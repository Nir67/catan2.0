import type { PickRequest } from "./Placement";
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
type Props = {
  g: View;
  id: string;
  send: (a: Action) => void;
  busy: boolean;
  onPick?: (pick: PickRequest) => void;
};
const materialNames: Record<Resource, string> = {
  wood: "עץ",
  brick: "לבנים",
  sheep: "צמר",
  wheat: "חיטה",
  stone: "אבן",
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
function ProgressCard({
  card,
  g,
  id,
  send,
  busy,
  onPick,
}: Props & { card: string }) {
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
        onClick={() => {
          if (onPick && ["engineer", "medicine"].includes(card)) {
            onPick({
              title:
                card === "engineer"
                  ? "בחר עיר לחומה בחינם"
                  : "בחר יישוב לשדרוג",
              action: { type: "play-progress", card },
              field: "vertexId",
            });
            setOpen(false);
          } else setOpen(!open);
        }}
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
export function ExpansionPanel(
  props: Props & { section?: "knights" | "cities" | "cards" },
) {
  const { g, id, send, busy, onPick, section = "knights" } = props;
  const [harborPlayer, setHarborPlayer] = useState(""),
    [harborResource, setHarborResource] = useState("");
  const active = g.players[g.currentPlayerIndex].id === id;
  const disabled = busy || !active || g.stage !== "action" || !!g.winner;
  const ownCities = g.buildings.filter(
    (b) => b.playerId === id && b.type === "city",
  );
  const ownKnights = g.knightPieces!.filter((k) => k.playerId === id);
  if (section === "knights" && !ownKnights.length) return null;
  return (
    <div className="expansion-tools" data-section={section}>
      <section className="panel knight-tools">
        <h2>האבירים שלי</h2>
        <p className="muted">אביר שהופעל בתור זה יוכל לפעול מתורך הבא.</p>
        {ownKnights.map((k, index) => {
          const legal = g.expansionLegal!.knights.find(
            (x) => x.vertexId === k.vertexId,
          )!;
          return (
            <div className="knight-control" key={k.vertexId}>
              <strong>
                אביר {index + 1} · דרגה {k.level} ·{" "}
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
                  קדם · צמר + אבן
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
                <button
                  disabled={disabled}
                  onClick={() =>
                    onPick?.({
                      title: "בחר יעד לאביר",
                      action: { type: "move-knight", vertexId: k.vertexId },
                      field: "destination",
                    })
                  }
                >
                  העבר אביר על הלוח
                </button>
              )}
            </div>
          );
        })}
      </section>
      <section className="panel city-tools">
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
                onClick={() => {
                  if (
                    level >= 3 &&
                    !g.buildings.some(
                      (b) => b.playerId === id && b.metropolis === t,
                    ) &&
                    !g.players.some(
                      (p) =>
                        p.id !== id && (p.improvements?.[t] ?? 0) >= level + 1,
                    )
                  )
                    onPick?.({
                      title: "בחר עיר למטרופולין",
                      action: { type: "improve-city", track: t },
                      field: "vertexId",
                    });
                  else send({ type: "improve-city", track: t });
                }}
              >
                שפר · {Math.max(0, level + 1 - (g.crane ? 1 : 0))}{" "}
                {materialNames[TRACKS[t]]}
              </button>
            </div>
          );
        })}
        <p className="muted">
          מטרופולין מעניק שתי נקודות נוספות ומוגן מברברים. כשהשיפור דורש עיר,
          בוחרים אותה על הלוח.
        </p>
      </section>
      <section className="panel progress-tools">
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
    </div>
  );
}
