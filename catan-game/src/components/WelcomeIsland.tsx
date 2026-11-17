import { TILES } from "../../shared/engine.js";
import wood from "../assets/wood.png";
import sheep from "../assets/sheep.png";
import wheat from "../assets/wheat.png";
import brick from "../assets/brick.png";
import stone from "../assets/stone.png";
import desert from "../assets/dessert.png";
import settlement from "../assets/pieces/settlement-red.png";
import city from "../assets/pieces/city-blue.png";
const art = [
  wood,
  sheep,
  wheat,
  stone,
  brick,
  wood,
  sheep,
  wheat,
  brick,
  desert,
  stone,
  wheat,
  wood,
  sheep,
  brick,
  stone,
  wheat,
  sheep,
  wood,
];
const numbers = [5, 9, 6, 3, 10, 8, 4, 11, 5, 0, 9, 12, 8, 6, 4, 10, 11, 3, 2];
const polygon = (x: number, y: number) =>
  Array.from(
    { length: 6 },
    (_, i) =>
      `${x + 58 * Math.cos(((-90 + i * 60) * Math.PI) / 180)},${y + 58 * Math.sin(((-90 + i * 60) * Math.PI) / 180)}`,
  ).join(" ");
export function WelcomeIsland() {
  return (
    <div className="welcome-table">
      <span className="table-caption">האי משתנה. הסיפורים נשארים.</span>
      <svg className="welcome-island" viewBox="80 0 640 545" aria-hidden="true">
        <defs>
          <filter id="welcome-matte" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 0 3"
              result="matte"
            />
            <feComposite in="SourceGraphic" in2="matte" operator="in" />
          </filter>
          {TILES.map((t) => (
            <clipPath key={t.id} id={`welcome-tile-${t.id}`}>
              <polygon points={polygon(t.x, t.y)} />
            </clipPath>
          ))}
        </defs>
        {TILES.map((t, i) => (
          <g key={t.id}>
            <image
              href={art[i]}
              x={t.x - 58}
              y={t.y - 64}
              width={116}
              height={128}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#welcome-tile-${t.id})`}
            />
            <polygon
              points={polygon(t.x, t.y)}
              fill="none"
              stroke="#dfc99c"
              strokeWidth="3"
            />
            {numbers[i] > 0 && (
              <g>
                <circle
                  cx={t.x}
                  cy={t.y + 8}
                  r="17"
                  fill="#f5e8cb"
                  stroke="#9b8059"
                />
                <text
                  x={t.x}
                  y={t.y + 14}
                  textAnchor="middle"
                  fontSize="18"
                  fontFamily="Georgia,serif"
                  fontWeight="bold"
                  fill={[6, 8].includes(numbers[i]) ? "#a5422f" : "#3a362c"}
                >
                  {numbers[i]}
                </text>
              </g>
            )}
          </g>
        ))}
        <image
          href={settlement}
          filter="url(#welcome-matte)"
          x="282"
          y="217"
          width="52"
          height="52"
        />
        <image
          href={city}
          filter="url(#welcome-matte)"
          x="523"
          y="295"
          width="60"
          height="60"
        />
      </svg>
      <div className="table-note">
        <span>19 משושים</span>
        <i />
        <span>הרבה יותר מדרך אחת לנצח</span>
      </div>
    </div>
  );
}
