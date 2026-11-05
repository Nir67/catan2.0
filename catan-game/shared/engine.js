import {
  initializeSeafarers,
  shipLocations,
  seaAction,
  seaView,
  goldProduction,
  resumeGold,
  islandBonus,
  robberProtected,
} from "./seafarers.js";
import {
  initializeExpansion,
  expansionAction,
  expansionEvent,
  expansionProduction,
  expansionView,
} from "./expansion.js";
export const RESOURCES = ["wood", "brick", "sheep", "wheat", "stone"];
export const COMMODITIES = ["paper", "cloth", "coin"];
export const MATERIALS = [...RESOURCES, ...COMMODITIES];
export const COLORS = ["blue", "red", "green", "yellow"];
export const COSTS = {
  road: { wood: 1, brick: 1 },
  ship: { wood: 1, sheep: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, stone: 3 },
  development: { sheep: 1, wheat: 1, stone: 1 },
};
export const emptyHand = (n = 0) =>
  Object.fromEntries(MATERIALS.map((r) => [r, RESOURCES.includes(r) ? n : 0]));
export const total = (hand) =>
  MATERIALS.reduce((n, r) => n + (hand[r] || 0), 0);
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const shuffle = (list, rng) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pointId = (p) =>
  `${Math.round(p.x * 10) / 10}-${Math.round(p.y * 10) / 10}`;
export const TILES = [];
export const VERTICES = [];
export const EDGES = [];
const vm = new Map(),
  em = new Map();
for (const [row, count] of [3, 4, 5, 4, 3].entries()) {
  for (let col = 0; col < count; col++) {
    const tile = {
      id: TILES.length,
      x: 400 + (col - (count - 1) / 2) * Math.sqrt(3) * 60,
      y: 90 + row * 90,
      vertices: [],
    };
    for (let i = 0; i < 6; i++) {
      const angle = ((-90 + i * 60) * Math.PI) / 180;
      const p = {
        x: tile.x + 60 * Math.cos(angle),
        y: tile.y + 60 * Math.sin(angle),
      };
      const id = pointId(p);
      tile.vertices.push(id);
      if (!vm.has(id))
        vm.set(id, { id, x: p.x, y: p.y, tiles: [], edges: [], neighbors: [] });
      vm.get(id).tiles.push(tile.id);
    }
    for (let i = 0; i < 6; i++) {
      const ends = [tile.vertices[i], tile.vertices[(i + 1) % 6]].sort();
      const id = ends.join("|");
      if (!em.has(id)) {
        const a = vm.get(ends[0]),
          b = vm.get(ends[1]);
        em.set(id, {
          id,
          vertices: ends,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          tiles: [],
        });
        for (const [one, other] of [
          [a, b],
          [b, a],
        ]) {
          one.edges.push(id);
          one.neighbors.push(other.id);
        }
      }
      em.get(id).tiles.push(tile.id);
    }
    TILES.push(tile);
  }
}
VERTICES.push(...vm.values());
EDGES.push(...em.values());
const coast = EDGES.filter((e) => e.tiles.length === 1).sort(
  (a, b) => Math.atan2(a.y - 270, a.x - 400) - Math.atan2(b.y - 270, b.x - 400),
);
export const PORTS = [0, 3, 7, 10, 13, 17, 20, 23, 27].map((i, n) => ({
  ...coast[i],
  resource: [
    "any",
    "wood",
    "any",
    "brick",
    "sheep",
    "any",
    "wheat",
    "any",
    "stone",
  ][n],
}));
export const boardFor = (g) =>
  g.geometry || { vertices: VERTICES, edges: EDGES, ports: PORTS };
const vertexAt = (g, id) => boardFor(g).vertices.find((v) => v.id === id);
const edgeAt = (g, id) => boardFor(g).edges.find((e) => e.id === id);
const adjacentTiles = (a, b) =>
  TILES[a].vertices.filter((v) => TILES[b].vertices.includes(v)).length === 2;
