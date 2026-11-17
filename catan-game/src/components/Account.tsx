import { useState, useEffect } from "react";
import { socket, saveAccountToken } from "../socket";
import "./Account.css";
export type Profile = {
  id: string;
  username: string;
  displayName: string;
  joinedAt: string;
  points: number;
  played: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  level: number;
  levelProgress: number;
  winRate: number;
  achievements: string[];
  history: {
    matchId: string;
    finishedAt: string;
    won: boolean;
    earned: number;
    finalScore: number;
    mode: string;
    seafarers: boolean;
    opponents: string[];
  }[];
};
type Leader = {
  rank: number;
  username: string;
  displayName: string;
  points: number;
  wins: number;
  played: number;
  level: number;
};
type Reply = {
  success: boolean;
  message?: string;
  accountToken?: string;
  leaders?: Leader[];
};
const badges: Record<string, [string, string]> = {
  "first-game": ["המסע התחיל", "סיום משחק מדורג ראשון"],
  "first-win": ["מנצח האי", "ניצחון ראשון"],
  "five-wins": ["בונה אימפריה", "חמישה ניצחונות"],
  "ten-games": ["ותיק קטאן", "עשרה משחקים מדורגים"],
  "hat-trick": ["רצף מנצח", "שלושה ניצחונות ברצף"],
};
export function AccountCenter({
  profile,
  connected,
  inGame,
}: {
  profile: Profile | null;
  connected: boolean;
  inGame: boolean;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<"login" | "register" | "profile" | "leaders">(
      "login",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [username, setUsername] = useState(""),
    [displayName, setDisplayName] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [leaders, setLeaders] = useState<Leader[]>([]);
  useEffect(() => {
    const update = (value: typeof leaders) => setLeaders(value);
    socket.on("leaderboard-state", update);
    return () => {
      socket.off("leaderboard-state", update);
    };
  }, []);
  async function request(event: string, data: unknown): Promise<Reply> {
    return new Promise((resolve) =>
      socket
        .timeout(15000)
        .emit(event, data, (timeout: Error | null, reply: Reply) =>
          resolve(
            timeout
              ? {
                  success: false,
                  message: "לא התקבל אישור. נסה שוב לאחר חידוש החיבור.",
                }
              : reply,
          ),
        ),
    );
  }
  function close() {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError("");
  }
  async function showLeaderboard() {
    setTab("leaders");
    setOpen(true);
    setError("");
    setBusy(true);
    const r = await request("get-leaderboard", {});
    if (r.success) setLeaders(r.leaders || []);
    else setError(r.message || "לא ניתן לטעון דירוג");
    setBusy(false);
  }
  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (tab === "register" && password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setBusy(true);
    const r = await request(tab === "register" ? "register" : "login", {
      username,
      password,
      displayName,
    });
    if (r.success && r.accountToken) {
      saveAccountToken(r.accountToken);
      setPassword("");
      setConfirm("");
      setTab("profile");
    } else setError(r.message || "ההתחברות נכשלה");
    setBusy(false);
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await request("logout", {});
    if (r.success) {
      saveAccountToken(null);
      close();
      setTab("login");
    } else setError(r.message || "ההתנתקות נכשלה");
    setBusy(false);
  }
  return (
    <section className="account-center" aria-label="חשבון ודירוג">
      <div className="account-strip">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">
            {profile ? profile.displayName.slice(0, 1) : "♟"}
          </span>
          <span>
            <strong>{profile ? profile.displayName : "משחקים כאורח"}</strong>
            <small>
              {profile
                ? `רמה ${profile.level} · ${profile.points.toLocaleString("he-IL")} נקודות · ${profile.wins} ניצחונות`
                : "פתח חשבון ושמור את ההתקדמות שלך"}
            </small>
          </span>
        </div>
        <div className="button-row">
          <button
            disabled={!connected || busy}
            onClick={() => {
              setError("");
              setTab(profile ? "profile" : "login");
              setOpen(!open);
            }}
          >
            {profile ? "הפרופיל שלי" : "התחברות / הרשמה"}
          </button>
          <button disabled={!connected || busy} onClick={showLeaderboard}>
            טבלת המובילים
          </button>
        </div>
      </div>
      {open && (
        <div className="account-content">
          <div className="account-heading">
            <h2>
              {tab === "leaders"
                ? "טבלת המובילים"
                : profile
                  ? "המסע שלך בקטאן"
                  : tab === "register"
                    ? "יוצרים חשבון"
                    : "ברוך שובך לאי"}
            </h2>
            <button className="quiet" aria-label="סגור חשבון" onClick={close}>
              ×
            </button>
          </div>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          {tab === "leaders" ? (
            <>
              {busy ? (
                <p role="status">טוענים דירוג…</p>
              ) : !leaders.length ? (
                <p>
                  הדירוג מחכה למנצחים הראשונים. סיימו משחק שבו כולם מחוברים
                  לחשבון!
                </p>
              ) : (
                <div className="leader-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>מקום</th>
                        <th>שחקן</th>
                        <th>נקודות</th>
                        <th>ניצחונות</th>
                        <th>משחקים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((l) => (
                        <tr
                          key={l.username}
                          className={
                            l.username === profile?.username ? "my-rank" : ""
                          }
                        >
                          <td>{l.rank}</td>
                          <td>
                            <strong>{l.displayName}</strong>
                            <small>
                              @{l.username} · רמה {l.level}
                            </small>
                          </td>
                          <td>{l.points}</td>
                          <td>{l.wins}</td>
                          <td>{l.played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : profile ? (
            <>
              <div className="profile-summary">
                <div>
                  <span className="eyebrow">רמה {profile.level}</span>
                  <h3>{profile.displayName}</h3>
                  <span className="muted">@{profile.username}</span>
                </div>
                <div className="profile-xp">
                  <strong>{profile.points.toLocaleString("he-IL")}</strong>
                  <span>נקודות מסע</span>
                  <progress
                    value={profile.levelProgress}
                    max={200}
                    aria-label="התקדמות לרמה הבאה"
                  />
                  <small>
                    עוד {200 - profile.levelProgress} נקודות לרמה{" "}
                    {profile.level + 1}
                  </small>
                </div>
              </div>
              <div className="profile-stats">
                <div>
                  <b>{profile.wins}</b>ניצחונות
                </div>
                <div>
                  <b>{profile.played}</b>משחקים מדורגים
                </div>
                <div>
                  <b>{profile.winRate}%</b>אחוז ניצחונות
                </div>
                <div>
                  <b>{profile.bestStreak}</b>רצף השיא
                </div>
              </div>
              <h3>הישגים</h3>
              <div className="achievement-list">
                {Object.entries(badges).map(([key, [title, detail]]) => (
                  <div
                    key={key}
                    className={
                      profile.achievements.includes(key)
                        ? "achievement earned"
                        : "achievement"
                    }
                  >
                    <strong>
                      {profile.achievements.includes(key) ? "◆" : "◇"} {title}
                    </strong>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
              <h3>המשחקים האחרונים</h3>
              {!profile.history.length ? (
                <p className="muted">
                  סיים משחק מדורג ראשון כדי להתחיל את המסע.
                </p>
              ) : (
                <ul className="match-history">
                  {profile.history.slice(0, 10).map((m) => (
                    <li key={m.matchId}>
                      <strong>
                        {m.won ? "ניצחון" : "המשחק הסתיים"}
                        <small>
                          {new Date(m.finishedAt).toLocaleDateString("he-IL", {
                            timeZone: "Asia/Jerusalem",
                          })}{" "}
                          ·{" "}
                          {m.mode === "cities-knights"
                            ? "ערים ואבירים"
                            : "בסיס"}
                          {m.seafarers ? " + יורדי הים" : ""}
                        </small>
                      </strong>
                      <span>{m.finalScore} נקודות במשחק</span>
                      <b>+{m.earned} נקודות מסע</b>
                    </li>
                  ))}
                </ul>
              )}
              <div className="button-row">
                <button disabled={busy || !connected} onClick={logout}>
                  התנתק מהחשבון
                </button>
              </div>
              {inGame && (
                <p className="muted">
                  המקום שלך נשמר בחשבון. אפשר להתחבר שוב גם ממכשיר אחר כדי לחזור
                  למשחק.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="account-tabs">
                <button
                  className={tab === "login" ? "selected" : ""}
                  disabled={busy}
                  onClick={() => {
                    setTab("login");
                    setError("");
                  }}
                >
                  התחברות
                </button>
                <button
                  className={tab === "register" ? "selected" : ""}
                  disabled={busy}
                  onClick={() => {
                    setTab("register");
                    setError("");
                  }}
                >
                  הרשמה
                </button>
              </div>
              {inGame ? (
                <p>
                  אפשר להמשיך כאורח במשחק הנוכחי. התחבר לחשבון לפני תחילת המשחק
                  הבא כדי לצבור נקודות.
                </p>
              ) : (
                <form className="account-form" onSubmit={authenticate}>
                  <label>
                    שם משתמש
                    <input
                      required
                      autoComplete="username"
                      value={username}
                      maxLength={24}
                      minLength={3}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  {tab === "register" && (
                    <label>
                      שם תצוגה
                      <input
                        required
                        autoComplete="nickname"
                        value={displayName}
                        maxLength={30}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                  )}
                  <label>
                    סיסמה
                    <input
                      required
                      type="password"
                      autoComplete={
                        tab === "register" ? "new-password" : "current-password"
                      }
                      minLength={tab === "register" ? 6 : 1}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  {tab === "register" && (
                    <>
                      <small>לפחות 6 תווים. אין חובה לאות גדולה, מספר או סימן מיוחד.</small>
                      <label>
                        אימות סיסמה
                        <input
                          required
                          type="password"
                          autoComplete="new-password"
                          maxLength={128}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          disabled={busy}
                        />
                      </label>
                    </>
                  )}
                  <button
                    className="primary"
                    disabled={busy || !connected}
                    type="submit"
                  >
                    {busy
                      ? "מתחברים…"
                      : tab === "register"
                        ? "צור חשבון"
                        : "התחבר לחשבון"}
                  </button>
                </form>
              )}
            </>
          )}
          <p className="account-rules">
            100 נקודות לניצחון · 20 לסיום משחק · רמה בכל 200 נקודות. משחק מדורג
            רק כשכל 3–4 השחקנים מחוברים לחשבונות שונים בתחילתו. הניקוד נקבע בשרת
            ומוענק פעם אחת בסיום.
          </p>
        </div>
      )}
    </section>
  );
}
