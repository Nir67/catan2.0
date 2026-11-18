import shipArt from "../assets/pieces/barbarian-ship.png";
import scienceCity from "../assets/pieces/city-green.png";
import politicsCity from "../assets/pieces/city-blue.png";
import tradeCity from "../assets/pieces/city-yellow.png";
import { useEffect, useId, useRef } from "react";
import type { View } from "../../shared/engine.js";
import harbors from "../assets/pieces/harbors-atlas.png";
export function HarborArt({ kind }: { kind: string }) {
  const n = ["wood", "brick", "sheep", "wheat", "stone", "any"].indexOf(kind),
    col = n % 3,
    row = Math.floor(n / 3);
  return (
    <svg
      className="harbor-art"
      viewBox={`${col * 400} ${row * 600 + 100} 400 465`}
      aria-hidden="true"
    >
      <image href={harbors} width="1200" height="1200" />
    </svg>
  );
}
function Ship() {
  return (
    <image
      href={shipArt}
      x="-19"
      y="-18"
      width="38"
      height="31"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
export function BarbarianTrack({ g }: { g: View }) {
  const id = useId(),
    points = [
      [21, 24],
      [76, 24],
      [131, 24],
      [188, 24],
      [188, 75],
      [131, 75],
      [76, 75],
      [21, 75],
    ],
    pos = g.barbarianPosition ?? 0,
    attack = g.buildings.filter((b) => b.type === "city").length,
    defense = (g.knightPieces ?? [])
      .filter((k) => k.active)
      .reduce((n, k) => n + k.level, 0);
  return (
    <section
      className={`sea-invasion ${pos === 6 ? "imminent" : ""}`}
      aria-label="מסלול הברברים"
    >
      <div className="invasion-heading">
        <strong>הברברים</strong>
        <span>{7 - pos} צעדים לחוף</span>
      </div>
      <svg
        viewBox="0 0 210 100"
        role="img"
        aria-label={`הברברים התקדמו ${pos} מתוך 7`}
      >
        <defs>
          <linearGradient id={id} x2="0" y2="1">
            <stop stopColor="#377f91" />
            <stop offset="1" stopColor="#204f65" />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="208"
          height="98"
          rx="12"
          fill={`url(#${id})`}
          stroke="#b1a073"
          strokeWidth="2"
        />
        <path d="M8 90 Q21 53 40 59 L43 99 L8 99Z" fill="#b6aa76" />
        <path
          d="M20 24 H188 V75 H21"
          fill="none"
          stroke="#e3d7ad"
          strokeWidth="1.4"
          strokeDasharray="3 5"
        />
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="9"
              fill={i < pos ? "#142f40" : "#3f8190"}
              stroke={i === pos ? "#efd68e" : "#83b5b1"}
              strokeWidth={i === pos ? 2 : 1}
            />
            {i === 7 && (
              <path
                d={`M${x - 8} ${y + 6}v-13h5v4h6v-4h5v13Z`}
                fill="#dfcfaa"
                stroke="#6e6951"
              />
            )}
          </g>
        ))}
        <g transform={`translate(${points[pos][0]} ${points[pos][1] - 1})`}>
          <Ship />
        </g>
        <path
          d="M55 49q8-4 16 0t16 0 M114 52q8-4 16 0t16 0"
          fill="none"
          stroke="#8cbab6"
          strokeWidth="1"
          opacity=".5"
        />
      </svg>
      <div className="invasion-strength">
        <span>
          ברברים <b>{attack}</b>
        </span>
        <span>
          הגנה <b>{defense}</b>
        </span>
      </div>
      {pos === 6 && <p>הספינה הבאה מביאה פלישה</p>}
    </section>
  );
}

