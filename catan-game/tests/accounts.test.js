import test from "node:test";
import assert from "node:assert/strict";
import { Accounts } from "../accounts.js";
const password = "abcdef";
const user = (store, name) =>
  store.register(
    { key: name, username: name, salt: "test", passwordHash: "0".repeat(128) },
    name,
  );
function room(store, id = "match-one") {
  const users = ["alice", "bob", "carol"].map(
    (n) => store.state.users.find((u) => u.username === n) || user(store, n),
  );
  return {
    matchId: id,
    ranked: true,
    players: users.map((u) => ({
      id: u.id,
      accountId: u.id,
      name: u.displayName,
    })),
    game: { winner: users[0].id, mode: "cities-knights", seafarers: true },
  };
}
test("scrypt credentials use random salts, case-insensitive unique names, generic login failure and private profiles", async () => {
  const store = new Accounts();
  await assert.rejects(() => store.credentials("abc", "short", true, "a"));
  await assert.rejects(() =>
    store.credentials("bad name", password, true, "a"),
  );
  const credentials = await store.credentials("Alice", password, true, "a"),
    u = store.register(credentials, "אליס");
  const second = await store.credentials("Bobby", password, true, "b");
  assert.notEqual(credentials.salt, second.salt);
  assert.notEqual(credentials.passwordHash, second.passwordHash);
  assert.equal(credentials.passwordHash.length, 128);
  assert.equal(
    (await store.credentials("ALICE", password, false, "a")).id,
    u.id,
  );
  await assert.rejects(() => store.credentials("alice", password, true, "a"));
  const errors = [];
  for (const [name, pass] of [
    ["alice", "wrong"],
    ["missing", "wrong"],
  ])
    try {
      await store.credentials(name, pass, false, "a");
    } catch (e) {
      errors.push(e.message);
    }
  assert.equal(errors[0], errors[1]);
  const profile = JSON.stringify(store.profile(u.id));
  for (const secret of [
    "passwordHash",
    "salt",
    password,
    credentials.passwordHash,
  ])
    assert.ok(!profile.includes(secret));
});
test("sessions are random, stored only as hashes, expire, rotate and revoke independently", () => {
  const store = new Accounts(),
    u = user(store, "alice"),
    one = store.issue(u.id),
    two = store.issue(u.id);
  assert.notEqual(one.token, two.token);
  assert.ok(!JSON.stringify(store.state).includes(one.token));
  assert.equal(store.session(one.token).userId, u.id);
  const rotated = store.issue(u.id, one.hash);
  assert.equal(store.session(one.token), null);
  assert.ok(store.session(two.token));
  assert.ok(store.session(rotated.token));
  store.revoke(two.hash);
  assert.equal(store.session(two.token), null);
  store.state.sessions[0].expiresAt = Date.now() - 1;
  assert.equal(store.session(rotated.token), null);
  assert.equal(store.session("bad-token"), null);
});
test("login rate limits persist across socket reconnect attempts by address", () => {
  const store = new Accounts();
  for (let i = 0; i < 20; i++) store.limit("same-ip");
  assert.throws(() => store.limit("same-ip"), /15/);
  store.limit("other-ip");
  store.inFlight = 2;
  assert.throws(() => store.limit("third-ip"));
});
test("win/completion awards are exactly once, survive restart and allow guests but reject duplicate seats", () => {
  const store = new Accounts(),
    match = room(store);
  assert.equal(
    store.award(match, () => 13),
    true,
  );
  assert.equal(store.profile(match.players[0].id).points, 100);
  assert.equal(store.profile(match.players[1].id).points, 20);
  assert.equal(store.profile(match.players[0].id).wins, 1);
  assert.equal(store.profile(match.players[1].id).wins, 0);
  assert.equal(store.profile(match.players[0].id).history[0].finalScore, 13);
  assert.equal(
    store.award(match, () => 13),
    false,
  );
  const restored = new Accounts(JSON.parse(JSON.stringify(store.state))),
    replay = { ...match, rewardsGranted: false };
  assert.equal(
    restored.award(replay, () => 99),
    false,
  );
  const casual = room(restored, "casual");
  casual.ranked = false;
  assert.equal(
    restored.award(casual, () => 10),
    false,
  );
  const duplicate = room(restored, "duplicate");
  duplicate.players[1] = duplicate.players[0];
  assert.equal(
    restored.award(duplicate, () => 10),
    false,
  );
  const guest = room(restored, "guest");
  guest.players[2].accountId = null;
  assert.equal(
    restored.award(guest, () => 10),
    true,
  );
  assert.equal(restored.profile(match.players[0].id).points, 200);
  assert.equal(guest.rewards[2].registered, false);
  assert.equal(guest.rewards[2].earned, 20);
});
test("levels, achievement milestones, streak reset, leaderboard ordering and bounded history", () => {
  const store = new Accounts();
  let match;
  for (let i = 0; i < 32; i++) {
    match = room(store, `match-${i}`);
    store.award(match, () => 10);
  }
  const p = store.profile(match.players[0].id);
  assert.equal(p.level, 17);
  assert.equal(p.played, 32);
  assert.equal(p.wins, 32);
  assert.equal(p.bestStreak, 32);
  assert.equal(p.history.length, 30);
  assert.equal(p.achievements.length, 5);
  assert.equal(p.winRate, 100);
  assert.equal(store.leaderboard()[0].username, "alice");
  assert.equal(store.leaderboard()[0].points, 3200);
  const loss = room(store, "loss");
  loss.game.winner = loss.players[1].id;
  store.award(loss, () => 10);
  assert.equal(store.profile(p.id).streak, 0);
  assert.equal(store.profile(p.id).bestStreak, 32);
});

test("ranked guest-only matches get one result ledger without creating fake accounts", () => {
  const store = new Accounts(),
    match = {
      matchId: "guest-only",
      ranked: true,
      players: ["one", "two", "three"].map((id) => ({
        id,
        name: id,
        accountId: null,
      })),
      game: { winner: "one", mode: "base" },
    };
  assert.equal(
    store.award(match, (_game, id) => (id === "one" ? 10 : 5)),
    true,
  );
  assert.deepEqual(
    match.rewards.map((p) => p.earned),
    [100, 20, 20],
  );
  assert.ok(match.rewards.every((p) => !p.registered));
  assert.equal(store.state.users.length, 0);
  assert.equal(
    store.award({ ...match, rewardsGranted: false }, () => 10),
    false,
  );
  assert.deepEqual(store.leaderboard(), []);
});
test("a guest can win a ranked mixed match; signed-in finishers still receive their twenty points", () => {
  const store = new Accounts(),
    match = room(store, "mixed-guest-winner"),
    registered = match.players[1].id,
    other = match.players[2].id;
  match.players[0] = { id: "guest-winner", accountId: null, name: "Guest" };
  match.game.winner = "guest-winner";
  assert.equal(
    store.award(match, () => 10),
    true,
  );
  assert.equal(store.profile(registered).points, 20);
  assert.equal(store.profile(other).points, 20);
  assert.equal(store.profile(registered).played, 1);
  assert.equal(store.profile(registered).wins, 0);
  assert.equal(match.rewards[0].earned, 100);
  assert.equal(match.rewards[0].registered, false);
  const forged = room(store, "forged");
  forged.players[0].accountId = "missing-account";
  assert.equal(
    store.award(forged, () => 10),
    false,
  );
});
