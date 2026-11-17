import { canPay, boardFor } from "../../shared/engine.js";
import type { View, Track } from "../../shared/engine.js";
import { shipLocations } from "../../shared/seafarers.js";
import { TRACKS } from "../../shared/expansion.js";
export type PickRequest = {
  title: string;
  action: { type: string; [key: string]: unknown };
  field: "vertexId" | "edgeId" | "destination" | "choice";
};
export type Placement = PickRequest & { vertices: string[]; edges: string[] };
export function placementFor(
  g: View,
  id: string,
  pick: PickRequest,
): Placement {
  let vertices: string[] = [],
    edges: string[] = [];
  const action = pick.action,
    active = g.players[g.currentPlayerIndex].id === id;
  if (
    g.stage === "expansion-choice" &&
    g.choice?.playerId === id &&
    action.type === "expansion-choice"
  ) {
    const geometry = boardFor(g),
      options = g.choice.options ?? [];
    return {
      ...pick,
      vertices: options
        .filter((o) => geometry.vertices.some((v) => v.id === o.id))
        .map((o) => o.id),
      edges: options
        .filter((o) => geometry.edges.some((e) => e.id === o.id))
        .map((o) => o.id),
    };
  }
  if (!active || g.winner) return { ...pick, vertices, edges };
  const cities = g.buildings.filter(
    (b) => b.playerId === id && b.type === "city",
  );
  if (
    action.type === "build-ship" &&
    ["action", "setup-road", "road-building"].includes(g.stage) &&
    (g.stage !== "action" || canPay(g.me.resources, { wood: 1, sheep: 1 }))
  )
    edges = g.seaLegal?.ships || [];
  if (action.type === "select-ship-to-move" && g.stage === "action")
    edges = g.seaLegal?.movable || [];
  if (
    action.type === "move-ship" &&
    g.stage === "action" &&
    g.seaLegal?.movable.includes(String(action.edgeId))
  )
    edges = shipLocations(
      { ...g, roads: g.roads.filter((r) => r.edgeId !== action.edgeId) },
      id,
    ).filter((e) => e !== action.edgeId);
  if (g.stage === "action") {
    if (
      action.type === "hire-knight" &&
      canPay(g.me.resources, { sheep: 1, stone: 1 })
    )
      vertices = g.expansionLegal?.hire || [];
    if (
      action.type === "build-wall" &&
      canPay(g.me.resources, { brick: 2 }) &&
      cities.filter((b) => b.wall).length < 3
    )
      vertices = cities.filter((b) => !b.wall).map((b) => b.vertexId);
    if (action.type === "improve-city") {
      const track = action.track as Track,
        level = g.me.improvements?.[track];
      if (
        level !== undefined &&
        level < 5 &&
        canPay(g.me.resources, {
          [TRACKS[track]]: Math.max(0, level + 1 - (g.crane ? 1 : 0)),
        })
      )
        vertices = cities.filter((b) => !b.metropolis).map((b) => b.vertexId);
    }
    if (
      action.type === "play-progress" &&
      action.card === "engineer" &&
      cities.filter((b) => b.wall).length < 3
    )
      vertices = cities.filter((b) => !b.wall).map((b) => b.vertexId);
    if (
      action.type === "play-progress" &&
      action.card === "medicine" &&
      cities.length < 4 &&
      canPay(g.me.resources, { wheat: 1, stone: 2 })
    )
      vertices = g.buildings
        .filter((b) => b.playerId === id && b.type === "settlement")
        .map((b) => b.vertexId);
    if (action.type === "move-knight")
      vertices =
        g.expansionLegal?.knights.find((k) => k.vertexId === action.vertexId)
          ?.destinations || [];
  }
  // Keep the rendered candidates tied to this room's actual geometry.
  const geometry = boardFor(g);
  return {
    ...pick,
    vertices: vertices.filter((v) => geometry.vertices.some((x) => x.id === v)),
    edges: edges.filter((e) => geometry.edges.some((x) => x.id === e)),
  };
}
