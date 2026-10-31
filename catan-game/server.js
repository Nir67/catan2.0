import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3001;

const rooms = new Map();

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  do {
    code = "";

    for (let i = 0; i < 4; i++) {
      code += chars[
        Math.floor(Math.random() * chars.length)
      ];
    }
  } while (rooms.has(code));

  return code;
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || "")
    .trim()
    .toUpperCase();
}

function getCurrentPlayer(room) {
  if (!room.game) {
    return null;
  }

  return room.players[
    room.game.currentPlayerIndex
  ];
}

app.get("/", (_req, res) => {
  res.send("Catan server is running");
});

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // --------------------------------------------------
  // CREATE ROOM
  // --------------------------------------------------

  socket.on(
    "create-room",
    (playerName, callback) => {
      const name = String(playerName || "").trim();

      if (!name) {
        callback({
          success: false,
          message: "צריך לכתוב שם",
        });
        return;
      }

      const roomCode = createRoomCode();

      const player = {
        id: socket.id,
        name,
      };

      const room = {
        hostId: socket.id,
        players: [player],
        game: null,
      };

      rooms.set(roomCode, room);

      socket.join(roomCode);

      callback({
        success: true,
        roomCode,
        players: room.players,
      });

      console.log(
        "ROOM CREATED:",
        roomCode,
        room.players
      );
    }
  );

  // --------------------------------------------------
  // JOIN ROOM
  // --------------------------------------------------

  socket.on(
    "join-room",
    (
      { roomCode, playerName },
      callback
    ) => {
      const code =
        normalizeRoomCode(roomCode);

      const name =
        String(playerName || "").trim();

      const room = rooms.get(code);

      if (!room) {
        callback({
          success: false,
          message: "החדר לא נמצא",
        });
        return;
      }

      if (!name) {
        callback({
          success: false,
          message: "צריך לכתוב שם",
        });
        return;
      }

      if (room.game) {
        callback({
          success: false,
          message:
            "המשחק בחדר הזה כבר התחיל",
        });
        return;
      }

      if (room.players.length >= 4) {
        callback({
          success: false,
          message: "החדר מלא",
        });
        return;
      }

      const existingPlayer =
        room.players.find(
          (player) =>
            player.id === socket.id
        );

      if (!existingPlayer) {
        room.players.push({
          id: socket.id,
          name,
        });
      }

      socket.join(code);

      callback({
        success: true,
        roomCode: code,
        players: room.players,
      });

      io.to(code).emit(
        "players-updated",
        room.players
      );

      console.log(
        "PLAYER JOINED:",
        code,
        room.players
      );
    }
  );

  // --------------------------------------------------
  // START GAME
  // --------------------------------------------------

  socket.on(
    "start-game",
    ({ roomCode }, callback) => {
      const code =
        normalizeRoomCode(roomCode);

      const room = rooms.get(code);

      if (!room) {
        callback({
          success: false,
          message: "החדר לא נמצא",
        });
        return;
      }

      if (room.hostId !== socket.id) {
        callback({
          success: false,
          message:
            "רק יוצר החדר יכול להתחיל את המשחק",
        });
        return;
      }

      if (room.players.length < 2) {
        callback({
          success: false,
          message:
            "צריך לפחות שני שחקנים כדי להתחיל",
        });
        return;
      }

      room.game = {
        currentPlayerIndex: 0,
        dice: [1, 1],
        hasRolled: false,
        turnNumber: 1,
        roads: [],
        buildings: [],
      };

      callback({
        success: true,
        gameState: room.game,
      });

      // זה האירוע שה-App.tsx מחכה לו כדי לעבור למסך המשחק.
      io.to(code).emit(
        "game-started",
        room.game
      );

      // שולחים גם game-state כדי שכל הלקוחות יהיו מסונכרנים.
      io.to(code).emit(
        "game-state",
        room.game
      );

      console.log(
        "GAME STARTED:",
        code,
        room.game
      );
    }
  );

  // --------------------------------------------------
  // ROLL DICE
  // --------------------------------------------------

  socket.on(
    "roll-dice",
    ({ roomCode }, callback) => {
      const code =
        normalizeRoomCode(roomCode);

      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      const currentPlayer =
        getCurrentPlayer(room);

      if (
        currentPlayer?.id !== socket.id
      ) {
        callback({
          success: false,
          message: "זה לא התור שלך",
        });
        return;
      }

      if (room.game.hasRolled) {
        callback({
          success: false,
          message:
            "כבר גלגלת בתור הזה",
        });
        return;
      }

      const die1 =
        Math.floor(Math.random() * 6) + 1;

      const die2 =
        Math.floor(Math.random() * 6) + 1;

      room.game.dice = [die1, die2];
      room.game.hasRolled = true;

      io.to(code).emit(
        "game-state",
        room.game
      );

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // BUILD ROAD
  // --------------------------------------------------

  socket.on(
    "build-road",
    (
      { roomCode, edgeId },
      callback
    ) => {
      const code =
        normalizeRoomCode(roomCode);

      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      const playerIndex =
        room.players.findIndex(
          (player) =>
            player.id === socket.id
        );

      if (playerIndex === -1) {
        callback({
          success: false,
          message:
            "השחקן לא נמצא בחדר",
        });
        return;
      }

      if (
        room.game.currentPlayerIndex !==
        playerIndex
      ) {
        callback({
          success: false,
          message:
            "אפשר לבנות רק בתור שלך",
        });
        return;
      }

      if (!room.game.roads) {
        room.game.roads = [];
      }

      const alreadyBuilt =
        room.game.roads.some(
          (road) =>
            road.edgeId === edgeId
        );

      if (alreadyBuilt) {
        callback({
          success: false,
          message:
            "כבר יש דרך במקום הזה",
        });
        return;
      }

      const colors = [
        "blue",
        "red",
        "green",
        "yellow",
      ];

      room.game.roads.push({
        edgeId,
        color:
          colors[
            playerIndex %
              colors.length
          ],
      });

      io.to(code).emit(
        "game-state",
        room.game
      );

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // BUILD SETTLEMENT
  // --------------------------------------------------

  socket.on(
    "build-settlement",
    (
      { roomCode, vertexId },
      callback
    ) => {
      const code =
        normalizeRoomCode(roomCode);
      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      const playerIndex =
        room.players.findIndex(
          (player) =>
            player.id === socket.id
        );

      if (playerIndex === -1) {
        callback({
          success: false,
          message: "השחקן לא נמצא בחדר",
        });
        return;
      }

      if (
        room.game.currentPlayerIndex !==
        playerIndex
      ) {
        callback({
          success: false,
          message: "אפשר לבנות רק בתור שלך",
        });
        return;
      }

      if (!room.game.buildings) {
        room.game.buildings = [];
      }

      const occupied =
        room.game.buildings.some(
          (building) =>
            building.vertexId === vertexId
        );

      if (occupied) {
        callback({
          success: false,
          message: "כבר יש מבנה במקום הזה",
        });
        return;
      }

      const colors = [
        "blue",
        "red",
        "green",
        "yellow",
      ];

      room.game.buildings.push({
        vertexId,
        color:
          colors[
            playerIndex % colors.length
          ],
        type: "settlement",
      });

      io.to(code).emit(
        "game-state",
        room.game
      );

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // BUILD CITY
  // --------------------------------------------------

  socket.on(
    "build-city",
    (
      { roomCode, vertexId },
      callback
    ) => {
      const code =
        normalizeRoomCode(roomCode);
      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      const playerIndex =
        room.players.findIndex(
          (player) =>
            player.id === socket.id
        );

      if (playerIndex === -1) {
        callback({
          success: false,
          message: "השחקן לא נמצא בחדר",
        });
        return;
      }

      if (
        room.game.currentPlayerIndex !==
        playerIndex
      ) {
        callback({
          success: false,
          message: "אפשר לבנות רק בתור שלך",
        });
        return;
      }

      if (!room.game.buildings) {
        room.game.buildings = [];
      }

      const colors = [
        "blue",
        "red",
        "green",
        "yellow",
      ];

      const playerColor =
        colors[
          playerIndex % colors.length
        ];

      const settlement =
        room.game.buildings.find(
          (building) =>
            building.vertexId === vertexId &&
            building.color === playerColor &&
            building.type === "settlement"
        );

      if (!settlement) {
        callback({
          success: false,
          message:
            "עיר אפשר לבנות רק במקום של יישוב שלך",
        });
        return;
      }

      settlement.type = "city";

      io.to(code).emit(
        "game-state",
        room.game
      );

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // END TURN
  // --------------------------------------------------

  socket.on(
    "end-turn",
    ({ roomCode }, callback) => {
      const code =
        normalizeRoomCode(roomCode);

      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      const currentPlayer =
        getCurrentPlayer(room);

      if (
        currentPlayer?.id !== socket.id
      ) {
        callback({
          success: false,
          message: "זה לא התור שלך",
        });
        return;
      }

      if (!room.game.hasRolled) {
        callback({
          success: false,
          message:
            "צריך לגלגל לפני שמסיימים תור",
        });
        return;
      }

      room.game.currentPlayerIndex =
        (
          room.game.currentPlayerIndex + 1
        ) % room.players.length;

      room.game.hasRolled = false;
      room.game.turnNumber += 1;

      io.to(code).emit(
        "game-state",
        room.game
      );

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // GET GAME STATE
  // --------------------------------------------------

  socket.on(
    "get-game-state",
    ({ roomCode }, callback) => {
      const code =
        normalizeRoomCode(roomCode);

      const room = rooms.get(code);

      if (!room || !room.game) {
        callback({
          success: false,
          message: "המשחק לא נמצא",
        });
        return;
      }

      callback({
        success: true,
        gameState: room.game,
      });
    }
  );

  // --------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------

  socket.on("disconnect", () => {
    console.log(
      "DISCONNECTED:",
      socket.id
    );

    for (
      const [code, room]
      of rooms.entries()
    ) {
      const playerIndex =
        room.players.findIndex(
          (player) =>
            player.id === socket.id
        );

      if (playerIndex === -1) {
        continue;
      }

      room.players.splice(
        playerIndex,
        1
      );

      if (
        room.players.length === 0
      ) {
        rooms.delete(code);
        continue;
      }

      if (
        room.hostId === socket.id
      ) {
        room.hostId =
          room.players[0].id;
      }

      if (room.game) {
        if (
          room.game.currentPlayerIndex >=
          room.players.length
        ) {
          room.game.currentPlayerIndex = 0;
        }

        io.to(code).emit(
          "game-state",
          room.game
        );
      }

      io.to(code).emit(
        "players-updated",
        room.players
      );
    }
  });
});

httpServer.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Catan server running on port ${PORT}`
    );
  }
);
