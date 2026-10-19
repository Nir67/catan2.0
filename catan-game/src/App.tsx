import { useState } from "react";

import woodImage from "./assets/wood.png";
import sheepImage from "./assets/sheep.png";
import wheatImage from "./assets/wheat.png";
import brickImage from "./assets/brick.png";
import stoneImage from "./assets/stone.png";
import desertImage from "./assets/dessert.png";

type Resource =
  | "wood"
  | "sheep"
  | "wheat"
  | "brick"
  | "stone"
  | "desert";

type Tile = {
  resource: Resource;
  number?: number;
};

const boardTiles: Tile[] = [
  { resource: "wood", number: 5 },
  { resource: "sheep", number: 2 },
  { resource: "wheat", number: 6 },

  { resource: "brick", number: 3 },
  { resource: "stone", number: 8 },
  { resource: "sheep", number: 10 },
  { resource: "wood", number: 9 },

  { resource: "wheat", number: 12 },
  { resource: "brick", number: 11 },
  { resource: "desert" },
  { resource: "stone", number: 4 },
  { resource: "wood", number: 8 },

  { resource: "sheep", number: 10 },
  { resource: "wheat", number: 9 },
  { resource: "brick", number: 4 },
  { resource: "stone", number: 5 },

  { resource: "wood", number: 6 },
  { resource: "sheep", number: 3 },
  { resource: "wheat", number: 11 },
];

const resourceImages: Record<Resource, string> = {
  wood: woodImage,
  sheep: sheepImage,
  wheat: wheatImage,
  brick: brickImage,
  stone: stoneImage,
  desert: desertImage,
};

const ROWS = [3, 4, 5, 4, 3];

const HEX_SIZE = 60;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const ROW_HEIGHT = HEX_SIZE * 1.5;

function getHexPoints(cx: number, cy: number) {
  const points: string[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 90) * Math.PI) / 180;

    const x = cx + HEX_SIZE * Math.cos(angle);
    const y = cy + HEX_SIZE * Math.sin(angle);

    points.push(`${x},${y}`);
  }

  return points.join(" ");
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function NumberToken({
  x,
  y,
  number,
}: {
  x: number;
  y: number;
  number: number;
}) {
  const isRed = number === 6 || number === 8;

  return (
    <>
      <circle
        cx={x}
        cy={y}
        r="21"
        fill="#fff1cc"
        stroke="#9b8253"
        strokeWidth="2"
      />

      <text
        x={x}
        y={y + 7}
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill={isRed ? "#c62828" : "#222"}
      >
        {number}
      </text>
    </>
  );
}

function Board() {
  let tileIndex = 0;

  const elements = [];

  const centerX = 400;

  for (let row = 0; row < ROWS.length; row++) {
    const amount = ROWS[row];

    const y = 90 + row * ROW_HEIGHT;

    const rowWidth =
      (amount - 1) * HEX_WIDTH;

    const startX =
      centerX - rowWidth / 2;

    for (let column = 0; column < amount; column++) {
      const tile = boardTiles[tileIndex];

      const x =
        startX + column * HEX_WIDTH;

      const currentIndex = tileIndex;

      const clipId =
        `hexClip-${currentIndex}`;

      elements.push(
        <g key={currentIndex}>
          <defs>
            <clipPath id={clipId}>
              <polygon
                points={getHexPoints(x, y)}
              />
            </clipPath>
          </defs>

          <image
            href={resourceImages[tile.resource]}
            x={x - HEX_WIDTH / 2 - 3}
            y={y - HEX_SIZE - 3}
            width={HEX_WIDTH + 6}
            height={HEX_SIZE * 2 + 6}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />

          <polygon
            points={getHexPoints(x, y)}
            fill="none"
            stroke="#ead29b"
            strokeWidth="3"
          />

          {tile.number !== undefined && (
            <NumberToken
              x={x}
              y={y + 20}
              number={tile.number}
            />
          )}
        </g>
      );

      tileIndex++;
    }
  }

  return (
    <svg
      viewBox="100 15 600 500"
      style={{
        width: "min(960px, 90vw)",
        height: "auto",
        display: "block",
      }}
    >
      {elements}
    </svg>
  );
}

