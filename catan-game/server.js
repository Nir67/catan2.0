import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createGame, applyAction, viewFor, COLORS } from "./shared/engine.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 16_384,
  cors: { origin: process.env.CLIENT_ORIGIN?.split(",") || true },
});
const dataFile =
  process.env.CATAN_DATA_FILE ||
  resolve(dirname(fileURLToPath(import.meta.url)), ".data/rooms.json");
let rooms = new Map(),
  identities = new Map();
try {
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  if (data.version !== 1) throw new Error("Unsupported save version");
  rooms = new Map(data.rooms);
  identities = new Map(data.identities);
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error(
      "Cannot read saved games. Refusing to overwrite them.",
      error,
    );
    process.exit(1);
  }
}
function persist() {
  mkdirSync(dirname(dataFile), { recursive: true });
  writeFileSync(
    `${dataFile}.tmp`,
    JSON.stringify({
      version: 1,
      rooms: [...rooms],
      identities: [...identities],
    }),
    { mode: 0o600 },
  );
  renameSync(`${dataFile}.tmp`, dataFile);
}
const online = (id) =>
  [...io.sockets.sockets.values()].some((s) => s.data.playerId === id);
const codeOf = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
function roomFor(socket) {
  const entry = [...rooms].find(([, r]) =>
    r.players.some((p) => p.id === socket.data.playerId),
  );
  assert(entry, "אינך שייך לחדר");
  return entry;
}
function emitRoom(code, room) {
  const lobby = {
    roomCode: code,
    hostId: room.hostId,
    players: room.players.map((p, i) => ({
      ...p,
      color: COLORS[i],
      online: online(p.id),
    })),
    started: !!room.game,
    mode: room.mode || "base",
  };
  for (const socket of io.sockets.sockets.values())
    if (room.players.some((p) => p.id === socket.data.playerId)) {
      socket.emit("room-state", lobby);
      if (room.game)
        socket.emit("game-state", viewFor(room.game, socket.data.playerId));
    }
}
function saveRoom(code, next) {
  const old = rooms.get(code);
  rooms.set(code, next);
  try {
    persist();
  } catch (error) {
    if (old) rooms.set(code, old);
    else rooms.delete(code);
    throw error;
  }
  emitRoom(code, next);
}
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token))
    return next(new Error("מזהה חיבור חסר — רענן את הדף"));
  let id = identities.get(token);
  if (!id) {
    id = randomUUID();
    identities.set(token, id);
  }
  socket.data.playerId = id;
  next();
});
io.on("connection", (socket) => {
  let windowStart = Date.now(),
    requestCount = 0;
  function on(event, handler) {
    socket.on(event, (data, ack) => {
      if (typeof ack !== "function") return;
      if (Date.now() - windowStart > 10_000) {
        windowStart = Date.now();
        requestCount = 0;
      }
      if (++requestCount > 120) {
        ack({ success: false, message: "יותר מדי פעולות — המתן רגע" });
        return;
      }
      try {
        const result = handler(data || {});
        ack({ success: true, ...result });
      } catch (error) {
        console.error(event, error.message);
        ack({
          success: false,
          message: error.code ? "לא ניתן לשמור את המשחק כרגע" : error.message,
        });
      }
    });
  }
  socket.emit("identity", socket.data.playerId);
  const current = [...rooms].find(([, r]) =>
    r.players.some((p) => p.id === socket.data.playerId),
  );
  if (current) emitRoom(...current);
  on("resume", () => {
    const entry = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === socket.data.playerId),
    );
    if (entry) emitRoom(...entry);
    return { playerId: socket.data.playerId };
  });
  on("create-room", ({ playerName, mode = "base" }) => {
    assert(
      ![...rooms.values()].some((r) =>
        r.players.some((p) => p.id === socket.data.playerId),
      ),
      "כבר הצטרפת לחדר",
    );
    assert(["base", "cities-knights"].includes(mode), "מצב משחק לא חוקי");
    const name = String(playerName || "").trim();
    assert(name.length > 0 && name.length <= 30, "כתוב שם באורך 1–30 תווים");
    assert(rooms.size < 500, "השרת מלא כרגע");
    let code;
    do {
      code = randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
    } while (rooms.has(code));
    saveRoom(code, {
      hostId: socket.data.playerId,
      players: [{ id: socket.data.playerId, name }],
      game: null,
      mode,
    });
    return { roomCode: code };
  });
  on("join-room", ({ roomCode, playerName }) => {
    const code = codeOf(roomCode),
      room = rooms.get(code);
    assert(room, "החדר לא נמצא");
    const entry = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === socket.data.playerId),
    );
    if (entry) {
      assert(entry[0] === code, "כבר הצטרפת לחדר אחר");
      emitRoom(code, room);
      return {};
    }
    assert(!room.game, "המשחק כבר התחיל");
    assert(room.players.length < 4, "החדר מלא");
    const name = String(playerName || "").trim();
    assert(name.length > 0 && name.length <= 30, "כתוב שם באורך 1–30 תווים");
    saveRoom(code, {
      ...room,
      players: [...room.players, { id: socket.data.playerId, name }],
    });
    return {};
  });
  on("set-mode", ({ mode }) => {
    const [code, room] = roomFor(socket);
    assert(
      room.hostId === socket.data.playerId && !room.game,
      "רק המארח יכול לשנות מצב לפני תחילת המשחק",
    );
    assert(["base", "cities-knights"].includes(mode), "מצב משחק לא חוקי");
    saveRoom(code, { ...room, mode });
    return {};
  });
  on("start-game", () => {
    const [code, room] = roomFor(socket);
    assert(room.hostId === socket.data.playerId, "רק המארח יכול להתחיל");
    assert(!room.game, "המשחק כבר התחיל");
    assert(
      room.players.every((p) => online(p.id)),
      "כל השחקנים צריכים להיות מחוברים",
    );
    saveRoom(code, {
      ...room,
      game: createGame(room.players, Math.random, {
        mode: room.mode || "base",
      }),
    });
    return {};
  });
  on("game-action", (action) => {
    const [code, room] = roomFor(socket);
    assert(room.game, "המשחק עוד לא התחיל");
    saveRoom(code, {
      ...room,
      game: applyAction(room.game, socket.data.playerId, action),
    });
    return {};
  });
  on("leave-room", () => {
    const [code, room] = roomFor(socket);
    assert(
      !room.game || room.game.winner,
      "במשחק פעיל המקום שלך נשמר; אפשר לחזור ברענון עם אותו דפדפן",
    );
    const players = room.players.filter((p) => p.id !== socket.data.playerId);
    if (players.length)
      saveRoom(code, {
        ...room,
        players,
        hostId: players.some((p) => p.id === room.hostId)
          ? room.hostId
          : players[0].id,
      });
    else {
      rooms.delete(code);
      persist();
    }
    socket.emit("room-left");
    return {};
  });
  socket.on("disconnect", () => {
    const entry = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === socket.data.playerId),
    );
    if (entry) emitRoom(...entry);
  });
});
app.get("/", (_req, res) =>
  res.json({ status: "ok", game: "CATAN base game" }),
);
httpServer.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log("CATAN server ready"),
);