export function createGame(players, rng = Math.random, options = {}) {
  check(
    players.length >= 3 && players.length <= 4,
    "משחק הבסיס דורש 3–4 שחקנים",
  );
  const resources = shuffle(
    [
      "wood",
      "wood",
      "wood",
      "wood",
      "sheep",
      "sheep",
      "sheep",
      "sheep",
      "wheat",
      "wheat",
      "wheat",
      "wheat",
      "brick",
      "brick",
      "brick",
      "stone",
      "stone",
      "stone",
      "desert",
    ],
    rng,
  );
  const nums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  // Bounded generation: a random independent set of four tiles holds the 6/8 tokens.
  const productive = resources.flatMap((r, i) => (r === "desert" ? [] : [i]));
  let reds;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidates = shuffle(productive, rng);
    const chosen = [];
    for (const i of candidates)
      if (chosen.every((j) => !adjacentTiles(i, j))) {
        chosen.push(i);
        if (chosen.length === 4) break;
      }
    if (chosen.length === 4) {
      reds = chosen;
      break;
    }
  }
  check(reds, "לא ניתן ליצור לוח");
  const redNumbers = shuffle([6, 6, 8, 8], rng),
    others = shuffle(
      nums.filter((n) => n !== 6 && n !== 8),
      rng,
    );
  const tiles = resources.map((resource, id) => ({
    ...TILES[id],
    resource,
    number:
      resource === "desert"
        ? null
        : reds.includes(id)
          ? redNumbers.pop()
          : others.pop(),
  }));
  const game = {
    mode: "base",
    targetScore: 10,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: COLORS[i],
      resources: emptyHand(),
      development: [],
      knights: 0,
    })),
    tiles,
    bank: emptyHand(19),
    roads: [],
    buildings: [],
    robber: resources.indexOf("desert"),
    deck: shuffle(
      [
        ...Array(14).fill("knight"),
        ...Array(5).fill("victory"),
        ...Array(2).fill("road-building"),
        ...Array(2).fill("plenty"),
        ...Array(2).fill("monopoly"),
      ],
      rng,
    ),
    currentPlayerIndex: 0,
    turnNumber: 1,
    stage: "setup-settlement",
    setupIndex: 0,
    setupOrder: [...players.keys(), ...[...players.keys()].reverse()],
    setupVertex: null,
    dice: null,
    hasRolled: false,
    playedDevelopment: false,
    pendingDiscards: {},
    victims: [],
    returnStage: "action",
    freeRoads: 0,
    longestRoad: null,
    largestArmy: null,
    roadLengths: players.map(() => 0),
    winner: null,
    trade: null,
    log: ["המשחק התחיל — מציבים יישוב ודרך לפי הסדר"],
    revision: 0,
  };
  check(
    !options.mode || ["base", "cities-knights"].includes(options.mode),
    "מצב משחק לא חוקי",
  );
  if (options.mode === "cities-knights") initializeExpansion(game, rng);
  game.friendlyRobber = !!options.friendlyRobber;
  if (options.seafarers) initializeSeafarers(game);
  return game;
}
const buildingAt = (g, id) => g.buildings.find((b) => b.vertexId === id);
const ownRoads = (g, id) => g.roads.filter((r) => r.playerId === id);
const pieceCount = (g, id, type) =>
  type === "road"
    ? ownRoads(g, id).filter((r) => r.type !== "ship").length
    : g.buildings.filter((b) => b.playerId === id && b.type === type).length;
export const canPay = (hand, cost) =>
  MATERIALS.every((r) => (hand[r] || 0) >= (cost[r] || 0));
