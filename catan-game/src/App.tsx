import robberPiece from "./assets/pieces/robber-painted.png";
import { SeaFrame } from "./components/SeaFrame";
import {
  HarborArt,
  BarbarianTrack,
  GameDice,
} from "./components/BoardOrnaments";
import { knightRanks } from "./components/pieceRanks";
import { KnightArt, WallArt } from "./components/PieceArt";
import { useEffect, useState } from "react";
import { socket, saveAccountToken } from "./socket";
import { AccountCenter } from "./components/Account";
import type { Profile } from "./components/Account";
import {
  COSTS,
  RESOURCES,
  MATERIALS,
  boardFor,
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
import { RankedChoice } from "./components/RankedChoice";
import { placementFor } from "./components/Placement";
import type { Placement, PickRequest } from "./components/Placement";
import { BoardZoom } from "./components/BoardZoom";
import { WelcomeIsland } from "./components/WelcomeIsland";
import { SeafarersPanel, GoldChoice } from "./components/Seafarers";
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
  stone: "אבן",
  paper: "נייר",
  cloth: "בד",
  coin: "מטבעות",
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
  seafarers?: boolean;
  friendlyRobber?: boolean;
  mode: "base" | "cities-knights";
  roomCode: string;
  hostId: string;
  started: boolean;
  ranked?: boolean;
  rewards?: {
    id: string;
    name: string;
    registered: boolean;
    earned: number;
    finalScore: number;
  }[];
  players: {
    id: string;
    name: string;
    color: Color;
    online: boolean;
    accountId?: string | null;
    botDifficulty?: "easy" | "medium" | "hard";
  }[];
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
  viewBox,
  placement,
  onKnightClick,
}: {
  g: View;
  mode: Build | null;
  send: Send;
  disabled: boolean;
  viewBox: string;
  placement: Placement | null;
  onKnightClick: (playerId: string) => void;
}) {
  const { vertices: VERTICES, edges: EDGES, ports: PORTS } = boardFor(g);
  const roadIds = new Set(
    placement ? placement.edges : mode === "road" ? g.legal.roads : [],
  );
  const vertexIds = new Set(
    placement
      ? placement.vertices
      : mode === "city"
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
    <svg className="board" viewBox={viewBox} role="group" aria-label="לוח קטאן">
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
      <SeaFrame g={g} />
      {g.tiles.map((t) => (
        <g key={t.id}>
          {["sea", "gold"].includes(t.resource) ? (
            <polygon
              points={hexPoints(t.x, t.y)}
              fill={t.resource === "sea" ? "#297b9a" : "#d6b74e"}
              stroke="#b8d5d0"
              strokeWidth="2"
            />
          ) : (
            <image
              href={resourceImages[t.resource as keyof typeof resourceImages]}
              x={t.x - 55}
              y={t.y - 63}
              width="110"
              height="126"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#tile-${t.id})`}
            />
          )}
          {t.resource === "gold" && (
            <text
              x={t.x}
              y={t.y - 15}
              textAnchor="middle"
              fontSize="22"
              fill="#6b491c"
            >
              ◆ זהב
            </text>
          )}
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
              <image
                className="robber-piece"
                href={robberPiece}
                x={t.x - 19}
                y={t.y - 51}
                width="38"
                height="43"
                preserveAspectRatio="xMidYMax meet"
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
              aria-label={`העבר ${t.resource === "sea" ? "פיראט" : "שודד"} למשושה ${t.id + 1}`}
              className="target"
              onClick={() =>
                send({
                  type: t.resource === "sea" ? "move-pirate" : "move-robber",
                  tileId: t.id,
                })
              }
              onKeyDown={(e) =>
                keyAction(e, {
                  type: t.resource === "sea" ? "move-pirate" : "move-robber",
                  tileId: t.id,
                })
              }
            />
          )}
        </g>
      ))}
      {PORTS.map((port, i) => {
        const dx = port.x - 400,
          dy = port.y - 270,
          len = Math.hypot(dx, dy),
          x = port.x + (dx / len) * 31,
          y = port.y + (dy / len) * 31;
        return (
          <g
            key={i}
            className="port"
            role="img"
            aria-label={`נמל ${port.resource === "any" ? "כללי" : names[port.resource]} ${port.resource === "any" ? "3:1" : "2:1"}`}
          >
            <title>
              {port.resource === "any"
                ? "נמל כללי · 3 קלפים תמורת אחד"
                : `נמל ${names[port.resource]} · 2 תמורת אחד`}
            </title>
            {port.vertices.map((id) => {
              const v = VERTICES.find((v) => v.id === id)!;
              return (
                <line
                  key={id}
                  x1={v.x}
                  y1={v.y}
                  x2={x}
                  y2={y}
                  stroke="#d1b77d"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
              );
            })}
            <svg
              x={x - 26}
              y={y - 31}
              width="52"
              height="51"
              viewBox="0 0 52 51"
            >
              <HarborArt kind={port.resource} />
            </svg>
            <rect
              x={x - 26}
              y={y + 15}
              width="55"
              height="18"
              rx="3"
              fill="#fff0cf"
              stroke="#94784e"
              strokeWidth=".7"
            />
            <text
              x={x + 1.5}
              y={y + 27}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#3e443a"
            >
              {port.resource === "any" ? "כללי 3:1" : names[port.resource] + " 2:1"}
            </text>
          </g>
        );
      })}
      {g.roads.map((r) => {
        const edge = EDGES.find((e) => e.id === r.edgeId)!;
        if (r.type === "ship")
          return (
            <g
              key={r.edgeId}
              aria-label="ספינה"
              transform={`translate(${edge.x} ${edge.y}) rotate(${edge.angle})`}
            >
              <path
                d="M -23 7 L -14 15 L 15 15 L 24 7 Z"
                fill={
                  {
                    blue: "#438cdf",
                    red: "#d55a4b",
                    green: "#4b9f68",
                    yellow: "#dfb845",
                  }[r.color]
                }
                stroke="white"
                strokeWidth="1.5"
              />
              <path
                d="M 0 6 L 0 -20 L 17 3 Z"
                fill="#fff6d9"
                stroke="#78694b"
              />
            </g>
          );
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
            <g
              key={edge.id}
              transform={`rotate(${edge.angle} ${edge.x} ${edge.y})`}
              className="road-placement-target"
              role="button"
              tabIndex={0}
              aria-label={`${placement?.title || "בנה דרך"} ${i + 1}`}
              onClick={() =>
                send(
                  placement
                    ? { ...placement.action, [placement.field]: edge.id }
                    : { type: "build-road", edgeId: edge.id },
                )
              }
              onKeyDown={(e) =>
                keyAction(
                  e,
                  placement
                    ? { ...placement.action, [placement.field]: edge.id }
                    : { type: "build-road", edgeId: edge.id },
                )
              }
            >
              <rect x={edge.x - 27} y={edge.y - 20} width="54" height="40" fill="transparent" />
              <rect x={edge.x - 24} y={edge.y - 4} width="48" height="8" rx="4" fill="#fff4bd" className="target" pointerEvents="none" />
            </g>
          );
        })}
      {!disabled &&
        VERTICES.filter((v) => vertexIds.has(v.id)).map((v, i) => (
          <circle
            key={v.id}
            cx={v.x}
            cy={v.y}
            r="20"
            fill="#fff5cc"
            stroke="#d28c22"
            strokeWidth="3"
            className="target"
            role="button"
            tabIndex={0}
            aria-label={`${placement?.title || `בנה ${mode === "city" ? "עיר" : "יישוב"}`} ${i + 1}`}
            onClick={() =>
              send(
                placement
                  ? { ...placement.action, [placement.field]: v.id }
                  : { type: `build-${mode}`, vertexId: v.id },
              )
            }
            onKeyDown={(e) =>
              keyAction(
                e,
                placement
                  ? { ...placement.action, [placement.field]: v.id }
                  : { type: `build-${mode}`, vertexId: v.id },
              )
            }
          />
        ))}
      {g.seafarers &&
        g.mode !== "cities-knights" &&
        VERTICES.map((v, i) => (
          <text className="site-number" key={v.id} x={v.x + 11} y={v.y - 12}>
            {i + 1}
          </text>
        ))}
      {g.seafarers && g.pirate != null && (
        <text
          x={g.tiles[g.pirate].x}
          y={g.tiles[g.pirate].y}
          textAnchor="middle"
          fontSize="32"
          aria-label="פיראט"
        >
          ☠
        </text>
      )}
      {g.mode === "cities-knights" && (
        <>
          {g.buildings
            .filter((b) => b.wall || b.metropolis)
            .map((b) => {
              const v = VERTICES.find((v) => v.id === b.vertexId)!;
              return (
                <g key={b.vertexId}>
                  {b.wall && (
                    <svg
                      x={v.x - 32}
                      y={v.y + 5}
                      width="64"
                      height="36"
                      viewBox="0 0 80 58"
                      className="city-wall-art"
                      aria-label="חומת עיר"
                    >
                      <WallArt color={b.color} />
                    </svg>
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
                className="knight-piece"
                onClick={() => !placement && onKnightClick(k.playerId)}
                role="button"
                tabIndex={placement ? -1 : 0}
                onKeyDown={(e) => {
                  if (!placement && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onKnightClick(k.playerId);
                  }
                }}
                style={{ pointerEvents: placement ? "none" : "auto" }}
                aria-label={`אביר דרגה ${k.level} ${k.active ? "פעיל" : "לא פעיל"}`}
              >
                <title>
                  {knightRanks[k.level]} · {k.active ? "פעיל" : "לא פעיל"} ·{" "}
                  {k.level === 1
                    ? "כוכב אחד"
                    : k.level === 2
                      ? "שני כוכבים"
                      : "שלושה כוכבים"}
                </title>
                <ellipse
                  cx={v.x}
                  cy={v.y + 9}
                  rx="16"
                  ry="5"
                  fill={k.active ? "#c6a247" : "#6c7677"}
                  stroke={k.active ? "#fff0b3" : "#c2cbca"}
                  strokeWidth="1.3"
                />
                <svg
                  x={v.x - 18}
                  y={v.y - 26}
                  width="36"
                  height="39"
                  viewBox="0 0 64 70"
                >
                  <KnightArt
                    color={k.color}
                    level={k.level}
                    active={k.active}
                  />
                </svg>
                <circle
                  cx={v.x + 12}
                  cy={v.y + 9}
                  r="4"
                  fill={k.active ? "#4f9b56" : "#808986"}
                  stroke="#fff2d5"
                  strokeWidth="1"
                />
                <text
                  className="knight-state-label"
                  x={v.x}
                  y={v.y + 22}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontWeight="700"
                  fill="#fff6da"
                  stroke="#344844"
                  strokeWidth="1.6"
                  paintOrder="stroke"
                >
                  {k.active ? "פעיל" : "לא פעיל"}
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
function TradeNotification({
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
  const [dismissed, setDismissed] = useState(false),
    offer = g.trade,
    active = g.players[g.currentPlayerIndex].id;
  if (
    dismissed ||
    (g.tradeResponses?.some(r => r.offerId === offer?.id && r.playerId === id && r.status === "rejected") ?? false) ||
    !offer ||
    offer.from === id ||
    g.stage !== "action" ||
    (active !== id && offer.from !== active)
  )
    return null;
  const enough = canPay(g.me.resources, offer.want);
  return (
    <section
      className="trade-notification"
      role="dialog"
      aria-labelledby="incoming-trade-title"
      aria-describedby="incoming-trade-detail"
    >
      <div className="section-title">
        <h2 id="incoming-trade-title">הצעת מסחר חדשה</h2>
        <button
          className="quiet"
          aria-label="סגור הצעת מסחר"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
      <p id="incoming-trade-detail">
        <strong>{g.players.find((p) => p.id === offer.from)?.name}</strong> רוצה
        לסחור איתך
      </p>
      <div className="trade-exchange">
        <div>
          <small>תקבל</small>
          <strong>{handText(offer.give)}</strong>
        </div>
        <span aria-hidden="true">⇄</span>
        <div>
          <small>תיתן</small>
          <strong>{handText(offer.want)}</strong>
        </div>
      </div>
      {!enough && <p className="muted">אין לך כרגע מספיק משאבים לעסקה.</p>}
      <div className="button-row">
        <button
          className="primary"
          disabled={busy || !enough}
          onClick={() => send({ type: "accept-trade", offerId: offer.id })}
        >
          קבל עסקה
        </button>
        <button disabled={busy} onClick={() => { send({ type: "reject-trade", offerId: offer.id }); setDismissed(true); }}>לא מעוניין</button>
      </div>
    </section>
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
    <details className="panel trade-drawer" open>
      <summary>
        מסחר <small>בנק ושחקנים</small>
      </summary>
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
              onClick={() =>
                send({ type: "accept-trade", offerId: g.trade?.id })
              }
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
    </details>
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
    <details
      className="panel development-drawer"
      open={g.me.development.length > 0}
    >
      <summary>
        קלפי הפיתוח שלי <span className="count">{g.me.development.length}</span>
      </summary>
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
    </details>
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
function StealPicker({ g, send, busy }: { g: View; send: Send; busy: boolean }) {
  const [victimId, setVictimId] = useState("");
  const victim = g.players.find(p => p.id === victimId && g.victims.includes(p.id));
  return <section className="panel urgent theft-picker">
    <h2>{victim ? "בחר קלף סגור של " + victim.name : "ממי תרצה לגנוב?"}</h2>
    {!victim ? g.victims.map(v => <button key={v} disabled={busy} onClick={() => setVictimId(v)}>{g.players.find(p => p.id === v)?.name}</button>) : <>
      <p className="muted">הקלפים מוסתרים ומעורבבים. בחר קלף אחד.</p>
      <div className="closed-cards">{Array.from({length: victim.resourceCount}, (_, i) => <button key={i} aria-label={"גנוב קלף סגור " + (i + 1)} disabled={busy} onClick={() => send({ type: "steal", victimId, cardIndex: i })}><span aria-hidden="true">?</span></button>)}</div>
      <button disabled={busy} onClick={() => setVictimId("")}>בחר שחקן אחר</button>
    </>}
  </section>;
}
function GameFeedback({g, id}: {g: View; id: string}) {
  const [hidden, setHidden] = useState("");
  const theft = g.me.lastTheft;
  const responses = (g.tradeResponses ?? []).filter(r => r.from === id);
  const key = JSON.stringify([theft?.id, responses]);
  if ((!theft && !responses.length) || hidden === key) return null;
  return <section className="game-feedback" role="status">
    <button aria-label="סגור עדכון" onClick={() => setHidden(key)}>×</button>
    {responses.map(r => <p key={r.playerId}>{g.players.find(p => p.id === r.playerId)?.name} {r.status === "accepted" ? "אישר/ה את המסחר — העסקה הושלמה" : "דחה/תה את הצעת המסחר"}</p>)}
    {theft && <p>קיבלת בגניבה: <strong>{names[theft.resource]}</strong> מ־{g.players.find(p => p.id === theft.victimId)?.name}</p>}
  </section>;
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
  const [zoomControls, setZoomControls] = useState<HTMLDivElement | null>(null);
  const [armyOpen, setArmyOpen] = useState(false);
  const [rollRequest, setRollRequest] = useState(0);
  const [tool, setTool] = useState(""),
    [pick, setPick] = useState<(PickRequest & { turn: number }) | null>(null);
  const chooseOnBoard = (request: PickRequest) => {
    setPick({ ...request, turn: g.turnNumber });
    setBuild(null);
  };
  const geometry = boardFor(g),
    boardChoice =
      g.choice?.playerId === id &&
      g.choice.options?.some(
        (o) =>
          geometry.vertices.some((v) => v.id === o.id) ||
          geometry.edges.some((e) => e.id === o.id),
      );
  const placement = boardChoice
    ? placementFor(g, id, {
        title: g.choice!.title + " · לחץ על הלוח",
        action: { type: "expansion-choice" },
        field: "choice",
      })
    : pick &&
        pick.turn === g.turnNumber &&
        ["action", "setup-road", "road-building"].includes(g.stage)
      ? placementFor(g, id, pick)
      : null;
  const [menu, setMenu] = useState(true),
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
      ? (forced ??
        (!placement && tool === "build" && menu && g.stage === "action"
          ? build
          : null))
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
    steal: "בחר ממי לגנוב ואז בחר קלף סגור",
    "road-building": `הצב עד ${g.freeRoads} דרכים ללא עלות`,
    "game-over": "המשחק הסתיים",
  };
  const doAction: Send = (a) => {
    if (a.type === "select-ship-to-move") {
      chooseOnBoard({
        title: "בחר יעד לספינה",
        action: { type: "move-ship", edgeId: a.edgeId },
        field: "destination",
      });
      return;
    }
    setPick(null);
    setBuild(null);
    send(a);
  };
  return (
    <>
      <TradeNotification
        key={g.trade?.id ?? JSON.stringify(g.trade)}
        g={g}
        id={id}
        send={send}
        busy={busy || !connected}
      />
      <GameFeedback g={g} id={id} />
      <div className="players">
        {g.players.map((p) => (
          <details
            key={p.id}
            className={`player-card ${p.id === g.players[g.currentPlayerIndex].id ? "current" : ""}`}
          >
            <summary>
              <span className={`dot ${p.color}`} />
              <strong>
                {p.name}
                {p.id === id ? " (אתה)" : ""}
              </strong>
              <span
                className={`online ${room.players.find((x) => x.id === p.id)?.online ? "" : "offline"}`}
                title="מצב חיבור"
              />
              <b>{p.score} נקודות</b>
            </summary>
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
          </details>
        ))}
      </div>
      <div className="game-grid">
        <main className="island">
          {placement && (
            <div className="placement-prompt" role="status">
              {placement.title} ·{" "}
              {placement.vertices.length + placement.edges.length} מקומות חוקיים{" "}
              <button onClick={() => setPick(null)}>בטל בחירה</button>
            </div>
          )}
          <div className="board-area">
            <div className="board-status">
              {" "}
              <div className="turn-banner">
                <span className="eyebrow">
                  תור {g.turnNumber} ·{" "}
                  {g.stage.startsWith("setup") ? "הצבה ראשונית" : "משחק"} ·{" "}
                  {g.mode === "cities-knights"
                    ? `ערים ואבירים · ${g.targetScore} נקודות`
                    : `משחק בסיס · ${g.targetScore} נקודות`}
                </span>
                <p>
                  {g.seafarers
                    ? `יורדי הים · יעד ${g.targetScore} נקודות · מפה מקורית`
                    : ""}
                </p>
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
              <div className="side-zoom" ref={setZoomControls} />
              {g.mode === "cities-knights" && (
                <>
                  <BarbarianTrack g={g} />
                  <div className="army-anchor">
                    <button
                      className="army-toggle"
                      aria-expanded={armyOpen}
                      disabled={!g.knightPieces?.some((k) => k.playerId === id)}
                      onClick={() => setArmyOpen(!armyOpen)}
                    >
                      האבירים שלי ·{" "}
                      {g.knightPieces?.filter((k) => k.playerId === id)
                        .length ?? 0}
                    </button>
                    {armyOpen && (
                      <div className="army-popover">
                        <button
                          className="army-close"
                          aria-label="סגור ניהול אבירים"
                          onClick={() => setArmyOpen(false)}
                        >
                          ×
                        </button>
                        <ExpansionPanel
                          g={g}
                          id={id}
                          send={doAction}
                          busy={disabled}
                          section="knights"
                          onPick={(request) => {
                            chooseOnBoard(request);
                            setArmyOpen(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>{" "}
            <BoardZoom seafarers={!!g.seafarers} controls={zoomControls}>
              {(viewBox) => (
                <Board
                  g={g}
                  mode={mode}
                  send={doAction}
                  disabled={disabled || (!active && !boardChoice)}
                  viewBox={viewBox}
                  placement={placement}
                  onKnightClick={(owner) => {
                    if (owner === id) setArmyOpen(true);
                  }}
                />
              )}
            </BoardZoom>
          </div>
          <div className="board-caption">
            {mode
              ? `בחר מיקום חוקי לבניית ${buildNames[mode]}`
              : "הנקודות והצלעות הזמינות מופיעות בעת בחירת בנייה"}{" "}
            · ⚓ נמלים לאורך החוף
          </div>
          <section className="panel hand-dock">
            <div className="section-title">
              <button
                className="hand-toggle"
                aria-expanded={tool === "cards"}
                onClick={() => setTool(tool === "cards" ? "" : "cards")}
              >
                הקלפים שלי {tool === "cards" ? "−" : "+"}
              </button>
              <span className="count">{total(g.me.resources)} קלפים</span>
            </div>
            <div
              className={`hand ${tool === "cards" ? "expanded" : "compact"}`}
            >
              {(g.mode === "cities-knights" ? MATERIALS : RESOURCES).map(
                (r) => (
                  <div
                    key={r}
                    className="hand-card"
                    aria-label={`${names[r]} – ${g.me.resources[r]} קלפים`}
                  >
                    {tool === "cards" ? (
                      <PlayingCard kind={r} count={g.me.resources[r]} />
                    ) : (
                      <button
                        className="resource-total"
                        onClick={() => setTool("cards")}
                      >
                        <span>{names[r]}</span>
                        <b>{g.me.resources[r]}</b>
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
            <p className="muted">
              רק אתה רואה את חלוקת החומרים ואת הקלפים שבידך.
            </p>
          </section>
        </main>
        <aside className="sidebar">
          <div className="action-dock">
          {!g.winner && (
            <section className="panel turn-controls">
              <GameDice g={g} rollRequest={rollRequest} />
              <div className="button-row">
                {active && g.stage === "pre-roll" && (
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => { setRollRequest(n => n + 1); send({ type: "roll-dice" }); }}
                  >
                    גלגל קוביות
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

          <nav className="tool-tabs" role="tablist" aria-label="כלי המשחק">
            {[
              ["build", "בנייה"],
              ["trade", "מסחר"],
              ...(g.mode === "cities-knights" ? [["cities", "ערים"]] : []),
              ["cards", "קלפים"],
              ["info", "מידע"],
            ].map(([key, label]) => (
              <button
                role="tab"
                aria-selected={tool === key}
                key={key}
                onClick={() => {
                  setTool(tool === key ? "" : key);
                  setMenu(true);
                  setPick(null);
                  setBuild(null);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          </div>
          <div className="tool-scroll" data-tool={tool}>
            {g.seafarers && (
              <div className="tool-build">
                <SeafarersPanel
                  g={g}
                  id={id}
                  send={send}
                  busy={disabled}
                  onPick={chooseOnBoard}
                />
              </div>
            )}
            {g.goldChoice && (
              <GoldChoice g={g} id={id} send={send} busy={disabled} />
            )}
            {g.mode === "cities-knights" && (
              <div className="tool-info">
                <ExpansionStatus g={g} />
              </div>
            )}
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
                <p>
                  {room.ranked
                    ? "המשחק המדורג הסתיים. נקודות נשמרו לחשבונות המחוברים; תוצאות האורחים מופיעות כאן."
                    : "משחק חברים אינו משנה את הדירוג. אפשר לבחור משחק מדורג בלובי של המשחק הבא."}
                </p>
                {!!room.rewards?.length && (
                  <ol className="result-table">
                    {[...room.rewards]
                      .sort((a, b) => b.finalScore - a.finalScore)
                      .map((p) => (
                        <li key={p.id}>
                          <strong>
                            {p.name}
                            <small>
                              {p.registered
                                ? "נשמר בפרופיל"
                                : "אורח · תוצאה למשחק הזה"}
                            </small>
                          </strong>
                          <span>{p.finalScore} נקודות משחק</span>
                          <b>+{p.earned}</b>
                        </li>
                      ))}
                  </ol>
                )}
                <p>אפשר לצאת מהחדר ולהתחיל משחק חדש.</p>
              </section>
            )}
            {!g.winner && (
              <section className="panel tool-build">
                <h2>בנייה</h2>
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
                            disabled ||
                            !active ||
                            g.stage !== "action" ||
                            !count
                          }
                          onClick={() => {
                            setPick(null);
                            setBuild(build === type ? null : type);
                          }}
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
                    {g.mode === "cities-knights" && (
                      <>
                        <button
                          aria-label="גייס אביר · צמר + אבן"
                          disabled={
                            disabled ||
                            !active ||
                            g.stage !== "action" ||
                            !g.expansionLegal?.hire.length ||
                            !canPay(g.me.resources, { sheep: 1, stone: 1 })
                          }
                          onClick={() =>
                            chooseOnBoard({
                              title: "בחר מיקום לאביר",
                              action: { type: "hire-knight" },
                              field: "vertexId",
                            })
                          }
                        >
                          <KnightArt
                            color={g.players.find((p) => p.id === id)!.color}
                          />
                          <span>
                            <strong>אביר</strong>
                            <small>1 צמר + 1 אבן</small>
                          </span>
                        </button>
                        <button
                          aria-label="בנה חומה · שתי לבנים"
                          disabled={
                            disabled ||
                            !active ||
                            g.stage !== "action" ||
                            !g.buildings.some(
                              (b) =>
                                b.playerId === id &&
                                b.type === "city" &&
                                !b.wall,
                            ) ||
                            g.buildings.filter(
                              (b) => b.playerId === id && b.wall,
                            ).length >= 3 ||
                            !canPay(g.me.resources, { brick: 2 })
                          }
                          onClick={() =>
                            chooseOnBoard({
                              title: "בחר עיר לחומה",
                              action: { type: "build-wall" },
                              field: "vertexId",
                            })
                          }
                        >
                          <WallArt
                            color={g.players.find((p) => p.id === id)!.color}
                          />
                          <span>
                            <strong>חומה</strong>
                            <small>2 לבנים</small>
                          </span>
                        </button>
                      </>
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
            {g.stage === "steal" && active && <StealPicker key={g.turnNumber + "-" + g.robber + "-" + g.pirate} g={g} send={send} busy={disabled} />}
            {g.mode === "cities-knights" &&
              ["cities", "cards"].includes(tool) && (
                <ExpansionPanel
                  g={g}
                  id={id}
                  send={doAction}
                  busy={disabled}
                  onPick={chooseOnBoard}
                  section={
                    tool === "cities"
                      ? "cities"
                      : tool === "cards"
                        ? "cards"
                        : "knights"
                  }
                />
              )}
            {g.stage === "action" && tool === "trade" && (
              <TradePanel
                key={`trade-${g.turnNumber}`}
                g={g}
                id={id}
                send={send}
                busy={disabled}
              />
            )}
            {!g.winner && g.mode !== "cities-knights" && tool === "cards" && (
              <DevelopmentPanel
                key={`development-${g.turnNumber}`}
                g={g}
                active={active}
                send={send}
                busy={disabled}
              />
            )}
            <details className="panel tool-info">
              <summary>הבנק</summary>
              <p>{handText(g.bank)}</p>
              <p>קלפי פיתוח שנותרו: {g.developmentRemaining}</p>
            </details>
            <details className="panel tool-info" open>
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
          </div>
        </aside>
      </div>
    </>
  );
}
function ModePicker({
  mode,
  onChange,
  disabled,
  seafarers,
  onSeafarers,
}: {
  mode: Room["mode"];
  onChange: (m: Room["mode"]) => void;
  disabled: boolean;
  seafarers: boolean;
  onSeafarers: (value: boolean) => void;
}) {
  return (
    <fieldset className="mode-picker">
      <legend>משחק והרחבות</legend>
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
      <label className={`sea-option ${seafarers ? "selected" : ""}`}>
        <input
          type="checkbox"
          checked={seafarers}
          disabled={disabled}
          onChange={(e) => onSeafarers(e.target.checked)}
        />
        <span>
          <strong>יורדי הים</strong>
          <small>ספינות, פיראט, זהב ואיים חדשים · משתלב עם שני המצבים</small>
        </span>
      </label>
    </fieldset>
  );
}
function App() {
  const [lastRoom, setLastRoom] = useState(
    () => localStorage.getItem("catan-last-room") || "",
  );
  const [showCards, setShowCards] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState("medium");
  const [account, setAccount] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Room["mode"]>("base");
  const [ranked, setRanked] = useState(false);
  const [extras, setExtras] = useState({
    seafarers: false,
  });
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
      localStorage.setItem("catan-last-room", value.roomCode);
      setLastRoom(value.roomCode);
      setRoom(value);
    }
    function gameState(value: View) {
      setGame((old) => (!old || value.revision >= old.revision ? value : old));
    }
    function left() {
      setRoom(null);
      setGame(null);
    }
    function accountState(value: Profile | null) {
      setAccount(value);
      if (value) setName(value.displayName);
      else saveAccountToken(null);
    }
    socket.on("account-state", accountState);
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", failure);
    socket.on("identity", identity);
    socket.on("room-state", roomState);
    socket.on("game-state", gameState);
    socket.on("room-left", left);
    if (socket.connected) connect();
    return () => {
      socket.off("account-state", accountState);
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
    <div className={`app ${g ? "is-playing" : ""}`} dir="rtl">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          CATAN
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
              <small className="match-kind">
                {room.ranked ? "מדורג" : "חברים"}
              </small>
            </span>
          )}
          <span
            className={connected ? "connection" : "connection disconnected"}
          >
            {connected ? "● מחובר" : "● מתחבר מחדש"}
          </span>
          {room && (
            <button
              className="quiet"
              disabled={busy}
              onClick={() => request("leave-room", {})}
            >
              {room.started && !g?.winner ? "יציאה מהמשחק" : "יציאה מהחדר"}
            </button>
          )}
        </div>
      </header>
      <AccountCenter
        profile={account}
        connected={connected}
        inGame={!!room?.started && !g?.winner}
      />
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
          {lastRoom && (
            <div className="return-game">
              <button
                disabled={busy || !connected}
                onClick={() =>
                  request("join-room", { roomCode: lastRoom, playerName: name })
                }
              >
                חזור למשחק {lastRoom}
              </button>
              <small>
                אפשר לחזור עם אותו משתמש או דפדפן. יציאה וניתוק לא מורידים
                נקודות.
              </small>
            </div>
          )}
          <section>
            <h1>קטאן</h1>
            <p>
              פותחים חדר, מזמינים חברים ומתחילים לסחור.
              <br />
              {`הראשון שמגיע ל־${extras.seafarers ? (mode === "cities-knights" ? 17 : 14) : mode === "cities-knights" ? 13 : 10} נקודות בתורו מנצח.`}
            </p>
            <div className="feature-list">
              <span>3–4 שחקנים</span>
              <span>משחק הבסיס והרחבות</span>
              <span>חברים או מדורג — אתם בוחרים</span>
            </div>
            <WelcomeIsland />
          </section>
          <section className="panel entry">
            <div className="entry-title">
              <h2>פותחים משחק</h2>
            </div>
            <RankedChoice
              ranked={ranked}
              onChange={setRanked}
              disabled={busy}
            />
            <ModePicker
              mode={mode}
              onChange={setMode}
              disabled={busy}
              seafarers={extras.seafarers}
              onSeafarers={(seafarers) => setExtras({ seafarers })}
            />
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
              onClick={() =>
                request("create-room", {
                  playerName: name,
                  mode,
                  ranked,
                  ...extras,
                })
              }
            >
              צור משחק
            </button>
            <p className="muted">רוצה לשחק נגד המחשב? צור משחק והוסף בוטים בלובי.</p>
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
          <RankedChoice
            ranked={!!room.ranked}
            disabled={busy || room.hostId !== id || room.players.some(p => !!p.botDifficulty)}
            onChange={(ranked) =>
              request("set-mode", { mode: room.mode, ranked })
            }
          />
          <p className="ranking-notice">
            {room.ranked
              ? "משחק מדורג · 100 נקודות לניצחון ו־20 לסיום"
              : "משחק חברים · ללא שינוי בדירוג האישי"}
          </p>
          <ModePicker
            mode={room.mode}
            disabled={busy || room.hostId !== id}
            onChange={(mode) => request("set-mode", { mode })}
            seafarers={!!room.seafarers}
            onSeafarers={(seafarers) =>
              request("set-mode", { mode: room.mode, seafarers })
            }
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
                {p.botDifficulty ? " · מחשב · רמה " + ({ easy: "קלה", medium: "בינונית", hard: "קשה" }[p.botDifficulty]) : p.accountId ? " · חשבון מחובר" : " · אורח"}
                {p.botDifficulty && room.hostId === id && <button disabled={busy} onClick={() => request("remove-bot", { playerId: p.id })}>הסר בוט</button>}
                <span className="muted">{p.online ? "מחובר" : "לא מחובר"}</span>
              </li>
            ))}
          </ul>
          <p>אפשר לשחק לבד נגד שני בוטים, או להוסיף בוט למשחק עם חבר. משחק עם בוטים אינו מדורג.</p>
          {room.hostId === id && <div className="bot-controls">
            <label>רמת המחשב <select aria-label="רמת המחשב" value={botDifficulty} onChange={e => setBotDifficulty(e.target.value)} disabled={busy}><option value="easy">קל</option><option value="medium">בינוני</option><option value="hard">קשה</option></select></label>
            <button disabled={busy || room.players.length >= 4} onClick={() => request("add-bot", { difficulty: botDifficulty })}>הוסף בוט</button>
          </div>}
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
            <strong>יורדי הים</strong>
            <p>
              יורדי הים מוסיפה מפה מקורית עם שלושה איים קטנים: ספינה עולה עץ
              וצמר, ספינת קצה מתור קודם ניתנת להזזה פעם בתור, ושדות זהב מפיקים
              משאבים לבחירה. יישוב ראשון שלך בכל אי חדש מעניק שתי נקודות בונוס.
              ב־7 אפשר להזיז פיראט במקום שודד; הוא חוסם בנייה והזזת ספינות
              סמוכות. יעד: 14 נקודות, או 17 בשילוב ערים ואבירים.
            </p>
          </div>
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
        <span>משחק חברים עצמאי · בסיס והרחבות</span>
      </footer>
    </div>
  );
}
export default App;
