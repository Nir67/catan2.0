import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const parameters = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const sessionHash = (token) => createHash("sha256").update(token).digest("hex");
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const normalize = (username) =>
  typeof username === "string"
    ? username.normalize("NFKC").trim().toLowerCase()
    : "";
export const newAccountState = () => ({
  users: [],
  sessions: [],
  awardedMatches: [],
});
export class Accounts {
  constructor(state = newAccountState()) {
    this.state = state;
    this.inFlight = 0;
    this.attempts = new Map();
  }
  user(id) {
    return this.state.users.find((u) => u.id === id);
  }
  profile(id) {
    const u = this.user(id);
    if (!u) return null;
    const { points, played, wins, streak, bestStreak } = u;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      joinedAt: u.joinedAt,
      points,
      played,
      wins,
      losses: played - wins,
      streak,
      bestStreak,
      level: 1 + Math.floor(points / 200),
      levelProgress: points % 200,
      winRate: played ? Math.round((wins / played) * 100) : 0,
      achievements: [
        ...(played >= 1 ? ["first-game"] : []),
        ...(wins >= 1 ? ["first-win"] : []),
        ...(wins >= 5 ? ["five-wins"] : []),
        ...(played >= 10 ? ["ten-games"] : []),
        ...(bestStreak >= 3 ? ["hat-trick"] : []),
      ],
      history: structuredClone(u.history),
    };
  }
  leaderboard() {
    return this.state.users
      .filter((u) => u.played > 0)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          a.joinedAt.localeCompare(b.joinedAt),
      )
      .slice(0, 25)
      .map((u, i) => ({
        rank: i + 1,
        username: u.username,
        displayName: u.displayName,
        points: u.points,
        wins: u.wins,
        played: u.played,
        level: 1 + Math.floor(u.points / 200),
      }));
  }
  limit(address) {
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.until < now) this.attempts.delete(key);
    const entry = this.attempts.get(address) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    check(
      ++entry.count <= 20,
      "יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות",
    );
    this.attempts.set(address, entry);
    check(this.inFlight < 2, "השרת מטפל בהתחברות אחרת. נסה שוב בעוד רגע");
  }
  async credentials(username, password, register, address) {
    this.limit(address);
    const key = normalize(username);
    check(
      typeof password === "string" && password.length <= 128,
      "שם משתמש או סיסמה לא תקינים",
    );
    if (register) {
      check(
        /^[\p{L}\p{N}_-]{3,24}$/u.test(key),
        "שם משתמש: 3–24 אותיות, ספרות, מקף או קו תחתון",
      );
      check(
        password.length >= 15,
        "בחר סיסמה באורך 15–128 תווים. אפשר להשתמש במשפט",
      );
      check(!this.state.users.some((u) => u.key === key), "שם המשתמש כבר תפוס");
    }
    const existing = this.state.users.find((u) => u.key === key),
      salt = register
        ? randomBytes(16).toString("hex")
        : existing?.salt || "00000000000000000000000000000000";
    this.inFlight++;
    try {
      const hash = await derive(password, salt, 64, parameters);
      if (!register)
        check(
          existing &&
            timingSafeEqual(hash, Buffer.from(existing.passwordHash, "hex")),
          "שם המשתמש או הסיסמה שגויים",
        );
      return register
        ? {
            key,
            username: username.normalize("NFKC").trim(),
            salt,
            passwordHash: hash.toString("hex"),
          }
        : existing;
    } finally {
      this.inFlight--;
    }
  }
  register(credentials, displayName) {
    check(
      !this.state.users.some((u) => u.key === credentials.key),
      "שם המשתמש כבר תפוס",
    );
    const name = typeof displayName === "string" ? displayName.trim() : "";
    check(
      name.length > 0 && name.length <= 30,
      "בחר שם תצוגה באורך 1–30 תווים",
    );
    const user = {
      ...credentials,
      id: randomUUID(),
      displayName: name,
      joinedAt: new Date().toISOString(),
      points: 0,
      played: 0,
      wins: 0,
      streak: 0,
      bestStreak: 0,
      history: [],
    };
    this.state.users.push(user);
    return user;
  }
  session(token) {
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
    return (
      this.state.sessions.find(
        (s) => s.hash === sessionHash(token) && s.expiresAt > Date.now(),
      ) || null
    );
  }
  issue(id, oldHash) {
    const now = Date.now();
    this.state.sessions = this.state.sessions.filter(
      (s) => s.expiresAt > now && s.hash !== oldHash,
    );
    // Keep at most ten independent device/tab sessions per account.
    const own = this.state.sessions.filter((s) => s.userId === id);
    while (own.length >= 10) {
      const oldest = own.shift();
      this.state.sessions = this.state.sessions.filter((s) => s !== oldest);
    }
    const token = randomBytes(32).toString("hex"),
      hash = sessionHash(token),
      expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    this.state.sessions.push({ hash, userId: id, expiresAt });
    return { token, hash };
  }
  valid(hash, id) {
    return this.state.sessions.some(
      (s) => s.hash === hash && s.userId === id && s.expiresAt > Date.now(),
    );
  }
  revoke(hash) {
    this.state.sessions = this.state.sessions.filter((s) => s.hash !== hash);
  }
  award(room, finalScore) {
    if (
      !room.ranked ||
      !room.matchId ||
      !room.game?.winner ||
      room.rewardsGranted ||
      this.state.awardedMatches.includes(room.matchId)
    )
      return false;
    const ids = room.players.map((p) => p.accountId);
    if (
      ids.length < 3 ||
      ids.length > 4 ||
      new Set(ids).size !== ids.length ||
      !room.players.every(
        (p) => p.id === p.accountId && this.user(p.accountId),
      ) ||
      !room.players.some((p) => p.id === room.game.winner)
    )
      return false;
    for (const p of room.players) {
      const u = this.user(p.accountId),
        won = p.id === room.game.winner,
        earned = won ? 100 : 20;
      u.played++;
      u.points += earned;
      if (won) {
        u.wins++;
        u.streak++;
      } else u.streak = 0;
      u.bestStreak = Math.max(u.bestStreak, u.streak);
      u.history.unshift({
        matchId: room.matchId,
        finishedAt: new Date().toISOString(),
        won,
        earned,
        finalScore: finalScore(room.game, p.id),
        mode: room.game.mode || "base",
        seafarers: !!room.game.seafarers,
        opponents: room.players
          .filter((other) => other.id !== p.id)
          .map((other) => other.name),
      });
      u.history = u.history.slice(0, 30);
    }
    this.state.awardedMatches.push(room.matchId);
    room.rewardsGranted = true;
    return true;
  }
}
