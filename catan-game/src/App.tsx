import { useEffect, useState } from "react";
import { socket } from "./socket";
import {
  COSTS,
  RESOURCES,
  MATERIALS,
  VERTICES,
  EDGES,
  PORTS,
  emptyHand,
  total,
  canPay,
} from "../shared/engine.js";
import type {
  View,
  Hand,
  Resource,
  Color,
  DevelopmentType,
} from "../shared/engine.js";
import "./App.css";
import {
  ExpansionPanel,
  ExpansionChoice,
  ExpansionStatus,
} from "./components/Expansion";
import { CardArt, PlayingCard, CardGallery } from "./components/Cards";
import wood from "./assets/wood.png";
import sheep from "./assets/sheep.png";
import wheat from "./assets/wheat.png";
import brick from "./assets/brick.png";
import stone from "./assets/stone.png";
import desert from "./assets/dessert.png";
import roadBlue from "./assets/pieces/road-blue.png";
import roadRed from "./assets/pieces/road-red.png";
import roadGreen from "./assets/pieces/road-green.png";
import roadYellow from "./assets/pieces/road-yellow.png";
import settlementBlue from "./assets/pieces/settlement-blue.png";
import settlementRed from "./assets/pieces/settlement-red.png";
import settlementGreen from "./assets/pieces/settlement-green.png";
import settlementYellow from "./assets/pieces/settlement-yellow.png";
import cityBlue from "./assets/pieces/city-blue.png";
import cityRed from "./assets/pieces/city-red.png";
import cityGreen from "./assets/pieces/city-green.png";
import cityYellow from "./assets/pieces/city-yellow.png";

const names: Record<Resource, string> = {
  wood: "עץ",
  brick: "לבנים",
  sheep: "צמר",
  wheat: "חיטה",
  stone: "מחצבים",
  paper: "נייר",
  cloth: "בד",
  coin: "מטבעות",
};
const icons: Record<Resource, string> = {
  wood: "🌲",
  brick: "🧱",
  sheep: "🐑",
  wheat: "🌾",
  stone: "⛰️",
  paper: "📜",
  cloth: "🧵",
  coin: "🪙",
};
const cardNames: Record<DevelopmentType, string> = {
  knight: "אביר",
  victory: "נקודת ניצחון",
  "road-building": "בניית דרכים",
  plenty: "שנת שפע",
  monopoly: "מונופול",
};
const resourceImages = { wood, sheep, wheat, brick, stone, desert };
const pieces = {
  road: { blue: roadBlue, red: roadRed, green: roadGreen, yellow: roadYellow },
  settlement: {
    blue: settlementBlue,
    red: settlementRed,
    green: settlementGreen,
    yellow: settlementYellow,
  },
  city: { blue: cityBlue, red: cityRed, green: cityGreen, yellow: cityYellow },
};
type Build = "road" | "settlement" | "city";
type Room = {
  mode: "base" | "cities-knights";
  roomCode: string;
  hostId: string;
  started: boolean;
  players: { id: string; name: string; color: Color; online: boolean }[];
};
type Action = { type: string; [key: string]: unknown };
type Reply = { success: boolean; message?: string; playerId?: string };
type Send = (action: Action) => void;
const buildNames = { road: "דרך", settlement: "יישוב", city: "עיר" };
const handText = (h: Partial<Hand>) =>
  MATERIALS.filter((r) => h[r])
    .map((r) => `${h[r]} ${names[r]}`)
    .join(" + ");
const hexPoints = (x: number, y: number) =>
  Array.from(
    { length: 6 },
    (_, i) =>
      `${x + 60 * Math.cos(((-90 + i * 60) * Math.PI) / 180)},${y + 60 * Math.sin(((-90 + i * 60) * Math.PI) / 180)}`,
  ).join(" ");

