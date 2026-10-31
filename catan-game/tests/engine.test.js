import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyAction,
  legalMoves,
  viewFor,
  VERTICES,
  EDGES,
  TILES,
  PORTS,
  RESOURCES,
  emptyHand,
  total,
  longestPath,
  score,
  tradeRatio,
} from "../shared/engine.js";
const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const fresh = () => createGame(players);
function setup(g = fresh()) {
  const order = [];
  while (g.stage.startsWith("setup")) {
    const id = g.players[g.currentPlayerIndex].id,
      m = legalMoves(g, id);
    if (g.stage === "setup-settlement") {
      order.push(id);
      g = applyAction(g, id, {
        type: "build-settlement",
        vertexId: m.settlements[0],
      });
    } else g = applyAction(g, id, { type: "build-road", edgeId: m.roads[0] });
  }
  return { g, order };
}
function ready() {
  const g = setup().g;
  g.stage = "action";
  g.hasRolled = true;
  return g;
}
function stock(g, id, amount = 10) {
  const p = g.players.find((p) => p.id === id);
  for (const r of RESOURCES) {
    g.bank[r] += p.resources[r] - amount;
    p.resources[r] = amount;
  }
  return g;
}
const act = (g, a, id = "a", rng) => applyAction(g, id, a, rng);
function route(length, avoid = new Set()) {
  function find(v, edges, vertices) {
    if (edges.length === length) return edges;
    for (const e of EDGES.filter(
      (e) => e.vertices.includes(v) && !edges.includes(e.id),
    )) {
      const n = e.vertices.find((n) => n !== v);
      if (avoid.has(n) || vertices.has(n)) continue;
      const found = find(n, [...edges, e.id], new Set([...vertices, n]));
      if (found) return found;
    }
    return null;
  }
  for (const v of VERTICES) {
    if (avoid.has(v.id)) continue;
    const r = find(v.id, [], new Set([v.id]));
    if (r) return r;
  }
  throw new Error("no route");
}
function conserve(g) {
  for (const r of RESOURCES)
    assert.equal(
      g.bank[r] + g.players.reduce((n, p) => n + p.resources[r], 0),
      19,
      `conservation ${r}`,
    );
}
test("board geometry, stock, token counts and red token separation", () => {
  assert.equal(VERTICES.length, 54);
  assert.equal(EDGES.length, 72);
  assert.equal(TILES.length, 19);
  assert.equal(PORTS.length, 9);
  assert.equal(new Set(PORTS.flatMap((p) => p.vertices)).size, 18);
  for (let i = 0; i < 50; i++) {
    const g = fresh();
    assert.equal(g.deck.length, 25);
    assert.equal(g.deck.filter((c) => c === "knight").length, 14);
    assert.equal(g.tiles.filter((t) => t.resource === "desert").length, 1);
    for (const [r, n] of [
      ["wood", 4],
      ["sheep", 4],
      ["wheat", 4],
      ["brick", 3],
      ["stone", 3],
    ])
      assert.equal(g.tiles.filter((t) => t.resource === r).length, n);
    for (const red of g.tiles.filter((t) => [6, 8].includes(t.number)))
      for (const other of g.tiles.filter(
        (t) => t.id !== red.id && [6, 8].includes(t.number),
      ))
        assert.ok(
          red.vertices.filter((v) => other.vertices.includes(v)).length < 2,
        );
  }
});
test("3–4 players only; snake setup, free pieces and second settlement income", () => {
  assert.throws(() => createGame(players.slice(0, 2)));
  assert.throws(() => createGame([...players, ...players]));
  const { g, order } = setup();
  assert.deepEqual(order, ["a", "b", "c", "c", "b", "a"]);
  assert.equal(g.currentPlayerIndex, 0);
  assert.equal(g.stage, "pre-roll");
  assert.equal(g.roads.length, 6);
  assert.equal(g.buildings.length, 6);
  for (const p of g.players) {
    const own = g.buildings.filter((b) => b.playerId === p.id);
    const second = VERTICES.find((v) => v.id === own[1].vertexId);
    const expected = emptyHand();
    for (const tile of second.tiles)
      if (g.tiles[tile].resource !== "desert")
        expected[g.tiles[tile].resource]++;
    assert.deepEqual(p.resources, expected);
  }
  conserve(g);
});
test("server rejects wrong turn, arbitrary IDs, disconnected roads and adjacent settlements atomically", () => {
  let g = fresh();
  assert.throws(() =>
    act(g, { type: "build-settlement", vertexId: VERTICES[0].id }, "b"),
  );
  const before = JSON.stringify(g);
  assert.throws(() => act(g, { type: "build-settlement", vertexId: "fake" }));
  assert.equal(JSON.stringify(g), before);
  g = act(g, {
    type: "build-settlement",
    vertexId: legalMoves(g, "a").settlements[0],
  });
  const remote = EDGES.find((e) => !e.vertices.includes(g.setupVertex));
  assert.throws(() => act(g, { type: "build-road", edgeId: remote.id }));
  g = ready();
  stock(g, "a", 3);
  const legal = legalMoves(g, "a").roads;
  const invalid = EDGES.find((e) => !legal.includes(e.id));
  assert.throws(() => act(g, { type: "build-road", edgeId: invalid.id }));
  const neighbor = VERTICES.find((v) => v.id === g.buildings[0].vertexId)
    .neighbors[0];
  assert.throws(() => act(g, { type: "build-settlement", vertexId: neighbor }));
});
test("roll once before actions; no arbitrary dice injection", () => {
  let g = setup().g;
  assert.throws(() => act(g, { type: "end-turn" }));
  assert.throws(() => act(g, { type: "buy-development" }));
  g = act(g, { type: "roll-dice", dice: [6, 6] }, "a", () => 0);
  assert.deepEqual(g.dice, [1, 1]);
  assert.equal(g.stage, "action");
  assert.throws(() => act(g, { type: "roll-dice" }));
  g = act(g, { type: "end-turn" });
  assert.equal(g.currentPlayerIndex, 1);
  assert.equal(g.stage, "pre-roll");
  assert.equal(g.hasRolled, false);
  assert.equal(g.turnNumber, 2);
});
test("paid roads, duplicate prevention, own city upgrades and returned settlement supply", () => {
  let g = ready();
  stock(g, "a", 3);
  const before = { ...g.players[0].resources };
  const edge = legalMoves(g, "a").roads[0];
  g = act(g, { type: "build-road", edgeId: edge });
  assert.equal(g.players[0].resources.wood, before.wood - 1);
  assert.equal(g.players[0].resources.brick, before.brick - 1);
  assert.throws(() => act(g, { type: "build-road", edgeId: edge }));
  const mine = g.buildings.find((b) => b.playerId === "a"),
    other = g.buildings.find((b) => b.playerId === "b");
  assert.throws(() => act(g, { type: "build-city", vertexId: other.vertexId }));
  g = act(g, { type: "build-city", vertexId: mine.vertexId });
  assert.equal(
    g.buildings.find((b) => b.vertexId === mine.vertexId).type,
    "city",
  );
  assert.throws(() => act(g, { type: "build-city", vertexId: mine.vertexId }));
  conserve(g);
  const broke = ready();
  broke.players[0].resources = emptyHand();
  assert.throws(() =>
    act(broke, {
      type: "build-road",
      edgeId: legalMoves(
        {
          ...broke,
          players: broke.players.map((p) => ({
            ...p,
            resources: emptyHand(9),
          })),
        },
        "a",
      ).roads[0],
    }),
  );
});
test("production for every player, city doubles, robber blocks", () => {
  let g = setup().g;
  const tile = g.tiles.find((t) => t.resource !== "desert");
  g.buildings = [
    { vertexId: tile.vertices[0], playerId: "a", color: "blue", type: "city" },
    {
      vertexId: tile.vertices[2],
      playerId: "b",
      color: "red",
      type: "settlement",
    },
  ];
  g.tiles.forEach((t) => (t.number = null));
  tile.number = 2;
  g.players.forEach((p) => (p.resources = emptyHand()));
  g.bank = emptyHand(19);
  g.robber = g.tiles.find((t) => t.resource === "desert").id;
  let next = act(g, { type: "roll-dice" }, "a", () => 0);
  assert.equal(next.players[0].resources[tile.resource], 2);
  assert.equal(next.players[1].resources[tile.resource], 1);
  conserve(next);
  g.robber = tile.id;
  next = act(g, { type: "roll-dice" }, "a", () => 0);
  assert.equal(next.players[0].resources[tile.resource], 0);
  g.robber = -1;
  g.bank[tile.resource] = 2;
  next = act(g, { type: "roll-dice" }, "a", () => 0);
  assert.equal(
    next.players[0].resources[tile.resource],
    0,
    "multiple recipients get none during shortage",
  );
  g.buildings = g.buildings.slice(0, 1);
  g.bank[tile.resource] = 1;
  next = act(g, { type: "roll-dice" }, "a", () => 0);
  assert.equal(
    next.players[0].resources[tile.resource],
    1,
    "single recipient gets remainder",
  );
});
test("seven enforces all discards before moving robber and random theft", () => {
  let g = setup().g;
  stock(g, "a", 2);
  stock(g, "b", 2);
  g = act(
    g,
    { type: "roll-dice" },
    "a",
    (() => {
      let i = 0;
      return () => (i++ % 2 ? 0.99 : 0);
    })(),
  );
  assert.equal(g.stage, "discard");
  assert.equal(g.pendingDiscards.a, 5);
  assert.throws(() =>
    act(g, { type: "move-robber", tileId: (g.robber + 1) % 19 }),
  );
  assert.throws(() => act(g, { type: "discard", cards: { wood: 1 } }));
  g = act(g, { type: "discard", cards: { wood: 2, brick: 2, sheep: 1 } });
  g = act(g, { type: "discard", cards: { wood: 2, brick: 2, sheep: 1 } }, "b");
  assert.equal(g.stage, "robber");
  assert.throws(() => act(g, { type: "move-robber", tileId: g.robber }));
  const tile = g.tiles.find(
    (t) =>
      t.id !== g.robber &&
      g.buildings.some(
        (b) => b.playerId === "b" && t.vertices.includes(b.vertexId),
      ),
  );
  const sum = total(g.players[0].resources) + total(g.players[1].resources);
  g = act(g, { type: "move-robber", tileId: tile.id }, "a", () => 0);
  if (g.stage === "steal")
    g = act(g, { type: "steal", victimId: "b" }, "a", () => 0);
  assert.equal(g.stage, "action");
  assert.equal(total(g.players[0].resources), 6);
  assert.equal(
    total(g.players[0].resources) + total(g.players[1].resources),
    sum,
  );
  conserve(g);
});
test("bank trade ratios, bundles, resource validation and harbor ownership", () => {
  let g = ready();
  stock(g, "a", 5);
  g.buildings = [];
  assert.equal(tradeRatio(g, "a", "wood"), 4);
  g = act(g, { type: "bank-trade", give: { wood: 4 }, want: { stone: 1 } });
  assert.equal(g.players[0].resources.wood, 1);
  assert.equal(g.players[0].resources.stone, 6);
  assert.throws(() =>
    act(g, { type: "bank-trade", give: { brick: 2 }, want: { sheep: 1 } }),
  );
  assert.throws(() =>
    act(g, { type: "bank-trade", give: { wood: -1 }, want: { brick: 1 } }),
  );
  assert.throws(() =>
    act(g, { type: "bank-trade", give: { wood: 0.5 }, want: { brick: 1 } }),
  );
  assert.throws(() =>
    act(g, { type: "bank-trade", give: { stone: 4 }, want: { stone: 1 } }),
  );
  assert.throws(() =>
    act(g, {
      type: "bank-trade",
      give: JSON.parse('{"__proto__":1}'),
      want: { brick: 1 },
    }),
  );
  const specific = PORTS.find((p) => p.resource === "wood"),
    generic = PORTS.find((p) => p.resource === "any");
  g.buildings = [
    { vertexId: specific.vertices[0], playerId: "a", type: "settlement" },
    { vertexId: generic.vertices[0], playerId: "a", type: "settlement" },
  ];
  assert.equal(tradeRatio(g, "a", "wood"), 2);
  assert.equal(tradeRatio(g, "a", "brick"), 3);
  conserve(g);
});
test("domestic trades require active player, nonempty distinct bundles and current resources", () => {
  let g = ready();
  stock(g, "a", 2);
  stock(g, "b", 2);
  g = act(
    g,
    { type: "offer-trade", give: { wood: 1 }, want: { brick: 1 } },
    "b",
  );
  assert.throws(() => act(g, { type: "accept-trade" }, "c"));
  g = act(g, { type: "accept-trade" }, "a");
  conserve(g);
  stock(g, "a", 2);
  stock(g, "b", 2);
  assert.throws(() =>
    act(g, { type: "offer-trade", give: { wood: 1 }, want: {} }),
  );
  g = act(g, { type: "offer-trade", give: { wood: 1 }, want: { brick: 2 } });
  assert.throws(() => act(g, { type: "accept-trade" }));
  g = act(g, { type: "accept-trade" }, "b");
  assert.equal(g.players[0].resources.wood, 1);
  assert.equal(g.players[0].resources.brick, 4);
  assert.equal(g.trade, null);
  assert.throws(() => act(g, { type: "accept-trade" }, "c"));
  conserve(g);
});
test("development deck and private hands never leak; purchased cards cannot be used same turn", () => {
  let g = ready();
  stock(g, "a", 2);
  g.deck = ["knight"];
  g = act(g, { type: "buy-development" });
  assert.equal(g.players[0].development[0].type, "knight");
  assert.throws(() => act(g, { type: "play-development", card: "knight" }));
  const view = viewFor(g, "b");
  assert.ok(!("deck" in view));
  assert.ok(!("setupOrder" in view));
  assert.ok(!("resources" in view.players[0]));
  assert.ok(!("development" in view.players[0]));
  assert.ok(!JSON.stringify(view).includes("boughtTurn"));
  assert.equal(view.developmentRemaining, 0);
});
test("knight works before rolling without discards; largest army and one card limit", () => {
  let g = setup().g;
  g.turnNumber = 5;
  g.players[0].development = [
    { type: "knight", boughtTurn: 1 },
    { type: "monopoly", boughtTurn: 1 },
  ];
  g.players[0].knights = 2;
  g = act(g, { type: "play-development", card: "knight" });
  assert.equal(g.largestArmy, "a");
  assert.equal(g.stage, "robber");
  assert.deepEqual(g.pendingDiscards, {});
  const vacant = g.tiles.find(
    (t) =>
      t.id !== g.robber &&
      !g.buildings.some((b) => t.vertices.includes(b.vertexId)),
  );
  g = act(g, { type: "move-robber", tileId: vacant.id });
  assert.equal(g.stage, "pre-roll");
  assert.throws(() =>
    act(g, { type: "play-development", card: "monopoly", resource: "wood" }),
  );
});
test("year of plenty, monopoly and sequential free roads", () => {
  let g = ready();
  g.turnNumber = 3;
  g.players[0].development = [{ type: "plenty", boughtTurn: 1 }];
  let before = g.players[0].resources.wood;
  g = act(g, { type: "play-development", card: "plenty", cards: { wood: 2 } });
  assert.equal(g.players[0].resources.wood, before + 2);
  conserve(g);
  g = ready();
  stock(g, "b", 2);
  g.turnNumber = 3;
  g.players[0].development = [{ type: "monopoly", boughtTurn: 1 }];
  const all = g.players.reduce((n, p) => n + p.resources.wood, 0);
  g = act(g, { type: "play-development", card: "monopoly", resource: "wood" });
  assert.equal(g.players[0].resources.wood, all);
  assert.equal(g.players[1].resources.wood, 0);
  conserve(g);
  g = setup().g;
  g.turnNumber = 3;
  g.players[0].development = [{ type: "road-building", boughtTurn: 1 }];
  const hand = { ...g.players[0].resources };
  g = act(g, { type: "play-development", card: "road-building" });
  assert.equal(g.stage, "road-building");
  for (let i = 0; i < 2; i++)
    g = act(g, { type: "build-road", edgeId: legalMoves(g, "a").roads[0] });
  assert.equal(g.stage, "pre-roll");
  assert.deepEqual(g.players[0].resources, hand);
  conserve(g);
});
test("longest road branches, cycles, blocking and award transfer/ties", () => {
  let g = ready();
  g.buildings = [];
  const path = route(6);
  g.roads = path.map((edgeId) => ({ edgeId, playerId: "a" }));
  assert.equal(longestPath(g, "a"), 6);
  const middle = EDGES.find((e) => e.id === path[2]).vertices.find((v) =>
    EDGES.find((e) => e.id === path[3]).vertices.includes(v),
  );
  g.buildings = [{ vertexId: middle, playerId: "b", type: "settlement" }];
  assert.equal(longestPath(g, "a"), 3);
  g.buildings = [];
  const ring = TILES[9].vertices;
  g.roads = ring.map((v, i) => ({
    edgeId: [v, ring[(i + 1) % 6]].sort().join("|"),
    playerId: "a",
  }));
  assert.equal(longestPath(g, "a"), 6);
  g = ready();
  g.buildings = [];
  g.roads = path.map((edgeId) => ({ edgeId, playerId: "a" }));
  g = act(g, { type: "cancel-trade" });
  assert.equal(g.longestRoad, "a");
  const avoid = new Set(
    path.flatMap((id) => EDGES.find((e) => e.id === id).vertices),
  );
  const other = route(6, avoid);
  g.roads.push(...other.map((edgeId) => ({ edgeId, playerId: "b" })));
  g = act(g, { type: "cancel-trade" });
  assert.equal(g.longestRoad, "a", "holder keeps tie");
  g.buildings = [{ vertexId: middle, playerId: "c", type: "settlement" }];
  g = act(g, { type: "cancel-trade" });
  assert.equal(g.longestRoad, "b");
});
test("piece supplies, hidden VP, 10 points only on own turn and finished-game lock", () => {
  let g = ready();
  g.players[0].development = Array.from({ length: 8 }, () => ({
    type: "victory",
    boughtTurn: 1,
  }));
  assert.equal(score(g, "a"), 10);
  assert.equal(viewFor(g, "b").players[0].score, 2);
  assert.equal(viewFor(g, "a").players[0].score, 10);
  g.currentPlayerIndex = 1;
  g = act(g, { type: "end-turn" }, "b");
  assert.equal(g.winner, null);
  g.stage = "action";
  g = act(g, { type: "end-turn" }, "c");
  assert.equal(g.winner, "a");
  assert.equal(g.stage, "game-over");
  assert.throws(() => act(g, { type: "roll-dice" }));
  assert.equal(viewFor(g, "b").players[0].score, 10);
  g = ready();
  stock(g, "a", 3);
  g.roads = EDGES.slice(0, 15).map((e) => ({ edgeId: e.id, playerId: "a" }));
  assert.deepEqual(legalMoves(g, "a").roads, []);
});
test("fuzz malformed actions preserve original state and conservation", () => {
  const g = ready(),
    snapshot = JSON.stringify(g);
  for (const action of [
    null,
    {},
    [],
    { type: "build-road", edgeId: null },
    { type: "build-city", vertexId: [] },
    { type: "offer-trade", give: [] },
    { type: "bank-trade", give: { wood: Infinity }, want: { brick: 1 } },
    { type: "play-development", card: "victory" },
    { type: "move-robber", tileId: -1 },
  ])
    assert.throws(() => act(g, action));
  assert.equal(JSON.stringify(g), snapshot);
  conserve(g);
});

