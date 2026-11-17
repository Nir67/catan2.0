import { Accounts, newAccountState } from "./accounts.js";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  createGame,
  applyAction,
  viewFor,
  COLORS,
  score,
} from "./shared/engine.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 16_384,
  cors: { origin: process.env.CLIENT_ORIGIN?.split(",") || true },
});
const dataFile =
  process.env.CATAN_DATA_FILE ||
  resolve(dirname(fileURLToPath(import.meta.url)), ".data/rooms.json");
const accounts = new Accounts();
let rooms = new Map(),
  identities = new Map();
try {
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  if (data.version !== 1) throw new Error("Unsupported save version");
  rooms = new Map(data.rooms);
  identities = new Map(data.identities);
  accounts.state = data.accounts || newAccountState();
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
      accounts: accounts.state,
    }),
    { mode: 0o600 },
  );
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(`${dataFile}.tmp`, dataFile);
      break;
    } catch (error) {
      // Windows scanners can briefly lock the destination between two saves.
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt >= 5)
        throw error;
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        20 * (attempt + 1),
      );
    }
  }
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
    r.players.some((p) => p.id === socket.data.playerId && !p.left),
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
      online: !p.left && online(p.id),
    })),
    started: !!room.game,
    ranked: !!room.ranked,
    rewards: room.rewards || [],
    mode: room.mode || "base",
    seafarers: !!room.seafarers,
    friendlyRobber: !!room.friendlyRobber,
  };
  for (const socket of io.sockets.sockets.values())
    if (
      validSocket(socket) &&
      room.players.some((p) => p.id === socket.data.playerId && !p.left)
    ) {
      socket.emit("room-state", lobby);
      if (room.game)
        socket.emit("game-state", viewFor(room.game, socket.data.playerId));
    }
}
function saveRoom(code, next) {
  const old = rooms.get(code),
    oldAccounts = structuredClone(accounts.state);
  let awarded;
  rooms.set(code, next);
  try {
    awarded = accounts.award(next, score);
    persist();
  } catch (error) {
    accounts.state = oldAccounts;
    if (old) rooms.set(code, old);
    else rooms.delete(code);
    throw error;
  }
  emitRoom(code, next);
  if (awarded) emitAccounts();
}

