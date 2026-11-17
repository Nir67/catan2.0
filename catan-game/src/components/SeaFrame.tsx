import { useId } from "react";
import type { View } from "../../shared/engine.js";
export function SeaFrame({ g }: { g: View }) {
  const id = useId(),
    radius = g.seafarers ? 500 : 330,
    outer = Array.from({ length: 6 }, (_, i) => ({
      x: 400 + radius * Math.cos((i * Math.PI) / 3),
      y: 270 + radius * Math.sin((i * Math.PI) / 3),
    })),
    points = outer.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g className="sea-frame" aria-label="מסגרת ים משושה בשישה חלקים">
      <defs>
        <linearGradient id={`${id}-sea`} x2=".7" y2="1">
          <stop stopColor="#4a9fb3" />
          <stop offset=".55" stopColor="#2c7899" />
          <stop offset="1" stopColor="#215d85" />
        </linearGradient>
        <pattern
          id={`${id}-waves`}
          width="44"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M3 15q6-3 12 0t12 0"
            fill="none"
            stroke="#a2d3d0"
            strokeWidth=".7"
            opacity=".2"
          />
          <path d="M15 28q6-3 12 0" fill="none" stroke="#173f5b" opacity=".2" />
        </pattern>
      </defs>
      <polygon
        points={points}
        fill={`url(#${id}-sea)`}
        stroke="#17425e"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon
        points={points}
        fill={`url(#${id}-waves)`}
        stroke="#c5c8ac"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {outer.map((p, i) => {
        const q = outer[(i + 1) % 6],
          m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 },
          dx = 400 - m.x,
          dy = 270 - m.y,
          len = Math.hypot(dx, dy),
          ux = dx / len,
          uy = dy / len,
          depth = g.seafarers ? 27 : 50,
          px = -uy,
          py = ux;
        return (
          <path
            key={i}
            d={`M${m.x} ${m.y}l${ux * 12} ${uy * 12}c${px * 8} ${py * 8} ${px * 8 + ux * 10} ${py * 8 + uy * 10} ${ux * 10} ${uy * 10}l${ux * (depth - 22)} ${uy * (depth - 22)}`}
            fill="none"
            stroke="#abc5bd"
            strokeWidth="1.2"
            opacity=".7"
          />
        );
      })}
    </g>
  );
}