// A deterministic full match catches phase deadlocks and conservation errors
// across combinations of production, discards, development cards and building.
test("seeded complete match reaches a legal winner without violating resource conservation", () => {
  let seed = 987654321;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let g = createGame(players, rng);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  function step(id, action) {
    g = applyAction(g, id, action, rng);
    conserve(g);
    for (const p of g.players)
      for (const r of RESOURCES) assert.ok(p.resources[r] >= 0);
  }
  for (let steps = 0; steps < 12000 && !g.winner; steps++) {
    const p = g.players[g.currentPlayerIndex],
      id = p.id,
      m = legalMoves(g, id);
    if (g.stage === "setup-settlement") {
      step(id, { type: "build-settlement", vertexId: pick(m.settlements) });
      continue;
    }
    if (g.stage === "setup-road" || g.stage === "road-building") {
      step(id, { type: "build-road", edgeId: pick(m.roads) });
      continue;
    }
    if (g.stage === "discard") {
      const [who, count] = Object.entries(g.pendingDiscards)[0],
        hand = g.players.find((p) => p.id === who).resources,
        cards = emptyHand();
      for (let i = 0; i < count; i++)
        cards[pick(RESOURCES.filter((r) => hand[r] > cards[r]))]++;
      step(who, { type: "discard", cards });
      continue;
    }
    if (g.stage === "robber") {
      const tiles = g.tiles.filter(
        (t) =>
          t.id !== g.robber &&
          !g.buildings.some(
            (b) => b.playerId === id && t.vertices.includes(b.vertexId),
          ),
      );
      step(id, {
        type: "move-robber",
        tileId: pick(
          tiles.length ? tiles : g.tiles.filter((t) => t.id !== g.robber),
        ).id,
      });
      continue;
    }
    if (g.stage === "steal") {
      step(id, { type: "steal", victimId: pick(g.victims) });
      continue;
    }
    const dev = p.development.find(
      (c) => c.type !== "victory" && c.boughtTurn < g.turnNumber,
    );
    if (!g.playedDevelopment && dev) {
      if (dev.type === "knight") {
        step(id, { type: "play-development", card: "knight" });
        continue;
      }
      if (dev.type === "road-building" && m.roads.length) {
        step(id, { type: "play-development", card: "road-building" });
        continue;
      }
      if (dev.type === "monopoly") {
        step(id, {
          type: "play-development",
          card: "monopoly",
          resource: pick(RESOURCES),
        });
        continue;
      }
      if (dev.type === "plenty") {
        const cards = emptyHand();
        for (let i = 0; i < Math.min(2, total(g.bank)); i++)
          cards[pick(RESOURCES.filter((r) => g.bank[r] > cards[r]))]++;
        step(id, { type: "play-development", card: "plenty", cards });
        continue;
      }
    }
    if (g.stage === "pre-roll") {
      step(id, { type: "roll-dice" });
      continue;
    }
    if (m.cities.length) {
      step(id, { type: "build-city", vertexId: pick(m.cities) });
      continue;
    }
    if (m.settlements.length) {
      step(id, { type: "build-settlement", vertexId: pick(m.settlements) });
      continue;
    }
    if (
      g.deck.length &&
      p.resources.stone &&
      p.resources.sheep &&
      p.resources.wheat
    ) {
      step(id, { type: "buy-development" });
      continue;
    }
    if (m.roads.length) {
      step(id, { type: "build-road", edgeId: pick(m.roads) });
      continue;
    }
    let traded = false;
    for (const cost of [
      { stone: 3, wheat: 2 },
      { wood: 1, brick: 1, sheep: 1, wheat: 1 },
      { stone: 1, sheep: 1, wheat: 1 },
    ]) {
      const want = RESOURCES.find(
        (r) => (cost[r] || 0) > p.resources[r] && g.bank[r] > 0,
      );
      const give = RESOURCES.find(
        (r) =>
          r !== want && p.resources[r] - (cost[r] || 0) >= tradeRatio(g, id, r),
      );
      if (want && give) {
        step(id, {
          type: "bank-trade",
          give: { [give]: tradeRatio(g, id, give) },
          want: { [want]: 1 },
        });
        traded = true;
        break;
      }
    }
    if (!traded) step(id, { type: "end-turn" });
  }
  assert.ok(g.winner, `match should finish; turn ${g.turnNumber}`);
  assert.equal(g.winner, g.players[g.currentPlayerIndex].id);
  assert.ok(score(g, g.winner) >= 10);
});
