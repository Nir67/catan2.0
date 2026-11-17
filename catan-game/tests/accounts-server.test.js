import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { io } from "socket.io-client";
import { VERTICES } from "../shared/engine.js";
const password = "sailing through the islands";
const wait = async (fn) => {
  const deadline = Date.now() + 10000;
  while (!fn()) {
    if (Date.now() > deadline) throw Error("state timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
test(
  "accounts: lobby upgrade, auth boundaries, cross-device seat recovery, atomic awards, replay and restart",
  { timeout: 60000 },
  async () => {
    await mkdir(".data", { recursive: true });
    const dir = await mkdtemp(join(process.cwd(), ".data/accounts-test-")),
      file = join(dir, "rooms.json"),
      port = 43000 + Math.floor(Math.random() * 5000),
      clients = [];
    let server;
    async function start() {
      server = spawn(process.execPath, ["server.js"], {
        env: { ...process.env, PORT: String(port), CATAN_DATA_FILE: file },
        stdio: ["ignore", "pipe", "inherit"],
        windowsHide: true,
      });
      await Promise.race([
        once(server.stdout, "data"),
        once(server, "exit").then(() => {
          throw Error("server exited");
        }),
      ]);
    }
    async function stop() {
      clients.forEach((c) => c.socket.disconnect());
      const done = once(server, "exit");
      server.kill();
      await done;
    }
    async function connect(accountToken, token = randomUUID()) {
      const c = {
        token,
        accountToken,
        id: null,
        profile: null,
        room: null,
        game: null,
        socket: io(`http://127.0.0.1:${port}`, {
          auth: { token, accountToken },
          autoConnect: false,
          reconnection: false,
        }),
      };
      c.socket.on("identity", (v) => (c.id = v));
      c.socket.on("account-state", (v) => (c.profile = v));
      c.socket.on("room-state", (v) => (c.room = v));
      c.socket.on("game-state", (v) => (c.game = v));
      c.socket.on("room-left", () => {
        c.room = null;
        c.game = null;
      });
      clients.push(c);
      c.socket.connect();
      await once(c.socket, "connect");
      await wait(() => c.id);
      return c;
    }
    const request = (c, event, data = {}) =>
      new Promise((resolve, reject) =>
        c.socket
          .timeout(15000)
          .emit(event, data, (error, result) =>
            error ? reject(error) : resolve(result),
          ),
      );
    async function register(c, name) {
      const r = await request(c, "register", {
        username: name,
        password,
        displayName: name,
      });
      assert.equal(r.success, true, r.message);
      c.accountToken = r.accountToken;
      await wait(() => c.profile);
      return r;
    }
    try {
      await start();
      const a = await connect(),
        b = await connect(),
        c = await connect(),
        outsider = await connect();
      assert.equal(
        (await request(a, "create-room", { playerName: "guest" })).success,
        true,
      );
      await wait(() => a.room);
      const code = a.room.roomCode,
        guestId = a.id;
      await register(a, "alice");
      assert.notEqual(a.id, guestId);
      assert.equal(a.room.hostId, a.id);
      assert.equal(a.room.roomCode, code);
      const oldGuest = await connect(undefined, a.token);
      assert.notEqual(oldGuest.id, a.id);
      assert.equal(oldGuest.profile, null);
      assert.equal(
        oldGuest.room,
        null,
        "guest token cannot recover account seat",
      );
      await register(b, "bobby");
      assert.equal(
        (
          await request(b, "join-room", {
            roomCode: code,
            playerName: "spoofed-name",
          })
        ).success,
        true,
      );
      assert.equal(
        (await request(c, "join-room", { roomCode: code, playerName: "carol" }))
          .success,
        true,
      );
      await register(c, "carol");
      await wait(() => a.room.ranked);
      assert.equal(
        (
          await request(outsider, "login", {
            username: "alice",
            password: "wrong",
          })
        ).success,
        false,
      );
      assert.equal(
        (
          await request(outsider, "register", {
            username: "ALICE",
            password,
            displayName: "fake",
          })
        ).success,
        false,
      );
      assert.equal(
        (
          await request(outsider, "join-room", {
            roomCode: code,
            playerName: "guest-seat",
          })
        ).success,
        true,
      );
      assert.equal(
        (await request(outsider, "login", { username: "alice", password }))
          .success,
        false,
        "a guest seat cannot duplicate an existing account seat in the same room",
      );
      assert.equal(new Set(a.room.players.map((p) => p.id)).size, 4);
      assert.equal((await request(outsider, "leave-room")).success, true);
      assert.equal((await request(a, "start-game")).success, true);
      await wait(() => a.game);
      const recovered = await connect(a.accountToken);
      assert.equal(recovered.id, a.id);
      assert.equal(recovered.game.players[0].id, a.id);
      assert.equal(
        (
          await request(recovered, "join-room", {
            roomCode: code,
            playerName: "duplicate",
          })
        ).success,
        true,
      );
      assert.equal(recovered.room.players.length, 3);
      assert.equal(
        (
          await request(outsider, "game-action", {
            type: "award-points",
            points: 99999,
            playerId: a.id,
          })
        ).success,
        false,
      );
      // Seed a legal near-victory board to exercise the actual authoritative winning action.
      await stop();
      const saved = JSON.parse(await readFile(file, "utf8")),
        room = saved.rooms[0][1],
        g = room.game,
        chosen = [];
      for (const v of VERTICES)
        if (
          chosen.every(
            (other) => other.id !== v.id && !other.neighbors.includes(v.id),
          )
        ) {
          chosen.push(v);
          if (chosen.length === 6) break;
        }
      g.buildings = chosen.map((v, i) => ({
        vertexId: v.id,
        playerId: a.id,
        color: "blue",
        type: i < 3 ? "city" : "settlement",
      }));
      g.stage = "action";
      g.currentPlayerIndex = 0;
      g.hasRolled = true;
      for (const r of ["stone", "wheat"]) {
        const n = r === "stone" ? 3 : 2;
        g.bank[r] += g.players[0].resources[r] - n;
        g.players[0].resources[r] = n;
      }
      await writeFile(file, JSON.stringify(saved));
      await start();
      const winner = await connect(a.accountToken),
        loser = await connect(b.accountToken);
      const result = await request(winner, "game-action", {
        type: "build-city",
        vertexId: chosen[3].id,
      });
      assert.equal(result.success, true, result.message);
      await wait(
        () => winner.profile?.points === 100 && loser.profile?.points === 20,
      );
      assert.equal(winner.game.winner, winner.id);
      assert.equal(winner.profile.wins, 1);
      assert.equal(loser.profile.wins, 0);
      assert.equal(winner.profile.history.length, 1);
      assert.equal(
        (
          await request(winner, "game-action", {
            type: "build-city",
            vertexId: chosen[3].id,
          })
        ).success,
        false,
      );
      assert.equal(winner.profile.points, 100);
      const leaders = await request(loser, "get-leaderboard");
      assert.equal(leaders.leaders[0].username, "alice");
      assert.equal(leaders.leaders[0].points, 100);
      assert.ok(!JSON.stringify(leaders).includes("passwordHash"));
      await stop();
      const persisted = await readFile(file, "utf8");
      assert.ok(!persisted.includes(password));
      assert.ok(!persisted.includes(a.accountToken));
      await start();
      const restored = await connect(a.accountToken);
      assert.equal(restored.profile.points, 100);
      assert.equal(restored.profile.played, 1);
      const sameSession = await connect(a.accountToken);
      assert.equal((await request(restored, "logout")).success, true);
      await wait(() => sameSession.profile === null);
      const revoked = await connect(a.accountToken);
      assert.equal(revoked.profile, null);
      assert.notEqual(revoked.id, a.id);
      const login = await request(revoked, "login", {
        username: "ALICE",
        password,
      });
      assert.equal(login.success, true, login.message);
      assert.equal(login.profile.points, 100);
      assert.notEqual(login.accountToken, a.accountToken);
    } finally {
      clients.forEach((c) => c.socket.disconnect());
      if (server?.exitCode === null) {
        const done = once(server, "exit");
        server.kill();
        await done;
      }
      await rm(dir, { recursive: true, force: true });
    }
  },
);