function pay(g, p, cost) {
  check(canPay(p.resources, cost), "אין מספיק משאבים");
  for (const r of MATERIALS) {
    const n = cost[r] || 0;
    p.resources[r] -= n;
    g.bank[r] += n;
  }
}
export function settlementLocations(g, id, setup = false) {
  if (pieceCount(g, id, "settlement") >= 5) return [];
  return boardFor(g)
    .vertices.filter(
      (v) =>
        v.tiles.some((i) => !["sea"].includes(g.tiles[i].resource)) &&
        (!setup ||
          !g.seafarers ||
          v.tiles.some((i) => g.tiles[i].island === 0)) &&
        !buildingAt(g, v.id) &&
        !g.knightPieces?.some((k) => k.vertexId === v.id) &&
        v.neighbors.every((n) => !buildingAt(g, n)) &&
        (setup ||
          ownRoads(g, id).some((r) =>
            edgeAt(g, r.edgeId).vertices.includes(v.id),
          )),
    )
    .map((v) => v.id);
}
export function roadLocations(g, id, setupVertex = null) {
  if (pieceCount(g, id, "road") >= 15) return [];
  return boardFor(g)
    .edges.filter(
      (e) =>
        (!g.seafarers || e.tiles.some((i) => g.tiles[i].resource !== "sea")) &&
        !g.roads.some((r) => r.edgeId === e.id) &&
        e.vertices.some((v) => {
          if (setupVertex) return v === setupVertex;
          const b =
            buildingAt(g, v) || g.knightPieces?.find((k) => k.vertexId === v);
          return b
            ? b.playerId === id
            : ownRoads(g, id).some(
                (r) =>
                  r.type !== "ship" && edgeAt(g, r.edgeId).vertices.includes(v),
              );
        }),
    )
    .map((e) => e.id);
}
export function longestPath(g, id) {
  const roads = ownRoads(g, id);
  const byVertex = new Map();
  for (const r of roads)
    for (const v of edgeAt(g, r.edgeId).vertices) {
      if (!byVertex.has(v)) byVertex.set(v, []);
      byVertex.get(v).push(r.edgeId);
    }
  function walk(v, used, previousType = null) {
    const occupant =
      buildingAt(g, v) || g.knightPieces?.find((k) => k.vertexId === v);
    if (used.size && occupant && occupant.playerId !== id) return used.size;
    let best = used.size;
    for (const edgeId of byVertex.get(v) || [])
      if (!used.has(edgeId)) {
        const route = roads.find((r) => r.edgeId === edgeId);
        const routeType = route.type || "road";
        if (
          previousType &&
          previousType !== routeType &&
          buildingAt(g, v)?.playerId !== id
        )
          continue;
        const next = edgeAt(g, edgeId).vertices.find((x) => x !== v);
        used.add(edgeId);
        best = Math.max(best, walk(next, used, routeType));
        used.delete(edgeId);
      }
    return best;
  }
  return Math.max(0, ...[...byVertex.keys()].map((v) => walk(v, new Set())));
}
function award(values, holder, minimum, players) {
  const max = Math.max(...values);
  if (max < minimum) return null;
  const leaders = players.filter((_, i) => values[i] === max).map((p) => p.id);
  return leaders.includes(holder)
    ? holder
    : leaders.length === 1
      ? leaders[0]
      : null;
}
export function score(g, id, hidden = true) {
  const p = g.players.find((p) => p.id === id);
  return (
    g.buildings
      .filter((b) => b.playerId === id)
      .reduce((n, b) => n + (b.type === "city" ? 2 : 1), 0) +
    (g.longestRoad === id ? 2 : 0) +
    (g.largestArmy === id ? 2 : 0) +
    (hidden ? p.development.filter((c) => c.type === "victory").length : 0) +
    (p.publicVP || 0) +
    (p.defenderVP || 0) +
    g.buildings.filter((b) => b.playerId === id && b.metropolis).length * 2 +
    (g.merchant?.playerId === id ? 1 : 0) +
    (p.discoveredIslands?.length || 0) * 2
  );
}
function updateAwards(g) {
  // A Diplomat relocation is a single action: preserve ownership until the
  // replacement road (or the decision to forgo it) has been resolved.
  if (g.choices?.some((c) => c.kind === "diplomat-road")) return;
  g.roadLengths = g.players.map((p) => longestPath(g, p.id));
  g.longestRoad = award(g.roadLengths, g.longestRoad, 5, g.players);
  g.largestArmy =
    g.mode === "cities-knights"
      ? null
      : award(
          g.players.map((p) => p.knights),
          g.largestArmy,
          3,
          g.players,
        );
  const id = g.players[g.currentPlayerIndex].id;
  if (!g.stage.startsWith("setup") && score(g, id) >= (g.targetScore || 10)) {
    g.winner = id;
    g.stage = "game-over";
    g.trade = null;
    note(
      g,
      `${g.players[g.currentPlayerIndex].name} ניצח/ה עם ${score(g, id)} נקודות!`,
    );
  }
}
function note(g, message) {
  g.log = [...g.log.slice(-39), message];
}
function bundle(value) {
  check(
    value && typeof value === "object" && !Array.isArray(value),
    "בחר משאבים",
  );
  check(
    Object.keys(value).every((r) => MATERIALS.includes(r)),
    "משאב לא חוקי",
  );
  return Object.fromEntries(
    MATERIALS.map((r) => {
      const n = value[r] ?? 0;
      check(Number.isInteger(n) && n >= 0 && n <= 95, "כמות לא חוקית");
      return [r, n];
    }),
  );
}
function give(g, p, items) {
  for (const r of MATERIALS) {
    const n = items[r] || 0;
    check(g.bank[r] >= n, "אין מספיק משאבים בבנק");
    g.bank[r] -= n;
    p.resources[r] += n;
  }
}
function production(g, sum) {
  for (const r of MATERIALS) {
    const claims = g.players.map((p) =>
      g.buildings
        .filter((b) => b.playerId === p.id)
        .reduce(
          (n, b) =>
            n +
            vertexAt(g, b.vertexId).tiles.filter(
              (i) =>
                i !== g.robber &&
                g.tiles[i].number === sum &&
                g.tiles[i].resource === r,
            ).length *
              (b.type === "city" ? 2 : 1),
          0,
        ),
    );
    const demand = claims.reduce((a, b) => a + b, 0),
      claimants = claims.filter((n) => n > 0).length;
    if (demand > g.bank[r] && claimants > 1) {
      note(g, `מחסור בבנק: ${r}`);
      continue;
    }
    claims.forEach((n, i) => {
      const amount = Math.min(n, g.bank[r]);
      g.bank[r] -= amount;
      g.players[i].resources[r] += amount;
    });
  }
}
export function tradeRatio(g, id, resource) {
  if (
    g.mode === "cities-knights" &&
    (g.fleet?.includes(resource) ||
      (g.merchant?.playerId === id &&
        g.tiles[g.merchant.tileId].resource === resource) ||
      (COMMODITIES.includes(resource) &&
        g.players.find((p) => p.id === id).improvements.trade >= 3))
  )
    return 2;
  const ports = boardFor(g).ports.filter((port) =>
    port.vertices.some((v) => buildingAt(g, v)?.playerId === id),
  );
  return ports.some((p) => p.resource === resource)
    ? 2
    : ports.some((p) => p.resource === "any")
      ? 3
      : 4;
}
function finishRobber(g) {
  delete g.requiredRobberTarget;
  g.stage = g.returnStage;
  g.victims = [];
}
function steal(g, p, victimId, rng) {
  check(g.victims.includes(victimId), "יש לבחור שחקן סמוך לשודד");
  const victim = g.players.find((x) => x.id === victimId),
    count = total(victim.resources);
  check(count > 0, "אין לשחקן משאבים");
  let pick = Math.floor(rng() * count);
  for (const r of MATERIALS) {
    if (pick < victim.resources[r]) {
      victim.resources[r]--;
      p.resources[r]++;
      break;
    }
    pick -= victim.resources[r];
  }
  note(g, `${p.name} גנב/ה קלף מ־${victim.name}`);
  finishRobber(g);
}
function perform(g, id, a, rng) {
  const p = g.players.find((p) => p.id === id);
  check(p, "השחקן אינו בחדר");
  check(a && typeof a.type === "string", "פעולה לא חוקית");
  check(!g.winner, "המשחק הסתיים");
  const active = g.players[g.currentPlayerIndex];
  if (seaAction(g, p, a, rng, expansionContext)) return;
  if (expansionAction(g, p, a, rng, expansionContext)) return;
  if (a.type === "discard") {
    check(
      g.stage === "discard" && g.pendingDiscards[id] > 0,
      "אין צורך להשליך",
    );
    const cards = bundle(a.cards);
    check(
      total(cards) === g.pendingDiscards[id],
      "יש להשליך בדיוק חצי מהקלפים (בעיגול מטה)",
    );
    pay(g, p, cards);
    delete g.pendingDiscards[id];
    if (!Object.keys(g.pendingDiscards).length)
      g.stage =
        g.mode === "cities-knights" && !g.barbarianAttacks
          ? "action"
          : "robber";
    note(g, `${p.name} השליך/ה ${total(cards)} קלפים`);
    return;
  }
  if (a.type === "accept-trade") {
    check(
      g.stage === "action" && g.trade && g.trade.from !== id,
      "אין הצעת מסחר זמינה",
    );
    const offer = g.trade,
      from = g.players.find((x) => x.id === offer.from);
    check(
      from.id === active.id || id === active.id,
      "אפשר לסחור רק עם השחקן שבתורו",
    );
    check(
      canPay(from.resources, offer.give) && canPay(p.resources, offer.want),
      "אין מספיק משאבים לעסקה",
    );
    for (const r of MATERIALS) {
      from.resources[r] += offer.want[r] - offer.give[r];
      p.resources[r] += offer.give[r] - offer.want[r];
    }
    note(g, `${from.name} ו־${p.name} השלימו עסקה`);
    g.trade = null;
    return;
  }
  if (a.type === "offer-trade") {
    check(g.stage === "action", "מסחר אפשרי רק אחרי גלגול וסיום אירוע השודד");
    const giveCards = bundle(a.give),
      want = bundle(a.want);
    check(
      total(giveCards) > 0 && total(want) > 0,
      "עסקה דורשת משאבים משני הצדדים",
    );
    check(
      MATERIALS.every((r) => !(giveCards[r] && want[r])),
      "אין להציע אותו משאב בשני הצדדים",
    );
    check(canPay(p.resources, giveCards), "אין לך את המשאבים המוצעים");
    g.trade = { from: id, give: giveCards, want };
    note(g, `${p.name} הציע/ה עסקה`);
    return;
  }
  if (a.type === "cancel-trade") {
    check(
      g.stage === "action" && (active.id === id || g.trade?.from === id),
      "אפשר לבטל רק הצעה שלך",
    );
    g.trade = null;
    return;
  }
  check(active.id === id, "זה לא התור שלך");
  if (g.stage === "setup-settlement") {
    check(
      a.type === "build-settlement" &&
        settlementLocations(g, id, true).includes(a.vertexId),
      "יש להציב יישוב בצומת פנוי ולשמור מרחק של שתי צלעות",
    );
    g.buildings.push({
      vertexId: a.vertexId,
      playerId: id,
      color: p.color,
      type:
        g.mode === "cities-knights" && g.setupIndex >= g.players.length
          ? "city"
          : "settlement",
    });
    g.setupVertex = a.vertexId;
    if (g.setupIndex >= g.players.length)
      for (const tileId of vertexAt(g, a.vertexId).tiles) {
        const r = g.tiles[tileId].resource;
        if (RESOURCES.includes(r)) give(g, p, { [r]: 1 });
      }
    g.stage = "setup-road";
    note(
      g,
      `${p.name} הציב/ה ${g.buildings.at(-1).type === "city" ? "עיר" : "יישוב"} התחלתי`,
    );
    return;
  }
  if (g.stage === "setup-road") {
    check(
      a.type === "build-road" &&
        roadLocations(g, id, g.setupVertex).includes(a.edgeId),
      "יש להציב דרך צמודה ליישוב שהצבת",
    );
    g.roads.push({ edgeId: a.edgeId, playerId: id, color: p.color });
    advanceSetup(g);
    return;
  }
  if (a.type === "move-robber") {
    check(
      g.stage === "robber" && g.requiredRobberTarget !== "pirate",
      "אי אפשר להזיז את השודד כעת",
    );
    check(
      Number.isInteger(a.tileId) &&
        g.tiles[a.tileId] &&
        g.tiles[a.tileId].resource !== "sea" &&
        a.tileId !== g.robber &&
        !g.buildings.some(
          (b) =>
            g.tiles[a.tileId].vertices.includes(b.vertexId) &&
            robberProtected(g, b.playerId),
        ),
      "בחר משושה אחר",
    );
    g.robber = a.tileId;
    g.victims = g.players
      .filter(
        (v) =>
          v.id !== id &&
          total(v.resources) > 0 &&
          g.buildings.some(
            (b) =>
              b.playerId === v.id &&
              g.tiles[a.tileId].vertices.includes(b.vertexId),
          ),
      )
      .map((v) => v.id);
    note(g, `${p.name} הזיז/ה את השודד`);
    if (g.victims.length === 1) steal(g, p, g.victims[0], rng);
    else if (g.victims.length) g.stage = "steal";
    else finishRobber(g);
    return;
  }
  if (a.type === "steal") {
    check(g.stage === "steal", "אין אפשרות לגנוב כעת");
    steal(g, p, a.victimId, rng);
    return;
  }
  if (a.type === "build-road" && g.stage === "road-building") {
    check(roadLocations(g, id).includes(a.edgeId), "אי אפשר לבנות דרך כאן");
    g.roads.push({ edgeId: a.edgeId, playerId: id, color: p.color });
    g.freeRoads--;
    if (
      !g.freeRoads ||
      !(roadLocations(g, id).length || shipLocations(g, id).length)
    )
      g.stage = g.returnStage;
    return;
  }
  check(
    ["pre-roll", "action"].includes(g.stage),
    "יש להשלים את הפעולה הנוכחית",
  );
  if (a.type === "play-development") {
    check(g.mode !== "cities-knights", "בהרחבה משתמשים בקלפי התקדמות");
    check(!g.playedDevelopment, "אפשר לשחק קלף פיתוח אחד בתור");
    const index = p.development.findIndex(
      (c) =>
        c.type === a.card &&
        c.type !== "victory" &&
        c.boughtTurn < g.turnNumber,
    );
    check(index >= 0, "אפשר לשחק רק קלף פיתוח שנקנה בתור קודם");
    if (a.card === "plenty") {
      const cards = bundle(a.cards);
      check(
        total(cards) === Math.min(2, total(g.bank)),
        "בחר שני משאבים מהבנק",
      );
      give(g, p, cards);
    } else if (a.card === "monopoly") {
      check(RESOURCES.includes(a.resource), "בחר משאב");
      for (const other of g.players)
        if (other.id !== id) {
          p.resources[a.resource] += other.resources[a.resource];
          other.resources[a.resource] = 0;
        }
    } else if (a.card === "road-building") {
      check(
        roadLocations(g, id).length || shipLocations(g, id).length,
        "אין מקום או חלקי דרך לבנייה",
      );
      g.returnStage = g.stage;
      g.stage = "road-building";
      g.freeRoads = g.seafarers
        ? 2
        : Math.min(2, 15 - pieceCount(g, id, "road"));
    } else if (a.card === "knight") {
      p.knights++;
      g.returnStage = g.stage;
      g.stage = "robber";
    } else throw new Error("קלף לא חוקי");
    p.development.splice(index, 1);
    g.playedDevelopment = true;
    g.trade = null;
    note(g, `${p.name} שיחק/ה קלף ${a.card}`);
    return;
  }
  if (a.type === "roll-dice") {
    check(g.stage === "pre-roll" && !g.hasRolled, "כבר גלגלת בתור הזה");
    g.dice = g.chosenDice || [
      1 + Math.floor(rng() * 6),
      1 + Math.floor(rng() * 6),
    ];
    delete g.chosenDice;
    g.hasRolled = true;
    note(g, `${p.name} גלגל/ה ${g.dice[0] + g.dice[1]}`);
    if (g.mode === "cities-knights") expansionEvent(g, rng, expansionContext);
    else resolveProduction(g, expansionContext);
    return;
  }
  check(g.stage === "action", "צריך לגלגל לפני מסחר או בנייה");
  if (a.type.startsWith("build-")) {
    const type = a.type.slice(6);
    check(["road", "settlement", "city"].includes(type), "סוג מבנה לא חוקי");
    if (type === "road") {
      check(
        roadLocations(g, id).includes(a.edgeId),
        "הדרך חייבת להתחבר לרשת שלך ולא לעבור דרך מבנה יריב",
      );
      pay(g, p, COSTS.road);
      g.roads.push({ edgeId: a.edgeId, playerId: id, color: p.color });
    }
    if (type === "settlement") {
      check(
        settlementLocations(g, id).includes(a.vertexId),
        "היישוב חייב להתחבר לדרך שלך ולשמור מרחק",
      );
      pay(g, p, COSTS.settlement);
      islandBonus(g, id, a.vertexId);
      g.buildings.push({
        vertexId: a.vertexId,
        playerId: id,
        color: p.color,
        type,
      });
    }
    if (type === "city") {
      const b = buildingAt(g, a.vertexId);
      check(
        b?.playerId === id &&
          b.type === "settlement" &&
          pieceCount(g, id, "city") < 4,
        "עיר משדרגת רק יישוב שלך (עד 4 ערים)",
      );
      pay(g, p, COSTS.city);
      b.type = "city";
    }
    g.trade = null;
    note(g, `${p.name} בנה/תה ${type}`);
    return;
  }
  if (a.type === "buy-development") {
    check(g.mode !== "cities-knights", "בהרחבה אין קניית קלפי פיתוח");
    check(g.deck.length, "קלפי הפיתוח אזלו");
    pay(g, p, COSTS.development);
    p.development.push({ type: g.deck.pop(), boughtTurn: g.turnNumber });
    g.trade = null;
    note(g, `${p.name} קנה/תה קלף פיתוח`);
    return;
  }
  if (a.type === "bank-trade") {
    const giveCards = bundle(a.give),
      want = bundle(a.want);
    check(total(want) > 0, "בחר משאבים לקבלה");
    check(
      MATERIALS.every((r) => !(giveCards[r] && want[r])),
      "אי אפשר להחליף משאב באותו משאב",
    );
    let credit = 0;
    for (const r of MATERIALS) {
      const ratio = tradeRatio(g, id, r);
      check(giveCards[r] % ratio === 0, "כמות ההחלפה לא מתאימה ליחס הנמל");
      credit += giveCards[r] / ratio;
    }
    check(
      credit === total(want),
      "יחס ההחלפה הוא 4:1, או 3:1 / 2:1 עם נמל מתאים",
    );
    check(canPay(g.bank, want), "אין מספיק משאבים בבנק");
    pay(g, p, giveCards);
    give(g, p, want);
    g.trade = null;
    note(g, `${p.name} סחר/ה עם הבנק`);
    return;
  }

  if (a.type === "cancel-trade") {
    g.trade = null;
    return;
  }
  if (a.type === "end-turn") {
    check(
      !p.progress || p.progress.length <= 4,
      "יש להחזיר קלפי התקדמות עודפים לפני סיום התור",
    );
    g.fleet = [];
    g.crane = false;
    g.harbor = null;
    g.trade = null;
    g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length;
    g.turnNumber++;
    g.stage = "pre-roll";
    g.hasRolled = false;
    g.playedDevelopment = false;
    return;
  }
  throw new Error("פעולה לא מוכרת");
}
export function applyAction(game, id, action, rng = Math.random) {
  const next = structuredClone(game);
  // Saves created before commodities existed remain valid base games.
  for (const r of MATERIALS) {
    next.bank[r] ??= 0;
    for (const p of next.players) p.resources[r] ??= 0;
  }
  perform(next, id, action, rng);
  resumeGold(next);
  next.revision++;
  updateAwards(next);
  return next;
}
export function legalMoves(g, id) {
  const p = g.players.find((p) => p.id === id);
  const active = g.players[g.currentPlayerIndex].id === id;
  const moves = { roads: [], settlements: [], cities: [] };
  if (!p || !active || g.winner) return moves;
  if (g.stage === "setup-settlement")
    moves.settlements = settlementLocations(g, id, true);
  if (g.stage === "setup-road")
    moves.roads = roadLocations(g, id, g.setupVertex);
  if (g.stage === "road-building") moves.roads = roadLocations(g, id);
  if (g.stage === "action") {
    if (canPay(p.resources, COSTS.road)) moves.roads = roadLocations(g, id);
    if (canPay(p.resources, COSTS.settlement))
      moves.settlements = settlementLocations(g, id);
    if (canPay(p.resources, COSTS.city) && pieceCount(g, id, "city") < 4)
      moves.cities = g.buildings
        .filter((b) => b.playerId === id && b.type === "settlement")
        .map((b) => b.vertexId);
  }
  return moves;
}
export function viewFor(g, id) {
  const me = g.players.find((p) => p.id === id);
  const { deck, ...publicState } = g;
  delete publicState.setupOrder;
  return {
    ...publicState,
    players: g.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      knights:
        g.mode === "cities-knights"
          ? g.knightPieces
              .filter((k) => k.playerId === p.id && k.active)
              .reduce((n, k) => n + k.level, 0)
          : p.knights,
      improvements: p.improvements,
      defenderVP: p.defenderVP,
      progressCount: p.progress?.length,
      resourceCount: total(p.resources),
      developmentCount: p.development.length,
      score: score(g, p.id, g.winner !== null || p.id === id),
      roadLength: g.roadLengths[i],
    })),
    developmentRemaining: deck.length,
    me: me
      ? {
          resources: { ...emptyHand(), ...me.resources },
          improvements: me.improvements,
          progress: me.progress,
          development: structuredClone(me.development),
          ratios: Object.fromEntries(
            MATERIALS.map((r) => [r, tradeRatio(g, id, r)]),
          ),
        }
      : null,
    legal: legalMoves(g, id),
    ...expansionView(g, id),
    ...seaView(g, id),
  };
}

