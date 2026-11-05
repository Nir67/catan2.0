import { useState } from "react";
import {
  boardFor,
  RESOURCES,
  emptyHand,
  total,
  canPay,
} from "../../shared/engine.js";
import type { View } from "../../shared/engine.js";
type Extras = { seafarers: boolean; friendlyRobber: boolean };
export function ExtraOptions({
  value,
  change,
  disabled,
}: {
  value: Extras;
  change: (value: Extras) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="extra-options" disabled={disabled}>
      <legend>הרחבות ותוספות</legend>
      <label>
        <input
          type="checkbox"
          checked={value.seafarers}
          onChange={(e) => change({ ...value, seafarers: e.target.checked })}
        />
        <span>
          <strong>יורדי הים</strong>
          <small>
            ספינות, פיראט, זהב ואיים חדשים · מפה מקורית · יעד 14 נקודות, או 17
            עם ערים ואבירים
          </small>
        </span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.friendlyRobber}
          onChange={(e) =>
            change({ ...value, friendlyRobber: e.target.checked })
          }
        />
        <span>
          <strong>השודד הידידותי</strong>
          <small>וריאנט: השודד לא עובר ליד שחקן עם שתי נקודות ומטה</small>
        </span>
      </label>
    </fieldset>
  );
}
export function SeafarersPanel({
  g,
  id,
  send,
  busy,
}: {
  g: View;
  id: string;
  send: (a: { type: string; [key: string]: unknown }) => void;
  busy: boolean;
}) {
  const [ship, setShip] = useState(""),
    [source, setSource] = useState(""),
    [destination, setDestination] = useState(""),
    [cards, setCards] = useState(emptyHand);
  const active = g.players[g.currentPlayerIndex].id === id,
    legal = g.seaLegal!,
    choice = g.goldChoice;
  const name = (e: string) => {
    const edge = boardFor(g).edges.find((x) => x.id === e)!;
    return `נתיב ${boardFor(g).edges.indexOf(edge) + 1} · צמתים ${edge.vertices.map((v) => boardFor(g).vertices.findIndex((x) => x.id === v) + 1).join("–")}`;
  };
  const names = {
    wood: "עץ",
    brick: "לבנים",
    sheep: "צמר",
    wheat: "חיטה",
    stone: "מחצבים",
  };
  const build =
    active && ["action", "setup-road", "road-building"].includes(g.stage);
  return (
    <section className="panel sea-panel">
      <span className="eyebrow">יורדי הים · {g.targetScore} נקודות</span>
      <h2>מפליגים לאיים חדשים</h2>
      <p>
        ספינות{" "}
        {g.roads.filter((r) => r.playerId === id && r.type === "ship").length}
        /15 · שני בונוסים לכל אי חדש שבו תקים יישוב.
      </p>
      <p className="muted">
        מפה מקורית לפי חוקי יורדי הים: אי מרכזי ושלושה איים קטנים. מתחילים רק
        באי המרכזי. דרך וספינה מתחברות דרך יישוב או עיר שלך.
      </p>
      {choice && (
        <div className="urgent">
          <h3>שדה זהב</h3>
          {choice.playerId === id ? (
            <>
              <p>בחר {choice.required} משאבים מהבנק.</p>
              <div className="choice-hand">
                {RESOURCES.map((r) => (
                  <label key={r}>
                    {names[r]}
                    <input
                      aria-label={`זהב ${names[r]}`}
                      type="number"
                      min={0}
                      max={g.bank[r]}
                      value={cards[r]}
                      onChange={(e) =>
                        setCards({
                          ...cards,
                          [r]: Math.max(
                            0,
                            Math.min(g.bank[r], Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                disabled={busy || total(cards) !== choice.required}
                onClick={() => {
                  send({ type: "choose-gold", cards });
                  setCards(emptyHand());
                }}
              >
                קבל משאבי זהב
              </button>
            </>
          ) : (
            <p>
              ממתינים לבחירת{" "}
              {g.players.find((p) => p.id === choice.playerId)?.name}
            </p>
          )}
        </div>
      )}
      <label>
        נתיב לספינה
        <select
          aria-label="נתיב לספינה"
          value={ship}
          onChange={(e) => setShip(e.target.value)}
        >
          <option value="">בחר נתיב…</option>
          {legal.ships.map((e) => (
            <option key={e} value={e}>
              {name(e)}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={
          busy ||
          !build ||
          !legal.ships.includes(ship) ||
          (g.stage === "action" &&
            !canPay(g.me.resources, { wood: 1, sheep: 1 }))
        }
        onClick={() => {
          send({ type: "build-ship", edgeId: ship });
          setShip("");
        }}
      >
        {g.stage === "setup-road" || g.stage === "road-building"
          ? "הצב ספינה בחינם"
          : "בנה ספינה · עץ + צמר"}
      </button>
      <details>
        <summary>הזזת ספינה</summary>
        <p className="muted">
          ניתן להזיז ספינת קצה פתוחה אחת מתור קודם. אי אפשר להזיז או לבנות ליד
          הפיראט.
        </p>
        <label>
          ספינה להזזה
          <select
            aria-label="ספינה להזזה"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">בחר ספינה…</option>
            {legal.movable.map((e) => (
              <option value={e} key={e}>
                {name(e)}
              </option>
            ))}
          </select>
        </label>
        <label>
          יעד לספינה
          <select
            aria-label="יעד לספינה"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">בחר יעד…</option>
            {boardFor(g)
              .edges.filter(
                (e) =>
                  e.tiles.some((i) => g.tiles[i].resource === "sea") &&
                  !g.roads.some((r) => r.edgeId === e.id),
              )
              .map((e) => (
                <option value={e.id} key={e.id}>
                  {name(e.id)}
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={
            busy || !active || g.stage !== "action" || !source || !destination
          }
          onClick={() => {
            send({ type: "move-ship", edgeId: source, destination });
            setSource("");
            setDestination("");
          }}
        >
          העבר ספינה
        </button>
      </details>
      {g.stage === "robber" && active && (
        <p>לחץ על משושה יבשה להזזת השודד, או על משושה ים להזזת הפיראט.</p>
      )}
    </section>
  );
}
