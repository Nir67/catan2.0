import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { postgresStore } from "../storage.js";
test("PostgreSQL saves restore private game/account state and reject stale writers without overwriting", async () => {
  const db = new PGlite(),
    pool = { query: (sql, args) => db.query(sql, args), end: async () => {} };
  try {
    const first = await postgresStore(pool),
      second = await postgresStore(pool);
    assert.equal(await first.load(), null);
    assert.equal(await second.load(), null);
    const original = {
      version: 1,
      rooms: [["ROOM", { game: { revision: 9, privateHand: { stone: 3 } } }]],
      identities: [["guest-token", "player"]],
      accounts: {
        users: [{ passwordHash: "protected-hash", points: 100 }],
        sessions: [{ hash: "session-hash" }],
        awardedMatches: [],
      },
    };
    await first.save(original);
    await assert.rejects(second.save({ ...original, rooms: [] }), {
      code: "CATAN_STATE_CONFLICT",
    });
    assert.deepEqual(await second.load(), original);
    const next = structuredClone(original);
    next.accounts.users[0].points = 200;
    await second.save(next);
    await assert.rejects(first.save(original), {
      code: "CATAN_STATE_CONFLICT",
    });
    assert.deepEqual(await first.load(), next);
    const reopened = await postgresStore(pool);
    assert.deepEqual(await reopened.load(), next);
    const circular = {};
    circular.self = circular;
    await assert.rejects(reopened.save(circular));
    assert.deepEqual(await first.load(), next);
  } finally {
    await db.close();
  }
});
