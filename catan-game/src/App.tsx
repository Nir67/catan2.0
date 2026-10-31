import { useEffect, useState } from "react";

import { socket } from "./socket";
import woodImage from "./assets/wood.png";
import sheepImage from "./assets/sheep.png";
import wheatImage from "./assets/wheat.png";
import brickImage from "./assets/brick.png";
import stoneImage from "./assets/stone.png";
import desertImage from "./assets/dessert.png";

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

type Player = {
  id: string;
  name: string;
};

type GameState = {
  currentPlayerIndex: number;
  dice: [number, number];
  hasRolled: boolean;
  turnNumber: number;

  // Stored and broadcast by the server.
  roads?: BuiltRoad[];
  buildings?: BuiltBuilding[];
};

type RoomResponse = {
  success: boolean;
  roomCode?: string;
  players?: Player[];
  message?: string;
};

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

type Point = {
  x: number;
  y: number;
};

type BoardCenter = {
  tileIndex: number;
  x: number;
  y: number;
};

type Vertex = {
  id: string;
  x: number;
  y: number;
};

type Edge = {
  id: string;
  x: number;
  y: number;
  angle: number;
};

type PlayerColor = "blue" | "red" | "green" | "yellow";

type BuiltRoad = {
  edgeId: string;
  color: PlayerColor;
};

type BuildingType = "settlement" | "city";

type BuiltBuilding = {
  vertexId: string;
  color: PlayerColor;
  type: BuildingType;
};

type BuildType = "road" | "settlement" | "city";

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

const roadImages: Record<PlayerColor, string> = {
  blue: roadBlue,
  red: roadRed,
  green: roadGreen,
  yellow: roadYellow,
};

const settlementImages: Record<PlayerColor, string> = {
  blue: settlementBlue,
  red: settlementRed,
  green: settlementGreen,
  yellow: settlementYellow,
};

const cityImages: Record<PlayerColor, string> = {
  blue: cityBlue,
  red: cityRed,
  green: cityGreen,
  yellow: cityYellow,
};

const PLAYER_COLORS: PlayerColor[] = [
  "blue",
  "red",
  "green",
  "yellow",
];

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

function NumberToken({
  x,
  y,
  number,
  isActive,
}: {
  x: number;
  y: number;
  number: number;
  isActive: boolean;
}) {
  const isRed = number === 6 || number === 8;

  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={isActive ? 25 : 21}
        fill={isActive ? "#fff4a8" : "#fff1cc"}
        stroke={isActive ? "#ffd700" : "#9b8253"}
        strokeWidth={isActive ? 5 : 2}
        style={{
          filter: isActive ? "drop-shadow(0 0 8px #ffd700)" : "none",
        }}
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

function getBoardCenters(): BoardCenter[] {
  const centers: BoardCenter[] = [];
  const centerX = 400;
  let tileIndex = 0;

  for (let row = 0; row < ROWS.length; row++) {
    const amount = ROWS[row];
    const y = 90 + row * ROW_HEIGHT;
    const rowWidth = (amount - 1) * HEX_WIDTH;
    const startX = centerX - rowWidth / 2;

    for (let column = 0; column < amount; column++) {
      centers.push({
        tileIndex,
        x: startX + column * HEX_WIDTH,
        y,
      });

      tileIndex++;
    }
  }

  return centers;
}

function getHexCorner(
  cx: number,
  cy: number,
  index: number
): Point {
  const angleDeg = -90 + index * 60;
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: cx + HEX_SIZE * Math.cos(angleRad),
    y: cy + HEX_SIZE * Math.sin(angleRad),
  };
}

function pointId(point: Point) {
  const x = Math.round(point.x * 10) / 10;
  const y = Math.round(point.y * 10) / 10;

  return `${x}-${y}`;
}

