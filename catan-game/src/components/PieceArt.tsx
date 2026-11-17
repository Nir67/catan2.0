import type { Color } from "../../shared/engine.js";
import atlas from "../assets/pieces/knights-walls-atlas.png";
const columns: Record<Color, number> = { blue: 0, red: 1, green: 2, yellow: 3 };
export function KnightArt({
  color = "blue",
  level = 1,
  active = false,
  className = "",
}: {
  color?: Color;
  level?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`piece-art knight-art ${active ? "active" : "inactive"} ${className}`}
      viewBox={`${columns[color] * 256} ${(level - 1) * 256} 256 256`}
      aria-hidden="true"
    >
      <image href={atlas} width="1024" height="1024" />
    </svg>
  );
}
export function WallArt({
  color = "blue",
  className = "",
}: {
  color?: Color;
  className?: string;
}) {
  return (
    <svg
      className={`piece-art wall-art ${className}`}
      viewBox={`${columns[color] * 256} 790 256 220`}
      aria-hidden="true"
    >
      <image href={atlas} width="1024" height="1024" />
    </svg>
  );
}
