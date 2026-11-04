export type BaseResource = "wood" | "brick" | "sheep" | "wheat" | "stone";
export type Resource = BaseResource | "paper" | "cloth" | "coin";
export type Track = "science" | "politics" | "trade";
export type Color = "blue" | "red" | "green" | "yellow";
export type Hand = Record<Resource, number>;
export type DevelopmentType =
  "knight" | "victory" | "road-building" | "plenty" | "monopoly";
export type Development = { type: DevelopmentType; boughtTurn: number };
export type Vertex = {
  id: string;
  x: number;
  y: number;
  tiles: number[];
  edges: string[];
  neighbors: string[];
};
export type Edge = {
  id: string;
  x: number;
  y: number;
  angle: number;
  vertices: string[];
  tiles: number[];
};
export type Tile = {
  id: number;
  x: number;
  y: number;
  vertices: string[];
  resource: BaseResource | "desert";
  number: number | null;
};
export type PublicPlayer = {
  id: string;
  name: string;
  color: Color;
  knights: number;
  resourceCount: number;
  developmentCount: number;
  score: number;
  roadLength: number;
  improvements?: Record<Track, number>;
  defenderVP?: number;
  progressCount?: number;
};
export type Knight = {
  vertexId: string;
  playerId: string;
  color: Color;
  level: number;
  active: boolean;
  activatedTurn: number;
  actedTurn: number;
  promotedTurn: number;
};
export type Choice = {
  playerId: string;
  title: string;
  kind?: string;
  options?: { id: string; label: string }[];
  required?: number;
  max?: Hand;
};
export type View = {
  mode: "base" | "cities-knights";
  targetScore: number;
  knightPieces?: Knight[];
  barbarianPosition?: number;
  barbarianAttacks?: number;
  eventDie?: string;
  lastBattle?: { attack: number; defense: number; won: boolean };
  merchant?: { playerId: string; tileId: number } | null;
  choice?: Choice | null;
  progressRemaining?: Record<Track, number>;
  harbor?: { used: string[] } | null;
  crane?: boolean;
  expansionLegal?: {
    hire: string[];
    knights: {
      vertexId: string;
      promote: boolean;
      act: boolean;
      chase: boolean;
      destinations: string[];
    }[];
  };
  players: PublicPlayer[];
  tiles: Tile[];
  bank: Hand;
  roads: { edgeId: string; playerId: string; color: Color }[];
  buildings: {
    vertexId: string;
    playerId: string;
    color: Color;
    type: "settlement" | "city";
    wall?: boolean;
    metropolis?: Track;
  }[];
  robber: number;
  currentPlayerIndex: number;
  turnNumber: number;
  stage: string;
  dice: [number, number] | null;
  hasRolled: boolean;
  playedDevelopment: boolean;
  pendingDiscards: Record<string, number>;
  victims: string[];
  freeRoads: number;
  longestRoad: string | null;
  largestArmy: string | null;
  winner: string | null;
  trade: { from: string; give: Hand; want: Hand } | null;
  log: string[];
  revision: number;
  developmentRemaining: number;
  me: {
    resources: Hand;
    development: Development[];
    ratios: Hand;
    improvements?: Record<Track, number>;
    progress?: string[];
  };
  legal: { roads: string[]; settlements: string[]; cities: string[] };
};
export const RESOURCES: BaseResource[];
export const COMMODITIES: Resource[];
export const MATERIALS: Resource[];
export const COLORS: Color[];
export const COSTS: Record<
  "road" | "settlement" | "city" | "development",
  Partial<Hand>
>;
export const VERTICES: Vertex[];
export const EDGES: Edge[];
export const TILES: Omit<Tile, "resource" | "number">[];
export const PORTS: (Edge & { resource: Resource | "any" })[];
export function emptyHand(n?: number): Hand;
export function total(hand: Hand): number;
export function canPay(hand: Hand, cost: Partial<Hand>): boolean;