function NumberDie({ value, color }: { value?: number; color: string }) {
  const id = useId(),
    pips: Record<number, number[][]> = {
      1: [[20, 20]],
      2: [
        [11, 11],
        [29, 29],
      ],
      3: [
        [11, 11],
        [20, 20],
        [29, 29],
      ],
      4: [
        [11, 11],
        [29, 11],
        [11, 29],
        [29, 29],
      ],
      5: [
        [11, 11],
        [29, 11],
        [20, 20],
        [11, 29],
        [29, 29],
      ],
      6: [
        [11, 11],
        [29, 11],
        [11, 20],
        [29, 20],
        [11, 29],
        [29, 29],
      ],
    },
    red = color === "red";
  return (
    <svg
      viewBox="0 0 42 44"
      className={`game-die ${color}`}
      role="img"
      aria-label={`קובייה ${red ? "אדומה" : color === "yellow" ? "צהובה" : "רגילה"} ${value ?? "טרם גולגלה"}`}
    >
      <defs>
        <linearGradient id={id} x2=".7" y2="1">
          <stop
            stopColor={
              red ? "#e78062" : color === "yellow" ? "#ffe7a3" : "#fffae9"
            }
          />
          <stop
            offset=".4"
            stopColor={
              red ? "#bb4637" : color === "yellow" ? "#e4bc56" : "#f1e6c8"
            }
          />
          <stop
            offset="1"
            stopColor={
              red ? "#8c302b" : color === "yellow" ? "#c59637" : "#c8b992"
            }
          />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="4"
        width="38"
        height="38"
        rx="8"
        fill={red ? "#752925" : "#958047"}
        opacity=".7"
      />
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="8"
        fill={`url(#${id})`}
        stroke={red ? "#82342c" : "#ad8d4c"}
        strokeWidth="1.2"
      />
      <rect
        x="3.5"
        y="3.5"
        width="33"
        height="33"
        rx="6"
        fill="none"
        stroke="#fff1c8"
        strokeOpacity=".38"
      />
      <path
        d="M8 5H30Q35 5 35 10"
        stroke="#fff9df"
        strokeOpacity=".45"
        strokeWidth="2"
        fill="none"
      />
      {value ? (
        pips[value].map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y + 0.6}
              r="3.3"
              fill={red ? "#7b2c24" : "#9b7734"}
            />
            <circle
              cx={x}
              cy={y - 0.3}
              r="2.6"
              fill={red ? "#fff0d3" : "#4b3c29"}
            />
          </g>
        ))
      ) : (
        <text
          x="20"
          y="27"
          textAnchor="middle"
          fill={red ? "#ffe7cc" : "#776c52"}
          fontSize="22"
        >
          ?
        </text>
      )}
    </svg>
  );
}
export function GameDice({ g }: { g: View }) {
  const diceElement = useRef<HTMLDivElement>(null);
  const rollKey = g.turnNumber + ":" + g.hasRolled;
  const previousRoll = useRef(rollKey);
  useEffect(() => {
    const changed = previousRoll.current !== rollKey;
    previousRoll.current = rollKey;
    if (!changed || !g.hasRolled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = Array.from(diceElement.current?.querySelectorAll<SVGElement>(".game-die") ?? []).map((die, i) => die.animate([
      { transform: "translateY(0) rotate(0deg) scale(1)" },
      { transform: "translateY(-9px) rotate(-24deg) scale(.9)", offset: .16 },
      { transform: "translateY(2px) rotate(125deg) scale(1.04)", offset: .4 },
      { transform: "translateY(-6px) rotate(242deg) scale(.94)", offset: .64 },
      { transform: "translateY(0) rotate(352deg) scale(1.03)", offset: .86 },
      { transform: "translateY(0) rotate(360deg) scale(1)" },
    ], { duration: 720 + i * 90, easing: "ease-out" }));
    return () => animations.forEach(animation => animation.cancel());
  }, [rollKey, g.hasRolled]);
  const id = useId(),
    event = g.eventDie,
    expanded = g.mode === "cities-knights",
    names: Record<string, string> = {
      barbarians: "ספינת ברברים",
      science: "מדע",
      politics: "פוליטיקה",
      trade: "מסחר",
    },
    city =
      event === "science"
        ? scienceCity
        : event === "politics"
          ? politicsCity
          : tradeCity;
  return (
    <>
      <div className="game-dice" ref={diceElement}>
        <div className="die-group">
          <NumberDie value={g.dice?.[0]} color={expanded ? "red" : "ivory"} />
          <small>{expanded ? "תוצאה + קלפים" : "תוצאה"}</small>
        </div>
        <div className="die-group">
          <NumberDie
            value={g.dice?.[1]}
            color={expanded ? "yellow" : "ivory"}
          />
          <small>תוצאה</small>
        </div>
        {expanded && (
          <div className="die-group">
            <svg
              className="game-die event"
              viewBox="0 0 42 44"
              role="img"
              aria-label={`קוביית אירוע: ${names[event ?? ""] ?? "טרם גולגלה"}`}
            >
              <title>{names[event ?? ""] ?? "קוביית אירוע"}</title>
              <defs>
                <linearGradient id={id} x2=".8" y2="1">
                  <stop stopColor="#fff9e7" />
                  <stop offset="1" stopColor="#cfbd8c" />
                </linearGradient>
              </defs>
              <rect
                x="2"
                y="4"
                width="38"
                height="38"
                rx="8"
                fill="#8f7a4f"
                opacity=".6"
              />
              <rect
                x="1"
                y="1"
                width="38"
                height="38"
                rx="8"
                fill={`url(#${id})`}
                stroke="#a18850"
                strokeWidth="1.2"
              />
              <rect
                x="3.5"
                y="3.5"
                width="33"
                height="33"
                rx="6"
                fill="none"
                stroke="#fff3ce"
                strokeWidth="1"
              />
              {event === "barbarians" ? (
                <g transform="translate(20 22) scale(.8)">
                  <Ship />
                </g>
              ) : event ? (
                <image
                  href={city}
                  x="9"
                  y="6"
                  width="24"
                  height="28"
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <text
                  x="20"
                  y="27"
                  textAnchor="middle"
                  fill="#776c52"
                  fontSize="22"
                >
                  ?
                </text>
              )}
            </svg>
            <small>אירוע</small>
          </div>
        )}
        <b>
          {g.hasRolled && g.dice
            ? `סכום ${g.dice[0] + g.dice[1]}`
            : "לפני גלגול"}
        </b>
      </div>
      {expanded && (
        <p className="dice-roles">
          אדומה + צהובה: משאבים · אדומה + אירוע: קלפים
        </p>
      )}
    </>
  );
}
