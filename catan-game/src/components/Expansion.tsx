import { useState } from "react";
import type { View, Resource, Track, Hand } from "../../shared/engine.js";
import {
  MATERIALS,
  RESOURCES,
  boardFor,
  emptyHand,
  total,
  canPay,
} from "../../shared/engine.js";
import { PROGRESS, TRACKS } from "../../shared/expansion.js";
import { CardArt } from "./Cards";
import "./Expansion.css";

type Action = { type: string; [key: string]: unknown };
type Props = { g: View; id: string; send: (a: Action) => void; busy: boolean };
const materialNames: Record<Resource, string> = {
  wood: "עץ",
  brick: "לבנים",
  sheep: "צמר",
  wheat: "חיטה",
  stone: "מחצבים",
  paper: "נייר",
  cloth: "בד",
  coin: "מטבעות",
};
const trackNames: Record<Track, string> = {
  science: "מדע",
  politics: "פוליטיקה",
  trade: "מסחר",
};
const siteName = (g: View, id: string) =>
  `צומת ${boardFor(g).vertices.findIndex((v) => v.id === id) + 1}`;
function Select({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  change: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">בחר…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function CardChoice({ g, send, busy }: Props) {
  const [cards, setCards] = useState<Hand>(emptyHand);
  const c = g.choice!;
  const max = c.max || g.me.resources;
  return (
    <>
      <div className="choice-hand">
        {MATERIALS.filter((r) => max[r] > 0).map((r) => (
          <label key={r}>
            {materialNames[r]} ({max[r]})
            <input
              aria-label={`בחירה ${materialNames[r]}`}
              type="number"
              min={0}
              max={max[r]}
              value={cards[r]}
              onChange={(e) =>
                setCards({
                  ...cards,
                  [r]: Math.max(
                    0,
                    Math.min(max[r], Number(e.target.value) || 0),
                  ),
                })
              }
            />
          </label>
        ))}
      </div>
      <button
        className="primary"
        disabled={busy || total(cards) !== c.required}
        onClick={() => send({ type: "expansion-choice", cards })}
      >
        אשר {total(cards)} / {c.required} קלפים
      </button>
    </>
  );
}
export function ExpansionChoice(props: Props) {
  const { g, id, send, busy } = props,
    c = g.choice;
  if (!c) return null;
  return (
    <section className="panel urgent expansion-choice">
      <h2>{c.title}</h2>
      {c.playerId !== id ? (
        <p>ממתינים ל־{g.players.find((p) => p.id === c.playerId)?.name}</p>
      ) : c.options ? (
        <div className="choice-options">
          {c.options.map((o) => (
            <button
              key={o.id}
              disabled={busy}
              onClick={() => send({ type: "expansion-choice", choice: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <CardChoice key={`${g.revision}-${c.kind}`} {...props} />
      )}
    </section>
  );
}
function ProgressCard({ card, g, id, send, busy }: Props & { card: string }) {
  const [open, setOpen] = useState(false),
    [one, setOne] = useState(""),
    [two, setTwo] = useState("");
  const [dice, setDice] = useState([1, 1]);
  const def = PROGRESS[card];
  const active = g.players[g.currentPlayerIndex].id === id;
  const playable =
    active &&
    !busy &&
    (card === "alchemist" ? g.stage === "pre-roll" : g.stage === "action");
  const sites = (ids: string[]) =>
    ids.map((v) => ({ id: v, label: siteName(g, v) }));
  const ownCities = g.buildings.filter(
    (b) => b.playerId === id && b.type === "city",
  );
  let options: { id: string; label: string }[] = [];
  let label = "בחירה";
  if (["engineer", "medicine", "intrigue", "smith"].includes(card)) {
    label =
      card === "smith"
        ? "אביר ראשון"
        : card === "intrigue"
          ? "אביר יריב"
          : "צומת";
    options =
      card === "smith"
        ? sites(
            g
              .expansionLegal!.knights.filter((k) => k.promote)
              .map((k) => k.vertexId),
          )
        : card === "intrigue"
          ? sites(
              g
                .knightPieces!.filter((k) => k.playerId !== id)
                .map((k) => k.vertexId),
            )
          : sites(
              (card === "engineer"
                ? ownCities.filter((b) => !b.wall)
                : g.buildings.filter(
                    (b) => b.playerId === id && b.type === "settlement",
                  )
              ).map((b) => b.vertexId),
            );
  } else if (["merchant", "bishop", "inventor"].includes(card)) {
    label = card === "inventor" ? "משושה ראשון" : "משושה";
    options = g.tiles
      .filter(
        (t) => card !== "inventor" || [3, 4, 5, 9, 10, 11].includes(t.number!),
      )
      .map((t) => ({
        id: String(t.id),
        label: `משושה ${t.id + 1}: ${["desert", "sea", "gold"].includes(t.resource) ? "מדבר" : materialNames[t.resource as Resource]} · ${t.number ?? "—"}`,
      }));
  } else if (
    ["resource-monopoly", "trade-monopoly", "merchant-fleet"].includes(card)
  ) {
    label = "חומר";
    options = (
      card === "resource-monopoly"
        ? RESOURCES
        : card === "trade-monopoly"
          ? MATERIALS.filter((r) => !RESOURCES.includes(r as never))
          : MATERIALS
    ).map((r) => ({ id: r, label: materialNames[r] }));
  } else if (["spy", "master-merchant", "deserter"].includes(card)) {
    label = "שחקן";
    options = g.players
      .filter((p) => p.id !== id)
      .map((p) => ({ id: p.id, label: p.name }));
  } else if (card === "diplomat") {
    label = "דרך פתוחה";
    options = g.roads.map((r) => ({
      id: r.edgeId,
      label: `דרך ${boardFor(g).edges.findIndex((e) => e.id === r.edgeId) + 1} · ${g.players.find((p) => p.id === r.playerId)?.name}`,
    }));
  }
  const needsChoice = [
    "engineer",
    "medicine",
    "intrigue",
    "smith",
    "merchant",
    "bishop",
    "inventor",
    "resource-monopoly",
    "trade-monopoly",
    "merchant-fleet",
    "spy",
    "master-merchant",
    "deserter",
    "diplomat",
  ].includes(card);
  function play() {
    const a: Action = { type: "play-progress", card };
    if (["engineer", "medicine", "intrigue"].includes(card)) a.vertexId = one;
    if (["merchant", "bishop"].includes(card)) a.tileId = Number(one);
    if (card === "inventor") a.tiles = [Number(one), Number(two)];
    if (card === "smith") a.knights = [one, ...(two ? [two] : [])];
    if (
      ["resource-monopoly", "trade-monopoly", "merchant-fleet"].includes(card)
    )
      a.resource = one;
    if (["spy", "master-merchant", "deserter"].includes(card)) a.playerId = one;
    if (card === "diplomat") a.edgeId = one;
    if (card === "alchemist") a.dice = dice;
    send(a);
    setOpen(false);
  }
  return (
    <article className={`progress-card ${def[0]}`}>
      <div className="progress-art">
        <CardArt kind={def[0]} />
        <span>{trackNames[def[0]]}</span>
      </div>
      <h3>
        {def[2]}{" "}
        <small>× {g.me.progress!.filter((c) => c === card).length}</small>
      </h3>
      <p>{def[3]}</p>
      <button
        disabled={!playable}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "סגור" : "שחק קלף"}
      </button>
      {g.me.progress!.length > 4 && active && g.stage === "action" && (
        <button
          disabled={busy}
          onClick={() =>
            send({
              type: "discard-progress",
              index: g.me.progress!.indexOf(card),
            })
          }
        >
          החזר לערימה
        </button>
      )}
      {open && playable && (
        <div className="progress-form">
          {needsChoice && (
            <Select
              label={label}
              value={one}
              options={options}
              change={setOne}
            />
          )}
          {["inventor", "smith"].includes(card) && (
            <Select
              label={card === "smith" ? "אביר שני (רשות)" : "משושה שני"}
              value={two}
              options={options.filter((o) => o.id !== one)}
              change={setTwo}
            />
          )}
          {card === "alchemist" &&
            dice.map((v, i) => (
              <label key={i}>
                {i === 0 ? "קובייה אדומה" : "קובייה צהובה"}
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={v}
                  onChange={(e) =>
                    setDice(
                      dice.map((n, j) =>
                        j === i
                          ? Math.max(
                              1,
                              Math.min(6, Number(e.target.value) || 1),
                            )
                          : n,
                      ),
                    )
                  }
                />
              </label>
            ))}
          <button
            className="primary"
            disabled={(needsChoice && !one) || (card === "inventor" && !two)}
            onClick={play}
          >
            הפעל {def[2]}
          </button>
        </div>
      )}
    </article>
  );
}
export function ExpansionStatus({ g }: { g: View }) {
  return (
    <section className="panel expansion-status">
      <span className="eyebrow">ערים ואבירים · יעד {g.targetScore} נקודות</span>
      <h2>הברברים בדרך</h2>
      <div
        className="barbarian-track"
        aria-label={`הברברים התקדמו ${g.barbarianPosition} מתוך 7`}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <span
            className={
              i === g.barbarianPosition
                ? "ship"
                : i < g.barbarianPosition!
                  ? "passed"
                  : ""
            }
            key={i}
          >
            {i === g.barbarianPosition ? "⛵" : i === 7 ? "⚔" : i}
          </span>
        ))}
      </div>
      <p>
        {g.barbarianPosition === 6
          ? "הפלישה תגיע בגלגול הספינה הבא"
          : `עוד ${7 - g.barbarianPosition!} צעדי ספינה לפלישה`}{" "}
        · כוח ברברים {g.buildings.filter((b) => b.type === "city").length} ·
        הגנה{" "}
        {g
          .knightPieces!.filter((k) => k.active)
          .reduce((n, k) => n + k.level, 0)}
      </p>
      <p className="muted">
        קוביית אירוע:{" "}
        {g.eventDie === "barbarians"
          ? "ספינה"
          : trackNames[g.eventDie as Track] || "טרם גולגלה"}{" "}
        · הקובייה הראשונה היא האדומה
      </p>
      {!g.barbarianAttacks && (
        <p className="muted">השודד יישאר במדבר עד הפלישה הראשונה.</p>
      )}
      {g.lastBattle && (
        <p>
          פלישה אחרונה: {g.lastBattle.attack} מול {g.lastBattle.defense} —{" "}
          {g.lastBattle.won ? "קטאן ניצלה" : "הברברים ניצחו"}
        </p>
      )}
    </section>
  );
}
export function ExpansionPanel(props: Props) {
  const { g, id, send, busy } = props;
  const [dest, setDest] = useState(""),
    [hire, setHire] = useState(""),
    [city, setCity] = useState(""),
    [harborPlayer, setHarborPlayer] = useState(""),
    [harborResource, setHarborResource] = useState("");
  const active = g.players[g.currentPlayerIndex].id === id;
  const disabled = busy || !active || g.stage !== "action" || !!g.winner;
  const ownCities = g.buildings.filter(
    (b) => b.playerId === id && b.type === "city",
  );
  const ownKnights = g.knightPieces!.filter((k) => k.playerId === id);
  return (
    <>
      <section className="panel">
        <h2>אבירים וחומות</h2>
        <p className="muted">
          המספרים על הלוח מציינים צמתים. אביר שהופעל בתור זה יכול להגן, ויוכל
          לפעול מתורך הבא.
        </p>
        <Select
          label="מיקום לאביר חדש"
          value={hire}
          change={setHire}
          options={g.expansionLegal!.hire.map((v) => ({
            id: v,
            label: siteName(g, v),
          }))}
        />
        <button
          disabled={
            disabled || !hire || !canPay(g.me.resources, { sheep: 1, stone: 1 })
          }
          onClick={() => {
            send({ type: "hire-knight", vertexId: hire });
            setHire("");
          }}
        >
          גייס אביר · צמר + מחצבים
        </button>
        {ownKnights.map((k) => {
          const legal = g.expansionLegal!.knights.find(
            (x) => x.vertexId === k.vertexId,
          )!;
          return (
            <div className="knight-control" key={k.vertexId}>
              <strong>
                {siteName(g, k.vertexId)} · דרגה {k.level} ·{" "}
                {k.active ? "פעיל" : "לא פעיל"}
              </strong>
              <div className="button-row">
                <button
                  disabled={
                    disabled ||
                    k.active ||
                    !canPay(g.me.resources, { wheat: 1 })
                  }
                  onClick={() =>
                    send({ type: "activate-knight", vertexId: k.vertexId })
                  }
                >
                  הפעל · חיטה
                </button>
                <button
                  disabled={
                    disabled ||
                    !legal.promote ||
                    !canPay(g.me.resources, { sheep: 1, stone: 1 })
                  }
                  onClick={() =>
                    send({ type: "promote-knight", vertexId: k.vertexId })
                  }
                >
                  קדם · צמר + מחצבים
                </button>
                <button
                  disabled={disabled || !legal.chase}
                  onClick={() =>
                    send({ type: "chase-robber", vertexId: k.vertexId })
                  }
                >
                  גרש שודד
                </button>
                {g.seafarers && (
                  <button
                    disabled={disabled || !legal.pirate}
                    onClick={() =>
                      send({ type: "chase-pirate", vertexId: k.vertexId })
                    }
                  >
                    גרש פיראט
                  </button>
                )}
              </div>
              {legal.destinations.length > 0 && (
                <>
                  <Select
                    label={`יעד לאביר ב${siteName(g, k.vertexId)}`}
                    value={dest}
                    change={setDest}
                    options={legal.destinations.map((v) => ({
                      id: v,
                      label:
                        siteName(g, v) +
                        (g.knightPieces!.some((x) => x.vertexId === v)
                          ? " · דחיקת יריב"
                          : ""),
                    }))}
                  />
                  <button
                    disabled={disabled || !legal.destinations.includes(dest)}
                    onClick={() => {
                      send({
                        type: "move-knight",
                        vertexId: k.vertexId,
                        destination: dest,
                      });
                      setDest("");
                    }}
                  >
                    העבר אביר
                  </button>
                </>
              )}
            </div>
          );
        })}
        <Select
          label="עיר לשיפור או לחומה"
          value={city}
          change={setCity}
          options={ownCities.map((b) => ({
            id: b.vertexId,
            label:
              siteName(g, b.vertexId) +
              (b.metropolis ? ` · מטרופולין ${trackNames[b.metropolis]}` : "") +
              (b.wall ? " · חומה" : ""),
          }))}
        />
        <button
          disabled={
            disabled ||
            !city ||
            !!ownCities.find((b) => b.vertexId === city)?.wall ||
            ownCities.filter((b) => b.wall).length >= 3 ||
            !canPay(g.me.resources, { brick: 2 })
          }
          onClick={() => send({ type: "build-wall", vertexId: city })}
        >
          בנה חומה · שתי לבנים
        </button>
        <p className="muted">
          חומותיך מאפשרות להחזיק{" "}
          {7 + 2 * ownCities.filter((b) => b.wall).length} קלפים לפני השלכת חצי
          היד ב־7.
        </p>
      </section>
      <section className="panel">
        <h2>שיפורי ערים</h2>
        {(Object.keys(TRACKS) as Track[]).map((t) => {
          const level = g.me.improvements![t];
          return (
            <div key={t} className={`improvement ${t}`}>
              <strong>
                {trackNames[t]} · דרגה {level}/5
              </strong>
              <div className="levels">
                {Array.from({ length: 5 }, (_, i) => (
                  <span className={i < level ? "filled" : ""} key={i} />
                ))}
              </div>
              <p>
                {t === "science"
                  ? "דרגה 3: אמת מים — משאב כשלא הופקו חומרים"
                  : t === "politics"
                    ? "דרגה 3: מצודה — אבירים בדרגה 3"
                    : "דרגה 3: בית מסחר — סחורות ביחס 2:1"}
              </p>
              <button
                disabled={
                  disabled ||
                  !ownCities.length ||
                  level === 5 ||
                  !canPay(g.me.resources, {
                    [TRACKS[t]]: Math.max(0, level + 1 - (g.crane ? 1 : 0)),
                  })
                }
                onClick={() =>
                  send({ type: "improve-city", track: t, vertexId: city })
                }
              >
                שפר · {Math.max(0, level + 1 - (g.crane ? 1 : 0))}{" "}
                {materialNames[TRACKS[t]]}
              </button>
            </div>
          );
        })}
        <p className="muted">
          מטרופולין בדרגה 4 מעניק שתי נקודות נוספות ומוגן מברברים. בחר עיר פנויה
          לפני השיפור שמעניק אותו.
        </p>
      </section>
      <section className="panel">
        <h2>
          קלפי ההתקדמות שלי{" "}
          <span className="count">{g.me.progress!.length}</span>
        </h2>
        <p className="muted">
          ניתן לשחק כמה קלפים בתורך, גם אם התקבלו עכשיו. עד ארבעה בסוף התור.
        </p>
        <div className="progress-cards">
          {[...new Set(g.me.progress)].map((card) => (
            <ProgressCard key={card} card={card} {...props} />
          ))}
        </div>
        {!g.me.progress!.length && (
          <p>שפר ערים כדי לקבל קלפים בגלגול שער תואם.</p>
        )}
        {g.harbor && (
          <div>
            <Select
              label="יריב לנמל מסחרי"
              value={harborPlayer}
              change={setHarborPlayer}
              options={g.players
                .filter((p) => p.id !== id && !g.harbor!.used.includes(p.id))
                .map((p) => ({ id: p.id, label: p.name }))}
            />
            <Select
              label="משאב לנמל מסחרי"
              value={harborResource}
              change={setHarborResource}
              options={RESOURCES.filter((r) => g.me.resources[r] > 0).map(
                (r) => ({ id: r, label: materialNames[r] }),
              )}
            />
            <button
              disabled={disabled || !harborPlayer || !harborResource}
              onClick={() =>
                send({
                  type: "harbor-trade",
                  playerId: harborPlayer,
                  resource: harborResource,
                })
              }
            >
              הצע החלפה כפויה
            </button>
          </div>
        )}
      </section>
    </>
  );
}