function HandPicker({
  label,
  value,
  onChange,
  max,
  disabled = false,
  expansion = false,
}: {
  label: string;
  value: Hand;
  onChange: (h: Hand) => void;
  max?: Hand;
  disabled?: boolean;
  expansion?: boolean;
}) {
  return (
    <fieldset className="hand-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="resource-inputs">
        {(expansion ? MATERIALS : RESOURCES).map((r) => (
          <label key={r}>
            <CardArt kind={r} />
            <span>{names[r]}</span>
            <input
              aria-label={`${label} ${names[r]}`}
              type="number"
              min="0"
              max={max?.[r] ?? 19}
              value={value[r]}
              onChange={(e) =>
                onChange({
                  ...value,
                  [r]: Math.max(
                    0,
                    Math.min(max?.[r] ?? 19, Number(e.target.value) || 0),
                  ),
                })
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Board({
  g,
  mode,
  send,
  disabled,
}: {
  g: View;
  mode: Build | null;
  send: Send;
  disabled: boolean;
}) {
  const roadIds = new Set(mode === "road" ? g.legal.roads : []);
  const vertexIds = new Set(
    mode === "city"
      ? g.legal.cities
      : mode === "settlement"
        ? g.legal.settlements
        : [],
  );
  const keyAction = (event: React.KeyboardEvent, action: Action) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabled) send(action);
    }
  };
  return (
    <svg
      className="board"
      viewBox="60 -30 680 600"
      role="group"
      aria-label="לוח קטאן"
    >
      <defs>
        <filter id="piece-matte" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 0 3"
            result="matte"
          />
          <feComposite in="SourceGraphic" in2="matte" operator="in" />
        </filter>
        {g.tiles.map((t) => (
          <clipPath key={t.id} id={`tile-${t.id}`}>
            <polygon points={hexPoints(t.x, t.y)} />
          </clipPath>
        ))}
      </defs>
      {PORTS.map((port, i) => {
        const dx = port.x - 400,
          dy = port.y - 270,
          len = Math.hypot(dx, dy),
          x = port.x + (dx / len) * 31,
          y = port.y + (dy / len) * 31;
        return (
          <g key={i} className="port">
            <line
              x1={port.x}
              y1={port.y}
              x2={x}
              y2={y}
              stroke="#e9d2a1"
              strokeWidth="3"
            />
            <circle cx={x} cy={y} r="20" fill="#fff4da" />
            <text
              x={x}
              y={y - 2}
              textAnchor="middle"
              fontSize="12"
              fill="#263c45"
            >
              {port.resource === "any" ? "⚓" : icons[port.resource]}
            </text>
            <text
              x={x}
              y={y + 12}
              textAnchor="middle"
              fontSize="11"
              fill="#263c45"
            >
              {port.resource === "any" ? "3:1" : "2:1"}
            </text>
          </g>
        );
      })}
      {g.tiles.map((t) => (
        <g key={t.id}>
          <image
            href={resourceImages[t.resource]}
            x={t.x - 55}
            y={t.y - 63}
            width="110"
            height="126"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#tile-${t.id})`}
          />
          <polygon
            points={hexPoints(t.x, t.y)}
            fill="none"
            stroke="#e9d2a1"
            strokeWidth="3"
          />
          {t.number !== null && (
            <g>
              <circle
                cx={t.x}
                cy={t.y + 17}
                r="20"
                fill={
                  g.hasRolled && g.dice && g.dice[0] + g.dice[1] === t.number
                    ? "#ffe58a"
                    : "#fff4db"
                }
                stroke="#9b8253"
                strokeWidth="2"
              />
              <text
                x={t.x}
                y={t.y + 23}
                textAnchor="middle"
                fontSize="19"
                fontWeight="bold"
                fill={t.number === 6 || t.number === 8 ? "#bd3232" : "#233640"}
              >
                {t.number}
              </text>
              <text
                x={t.x}
                y={t.y + 34}
                textAnchor="middle"
                fontSize="7"
                fill="#6a5140"
              >
                {"•".repeat(6 - Math.abs(7 - t.number))}
              </text>
            </g>
          )}
          {g.robber === t.id && (
            <g aria-label="שודד">
              <ellipse
                cx={t.x}
                cy={t.y - 17}
                rx="14"
                ry="6"
                fill="#12232b"
                opacity=".3"
              />
              <path
                d={`M ${t.x - 11} ${t.y - 19} L ${t.x - 6} ${t.y - 40} Q ${t.x - 14} ${t.y - 55} ${t.x} ${t.y - 55} Q ${t.x + 14} ${t.y - 55} ${t.x + 6} ${t.y - 40} L ${t.x + 11} ${t.y - 19} Z`}
                fill="#243038"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}
          {g.stage === "robber" && !disabled && g.robber !== t.id && (
            <polygon
              points={hexPoints(t.x, t.y)}
              fill="#ffd45a22"
              stroke="#ffde70"
              strokeWidth="4"
              role="button"
              tabIndex={0}
              aria-label={`העבר שודד למשושה ${t.id + 1}`}
              className="target"
              onClick={() => send({ type: "move-robber", tileId: t.id })}
              onKeyDown={(e) =>
                keyAction(e, { type: "move-robber", tileId: t.id })
              }
            />
          )}
        </g>
      ))}
      {g.roads.map((r) => {
        const edge = EDGES.find((e) => e.id === r.edgeId)!;
        return (
          <image
            key={r.edgeId}
            href={pieces.road[r.color]}
            x={edge.x - 34.3}
            y={edge.y - 34.3}
            width="68.6"
            height="68.6"
            transform={`rotate(${edge.angle} ${edge.x} ${edge.y})`}
            className="piece"
            filter="url(#piece-matte)"
          />
        );
      })}
      {g.buildings.map((b) => {
        const v = VERTICES.find((v) => v.id === b.vertexId)!;
        const size = b.type === "city" ? 48 : 38;
        return (
          <image
            key={b.vertexId}
            href={pieces[b.type][b.color]}
            x={v.x - size / 2}
            y={v.y - size / 2}
            width={size}
            height={size}
            className="piece"
            filter="url(#piece-matte)"
          />
        );
      })}
      {!disabled &&
        EDGES.filter((e) => roadIds.has(e.id)).map((edge, i) => {
          return (
            <rect
              key={edge.id}
              x={edge.x - 24}
              y={edge.y - 7}
              width="48"
              height="14"
              rx="7"
              fill="#fff4bd"
              transform={`rotate(${edge.angle} ${edge.x} ${edge.y})`}
              className="target"
              role="button"
              tabIndex={0}
              aria-label={`בנה דרך ${i + 1}`}
              onClick={() => send({ type: "build-road", edgeId: edge.id })}
              onKeyDown={(e) =>
                keyAction(e, { type: "build-road", edgeId: edge.id })
              }
            />
          );
        })}
      {!disabled &&
        VERTICES.filter((v) => vertexIds.has(v.id)).map((v, i) => (
          <circle
            key={v.id}
            cx={v.x}
            cy={v.y}
            r="11"
            fill="#fff5cc"
            stroke="#d28c22"
            strokeWidth="3"
            className="target"
            role="button"
            tabIndex={0}
            aria-label={`בנה ${mode === "city" ? "עיר" : "יישוב"} ${i + 1}`}
            onClick={() => send({ type: `build-${mode}`, vertexId: v.id })}
            onKeyDown={(e) =>
              keyAction(e, { type: `build-${mode}`, vertexId: v.id })
            }
          />
        ))}
      {g.mode === "cities-knights" && (
        <>
          {g.buildings
            .filter((b) => b.wall || b.metropolis)
            .map((b) => {
              const v = VERTICES.find((v) => v.id === b.vertexId)!;
              return (
                <g key={b.vertexId}>
                  {b.wall && (
                    <rect
                      x={v.x - 24}
                      y={v.y + 12}
                      width="48"
                      height="9"
                      fill="#d6ba75"
                      stroke="#6e592f"
                    />
                  )}
                  {b.metropolis && (
                    <text
                      x={v.x}
                      y={v.y - 19}
                      textAnchor="middle"
                      fontSize="24"
                      aria-label="מטרופולין"
                    >
                      ♛
                    </text>
                  )}
                </g>
              );
            })}
          {g.knightPieces!.map((k) => {
            const v = VERTICES.find((v) => v.id === k.vertexId)!;
            return (
              <g
                key={k.vertexId}
                aria-label={`אביר דרגה ${k.level} ${k.active ? "פעיל" : "לא פעיל"}`}
              >
                <circle
                  cx={v.x}
                  cy={v.y}
                  r="15"
                  fill={
                    k.active
                      ? {
                          blue: "#367db8",
                          red: "#b8413c",
                          green: "#397346",
                          yellow: "#d6aa35",
                        }[k.color]
                      : "#e0dcd0"
                  }
                  stroke={
                    {
                      blue: "#367db8",
                      red: "#b8413c",
                      green: "#397346",
                      yellow: "#b88b25",
                    }[k.color]
                  }
                  strokeWidth="4"
                />
                <text
                  x={v.x}
                  y={v.y + 5}
                  textAnchor="middle"
                  fontSize="18"
                  fill={k.active ? "white" : "#5b6769"}
                >
                  ♞
                </text>
                <text x={v.x + 13} y={v.y + 17} fontSize="10" fill="#fff">
                  {k.level}
                </text>
              </g>
            );
          })}
          {VERTICES.map((v, i) => (
            <text className="site-number" key={v.id} x={v.x + 11} y={v.y - 12}>
              {i + 1}
            </text>
          ))}
          {g.merchant &&
            (() => {
              const t = g.tiles[g.merchant.tileId];
              return (
                <g aria-label="סוחר">
                  <path
                    d={`M ${t.x + 22} ${t.y - 8} l 8 -25 l 8 25 Z`}
                    fill="#9b5a92"
                    stroke="white"
                  />
                </g>
              );
            })()}
        </>
      )}
    </svg>
  );
}
function TradePanel({
  g,
  id,
  send,
  busy,
}: {
  g: View;
  id: string;
  send: Send;
  busy: boolean;
}) {
  const [give, setGive] = useState(emptyHand),
    [want, setWant] = useState(emptyHand);
  const mine = g.players[g.currentPlayerIndex].id === id;
  return (
    <section className="panel">
      <h2>מסחר</h2>
      {
        <>
          <p className="muted">
            יחסי הבנק שלך:{" "}
            {(g.mode === "cities-knights" ? MATERIALS : RESOURCES)
              .map((r) => `${names[r]} ${g.me.ratios[r]}:1`)
              .join(" · ")}
          </p>
          <HandPicker
            expansion={g.mode === "cities-knights"}
            label="נותן"
            value={give}
            onChange={setGive}
            max={g.me.resources}
            disabled={busy}
          />
          <HandPicker
            expansion={g.mode === "cities-knights"}
            label="מקבל"
            value={want}
            onChange={setWant}
            disabled={busy}
          />
          <div className="button-row">
            <button
              disabled={busy || !mine || !total(give) || !total(want)}
              onClick={() => send({ type: "bank-trade", give, want })}
            >
              החלף עם הבנק
            </button>
            <button
              disabled={busy || !total(give) || !total(want)}
              onClick={() => send({ type: "offer-trade", give, want })}
            >
              הצע לשחקנים
            </button>
          </div>
        </>
      }
      {g.trade ? (
        <div className="trade-offer">
          <strong>
            {g.players.find((p) => p.id === g.trade!.from)?.name} מציע/ה
          </strong>
          <p>
            {handText(g.trade.give)} ← תמורת → {handText(g.trade.want)}
          </p>
          {g.trade.from !== id ? (
            <button
              disabled={
                busy ||
                (!mine &&
                  g.trade.from !== g.players[g.currentPlayerIndex].id) ||
                !canPay(g.me.resources, g.trade.want)
              }
              onClick={() => send({ type: "accept-trade" })}
            >
              קבל עסקה
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => send({ type: "cancel-trade" })}
            >
              בטל הצעה
            </button>
          )}
        </div>
      ) : (
        !mine && (
          <p className="muted">אפשר לסחור עם השחקן שבתורו כשמופיעה הצעה.</p>
        )
      )}
    </section>
  );
}
function DevelopmentPanel({
  g,
  send,
  busy,
  active,
}: {
  g: View;
  send: Send;
  busy: boolean;
  active: boolean;
}) {
  const [choice, setChoice] = useState<DevelopmentType | null>(null),
    [cards, setCards] = useState(emptyHand),
    [resource, setResource] = useState<Resource>("wood");
  const canPlay =
    active &&
    !busy &&
    !g.playedDevelopment &&
    ["pre-roll", "action"].includes(g.stage);
  return (
    <section className="panel">
      <h2>
        קלפי הפיתוח שלי <span className="count">{g.me.development.length}</span>
      </h2>
      <div className="dev-cards">
        {(Object.keys(cardNames) as DevelopmentType[]).map((type) => {
          const hand = g.me.development.filter((c) => c.type === type);
          if (!hand.length) return null;
          const playable =
            canPlay &&
            type !== "victory" &&
            hand.some((c) => c.boughtTurn < g.turnNumber);
          return (
            <button
              key={type}
              className="dev-card-button"
              aria-label={`${cardNames[type]} – ${hand.length} קלפים`}
              disabled={!playable}
              onClick={() => {
                if (type === "plenty" || type === "monopoly") setChoice(type);
                else send({ type: "play-development", card: type });
              }}
            >
              <PlayingCard
                kind={type}
                count={hand.length}
                status={
                  type === "victory"
                    ? "נקודה חסויה"
                    : !hand.some((c) => c.boughtTurn < g.turnNumber)
                      ? "זמין מהתור הבא"
                      : playable
                        ? "לחץ כדי לשחק"
                        : "לא זמין כעת"
                }
              />
            </button>
          );
        })}
      </div>
      {!g.me.development.length && (
        <p className="muted">קלפים שקנית נשארים חסויים מהשחקנים האחרים.</p>
      )}
      {choice === "plenty" && canPlay && (
        <>
          <HandPicker
            label="שנת שפע"
            value={cards}
            onChange={setCards}
            max={g.bank}
          />
          <button
            disabled={total(cards) !== Math.min(2, total(g.bank))}
            onClick={() => {
              send({ type: "play-development", card: "plenty", cards });
              setChoice(null);
              setCards(emptyHand());
            }}
          >
            קבל משאבים
          </button>
        </>
      )}
      {choice === "monopoly" && canPlay && (
        <div className="button-row">
          <select
            aria-label="משאב למונופול"
            value={resource}
            onChange={(e) => setResource(e.target.value as Resource)}
          >
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {names[r]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              send({ type: "play-development", card: "monopoly", resource });
              setChoice(null);
            }}
          >
            הפעל מונופול
          </button>
        </div>
      )}
      <p className="muted">
        קלף פעולה אחד בתור, החל מהתור שאחרי הקנייה. נקודות ניצחון נספרות
        אוטומטית.
      </p>
    </section>
  );
}
function DiscardPanel({
  g,
  send,
  busy,
  required,
}: {
  g: View;
  send: Send;
  busy: boolean;
  required: number;
}) {
  const [cards, setCards] = useState(emptyHand);
  return (
    <section className="panel urgent">
      <h2>יצא 7 — עליך להשליך {required} קלפים</h2>
      <HandPicker
        expansion={g.mode === "cities-knights"}
        label="להשלכה"
        value={cards}
        onChange={setCards}
        max={g.me.resources}
      />
      <button
        disabled={busy || total(cards) !== required}
        onClick={() => send({ type: "discard", cards })}
      >
        השלך {total(cards)} מתוך {required}
      </button>
    </section>
  );
}
function Game({
  g,
  room,
  id,
  send,
  busy,
  connected,
}: {
  g: View;
  room: Room;
  id: string;
  send: Send;
  busy: boolean;
  connected: boolean;
}) {
  const [menu, setMenu] = useState(false),
    [build, setBuild] = useState<Build | null>(null);
  const active = g.players[g.currentPlayerIndex].id === id;
  const disabled = busy || !connected;
  const forced: Build | null =
    g.stage === "setup-settlement"
      ? "settlement"
      : ["setup-road", "road-building"].includes(g.stage)
        ? "road"
        : null;
  const mode =
    active && !g.winner
      ? (forced ?? (menu && g.stage === "action" ? build : null))
      : null;
  const instruction: Record<string, string> = {
    "setup-settlement":
      g.mode === "cities-knights"
        ? "הצב מבנה התחלתי בנקודה מודגשת: יישוב בסבב הראשון ועיר בסבב השני"
        : "הצב יישוב התחלתי באחת הנקודות המודגשות",
    "setup-road": "הצב דרך צמודה ליישוב שהצבת",
    "pre-roll": "גלגל קוביות כדי להתחיל את התור",
    action:
      g.mode === "cities-knights"
        ? "אפשר לסחור, לבנות, לפתח ערים ולהפעיל אבירים וקלפי התקדמות"
        : "אפשר לסחור, לבנות או לקנות קלף פיתוח",
    "expansion-choice": "יש להשלים את הבחירה המוצגת",
    discard: "ממתינים להשלכת קלפים מכל מי שמחזיק מעל 7",
    robber: "בחר משושה אחר כדי להזיז את השודד",
    steal: "בחר ממי לגנוב קלף אקראי",
    "road-building": `הצב עד ${g.freeRoads} דרכים ללא עלות`,
    "game-over": "המשחק הסתיים",
  };
  const doAction: Send = (a) => {
    setBuild(null);
    send(a);
  };
  return (
    <>
      <div className="players">
        {g.players.map((p) => (
          <article
            key={p.id}
            className={`player-card ${p.id === g.players[g.currentPlayerIndex].id ? "current" : ""}`}
          >
            <div>
              <span className={`dot ${p.color}`} />
              <strong>
                {p.name}
                {p.id === id ? " (אתה)" : ""}
              </strong>
              <span
                className={`online ${room.players.find((x) => x.id === p.id)?.online ? "" : "offline"}`}
                title="מצב חיבור"
              />
            </div>
            <b>{p.score} נקודות</b>
            <span>
              קלפים {p.resourceCount} ·{" "}
              {g.mode === "cities-knights"
                ? `התקדמות ${p.progressCount} · מגיני קטאן ${p.defenderVP}`
                : `פיתוח ${p.developmentCount}`}
            </span>
            <span>
              דרך {p.roadLength} · אבירים {p.knights}
            </span>
            {(g.longestRoad === p.id || g.largestArmy === p.id) && (
              <small>
                {g.longestRoad === p.id ? "🛤 הדרך הארוכה " : ""}
                {g.largestArmy === p.id ? "🛡 הצבא הגדול" : ""}
              </small>
            )}
          </article>
        ))}
      </div>
      <div className="game-grid">
        <main className="island">
          <div className="turn-banner">
            <span className="eyebrow">
              תור {g.turnNumber} ·{" "}
              {g.stage.startsWith("setup") ? "הצבה ראשונית" : "משחק"} ·{" "}
              {g.mode === "cities-knights"
                ? "ערים ואבירים · 13 נקודות"
                : "משחק בסיס · 10 נקודות"}
            </span>
            <h1>
              {g.winner
                ? `${g.players.find((p) => p.id === g.winner)?.name} ניצח/ה! 🏆`
                : active
                  ? "התור שלך"
                  : `התור של ${g.players[g.currentPlayerIndex].name}`}
            </h1>
            <p>
              {active || g.stage === "discard"
                ? instruction[g.stage]
                : "צפה בלוח בזמן שהשחקן משלים את התור"}
            </p>
          </div>
          <Board
            g={g}
            mode={mode}
            send={doAction}
            disabled={disabled || !active}
          />
          <div className="board-caption">
            {mode
              ? `בחר מיקום חוקי לבניית ${buildNames[mode]}`
              : "הנקודות והצלעות הזמינות מופיעות בעת בחירת בנייה"}{" "}
            · ⚓ נמלים לאורך החוף
          </div>
        </main>
        <aside className="sidebar">
          {g.mode === "cities-knights" && <ExpansionStatus g={g} />}
          {g.mode === "cities-knights" && (
            <ExpansionChoice g={g} id={id} send={send} busy={disabled} />
          )}
          {g.winner && (
            <section className="panel winner">
              <h2>🏆 יש לנו מנצח</h2>
              <p>
                {g.players.find((p) => p.id === g.winner)?.name} הגיע/ה ל־
                {g.players.find((p) => p.id === g.winner)?.score} נקודות.
              </p>
              <p>אפשר לצאת מהחדר ולהתחיל משחק חדש.</p>
            </section>
          )}
          <section className="panel">
            <div className="section-title">
              <h2>המשאבים שלי</h2>
              <span className="count">{total(g.me.resources)} קלפים</span>
            </div>
            <div className="hand">
              {(g.mode === "cities-knights" ? MATERIALS : RESOURCES).map(
                (r) => (
                  <div
                    key={r}
                    className="hand-card"
                    aria-label={`${names[r]} – ${g.me.resources[r]} קלפים`}
                  >
                    <PlayingCard kind={r} count={g.me.resources[r]} />
                  </div>
                ),
              )}
            </div>
            <p className="muted">
              רק אתה רואה את חלוקת החומרים ואת הקלפים שבידך.
            </p>
          </section>
          {!g.winner && (
            <section className="panel">
              <div className="dice">
                <span>{g.dice?.[0] ?? "?"}</span>
                <span>{g.dice?.[1] ?? "?"}</span>
                <b>
                  {g.hasRolled && g.dice
                    ? `סכום ${g.dice[0] + g.dice[1]}`
                    : "לפני גלגול"}
                </b>
              </div>
              <div className="button-row">
                {active && g.stage === "pre-roll" && (
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => send({ type: "roll-dice" })}
                  >
                    🎲 גלגל קוביות
                  </button>
                )}
                {active && g.stage === "action" && (
                  <button
                    disabled={disabled}
                    onClick={() => {
                      setMenu(false);
                      setBuild(null);
                      send({ type: "end-turn" });
                    }}
                  >
                    סיים תור ←
                  </button>
                )}
              </div>
              {!active && (
                <p className="muted">ממתינים לתור שלך. ניתן לקבל הצעות מסחר.</p>
              )}
            </section>
          )}
          {!g.winner && (
            <section className="panel">
              <button
                className="build-toggle"
                aria-expanded={menu}
                onClick={() => {
                  setMenu(!menu);
                  setBuild(null);
                }}
              >
                🔨 בנייה {menu ? "−" : "+"}
              </button>
              {menu && (
                <div className="build-options">
                  {(["road", "settlement", "city"] as Build[]).map((type) => {
                    const count =
                      type === "road"
                        ? g.legal.roads.length
                        : type === "settlement"
                          ? g.legal.settlements.length
                          : g.legal.cities.length;
                    return (
                      <button
                        key={type}
                        className={mode === type ? "selected" : ""}
                        disabled={
                          disabled || !active || g.stage !== "action" || !count
                        }
                        onClick={() => setBuild(build === type ? null : type)}
                      >
                        <img
                          src={
                            pieces[type][
                              g.players.find((p) => p.id === id)!.color
                            ]
                          }
                          alt=""
                        />
                        <span>
                          <strong>{buildNames[type]}</strong>
                          <small>{handText(COSTS[type])}</small>
                        </span>
                      </button>
                    );
                  })}
                  {g.mode !== "cities-knights" && (
                    <button
                      disabled={
                        disabled ||
                        !active ||
                        g.stage !== "action" ||
                        !g.developmentRemaining ||
                        !canPay(g.me.resources, COSTS.development)
                      }
                      onClick={() => send({ type: "buy-development" })}
                    >
                      <span>🃏</span>
                      <span>
                        <strong>קנה קלף פיתוח</strong>
                        <small>
                          {handText(COSTS.development)} · נותרו{" "}
                          {g.developmentRemaining}
                        </small>
                      </span>
                    </button>
                  )}
                  <p className="muted">
                    15 דרכים, 5 יישובים ו־4 ערים לכל שחקן. רק מיקומים חוקיים
                    מוצגים בלוח.
                  </p>
                </div>
              )}
            </section>
          )}
          {!!g.pendingDiscards[id] && (
            <DiscardPanel
              key={`discard-${g.turnNumber}`}
              g={g}
              send={send}
              busy={disabled}
              required={g.pendingDiscards[id]}
            />
          )}
          {g.stage === "steal" && active && (
            <section className="panel urgent">
              <h2>בחר שחקן לגניבה</h2>
              {g.victims.map((v) => (
                <button
                  key={v}
                  disabled={disabled}
                  onClick={() => send({ type: "steal", victimId: v })}
                >
                  {g.players.find((p) => p.id === v)?.name}
                </button>
              ))}
            </section>
          )}
          {g.mode === "cities-knights" && (
            <ExpansionPanel g={g} id={id} send={send} busy={disabled} />
          )}
          {g.stage === "action" && (
            <TradePanel
              key={`trade-${g.turnNumber}`}
              g={g}
              id={id}
              send={send}
              busy={disabled}
            />
          )}
          {!g.winner && g.mode !== "cities-knights" && (
            <DevelopmentPanel
              key={`development-${g.turnNumber}`}
              g={g}
              active={active}
              send={send}
              busy={disabled}
            />
          )}
          <details className="panel">
            <summary>הבנק</summary>
            <p>{handText(g.bank)}</p>
            <p>קלפי פיתוח שנותרו: {g.developmentRemaining}</p>
          </details>
          <details className="panel" open>
            <summary>יומן המשחק</summary>
            <ol className="game-log">
              {g.log
                .slice(-8)
                .reverse()
                .map((entry, i) => (
                  <li key={`${g.revision}-${i}`}>{entry}</li>
                ))}
            </ol>
          </details>
        </aside>
      </div>
    </>
  );
}
function ModePicker({
  mode,
  onChange,
  disabled,
}: {
  mode: Room["mode"];
  onChange: (m: Room["mode"]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="mode-picker">
      <legend>איך משחקים?</legend>
      <button
        type="button"
        className={mode === "base" ? "selected" : ""}
        aria-pressed={mode === "base"}
        disabled={disabled}
        onClick={() => onChange("base")}
      >
        <strong>משחק הבסיס</strong>
        <small>10 נקודות · מסחר, דרכים וקלפי פיתוח</small>
      </button>
      <button
        type="button"
        className={mode === "cities-knights" ? "selected" : ""}
        aria-pressed={mode === "cities-knights"}
        disabled={disabled}
        onClick={() => onChange("cities-knights")}
      >
        <strong>ערים ואבירים</strong>
        <small>13 נקודות · ברברים, אבירים ופיתוח ערים</small>
      </button>
    </fieldset>
  );
}
function App() {
  const [showCards, setShowCards] = useState(false);
  const [mode, setMode] = useState<Room["mode"]>("base");
  const [connected, setConnected] = useState(socket.connected),
    [id, setId] = useState(""),
    [room, setRoom] = useState<Room | null>(null),
    [g, setGame] = useState<View | null>(null);
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    function connect() {
      setConnected(true);
      setError("");
      socket.emit("resume", {}, (reply: Reply) => {
        if (reply.playerId) setId(reply.playerId);
      });
    }
    function disconnect() {
      setConnected(false);
      setBusy(false);
    }
    function failure() {
      setConnected(false);
      setError("החיבור לשרת לא זמין. מנסים להתחבר מחדש…");
    }
    function identity(value: string) {
      setId(value);
    }
    function roomState(value: Room) {
      setRoom(value);
    }
    function gameState(value: View) {
      setGame((old) => (!old || value.revision >= old.revision ? value : old));
    }
    function left() {
      setRoom(null);
      setGame(null);
    }
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", failure);
    socket.on("identity", identity);
    socket.on("room-state", roomState);
    socket.on("game-state", gameState);
    socket.on("room-left", left);
    if (socket.connected) connect();
    return () => {
      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("connect_error", failure);
      socket.off("identity", identity);
      socket.off("room-state", roomState);
      socket.off("game-state", gameState);
      socket.off("room-left", left);
    };
  }, []);
  function request(event: string, data: unknown) {
    if (busy) return;
    if (!connected) {
      setError("ממתינים לחיבור לשרת");
      return;
    }
    setBusy(true);
    setError("");
    socket
      .timeout(8000)
      .emit(event, data, (timeout: Error | null, reply: Reply) => {
        setBusy(false);
        if (timeout)
          setError("לא התקבל אישור מהשרת. בדוק את הלוח לפני ניסיון נוסף.");
        else if (!reply.success) setError(reply.message || "הפעולה נכשלה");
      });
  }
  return (
    <div className="app" dir="rtl">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          CATAN<span>האי מחכה לכם</span>
        </a>
        <div className="room-meta">
          <button
            className="quiet cards-preview-button"
            onClick={() => setShowCards(true)}
          >
            הצג את הקלפים
          </button>
          {room && (
            <span>
              חדר <b dir="ltr">{room.roomCode}</b>
            </span>
          )}
          <span
            className={connected ? "connection" : "connection disconnected"}
          >
            {connected ? "● מחובר" : "● מתחבר מחדש"}
          </span>
          {room && (!room.started || g?.winner) && (
            <button
              className="quiet"
              disabled={busy}
              onClick={() => request("leave-room", {})}
            >
              יציאה מהחדר
            </button>
          )}
        </div>
      </header>
      {!connected && room && (
        <div className="notice" role="status">
          החיבור נותק. המשחק נשמר והמקום שלך נשמר; מנסים להתחבר מחדש.
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
          <button aria-label="סגור הודעה" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {!room ? (
        <main className="welcome">
          <section>
            <span className="eyebrow">
              קטאן · משחק הבסיס וערים ואבירים · 3–4 שחקנים
            </span>
            <h1>
              בונים אי.
              <br />
              יוצרים אימפריה.
            </h1>
            <p>
              סחרו במשאבים, סללו דרכים והקימו יישובים.
              <br />
              {mode === "cities-knights"
                ? "אבירים מגינים על האי. מטרופולינים מובילים ל־13 נקודות."
                : "הראשון שמגיע ל־10 נקודות בתורו מנצח."}
            </p>
            <div className="feature-list">
              <span>🌾 משאבים ומסחר</span>
              <span>🛤 דרכים וערים</span>
              <span>🃏 קלפי פיתוח</span>
            </div>
          </section>
          <section className="panel entry">
            <h2>יוצאים לדרך</h2>
            <ModePicker mode={mode} onChange={setMode} disabled={busy} />
            <label>
              שם השחקן
              <input
                placeholder="השם שלך"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={!connected || busy || !name.trim()}
              onClick={() => request("create-room", { playerName: name, mode })}
            >
              צור משחק
            </button>
            <div className="divider">או הצטרפו לחברים</div>
            <label>
              קוד חדר
              <input
                placeholder="קוד חדר"
                dir="ltr"
                value={code}
                maxLength={5}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button
              disabled={!connected || busy || !name.trim() || !code.trim()}
              onClick={() =>
                request("join-room", { playerName: name, roomCode: code })
              }
            >
              הצטרף למשחק
            </button>
          </section>
        </main>
      ) : !room.started ? (
        <main className="lobby panel">
          <span className="eyebrow">מכינים את האי</span>
          <h1>החדר שלכם מוכן</h1>
          <p>שתפו את הקוד עם החברים</p>
          <ModePicker
            mode={room.mode}
            disabled={busy || room.hostId !== id}
            onChange={(mode) => request("set-mode", { mode })}
          />
          <strong className="room-code" dir="ltr">
            {room.roomCode}
          </strong>
          <ul>
            {room.players.map((p) => (
              <li key={p.id}>
                <span className={`dot ${p.color}`} />
                {p.name}
                {p.id === id ? " (אתה)" : ""}
                {p.id === room.hostId ? " · מארח" : ""}
                <span className="muted">{p.online ? "מחובר" : "לא מחובר"}</span>
              </li>
            ))}
          </ul>
          <p>שני המצבים מיועדים ל־3–4 שחקנים. כל שחקן מצטרף מחלון נפרד.</p>
          {room.hostId === id ? (
            <button
              className="primary"
              disabled={
                busy ||
                room.players.length < 3 ||
                room.players.some((p) => !p.online)
              }
              onClick={() => request("start-game", {})}
            >
              התחל משחק
            </button>
          ) : (
            <p>ממתינים למארח שיתחיל את המשחק</p>
          )}
        </main>
      ) : g ? (
        <Game
          g={g}
          room={room}
          id={id}
          send={(action) => request("game-action", action)}
          busy={busy}
          connected={connected}
        />
      ) : (
        <p className="notice">טוענים את המשחק…</p>
      )}
      {showCards && <CardGallery onClose={() => setShowCards(false)} />}
      <footer>
        <details>
          <summary>איך משחקים?</summary>
          <p>
            מציבים שני יישובים ושתי דרכים בסדר הלוך־חזור. היישוב השני מספק
            משאבים התחלתיים. בתור שלך מגלגלים קוביות, סוחרים ובונים. יישוב מפיק
            משאב אחד ועיר שניים. שומרים על מרחק של שתי צלעות בין מבנים. ב־7
            משליכים חצי מהיד אם יש מעל 7 קלפים, מזיזים שודד וגונבים משאב.
          </p>
          <p>
            הדרך הארוכה (לפחות 5) והצבא הגדול (לפחות 3 אבירים) מעניקים 2 נקודות
            כל אחד. נקודות פיתוח נשארות חסויות. הראשון שמגיע ל־10 בתורו מנצח.
            ההתקדמות נשמרת בשרת; חזרה באותה לשונית משחזרת את המקום.
          </p>
          <div className="expansion-help">
            <strong>ערים ואבירים</strong>
            <p>
              מתחילים ביישוב ובעיר. ערים מפיקות נייר, בד ומטבעות לצד משאבים.
              מפתחים מדע, פוליטיקה ומסחר; שער תואם וקובייה אדומה מעניקים קלפי
              התקדמות. מגייסים אבירים ומפעילים בחיטה להגנת האי. כל שבעה צעדי
              ספינה מגיעה פלישת ברברים. חומות מוסיפות שני קלפים לסף ההשלכה. אין
              צבא גדול או קניית קלפי פיתוח. מנצחים עם 13 נקודות בתורך.
            </p>
          </div>
          <a
            href="https://www.catan.com/understand-catan/game-rules"
            target="_blank"
            rel="noreferrer"
          >
            חוקי CATAN הרשמיים ↗
          </a>
        </details>
        <span>משחק חברים עצמאי · בסיס או ערים ואבירים</span>
      </footer>
    </div>
  );
}
export default App;