function DicePanel() {
  const [dice, setDice] =
    useState<[number, number]>([1, 1]);

  function rollDice() {
    setDice([
      rollDie(),
      rollDie(),
    ]);
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "22px",
        right: "22px",

        width: "150px",

        padding: "14px",

        borderRadius: "16px",

        background:
          "rgba(255,255,255,0.93)",

        boxShadow:
          "0 6px 18px rgba(0,0,0,0.20)",

        display: "flex",
        flexDirection: "column",
        alignItems: "center",

        gap: "10px",

        color: "#222",

        zIndex: 10,
      }}
    >
      <strong>
        🎲 קוביות
      </strong>

      <div
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",

            borderRadius: "10px",

            background: "white",

            border:
              "2px solid #ddd",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            fontSize: "25px",
            fontWeight: "bold",
          }}
        >
          {dice[0]}
        </div>

        <div
          style={{
            width: "48px",
            height: "48px",

            borderRadius: "10px",

            background: "white",

            border:
              "2px solid #ddd",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            fontSize: "25px",
            fontWeight: "bold",
          }}
        >
          {dice[1]}
        </div>
      </div>

      <div
        style={{
          fontSize: "15px",
          fontWeight: "bold",
        }}
      >
        סכום: {dice[0] + dice[1]}
      </div>

      <button
        onClick={rollDice}
        style={{
          border: "none",

          borderRadius: "9px",

          padding:
            "9px 15px",

          background:
            "#f2c744",

          fontWeight:
            "bold",

          cursor:
            "pointer",
        }}
      >
        גלגל
      </button>
    </div>
  );
}

function StartScreen({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",

        display: "flex",
        flexDirection: "column",

        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1
        style={{
          margin: 0,

          fontSize: "70px",

          letterSpacing: "10px",
        }}
      >
        CATAN
      </h1>

      <p
        style={{
          fontSize: "20px",
        }}
      >
        המשחק שלנו מתחיל כאן 🎲
      </p>

      <button
        onClick={onStart}
        style={{
          padding:
            "14px 30px",

          border: "none",

          borderRadius:
            "12px",

          background:
            "#f2c744",

          fontSize:
            "18px",

          fontWeight:
            "bold",

          cursor:
            "pointer",
        }}
      >
        משחק חדש
      </button>
    </div>
  );
}

function GameScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",

        position: "relative",

        display: "flex",
        flexDirection: "column",

        alignItems: "center",

        overflow: "hidden",
      }}
    >
      <button
        onClick={onBack}
        style={{
          position: "absolute",

          top: "22px",
          left: "22px",

          border: "none",

          borderRadius: "10px",

          padding:
            "9px 18px",

          background:
            "white",

          cursor:
            "pointer",

          zIndex: 10,
        }}
      >
        חזרה
      </button>

      <DicePanel />

      <h1
        style={{
          margin:
            "18px 0 4px",

          fontSize:
            "42px",

          letterSpacing:
            "8px",
        }}
      >
        CATAN
      </h1>

      <div
        style={{
          flex: 1,

          width: "100%",

          display: "flex",

          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Board />
      </div>
    </div>
  );
}

function App() {
  const [gameStarted, setGameStarted] =
    useState(false);

  return (
    <div
      style={{
        width: "100%",

        minHeight: "100vh",

        margin: 0,

        background:
          "linear-gradient(180deg, #70d6ee 0%, #1ca8d1 100%)",

        color: "white",

        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      {gameStarted ? (
        <GameScreen
          onBack={() =>
            setGameStarted(false)
          }
        />
      ) : (
        <StartScreen
          onStart={() =>
            setGameStarted(true)
          }
        />
      )}
    </div>
  );
}

export default App;