function getBoardVertices(): Vertex[] {
  const vertices = new Map<string, Vertex>();

  for (const center of getBoardCenters()) {
    for (let corner = 0; corner < 6; corner++) {
      const point = getHexCorner(
        center.x,
        center.y,
        corner
      );

      const id = pointId(point);

      if (!vertices.has(id)) {
        vertices.set(id, {
          id,
          x: Math.round(point.x * 10) / 10,
          y: Math.round(point.y * 10) / 10,
        });
      }
    }
  }

  return Array.from(vertices.values());
}

function getRoadPosition(
  cx: number,
  cy: number,
  edgeIndex: number
) {
  const p1 = getHexCorner(cx, cy, edgeIndex);
  const p2 = getHexCorner(
    cx,
    cy,
    (edgeIndex + 1) % 6
  );

  const x = (p1.x + p2.x) / 2;
  const y = (p1.y + p2.y) / 2;

  let angle =
    (Math.atan2(
      p2.y - p1.y,
      p2.x - p1.x
    ) *
      180) /
    Math.PI;

  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  return {
    x,
    y,
    angle,
    p1,
    p2,
  };
}

function getBoardEdges(): Edge[] {
  const edges = new Map<string, Edge>();

  for (const center of getBoardCenters()) {
    for (
      let edgeIndex = 0;
      edgeIndex < 6;
      edgeIndex++
    ) {
      const road = getRoadPosition(
        center.x,
        center.y,
        edgeIndex
      );

      const first = pointId(road.p1);
      const second = pointId(road.p2);
      const id = [first, second].sort().join("|");

      if (!edges.has(id)) {
        edges.set(id, {
          id,
          x: road.x,
          y: road.y,
          angle: road.angle,
        });
      }
    }
  }

  return Array.from(edges.values());
}

function RoadPiece({
  x,
  y,
  angle,
  color,
}: {
  x: number;
  y: number;
  angle: number;
  color: PlayerColor;
}) {
  const imageSize = HEX_SIZE * (512 / 448);

  return (
    <image
      href={roadImages[color]}
      x={x - imageSize / 2}
      y={y - imageSize / 2}
      width={imageSize}
      height={imageSize}
      transform={`rotate(${angle} ${x} ${y})`}
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "none" }}
    />
  );
}

function BuildingPiece({
  x,
  y,
  color,
  type,
}: {
  x: number;
  y: number;
  color: PlayerColor;
  type: BuildingType;
}) {
  const size = type === "city" ? 54 : 42;
  const image =
    type === "city"
      ? cityImages[color]
      : settlementImages[color];

  return (
    <image
      href={image}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "none" }}
    />
  );
}

const BOARD_CENTERS = getBoardCenters();
const BOARD_VERTICES = getBoardVertices();
const BOARD_EDGES = getBoardEdges();