function advanceSetup(g) {
  g.setupIndex++;
  if (g.setupIndex === g.setupOrder.length) {
    g.currentPlayerIndex = 0;
    g.stage = "pre-roll";
    note(g, "ההצבה הסתיימה — מתחילים לגלגל");
  } else {
    g.currentPlayerIndex = g.setupOrder[g.setupIndex];
    g.stage = "setup-settlement";
  }
}
const expansionContext = {
  advanceSetup,
  steal,
  roadLocations,
  pay,
  give,
  note,
  names: {
    wood: "עץ",
    brick: "לבנים",
    sheep: "צמר",
    wheat: "חיטה",
    stone: "מחצבים",
  },
};
export function resolveProduction(g, ctx = expansionContext) {
  const sum = g.dice[0] + g.dice[1];
  if (sum === 7) {
    g.pendingDiscards = Object.fromEntries(
      g.players
        .filter(
          (p) =>
            total(p.resources) >
            7 +
              2 *
                g.buildings.filter((b) => b.playerId === p.id && b.wall).length,
        )
        .map((p) => [p.id, Math.floor(total(p.resources) / 2)]),
    );
    g.returnStage = "action";
    g.stage = Object.keys(g.pendingDiscards).length
      ? "discard"
      : g.mode === "cities-knights" && !g.barbarianAttacks
        ? "action"
        : "robber";
  } else {
    g.stage = "action";
    if (g.mode === "cities-knights") expansionProduction(g, sum, ctx);
    else production(g, sum);
    goldProduction(g, sum);
    resumeGold(g);
  }
}
