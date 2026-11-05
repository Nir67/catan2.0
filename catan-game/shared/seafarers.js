import { boardFor, RESOURCES, total, score } from "./engine.js";
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const at = (g, v) =>
  g.buildings.find((b) => b.vertexId === v) ||
  g.knightPieces?.find((k) => k.vertexId === v);
const edge = (g, id) => boardFor(g).edges.find((e) => e.id === id);
export function initializeSeafarers(g) {
  g.seafarers = true;
  g.targetScore = g.mode === "cities-knights" ? 17 : 14;
  g.pirate = null;
  g.goldClaims = [];
  g.shipMovedTurn = 0;
  const original = g.tiles,
    tiles = original.map((t) => ({ ...t, island: 0 }));
  const remote = new Map([
    ["4,0", ["gold", 5, 1]],
    ["4,-1", ["stone", 9, 1]],
    ["0,4", ["wheat", 4, 2]],
    ["-1,4", ["sheep", 10, 2]],
    ["-4,0", ["gold", 6, 3]],
    ["-4,1", ["brick", 11, 3]],
  ]);
  for (let r = -4; r <= 4; r++)
    for (let q = -4; q <= 4; q++) {
      const radius = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      if (radius <= 2 || radius > 4) continue;
      const data = remote.get(`${q},${r}`);
      tiles.push({
        id: tiles.length,
        x: 400 + Math.sqrt(3) * 60 * (q + r / 2),
        y: 270 + 90 * r,
        resource: data?.[0] || "sea",
        number: data?.[1] || null,
        island: data?.[2] ?? null,
        vertices: [],
      });
    }
  const vertices = new Map(),
    edges = new Map();
  for (const t of tiles) {
    t.vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = ((-90 + i * 60) * Math.PI) / 180,
        x = t.x + 60 * Math.cos(angle),
        y = t.y + 60 * Math.sin(angle),
        id = `${Math.round(x * 10) / 10}-${Math.round(y * 10) / 10}`;
      t.vertices.push(id);
      if (!vertices.has(id))
        vertices.set(id, { id, x, y, tiles: [], edges: [], neighbors: [] });
      vertices.get(id).tiles.push(t.id);
    }
    for (let i = 0; i < 6; i++) {
      const ends = [t.vertices[i], t.vertices[(i + 1) % 6]].sort(),
        id = ends.join("|");
      if (!edges.has(id)) {
        const a = vertices.get(ends[0]),
          b = vertices.get(ends[1]);
        edges.set(id, {
          id,
          vertices: ends,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          tiles: [],
        });
        for (const [v, n] of [
          [a, b],
          [b, a],
        ]) {
          v.edges.push(id);
          v.neighbors.push(n.id);
        }
      }
      edges.get(id).tiles.push(t.id);
    }
  }
  g.tiles = tiles;
  g.geometry = {
    vertices: [...vertices.values()],
    edges: [...edges.values()],
    ports: boardFor(g).ports,
  };
  for (const p of g.players) p.discoveredIslands = [];
}
export function shipLocations(g, id, setupVertex = null) {
  if (
    !g.seafarers ||
    g.roads.filter((r) => r.playerId === id && r.type === "ship").length >= 15
  )
    return [];
  return boardFor(g)
    .edges.filter(
      (e) =>
        e.tiles.some((i) => g.tiles[i].resource === "sea") &&
        !e.tiles.includes(g.pirate) &&
        !g.roads.some((r) => r.edgeId === e.id) &&
        e.vertices.some((v) => {
          if (setupVertex) return v === setupVertex;
          const b = at(g, v);
          if (b && b.playerId !== id) return false;
          if (b && g.buildings.includes(b)) return true;
          return g.roads.some(
            (r) =>
              r.playerId === id &&
              r.type === "ship" &&
              edge(g, r.edgeId).vertices.includes(v),
          );
        }),
    )
    .map((e) => e.id);
}
export function movableShips(g, id) {
  if (!g.seafarers || g.shipMovedTurn === g.turnNumber) return [];
  return g.roads
    .filter(
      (r) =>
        r.playerId === id &&
        r.type === "ship" &&
        r.builtTurn < g.turnNumber &&
        !edge(g, r.edgeId).tiles.includes(g.pirate) &&
        edge(g, r.edgeId).vertices.some(
          (v) =>
            !at(g, v) &&
            !g.roads.some(
              (other) =>
                other !== r &&
                other.playerId === id &&
                edge(g, other.edgeId).vertices.includes(v),
            ),
        ),
    )
    .map((r) => r.edgeId);
}
export function islandBonus(g, id, vertexId) {
  if (!g.seafarers) return;
  const p = g.players.find((p) => p.id === id),
    v = boardFor(g).vertices.find((v) => v.id === vertexId);
  for (const island of new Set(
    v.tiles.map((i) => g.tiles[i].island).filter((i) => i > 0),
  ))
    if (!p.discoveredIslands.includes(island)) p.discoveredIslands.push(island);
}
export function goldProduction(g, sum) {
  if (!g.seafarers) return;
  g.goldClaims = [];
  for (let i = 0; i < g.players.length; i++) {
    const p = g.players[(g.currentPlayerIndex + i) % g.players.length];
    const required = g.buildings
      .filter((b) => b.playerId === p.id)
      .reduce(
        (n, b) =>
          n +
          boardFor(g)
            .vertices.find((v) => v.id === b.vertexId)
            .tiles.filter(
              (i) =>
                g.tiles[i].resource === "gold" &&
                g.tiles[i].number === sum &&
                g.robber !== i,
            ).length *
            (b.type === "city" ? 2 : 1),
        0,
      );
    if (required) g.goldClaims.push({ playerId: p.id, required });
  }
}
export function resumeGold(g) {
  if (g.goldClaims?.length && g.stage === "action") g.stage = "gold-choice";
}
export function seaAction(g, p, a, rng, ctx) {
  if (!g.seafarers) return false;
  const active = g.players[g.currentPlayerIndex].id;
  if (a.type === "choose-gold") {
    const c = g.goldClaims[0];
    check(
      g.stage === "gold-choice" && c?.playerId === p.id,
      "אין בחירת זהב עבורך",
    );
    const available = RESOURCES.reduce((n, r) => n + g.bank[r], 0),
      count = Math.min(c.required, available),
      cards = a.cards;
    check(
      cards && typeof cards === "object" && !Array.isArray(cards),
      "בחר משאבים",
    );
    check(
      Object.keys(cards).every((r) => RESOURCES.includes(r) || cards[r] === 0),
      "זהב מעניק משאבים בלבד",
    );
    check(
      RESOURCES.every(
        (r) =>
          Number.isInteger(cards[r] ?? 0) &&
          (cards[r] ?? 0) >= 0 &&
          (cards[r] ?? 0) <= g.bank[r],
      ) && total(cards) === count,
      `בחר ${count} משאבים זמינים`,
    );
    ctx.give(g, p, cards);
    g.goldClaims.shift();
    g.stage = g.goldClaims.length ? "gold-choice" : "action";
    return true;
  }
  if (a.type === "move-pirate") {
    check(
      active === p.id &&
        g.stage === "robber" &&
        g.requiredRobberTarget !== "robber",
      "אי אפשר להזיז פיראט כעת",
    );
    check(
      Number.isInteger(a.tileId) &&
        g.tiles[a.tileId]?.resource === "sea" &&
        a.tileId !== g.pirate,
      "בחר משושה ים אחר",
    );
    g.pirate = a.tileId;
    g.victims = g.players
      .filter(
        (x) =>
          x.id !== p.id &&
          total(x.resources) > 0 &&
          g.roads.some(
            (r) =>
              r.playerId === x.id &&
              r.type === "ship" &&
              edge(g, r.edgeId).tiles.includes(a.tileId),
          ),
      )
      .map((x) => x.id);
    if (g.victims.length === 1) ctx.steal(g, p, g.victims[0], rng);
    else if (g.victims.length) g.stage = "steal";
    else {
      g.stage = g.returnStage;
      g.victims = [];
      delete g.requiredRobberTarget;
    }
    return true;
  }
  if (!["build-ship", "move-ship"].includes(a.type)) return false;
  check(active === p.id, "זה לא התור שלך");
  if (a.type === "move-ship") {
    check(
      g.stage === "action" && movableShips(g, p.id).includes(a.edgeId),
      "ניתן להזיז רק ספינת קצה פתוחה מתור קודם, פעם בתור",
    );
    const ship = g.roads.find((r) => r.edgeId === a.edgeId);
    g.roads = g.roads.filter((r) => r !== ship);
    check(
      a.destination !== a.edgeId &&
        shipLocations(g, p.id).includes(a.destination),
      "בחר יעד חוקי לספינה",
    );
    ship.edgeId = a.destination;
    g.roads.push(ship);
    g.shipMovedTurn = g.turnNumber;
    return true;
  }
  const setup = g.stage === "setup-road",
    free = g.stage === "road-building";
  check(setup || free || g.stage === "action", "יש להשלים גלגול ובחירות");
  check(
    shipLocations(g, p.id, setup ? g.setupVertex : null).includes(a.edgeId),
    "אין אפשרות לבנות ספינה כאן",
  );
  if (!setup && !free) ctx.pay(g, p, { wood: 1, sheep: 1 });
  g.roads.push({
    edgeId: a.edgeId,
    playerId: p.id,
    color: p.color,
    type: "ship",
    builtTurn: g.turnNumber,
  });
  if (setup) ctx.advanceSetup(g);
  else if (free) {
    g.freeRoads--;
    if (
      !g.freeRoads ||
      !(shipLocations(g, p.id).length || ctx.roadLocations(g, p.id).length)
    )
      g.stage = g.returnStage;
  }
  ctx.note(g, `${p.name} בנה/תה ספינה`);
  return true;
}
export function seaView(g, id) {
  if (!g.seafarers) return {};
  const c = g.goldClaims?.[0];
  return {
    goldChoice: c
      ? {
          playerId: c.playerId,
          required: Math.min(
            c.required,
            RESOURCES.reduce((n, r) => n + g.bank[r], 0),
          ),
        }
      : null,
    seaLegal: {
      ships: shipLocations(
        g,
        id,
        g.stage === "setup-road" ? g.setupVertex : null,
      ),
      movable: movableShips(g, id),
    },
  };
}
export function robberProtected(g, id) {
  return g.friendlyRobber && score(g, id, false) <= 2;
}