function validSocket(socket) {
  return (
    !socket.data.accountId ||
    accounts.valid(socket.data.sessionHash, socket.data.accountId)
  );
}
function resetSocket(socket) {
  socket.data.accountId = null;
  socket.data.sessionHash = null;
  socket.data.playerId = socket.data.guestId;
  socket.emit("room-left");
  socket.emit("identity", socket.data.playerId);
  socket.emit("account-state", null);
  const room = [...rooms].find(([, r]) =>
    r.players.some((p) => p.id === socket.data.playerId && !p.left),
  );
  if (room) emitRoom(...room);
}
function emitAccounts() {
  for (const peer of io.sockets.sockets.values())
    if (validSocket(peer))
      peer.emit("account-state", accounts.profile(peer.data.accountId));
  io.emit("leaderboard-state", accounts.leaderboard());
}
function accountTransaction(fn) {
  const oldState = structuredClone(accounts.state),
    oldRooms = new Map(rooms);
  try {
    const result = fn();
    persist();
    return result;
  } catch (error) {
    accounts.state = oldState;
    rooms = oldRooms;
    throw error;
  }
}
function authAllowed(socket) {
  const entry = [...rooms].find(([, r]) =>
    r.players.some((p) => p.id === socket.data.playerId && !p.left),
  );
  assert(!entry?.[1].game, "כדי להחליף חשבון יש לצאת מהחדר לאחר סיום המשחק");
  return entry;
}
async function authenticate(socket, data, register) {
  authAllowed(socket);
  socket.data.authBusy = true;
  try {
    const originalId = socket.data.playerId;
    const credentials = await accounts.credentials(
      data.username,
      data.password,
      register,
      socket.handshake.address,
    );
    assert(
      socket.connected && socket.data.playerId === originalId,
      "החיבור השתנה. נסה להתחבר מחדש",
    );
    const current = authAllowed(socket);
    let user, session;
    accountTransaction(() => {
      user = register
        ? accounts.register(credentials, data.displayName)
        : accounts.user(credentials.id);
      const existing = [...rooms].find(([, r]) =>
        r.players.some((p) => p.id === user.id && !p.left),
      );
      assert(
        !current || !existing || originalId === user.id,
        "החשבון כבר נמצא בחדר. צא ממושב האורח ואז התחבר כדי לחזור למושב החשבון",
      );
      if (current && originalId !== user.id) {
        const [code, r] = current;
        rooms.set(code, {
          ...r,
          hostId: r.hostId === originalId ? user.id : r.hostId,
          players: r.players.map((p) =>
            p.id === originalId
              ? {
                  ...p,
                  id: user.id,
                  accountId: user.id,
                  name: user.displayName,
                }
              : p,
          ),
        });
      }
      session = accounts.issue(user.id, socket.data.sessionHash);
    });
    socket.data.playerId = user.id;
    socket.data.accountId = user.id;
    socket.data.sessionHash = session.hash;
    socket.emit("room-left");
    socket.emit("identity", user.id);
    socket.emit("account-state", accounts.profile(user.id));
    const room = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === user.id),
    );
    if (room) emitRoom(...room);
    if (current && (!room || current[0] !== room[0]))
      emitRoom(current[0], rooms.get(current[0]));
    return { accountToken: session.token, profile: accounts.profile(user.id) };
  } finally {
    socket.data.authBusy = false;
  }
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
  socket.data.guestId = id;
  const session = accounts.session(socket.handshake.auth?.accountToken);
  socket.data.accountId = session?.userId || null;
  socket.data.sessionHash = session?.hash || null;
  socket.data.playerId = session?.userId || id;
  next();
});
io.on("connection", (socket) => {
  let windowStart = Date.now(),
    requestCount = 0;
  function on(event, handler) {
    socket.on(event, async (data, ack) => {
      if (typeof ack !== "function") return;
      if (socket.data.authBusy) {
        ack({ success: false, message: "ממתינים לסיום ההתחברות" });
        return;
      }
      if (!validSocket(socket)) resetSocket(socket);
      if (Date.now() - windowStart > 10_000) {
        windowStart = Date.now();
        requestCount = 0;
      }
      if (++requestCount > 120) {
        ack({ success: false, message: "יותר מדי פעולות — המתן רגע" });
        return;
      }
      try {
        const result = await handler(data || {});
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
  socket.emit("account-state", accounts.profile(socket.data.accountId));
  const current = [...rooms].find(([, r]) =>
    r.players.some((p) => p.id === socket.data.playerId && !p.left),
  );
  if (current) emitRoom(...current);
  on("get-leaderboard", () => ({ leaders: accounts.leaderboard() }));
  on("register", (data) => authenticate(socket, data, true));
  on("login", (data) => authenticate(socket, data, false));
  on("logout", () => {
    const hash = socket.data.sessionHash;
    accountTransaction(() => accounts.revoke(hash));
    for (const peer of io.sockets.sockets.values())
      if (peer.data.sessionHash === hash && hash) resetSocket(peer);
    return {};
  });
  on("resume", () => {
    const entry = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === socket.data.playerId && !p.left),
    );
    if (entry) emitRoom(...entry);
    socket.emit("account-state", accounts.profile(socket.data.accountId));
    return { playerId: socket.data.playerId };
  });
  on(
    "create-room",
    ({ playerName, mode = "base", seafarers = false, ranked = false }) => {
      assert(
        ![...rooms.values()].some((r) =>
          r.players.some((p) => p.id === socket.data.playerId && !p.left),
        ),
        "כבר הצטרפת לחדר",
      );
      assert(["base", "cities-knights"].includes(mode), "מצב משחק לא חוקי");
      assert(typeof ranked === "boolean", "בחר משחק מדורג או משחק חברים");
      const name =
        accounts.user(socket.data.accountId)?.displayName ||
        String(playerName || "").trim();
      assert(name.length > 0 && name.length <= 30, "כתוב שם באורך 1–30 תווים");
      assert(rooms.size < 500, "השרת מלא כרגע");
      let code;
      do {
        code = randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase();
      } while (rooms.has(code));
      saveRoom(code, {
        hostId: socket.data.playerId,
        players: [
          { id: socket.data.playerId, name, accountId: socket.data.accountId },
        ],
        game: null,
        ranked,
        mode,
        seafarers: !!seafarers,
        friendlyRobber: false,
      });
      return { roomCode: code };
    },
  );
  on("join-room", ({ roomCode, playerName }) => {
    const code = codeOf(roomCode),
      room = rooms.get(code);
    assert(room, "החדר לא נמצא");
    const entry = [...rooms].find(([, r]) =>
      r.players.some((p) => p.id === socket.data.playerId && !p.left),
    );
    if (entry) {
      assert(entry[0] === code, "כבר הצטרפת לחדר אחר");
      emitRoom(code, room);
      return {};
    }
    const returning = room.players.find(
      (p) => p.id === socket.data.playerId && p.left,
    );
    if (returning) {
      saveRoom(code, {
        ...room,
        players: room.players.map((p) =>
          p.id === returning.id ? { ...p, left: false } : p,
        ),
      });
      return {};
    }
    assert(!room.game, "המשחק כבר התחיל");
    assert(room.players.length < 4, "החדר מלא");
    const name =
      accounts.user(socket.data.accountId)?.displayName ||
      String(playerName || "").trim();
    assert(name.length > 0 && name.length <= 30, "כתוב שם באורך 1–30 תווים");
    saveRoom(code, {
      ...room,
      players: [
        ...room.players,
        { id: socket.data.playerId, name, accountId: socket.data.accountId },
      ],
    });
    return {};
  });
  on("set-mode", ({ mode, seafarers, ranked }) => {
    const [code, room] = roomFor(socket);
    assert(
      room.hostId === socket.data.playerId && !room.game,
      "רק המארח יכול לשנות מצב לפני תחילת המשחק",
    );
    assert(["base", "cities-knights"].includes(mode), "מצב משחק לא חוקי");
    assert(
      ranked === undefined || typeof ranked === "boolean",
      "בחר משחק מדורג או משחק חברים",
    );
    saveRoom(code, {
      ...room,
      mode,
      ranked: ranked === undefined ? !!room.ranked : ranked,
      seafarers: seafarers === undefined ? !!room.seafarers : !!seafarers,
      friendlyRobber: false,
    });
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
      matchId: randomUUID(),
      ranked: !!room.ranked,
      game: createGame(room.players, Math.random, {
        mode: room.mode || "base",
        seafarers: !!room.seafarers,
        friendlyRobber: false,
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
    if (room.game && !room.game.winner) {
      saveRoom(code, {
        ...room,
        players: room.players.map((p) =>
          p.id === socket.data.playerId ? { ...p, left: true } : p,
        ),
      });
      for (const peer of io.sockets.sockets.values())
        if (peer.data.playerId === socket.data.playerId) peer.emit("room-left");
      return {};
    }
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
      r.players.some((p) => p.id === socket.data.playerId && !p.left),
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
