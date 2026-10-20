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

const rooms = new Map();

function createRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";

  let code = "";

  for (let i = 0; i < 2; i++) {
    code += letters[
      Math.floor(Math.random() * letters.length)
    ];
  }

  for (let i = 0; i < 2; i++) {
    code += numbers[
      Math.floor(Math.random() * numbers.length)
    ];
  }

  return code;
}

io.on("connection", (socket) => {
  socket.on("start-game", ({ roomCode }, callback) => {
    console.log("START GAME RECEIVED:", roomCode);
    socket.on("start-game", ({ roomCode }, callback) => {
  console.log("START GAME RECEIVED:", roomCode);

  const room = rooms.get(roomCode);

  if (!room) {
    callback({
      success: false,
      message: "החדר לא קיים",
    });
    return;
  }

  const host = room.players[0];

  if (host.id !== socket.id) {
    callback({
      success: false,
      message: "רק יוצר החדר יכול להתחיל",
    });
    return;
  }

  console.log("SENDING GAME STARTED");

  io.to(roomCode).emit("game-started");

  callback({
    success: true,
  });
});
  const room = rooms.get(roomCode);

  if (!room) {
    callback({
      success: false,
      message: "החדר לא קיים",
    });

    return;
  }

  const host = room.players[0];

  if (host.id !== socket.id) {
    callback({
      success: false,
      message: "רק יוצר החדר יכול להתחיל את המשחק",
    });

    return;
  }

  io.to(roomCode).emit("game-started");

  callback({
    success: true,
  });
});
  console.log("Player connected:", socket.id);

  socket.on("create-room", (playerName, callback) => {
    let roomCode = createRoomCode();

    while (rooms.has(roomCode)) {
      roomCode = createRoomCode();
    }

    const room = {
      players: [
        {
          id: socket.id,
          name: playerName,
        },
      ],
    };

    rooms.set(roomCode, room);

    socket.join(roomCode);

    console.log(
      `${playerName} created room ${roomCode}`
    );

    callback({
      success: true,
      roomCode,
      players: room.players,
    });
  });

  socket.on(
    "join-room",
    ({ roomCode, playerName }, callback) => {
      const room = rooms.get(roomCode);

      if (!room) {
        callback({
          success: false,
          message: "החדר לא קיים",
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

      room.players.push({
        id: socket.id,
        name: playerName,
      });

      socket.join(roomCode);

      io.to(roomCode).emit(
        "players-updated",
        room.players
      );

      console.log(
        `${playerName} joined room ${roomCode}`
      );

      callback({
        success: true,
        roomCode,
        players: room.players,
      });
    }
  );

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    for (const [roomCode, room] of rooms.entries()) {
      const oldLength = room.players.length;

      room.players = room.players.filter(
        (player) => player.id !== socket.id
      );

      if (room.players.length !== oldLength) {
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit(
            "players-updated",
            room.players
          );
        }
      }
    }
  });
});

httpServer.listen(3001, "0.0.0.0", () => {
  console.log("🎲 Catan server running on port 3001");
});