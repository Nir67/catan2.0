import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";

import { join } from "node:path";
import { io } from "socket.io-client";

const waitFor = async (predicate) => {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for state");
    await new Promise((r) => setTimeout(r, 20));
  }
};
const request = (client, event, data = {}) =>
  new Promise((resolve, reject) =>
    client.socket
      .timeout(5000)
      .emit(event, data, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  );
test(
  "three-player network flow, auth boundaries, reconnect, stable seats and disk recovery",
  { timeout: 30000 },
  async () => {
    await mkdir(".data", { recursive: true });
    const dir = await mkdtemp(join(process.cwd(), ".data/catan-test-")),
      dataFile = join(dir, "rooms.json");
    const port = 31000 + Math.floor(Math.random() * 10000);
    let server;
    const clients = [];
    async function start() {
      server = spawn(process.execPath, ["server.js"], {
        env: { ...process.env, PORT: String(port), CATAN_DATA_FILE: dataFile },
        stdio: ["ignore", "pipe", "inherit"],
        windowsHide: true,
      });
      await Promise.race([
        once(server.stdout, "data"),
        once(server, "exit").then(() => {
          throw new Error("Server exited early");
        }),
      ]);
    }
    async function connect(token = randomUUID()) {
      const client = {
        token,
        room: null,
        game: null,
        id: null,
        socket: io(`http://127.0.0.1:${port}`, {
          auth: { token },
          autoConnect: false,
          reconnection: false,
        }),
      };
      client.socket.on("identity", (id) => (client.id = id));
      client.socket.on("room-state", (r) => (client.room = r));
      client.socket.on("game-state", (g) => (client.game = g));
      clients.push(client);
      client.socket.connect();
      await once(client.socket, "connect");
      await waitFor(() => client.id);
      return client;
    }
    try {
      await start();
      const a = await connect(),
        b = await connect(),
        c = await connect(),
        outsider = await connect();
      const created = await request(a, "create-room", { playerName: "Alice" });
      assert.equal(created.success, true, created.message);
      await waitFor(() => a.room);
      const code = a.room.roomCode;
      assert.equal(
        (
          await request(b, "join-room", {
            roomCode: code.toLowerCase(),
            playerName: "Bob",
          })
        ).success,
        true,
      );
      assert.equal(
        (await request(a, "start-game")).success,
        false,
        "two-player basegame rejected",
      );
      assert.equal(
        (await request(c, "join-room", { roomCode: code, playerName: "Carol" }))
          .success,
        true,
      );
      assert.equal(
        (await request(b, "start-game")).success,
        false,
        "host authority",
      );
      assert.equal((await request(a, "start-game")).success, true);
      await waitFor(() => clients.slice(0, 3).every((c) => c.game));
      assert.equal(
        (await request(a, "start-game")).success,
        false,
        "start cannot reset ongoing game",
      );
      assert.equal(
        (
          await request(outsider, "game-action", {
            type: "roll-dice",
            roomCode: code,
          })
        ).success,
        false,
      );
      while (a.game.stage.startsWith("setup")) {
        const active = clients
            .slice(0, 3)
            .find((c) => c.id === a.game.players[a.game.currentPlayerIndex].id),
          revision = a.game.revision;
        await waitFor(() => active.game.revision === revision);
        const settlement = active.game.stage === "setup-settlement";
        const reply = await request(
          active,
          "game-action",
          settlement
            ? {
                type: "build-settlement",
                vertexId: active.game.legal.settlements[0],
              }
            : { type: "build-road", edgeId: active.game.legal.roads[0] },
        );
        assert.equal(reply.success, true, reply.message);
        await waitFor(() =>
          clients.slice(0, 3).every((c) => c.game.revision === revision + 1),
        );
      }
      assert.equal(a.game.buildings.length, 6);
      assert.equal(a.game.roads.length, 6);
      for (const c of clients.slice(0, 3)) {
        assert.ok(c.game.me);
        assert.ok(
          c.game.players.every(
            (p) => !("resources" in p) && !("development" in p),
          ),
        );
        assert.equal("deck" in c.game, false);
      }
      assert.equal(outsider.game, null);
      assert.equal(
        (await request(b, "game-action", { type: "roll-dice" })).success,
        false,
      );
      assert.equal(
        (await request(a, "game-action", { type: "roll-dice" })).success,
        true,
      );
      await waitFor(() => a.game.hasRolled && b.game.hasRolled);
      assert.deepEqual(a.game.dice, b.game.dice);
      const snapshot = structuredClone(a.game),
        id = a.id;
      a.socket.disconnect();
      const resumed = await connect(a.token);
      await request(resumed, "resume");
      await waitFor(() => resumed.game);
      assert.equal(resumed.id, id);
      assert.equal(resumed.game.players[0].color, "blue");
      assert.equal(resumed.game.revision, snapshot.revision);
      const saved = JSON.parse(await readFile(dataFile, "utf8"));
      assert.equal(saved.rooms[0][1].game.roads.length, 6);
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
      await start();
      const restored = await connect(a.token);
      await request(restored, "resume");
      await waitFor(() => restored.game);
      assert.equal(restored.id, id);
      assert.deepEqual(restored.game.dice, snapshot.dice);
      assert.equal(restored.game.revision, snapshot.revision);
    } finally {
      clients.forEach((c) => c.socket.disconnect());
      if (server?.exitCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
      await rm(dir, { recursive: true, force: true });
    }
  },
);