function Board({
  activeNumber,
  roads,
  buildings,
  buildMode,
  playerColor,
  onRoadClick,
  onVertexClick,
}: {
  activeNumber: number | null;
  roads: BuiltRoad[];
  buildings: BuiltBuilding[];
  buildMode: BuildType | null;
  playerColor: PlayerColor;
  onRoadClick: (edgeId: string) => void;
  onVertexClick: (vertexId: string) => void;
}) {
  const occupiedEdges = new Set(
    roads.map((road) => road.edgeId)
  );

  const buildingByVertex = new Map(
    buildings.map((building) => [
      building.vertexId,
      building,
    ])
  );

  return (
    <svg
      viewBox="100 15 600 500"
      style={{
        width: "min(960px, 90vw)",
        height: "auto",
        display: "block",
      }}
    >
      {/* משושים */}
      {BOARD_CENTERS.map(
        ({ tileIndex, x, y }) => {
          const tile = boardTiles[tileIndex];
          const isActive =
            activeNumber !== null &&
            tile.number === activeNumber;
          const clipId = `hexClip-${tileIndex}`;

          return (
            <g key={tileIndex}>
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
                  isActive={isActive}
                />
              )}
            </g>
          );
        }
      )}

      {/* דרכים שכבר נבנו */}
      {roads.map((road) => {
        const edge = BOARD_EDGES.find(
          (item) => item.id === road.edgeId
        );

        if (!edge) return null;

        return (
          <RoadPiece
            key={road.edgeId}
            x={edge.x}
            y={edge.y}
            angle={edge.angle}
            color={road.color}
          />
        );
      })}

      {/* יישובים וערים שכבר נבנו */}
      {buildings.map((building) => {
        const vertex = BOARD_VERTICES.find(
          (item) => item.id === building.vertexId
        );

        if (!vertex) return null;

        return (
          <BuildingPiece
            key={building.vertexId}
            x={vertex.x}
            y={vertex.y}
            color={building.color}
            type={building.type}
          />
        );
      })}

      {/* אפשרויות לבניית דרך מופיעות רק אחרי בחירת "דרך" */}
      {buildMode === "road" &&
        BOARD_EDGES.map((edge) => {
          if (occupiedEdges.has(edge.id)) {
            return null;
          }

          const radians =
            (edge.angle * Math.PI) / 180;
          const halfLength = HEX_SIZE / 2;
          const dx =
            Math.cos(radians) * halfLength;
          const dy =
            Math.sin(radians) * halfLength;

          return (
            <line
              key={`build-road-${edge.id}`}
              x1={edge.x - dx}
              y1={edge.y - dy}
              x2={edge.x + dx}
              y2={edge.y + dy}
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="12"
              strokeLinecap="round"
              style={{ cursor: "pointer" }}
              onClick={() => onRoadClick(edge.id)}
            />
          );
        })}

      {/* אפשרויות לבניית יישוב/עיר */}
      {(buildMode === "settlement" ||
        buildMode === "city") &&
        BOARD_VERTICES.map((vertex) => {
          const existing =
            buildingByVertex.get(vertex.id);

          const canBuildSettlement =
            buildMode === "settlement" &&
            !existing;

          const canBuildCity =
            buildMode === "city" &&
            existing?.type === "settlement" &&
            existing.color === playerColor;

          if (
            !canBuildSettlement &&
            !canBuildCity
          ) {
            return null;
          }

          return (
            <circle
              key={`build-vertex-${vertex.id}`}
              cx={vertex.x}
              cy={vertex.y}
              r={buildMode === "city" ? 17 : 12}
              fill="rgba(255,255,255,0.75)"
              stroke="#f2c744"
              strokeWidth="4"
              style={{ cursor: "pointer" }}
              onClick={() =>
                onVertexClick(vertex.id)
              }
            />
          );
        })}
    </svg>
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
          padding: "14px 30px",
          border: "none",
          borderRadius: "12px",
          background: "#f2c744",
          fontSize: "18px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        משחק חדש
      </button>
    </div>
  );
}

