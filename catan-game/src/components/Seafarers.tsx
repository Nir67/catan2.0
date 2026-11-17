import type { PickRequest } from "./Placement";
import { useState } from "react";
import { RESOURCES, emptyHand, total, canPay } from "../../shared/engine.js";
import type { View } from "../../shared/engine.js";
export function SeafarersPanel({
  g,
  id,
  busy,
  onPick,
}: {
  g: View;
  id: string;
  send: (a: { type: string; [key: string]: unknown }) => void;
  busy: boolean;
  onPick: (pick: PickRequest) => void;
}) {
  const active = g.players[g.currentPlayerIndex].id === id,
    legal = g.seaLegal!;
  const canBuild =
    active && ["action", "setup-road", "road-building"].includes(g.stage);
  return (
    <section className="panel sea-panel">
      <h2>
        ספינות{" "}
        <small>
          {g.roads.filter((r) => r.playerId === id && r.type === "ship").length}
          /15
        </small>
      </h2>
      <button
        className="primary"
        disabled={
          busy ||
          !canBuild ||
          !legal.ships.length ||
          (g.stage === "action" &&
            !canPay(g.me.resources, { wood: 1, sheep: 1 }))
        }
        onClick={() =>
          onPick({
            title: "בחר נתיב לספינה",
            action: { type: "build-ship" },
            field: "edgeId",
          })
        }
      >
        {g.stage === "setup-road" || g.stage === "road-building"
          ? "הצב ספינה בחינם"
          : "בנה ספינה · עץ + צמר"}
      </button>
      <button
        disabled={
          busy || !active || g.stage !== "action" || !legal.movable.length
        }
        onClick={() =>
          onPick({
            title: "בחר ספינה להזזה",
            action: { type: "select-ship-to-move" },
            field: "edgeId",
          })
        }
      >
        הזז ספינה על הלוח
      </button>
      <details className="compact-help">
        <summary>כללי הפלגה</summary>
        <p>
          ספינה מתחברת לספינות שלך, או ליישוב ולעיר שלך בחוף. אפשר להזיז ספינת
          קצה אחת מתור קודם; הפיראט חוסם נתיבים סמוכים.
        </p>
        <p>
          יישוב ראשון בכל אי חדש מעניק שתי נקודות בונוס. שדה זהב מעניק משאבים
          לבחירה.
        </p>
      </details>
    </section>
  );
}

export function GoldChoice({
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
  const [cards, setCards] = useState(emptyHand);
  const choice = g.goldChoice;
  const names = {
    wood: "עץ",
    brick: "לבנים",
    sheep: "צמר",
    wheat: "חיטה",
    stone: "אבן",
  };

  return (
    <section className="gold-prompt">
      {" "}
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
    </section>
  );
}