function HomeScreen({
  onEnterLobby,
  onBack,
}: {
  onEnterLobby: (
    roomCode: string,
    playerName: string,
    players: Player[]
  ) => void;
  onBack: () => void;
}) {
  const [playerName, setPlayerName] =
    useState("");
  const [roomCode, setRoomCode] =
    useState("");
  const [error, setError] =
    useState("");

  function createRoom() {
    const name = playerName.trim();

    if (!name) {
      setError("צריך לכתוב שם");
      return;
    }

    setError("");

    socket.emit(
      "create-room",
      name,
      (response: RoomResponse) => {
        if (
          !response.success ||
          !response.roomCode ||
          !response.players
        ) {
          setError(
            response.message ||
              "לא הצלחנו ליצור חדר"
          );
          return;
        }

        onEnterLobby(
          response.roomCode,
          name,
          response.players
        );
      }
    );
  }

  function joinRoom() {
    const name = playerName.trim();
    const code =
      roomCode.trim().toUpperCase();

    if (!name) {
      setError("צריך לכתוב שם");
      return;
    }

    if (!code) {
      setError("צריך לכתוב קוד חדר");
      return;
    }

    setError("");

    socket.emit(
      "join-room",
      {
        roomCode: code,
        playerName: name,
      },
      (response: RoomResponse) => {
        if (
          !response.success ||
          !response.roomCode ||
          !response.players
        ) {
          setError(
            response.message ||
              "לא הצלחנו להצטרף"
          );
          return;
        }

        onEnterLobby(
          response.roomCode,
          name,
          response.players
        );
      }
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <h1
        style={{
          fontSize: "60px",
          letterSpacing: "8px",
          margin: 0,
        }}
      >
        CATAN
      </h1>

      <h2>משחק אונליין</h2>

      <input
        value={playerName}
        onChange={(event) =>
          setPlayerName(event.target.value)
        }
        placeholder="השם שלך"
        style={{
          width: "240px",
          padding: "12px",
          fontSize: "18px",
          borderRadius: "10px",
          border: "1px solid #ccc",
          textAlign: "center",
        }}
      />

      <button
        onClick={createRoom}
        style={{
          width: "240px",
          padding: "14px",
          fontSize: "18px",
          fontWeight: "bold",
          border: "none",
          borderRadius: "12px",
          background: "#f2c744",
          cursor: "pointer",
        }}
      >
        🎮 צור משחק
      </button>

      <div>או</div>

      <input
        value={roomCode}
        onChange={(event) =>
          setRoomCode(
            event.target.value.toUpperCase()
          )
        }
        placeholder="קוד חדר"
        maxLength={4}
        style={{
          width: "240px",
          padding: "12px",
          fontSize: "20px",
          borderRadius: "10px",
          border: "1px solid #ccc",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      />

      <button
        onClick={joinRoom}
        style={{
          width: "240px",
          padding: "14px",
          fontSize: "18px",
          fontWeight: "bold",
          border: "none",
          borderRadius: "12px",
          background: "white",
          cursor: "pointer",
        }}
      >
        הצטרף למשחק
      </button>

      {error && (
        <div
          style={{
            color: "#8b0000",
            background: "white",
            padding: "8px 14px",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={onBack}
        style={{
          marginTop: "10px",
          border: "none",
          background: "transparent",
          color: "white",
          cursor: "pointer",
        }}
      >
        ← חזרה
      </button>
    </div>
  );
}

function LobbyScreen({
  roomCode,
  playerName,
  initialPlayers,
  onStart,
  onBack,
}: {
  roomCode: string;
  playerName: string;
  initialPlayers: Player[];
  onStart: (
    gameState: GameState,
    players: Player[]
  ) => void;
  onBack: () => void;
}) {
  const [players, setPlayers] =
    useState<Player[]>(initialPlayers);

  const [error, setError] =
    useState("");

  const isHost =
    players[0]?.id === socket.id;

  useEffect(() => {
    function handlePlayersUpdated(
      updatedPlayers: Player[]
    ) {
      setPlayers(updatedPlayers);
    }

    function handleGameStarted(
      newGameState: GameState
    ) {
      onStart(
        newGameState,
        players
      );
    }

    socket.on(
      "players-updated",
      handlePlayersUpdated
    );

    socket.on(
      "game-started",
      handleGameStarted
    );

    return () => {
      socket.off(
        "players-updated",
        handlePlayersUpdated
      );

      socket.off(
        "game-started",
        handleGameStarted
      );
    };
  }, [onStart, players]);

  function startGame() {
    console.log(
      "START BUTTON CLICKED"
    );

    socket.emit(
      "start-game",
      { roomCode },
      (response: {
        success: boolean;
        message?: string;
      }) => {
        console.log(
          "SERVER RESPONSE:",
          response
        );

        if (!response.success) {
          setError(
            response.message ||
              "לא ניתן להתחיל את המשחק"
          );
        }
      }
    );
  }

  function leaveRoom() {
    socket.disconnect();
    socket.connect();
    onBack();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
      }}
    >
      <h1>חדר משחק</h1>

      <div
        style={{
          background: "white",
          color: "#222",
          padding: "15px 30px",
          borderRadius: "14px",
          textAlign: "center",
        }}
      >
        <div>קוד החדר</div>

        <div
          style={{
            fontSize: "38px",
            fontWeight: "bold",
            letterSpacing: "6px",
          }}
        >
          {roomCode}
        </div>
      </div>

      <h2>שחקנים</h2>

      {players.map(
        (player, index) => (
          <div
            key={player.id}
            style={{
              width: "260px",
              background: "white",
              color: "#222",
              padding: "12px 18px",
              borderRadius: "10px",
              fontSize: "18px",
            }}
          >
            🟢 {player.name}

            {player.name ===
            playerName
              ? " (אתה)"
              : ""}

            {index === 0
              ? " 👑"
              : ""}
          </div>
        )
      )}

      {players.length < 2 && (
        <div>
          מחכים לשחקן נוסף...
        </div>
      )}

      {isHost ? (
        <button
          onClick={startGame}
          disabled={
            players.length < 2
          }
          style={{
            marginTop: "10px",
            padding: "14px 35px",
            border: "none",
            borderRadius: "12px",
            background:
              players.length >= 2
                ? "#f2c744"
                : "#cccccc",
            fontSize: "19px",
            fontWeight: "bold",
            cursor:
              players.length >= 2
                ? "pointer"
                : "not-allowed",
          }}
        >
          🎮 התחל משחק
        </button>
      ) : (
        <div
          style={{
            fontWeight: "bold",
          }}
        >
          מחכים שיוצר החדר יתחיל את המשחק...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "white",
            color: "#9b0000",
            padding: "8px 14px",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={leaveRoom}
        style={{
          marginTop: "8px",
          padding: "10px 22px",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
        }}
      >
        יציאה מהחדר
      </button>
    </div>
  );
}

function BuildToolbar({
  isMyTurn,
  isOpen,
  selectedBuild,
  playerColor,
  onToggle,
  onSelect,
}: {
  isMyTurn: boolean;
  isOpen: boolean;
  selectedBuild: BuildType | null;
  playerColor: PlayerColor;
  onToggle: () => void;
  onSelect: (type: BuildType | null) => void;
}) {
  const buildItems: Array<{
    type: BuildType;
    label: string;
    image: string;
  }> = [
    {
      type: "road",
      label: "דרך",
      image: roadImages[playerColor],
    },
    {
      type: "settlement",
      label: "יישוב",
      image: settlementImages[playerColor],
    },
    {
      type: "city",
      label: "עיר",
      image: cityImages[playerColor],
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: "22px",
        top: "78px",
        zIndex: 20,
        direction: "rtl",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: isOpen ? "190px" : "118px",
          padding: "11px 14px",
          border: "none",
          borderRadius: "12px",
          background: "white",
          fontWeight: "bold",
          fontSize: "16px",
          cursor: "pointer",
          boxShadow: "0 5px 14px rgba(0,0,0,0.18)",
        }}
      >
        🔨 בנייה {isOpen ? "✕" : ""}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: "8px",
            width: "190px",
            padding: "10px",
            background: "rgba(255,255,255,0.97)",
            borderRadius: "14px",
            boxShadow: "0 8px 22px rgba(0,0,0,0.2)",
            color: "#222",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              marginBottom: "8px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {isMyTurn
              ? selectedBuild
                ? "עכשיו בחר מקום בלוח"
                : "מה אתה רוצה לבנות?"
              : "אפשר לבנות רק בתור שלך"}
          </div>

          {buildItems.map((item) => {
            const selected =
              selectedBuild === item.type;

            return (
              <button
                key={item.type}
                disabled={!isMyTurn}
                onClick={() =>
                  onSelect(
                    selected ? null : item.type
                  )
                }
                style={{
                  width: "100%",
                  height: "58px",
                  marginBottom: "7px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  border: selected
                    ? "3px solid #f2c744"
                    : "1px solid #ddd",
                  borderRadius: "10px",
                  background: selected
                    ? "#fff8d8"
                    : "white",
                  cursor: isMyTurn
                    ? "pointer"
                    : "not-allowed",
                  opacity: isMyTurn ? 1 : 0.5,
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                <span>{item.label}</span>

                <img
                  src={item.image}
                  alt={item.label}
                  style={{
                    width: "54px",
                    height: "48px",
                    objectFit: "contain",
                  }}
                />
              </button>
            );
          })}

          {selectedBuild && (
            <button
              onClick={() => onSelect(null)}
              style={{
                width: "100%",
                padding: "8px",
                border: "none",
                borderRadius: "9px",
                background: "#eee",
                cursor: "pointer",
              }}
            >
              ביטול בחירה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GameScreen({
  roomCode,
  players,
  initialGameState,
  onBack,
}: {
  roomCode: string;
  players: Player[];
  initialGameState: GameState;
  onBack: () => void;
}) {
  const [gameState, setGameState] =
    useState<GameState>(initialGameState);

  const [error, setError] = useState("");
  const [buildMenuOpen, setBuildMenuOpen] =
    useState(false);
  const [selectedBuild, setSelectedBuild] =
    useState<BuildType | null>(null);

  useEffect(() => {
    function handleGameState(
      newGameState: GameState
    ) {
      console.log(
        "NEW GAME STATE:",
        newGameState
      );

      setGameState(newGameState);
      setError("");
    }

    socket.on(
      "game-state",
      handleGameState
    );

    return () => {
      socket.off(
        "game-state",
        handleGameState
      );
    };
  }, []);

  const currentPlayer =
    players[gameState.currentPlayerIndex];

  const isMyTurn =
    currentPlayer?.id === socket.id;

  const myPlayerIndex = Math.max(
    0,
    players.findIndex(
      (player) => player.id === socket.id
    )
  );

  const myColor =
    PLAYER_COLORS[
      myPlayerIndex % PLAYER_COLORS.length
    ];

  function emitBuild(
    eventName:
      | "build-road"
      | "build-settlement"
      | "build-city",
    locationKey: "edgeId" | "vertexId",
    locationId: string
  ) {
    if (!isMyTurn) {
      setError("אפשר לבנות רק בתור שלך");
      return;
    }

    socket.emit(
      eventName,
      {
        roomCode,
        [locationKey]: locationId,
      },
      (response: {
        success: boolean;
        message?: string;
      }) => {
        if (!response.success) {
          setError(
            response.message ||
              "לא ניתן לבנות כאן"
          );
          return;
        }

        setError("");
        setSelectedBuild(null);
      }
    );
  }

  function handleRoadClick(edgeId: string) {
    if (selectedBuild !== "road") return;

    emitBuild(
      "build-road",
      "edgeId",
      edgeId
    );
  }

  function handleVertexClick(
    vertexId: string
  ) {
    if (selectedBuild === "settlement") {
      emitBuild(
        "build-settlement",
        "vertexId",
        vertexId
      );
      return;
    }

    if (selectedBuild === "city") {
      emitBuild(
        "build-city",
        "vertexId",
        vertexId
      );
    }
  }

  function rollDice() {
    socket.emit(
      "roll-dice",
      { roomCode },
      (response: {
        success: boolean;
        message?: string;
      }) => {
        if (!response.success) {
          setError(
            response.message ||
              "לא ניתן לגלגל"
          );
        }
      }
    );
  }

  function endTurn() {
    socket.emit(
      "end-turn",
      { roomCode },
      (response: {
        success: boolean;
        message?: string;
      }) => {
        if (!response.success) {
          setError(
            response.message ||
              "לא ניתן לסיים תור"
          );
          return;
        }

        setSelectedBuild(null);
        setBuildMenuOpen(false);
      }
    );
  }

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
          padding: "9px 18px",
          border: "none",
          borderRadius: "10px",
          background: "white",
          cursor: "pointer",
          zIndex: 30,
        }}
      >
        חזרה
      </button>

      <BuildToolbar
        isMyTurn={isMyTurn}
        isOpen={buildMenuOpen}
        selectedBuild={selectedBuild}
        playerColor={myColor}
        onToggle={() =>
          setBuildMenuOpen(
            (current) => !current
          )
        }
        onSelect={setSelectedBuild}
      />

      {/* קוביות מסונכרנות */}
      <div
        style={{
          position: "absolute",
          top: "22px",
          right: "22px",
          width: "180px",
          padding: "15px",
          borderRadius: "16px",
          background:
            "rgba(255,255,255,0.95)",
          color: "#222",
          textAlign: "center",
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.2)",
          zIndex: 10,
        }}
      >
        <strong>
          🎲 תור {gameState.turnNumber}
        </strong>

        <div
          style={{
            marginTop: "8px",
            marginBottom: "10px",
          }}
        >
          {isMyTurn
            ? "התור שלך 👈"
            : `התור של ${
                currentPlayer?.name ??
                "השחקן השני"
              }`}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              background: "white",
              border: "2px solid #ddd",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "26px",
              fontWeight: "bold",
            }}
          >
            {gameState.dice[0]}
          </div>

          <div
            style={{
              width: "50px",
              height: "50px",
              background: "white",
              border: "2px solid #ddd",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "26px",
              fontWeight: "bold",
            }}
          >
            {gameState.dice[1]}
          </div>
        </div>

        {gameState.hasRolled && (
          <div
            style={{
              margin: "8px 0",
              fontWeight: "bold",
            }}
          >
            סכום:{" "}
            {gameState.dice[0] +
              gameState.dice[1]}
          </div>
        )}

        {!gameState.hasRolled &&
          isMyTurn && (
            <button
              onClick={rollDice}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "10px",
                border: "none",
                borderRadius: "9px",
                background: "#f2c744",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🎲 גלגל
            </button>
          )}

        {gameState.hasRolled &&
          isMyTurn && (
            <button
              onClick={endTurn}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "10px",
                border: "none",
                borderRadius: "9px",
                background: "#8fd18f",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              סיים תור ➜
            </button>
          )}

        {!isMyTurn && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "13px",
            }}
          >
            ממתין לשחקן השני...
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "8px",
              color: "#b00020",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <h1
        style={{
          margin: "18px 0 4px",
          fontSize: "42px",
          letterSpacing: "8px",
        }}
      >
        CATAN
      </h1>

      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Board
          activeNumber={
            gameState.hasRolled
              ? gameState.dice[0] +
                gameState.dice[1]
              : null
          }
          roads={gameState.roads ?? []}
          buildings={
            gameState.buildings ?? []
          }
          buildMode={selectedBuild}
          playerColor={myColor}
          onRoadClick={handleRoadClick}
          onVertexClick={handleVertexClick}
        />
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] =
    useState<
      "start" |
        "home" |
        "lobby" |
        "game"
    >("start");

  const [roomCode, setRoomCode] =
    useState("");

  const [
    playerName,
    setPlayerName,
  ] = useState("");

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [
    gameState,
    setGameState,
  ] = useState<GameState | null>(
    null
  );

  function enterLobby(
    code: string,
    name: string,
    roomPlayers: Player[]
  ) {
    setRoomCode(code);
    setPlayerName(name);
    setPlayers(roomPlayers);
    setScreen("lobby");
  }

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
      {screen === "start" && (
        <StartScreen
          onStart={() => {
            setScreen("home");
          }}
        />
      )}

      {screen === "home" && (
        <HomeScreen
          onEnterLobby={
            enterLobby
          }
          onBack={() => {
            setScreen("start");
          }}
        />
      )}

      {screen === "lobby" && (
        <LobbyScreen
          roomCode={roomCode}
          playerName={playerName}
          initialPlayers={players}
          onStart={(
            newGameState,
            roomPlayers
          ) => {
            setGameState(
              newGameState
            );
            setPlayers(
              roomPlayers
            );
            setScreen("game");
          }}
          onBack={() => {
            setScreen("home");
          }}
        />
      )}

      {screen === "game" &&
        gameState && (
          <GameScreen
            roomCode={roomCode}
            players={players}
            initialGameState={
              gameState
            }
            onBack={() => {
              setScreen(
                "lobby"
              );
            }}
          />
        )}
    </div>
  );
}

export default App;
