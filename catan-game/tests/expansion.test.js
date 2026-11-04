import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyAction,
  legalMoves,
  viewFor,
  VERTICES,
  EDGES,
  MATERIALS,
  COMMODITIES,
  total,
  score,
  tradeRatio,
  longestPath,
} from "../shared/engine.js";
import { PROGRESS, connectedSites, knightSites } from "../shared/expansion.js";
const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const fresh = () =>
  createGame(players, Math.random, { mode: "cities-knights" });
const act = (g, a, id = "a", rng = () => 0.2) => applyAction(g, id, a, rng);
function setup(g = fresh()) {
  while (g.stage.startsWith("setup")) {
    const id = g.players[g.currentPlayerIndex].id,
      legal = legalMoves(g, id);
    g = act(
      g,
      g.stage === "setup-settlement"
        ? { type: "build-settlement", vertexId: legal.settlements[0] }
        : { type: "build-road", edgeId: legal.roads[0] },
      id,
    );
  }
  return g;
}
function ready() {
  const g = setup();
  g.stage = "action";
  g.hasRolled = true;
  return g;
}
function stock(g, id, items) {
  const p = g.players.find((p) => p.id === id);
  for (const [r, n] of Object.entries(items)) {
    g.bank[r] += p.resources[r] - n;
    p.resources[r] = n;
  }
  return g;
}
function card(g, type) {
  const p = g.players[0],
    t = PROGRESS[type][0],
    i = g.progressDecks[t].indexOf(type);
  if (i >= 0) g.progressDecks[t].splice(i, 1);
  p.progress.push(type);
  return g;
}
const play = (g, type, args = {}) =>
  act(card(g, type), { type: "play-progress", card: type, ...args });
function conservation(g) {
  for (const r of MATERIALS)
    assert.equal(
      g.bank[r] + g.players.reduce((n, p) => n + p.resources[r], 0),
      COMMODITIES.includes(r) ? 12 : 19,
      r,
    );
}
function k(g, playerId, vertexId, level = 1, active = false) {
  const piece = {
    playerId,
    vertexId,
    color: g.players.find((p) => p.id === playerId).color,
    level,
    active,
    activatedTurn: 0,
    actedTurn: -1,
    promotedTurn: -1,
  };
  g.knightPieces.push(piece);
  return piece;
}
const city = (g, id = "a") =>
  g.buildings.find((b) => b.playerId === id && b.type === "city");
const settlement = (g, id = "a") =>
  g.buildings.find((b) => b.playerId === id && b.type === "settlement");
function roll(g, red, yellow, event = 0.2) {
  g.stage = "pre-roll";
  g.hasRolled = false;
  const values = [(red - 1) / 6 + 0.001, (yellow - 1) / 6 + 0.001, event];
  return act(g, { type: "roll-dice" }, "a", () => values.shift());
}
function choice(g, value, id = g.choices[0].playerId, cards) {
  return act(g, { type: "expansion-choice", choice: value, cards }, id);
}

test("mode is explicit, base stays default; C&K has three 18-card decks and 12 of each commodity", () => {
  const g = fresh();
  assert.equal(createGame(players).mode, "base");
  assert.equal(g.targetScore, 13);
  assert.equal(g.deck.length, 0);
  assert.deepEqual(
    Object.values(g.progressDecks).map((d) => d.length),
    [18, 18, 18],
  );
  assert.equal(Object.keys(PROGRESS).length, 25);
  conservation(g);
  assert.throws(() => createGame(players, Math.random, { mode: "fake" }));
});
test("snake setup places one settlement and one city, grants resources rather than commodities", () => {
  const g = setup();
  for (const p of g.players) {
    assert.equal(
      g.buildings.filter((b) => b.playerId === p.id && b.type === "city")
        .length,
      1,
    );
    assert.equal(score(g, p.id), 3);
    assert.ok(COMMODITIES.every((r) => p.resources[r] === 0));
    assert.ok(total(p.resources) <= 3);
  }
  conservation(g);
});
test("city production splits forest/pasture/mountains into resource and commodity, fields and hills double", () => {
  for (const [resource, commodity] of [
    ["wood", "paper"],
    ["sheep", "cloth"],
    ["stone", "coin"],
    ["brick", null],
    ["wheat", null],
  ]) {
    const g = fresh(),
      t = g.tiles.find((t) => t.resource === resource);
    g.buildings = [
      { vertexId: t.vertices[0], playerId: "a", color: "blue", type: "city" },
    ];
    g.robber = g.tiles.find((t) => t.resource === "desert").id;
    const n = roll(
      g,
      ...(t.number <= 7 ? [1, t.number - 1] : [6, t.number - 6]),
      0.2,
    );
    assert.equal(n.players[0].resources[resource], commodity ? 1 : 2);
    if (commodity) assert.equal(n.players[0].resources[commodity], 1);
    conservation(n);
  }
});
test("commodity shortages are independent of resources and robber blocks both", () => {
  const g = fresh(),
    t = g.tiles.find((t) => t.resource === "wood");
  g.buildings = [
    { vertexId: t.vertices[0], playerId: "a", type: "city" },
    { vertexId: t.vertices[2], playerId: "b", type: "city" },
  ];
  stock(g, "c", { paper: 11 });
  const dice = t.number <= 7 ? [1, t.number - 1] : [6, t.number - 6];
  let n = roll(g, ...dice);
  assert.equal(n.players[0].resources.wood, 1);
  assert.equal(n.players[0].resources.paper, 0);
  conservation(n);
  g.robber = t.id;
  n = roll(g, ...dice);
  assert.equal(n.players[0].resources.wood, 0);
  assert.equal(n.players[0].resources.paper, 0);
});
test("seven before first invasion discards commodities but leaves robber in desert, walls raise threshold", () => {
  let g = ready();
  stock(g, "a", Object.fromEntries(MATERIALS.map((r) => [r, 0])));
  stock(g, "a", { paper: 6, wood: 2, wheat: 1 });
  g = act(stock(g, "a", { brick: 2 }), {
    type: "build-wall",
    vertexId: city(g).vertexId,
  });
  assert.ok(city(g).wall);
  let n = roll(g, 1, 6);
  assert.equal(n.stage, "action");
  assert.equal(n.robber, g.robber);
  stock(g, "a", { paper: 7 });
  n = roll(g, 1, 6);
  assert.equal(n.pendingDiscards.a, 5);
  n = act(n, { type: "discard", cards: { paper: 5 } });
  assert.equal(n.stage, "action");
  conservation(n);
  assert.throws(() =>
    act(g, { type: "build-wall", vertexId: city(g).vertexId }),
  );
});
test("knight placement, activation, promotion limits and action timing are enforced atomically", () => {
  let g = ready();
  stock(g, "a", { sheep: 5, stone: 5, wheat: 3 });
  const v = knightSites(g, "a")[0];
  assert.ok(v);
  g = act(g, { type: "hire-knight", vertexId: v });
  assert.equal(g.knightPieces[0].active, false);
  g = act(g, { type: "activate-knight", vertexId: v });
  g = act(g, { type: "promote-knight", vertexId: v });
  assert.equal(g.knightPieces[0].level, 2);
  assert.throws(() => act(g, { type: "promote-knight", vertexId: v }));
  assert.throws(() =>
    act(g, {
      type: "move-knight",
      vertexId: v,
      destination: connectedSites(g, "a", v)[0],
    }),
  );
  g.turnNumber++;
  assert.throws(() => act(g, { type: "promote-knight", vertexId: v }));
  g.players[0].improvements.politics = 3;
  g = act(g, { type: "promote-knight", vertexId: v });
  assert.equal(g.knightPieces[0].level, 3);
  conservation(g);
});
test("knights block enemy road extension and longest road, distance rule ignores neighboring knights", () => {
  const g = ready();
  g.buildings = [];
  g.roads = [];
  const v = VERTICES.find((v) => v.edges.length === 3);
  const edges = v.edges.slice(0, 2);
  g.roads = edges.map((edgeId) => ({ edgeId, playerId: "b", color: "red" }));
  assert.equal(longestPath(g, "b"), 2);
  k(g, "a", v.id);
  assert.equal(longestPath(g, "b"), 1);
  assert.equal(legalMoves(g, "b").roads.length, 0);
});
test("active knights move along own roads and deactivate; displacement lets victim choose a legal retreat", () => {
  let g = ready();
  g.buildings = [];
  g.roads = [];
  const v = VERTICES.find((v) => v.edges.length === 3),
    e1 = EDGES.find((e) => e.id === v.edges[0]),
    e2 = EDGES.find((e) => e.id === v.edges[1]);
  const start = e1.vertices.find((x) => x !== v.id),
    retreat = e2.vertices.find((x) => x !== v.id);
  g.roads = [
    { edgeId: e1.id, playerId: "a", color: "blue" },
    { edgeId: e2.id, playerId: "b", color: "red" },
  ];
  k(g, "a", start, 2, true);
  k(g, "b", v.id, 1, true);
  g = act(g, { type: "move-knight", vertexId: start, destination: v.id });
  assert.equal(g.stage, "expansion-choice");
  assert.equal(g.choices[0].playerId, "b");
  assert.throws(() => choice(g, retreat, "a"));
  g = choice(g, retreat);
  assert.equal(
    g.knightPieces.find((k) => k.playerId === "b").vertexId,
    retreat,
  );
  assert.equal(g.knightPieces.find((k) => k.playerId === "a").active, false);
  assert.equal(g.stage, "action");
});
test("successful barbarian defense awards unique strongest defender, deactivates army and resets seven-space track", () => {
  const g = ready();
  g.barbarianPosition = 6;
  k(g, "a", knightSites(g, "a")[0], 3, true);
  const n = roll(g, 1, 1);
  assert.equal(n.barbarianAttacks, 1);
  assert.equal(n.barbarianPosition, 0);
  assert.equal(n.players[0].defenderVP, 1);
  assert.equal(n.knightPieces[0].active, false);
  assert.equal(n.largestArmy, null);
  conservation(n);
});
test("failed defense asks all weakest eligible players which city to lose; walls removed before production", () => {
  let g = ready();
  g.barbarianPosition = 6;
  city(g).wall = true;
  g = roll(g, 1, 1);
  assert.equal(g.stage, "expansion-choice");
  assert.equal(g.choices.length, 3);
  while (g.choices.length) g = choice(g, g.choices[0].options[0].id);
  assert.equal(g.buildings.filter((b) => b.type === "city").length, 0);
  assert.equal(g.buildings.filter((b) => b.wall).length, 0);
  assert.equal(g.stage, "action");
  conservation(g);
});
test("tied defenders choose progress deck and metropolises are immune to pillaging but count in invasion strength", () => {
  let g = ready();
  g.barbarianPosition = 6;
  k(g, "a", knightSites(g, "a")[0], 2, true);
  k(g, "b", knightSites(g, "b")[0], 2, true);
  g = roll(g, 1, 1);
  assert.equal(g.choices.length, 2);
  g = choice(g, "trade");
  g = choice(g, "science");
  assert.equal(g.players[0].defenderVP, 0);
  assert.equal(g.stage, "action");
  g = ready();
  city(g).metropolis = "trade";
  g.barbarianPosition = 6;
  g = roll(g, 1, 1);
  assert.equal(g.lastBattle.attack, 3);
  assert.equal(g.choices.length, 2);
  assert.ok(g.choices.every((c) => c.playerId !== "a"));
});
test("city improvements, commodity costs, metropolis ownership and level-five theft", () => {
  let g = ready();
  stock(g, "a", { paper: 12 });
  for (let i = 0; i < 4; i++)
    g = act(g, {
      type: "improve-city",
      track: "science",
      vertexId: city(g).vertexId,
    });
  assert.equal(g.players[0].resources.paper, 2);
  assert.equal(city(g).metropolis, "science");
  assert.equal(score(g, "a"), 5);
  conservation(g);
  g.currentPlayerIndex = 1;
  g.players[1].improvements.science = 4;
  stock(g, "a", { paper: 0 });
  stock(g, "b", { paper: 5 });
  g = act(
    g,
    { type: "improve-city", track: "science", vertexId: city(g, "b").vertexId },
    "b",
  );
  assert.equal(city(g).metropolis, undefined);
  assert.equal(city(g, "b").metropolis, "science");
  assert.throws(() =>
    act(
      g,
      {
        type: "improve-city",
        track: "science",
        vertexId: city(g, "b").vertexId,
      },
      "b",
    ),
  );
});
test("aqueduct is a chosen resource for no production, never on a seven; trading house gives commodity 2:1", () => {
  let g = ready();
  g.players[0].improvements.science = 3;
  g.buildings = g.buildings.filter((b) => b.playerId !== "a");
  g = roll(g, 1, 1);
  assert.equal(g.choices[0].kind, "aqueduct");
  const before = g.players[0].resources.wheat;
  g = choice(g, "wheat");
  assert.equal(g.players[0].resources.wheat, before + 1);
  conservation(g);
  g = roll(g, 1, 6);
  assert.equal(g.choices.length, 0);
  g = ready();
  g.players[0].improvements.trade = 3;
  assert.equal(tradeRatio(g, "a", "coin"), 2);
  stock(g, "a", { coin: 2 });
  g = act(g, { type: "bank-trade", give: { coin: 2 }, want: { cloth: 1 } });
  assert.equal(g.players[0].resources.cloth, 1);
  conservation(g);
});
test("event/red die draws in turn order; public VP immediately revealed, off-turn fifth card must be discarded privately", () => {
  let g = ready();
  g.players[1].improvements.science = 1;
  g.players[1].progress = ["mining", "medicine", "smith", "crane"];
  g.progressDecks.science.push("inventor");
  g = roll(g, 1, 1, 0.51);
  assert.equal(g.choices[0].playerId, "b");
  assert.equal(g.choices[0].kind, "discard-progress");
  const other = JSON.parse(JSON.stringify(viewFor(g, "a")));
  assert.equal(other.choice.options, undefined);
  assert.equal(other.progressDecks, undefined);
  assert.equal(other.choices, undefined);
  assert.equal(other.players[1].progress, undefined);
  g = choice(g, "0");
  assert.equal(g.players[1].progress.length, 4);
  g.progressDecks.science.push("printer");
  g = roll(g, 1, 1, 0.51);
  assert.equal(g.players[1].publicVP, 1);
  assert.equal(g.players[1].progress.length, 4);
});
test("alchemist controls numbered dice but rolls event normally; ordinary dice injection is ignored", () => {
  let g = setup();
  g = play(g, "alchemist", { dice: [3, 4] });
  g = act(g, { type: "roll-dice" }, "a", () => 0.99);
  assert.deepEqual(g.dice, [3, 4]);
  assert.equal(g.eventDie, "trade");
  assert.equal(g.stage, "action");
  const n = act(setup(), { type: "roll-dice", dice: [6, 6] }, "a", () => 0);
  assert.deepEqual(n.dice, [1, 1]);
  assert.throws(() => play(ready(), "alchemist", { dice: [3, 4] }));
});
test("science progress: crane, engineer, medicine, mining, irrigation, inventor and smith", () => {
  let g = ready();
  g = play(g, "crane");
  g = act(g, { type: "improve-city", track: "science" });
  assert.equal(g.players[0].improvements.science, 1);
  assert.equal(g.crane, false);
  g = play(g, "engineer", { vertexId: city(g).vertexId });
  assert.ok(city(g).wall);
  stock(g, "a", { wheat: 1, stone: 2 });
  const v = settlement(g).vertexId;
  g = play(g, "medicine", { vertexId: v });
  assert.equal(g.buildings.find((b) => b.vertexId === v).type, "city");
  conservation(g);
  for (const type of ["mining", "irrigation"]) {
    g = ready();
    const tile = g.tiles.find(
      (t) => t.resource === (type === "mining" ? "stone" : "wheat"),
    );
    g.buildings = [
      {
        playerId: "a",
        color: "blue",
        vertexId: tile.vertices[0],
        type: "city",
      },
    ];
    g = play(g, type);
    conservation(g);
  }
  g = ready();
  const ts = g.tiles
      .filter((t) => [3, 4, 5, 9, 10, 11].includes(t.number))
      .slice(0, 2),
    nums = ts.map((t) => t.number);
  g = play(g, "inventor", { tiles: ts.map((t) => t.id) });
  assert.deepEqual(
    ts.map((t) => g.tiles[t.id].number),
    nums.reverse(),
  );
  g = ready();
  const pos = knightSites(g, "a")[0];
  k(g, "a", pos);
  g = play(g, "smith", { knights: [pos] });
  assert.equal(g.knightPieces[0].level, 2);
});
test("merchant, merchant fleet and monopolies use the correct material types and quantities", () => {
  let g = ready();
  const t = g.tiles.find(
    (t) =>
      t.resource !== "desert" &&
      g.buildings.some(
        (b) => b.playerId === "a" && t.vertices.includes(b.vertexId),
      ),
  );
  g = play(g, "merchant", { tileId: t.id });
  assert.equal(tradeRatio(g, "a", t.resource), 2);
  assert.equal(score(g, "a"), 4);
  g = play(g, "merchant-fleet", { resource: "coin" });
  assert.equal(tradeRatio(g, "a", "coin"), 2);
  g = act(g, { type: "end-turn" });
  assert.equal(tradeRatio(g, "a", "coin"), 4);
  g = ready();
  stock(g, "b", { wood: 4 });
  stock(g, "c", { wood: 1 });
  const initial = g.players[0].resources.wood;
  g = play(g, "resource-monopoly", { resource: "wood" });
  assert.equal(g.players[0].resources.wood, initial + 3);
  assert.equal(g.players[1].resources.wood, 2);
  conservation(g);
  stock(g, "b", { coin: 2 });
  g = play(g, "trade-monopoly", { resource: "coin" });
  assert.equal(g.players[0].resources.coin, 1);
  assert.equal(g.players[1].resources.coin, 1);
  conservation(g);
});
test("bishop waits for first invasion; warlord activates knights and road-building grants two free roads", () => {
  let g = ready();
  assert.throws(() => play(g, "bishop", { tileId: (g.robber + 1) % 19 }));
  g.barbarianAttacks = 1;
  g = play(g, "bishop", { tileId: (g.robber + 1) % 19 });
  conservation(g);
  const v = knightSites(g, "a")[0];
  k(g, "a", v);
  g = play(g, "warlord");
  assert.equal(g.knightPieces[0].active, true);
  assert.equal(viewFor(g, "a").expansionLegal.knights[0].act, false);
  g = play(g, "road-building");
  assert.equal(g.stage, "road-building");
  g = act(g, { type: "build-road", edgeId: legalMoves(g, "a").roads[0] });
  assert.equal(g.freeRoads, 1);
});
test("spy and master merchant reveal only to actor and transfer exactly selected cards", () => {
  let g = ready();
  g.players[1].progress = ["mining", "smith"];
  g = play(g, "spy", { playerId: "b" });
  assert.equal(viewFor(g, "b").choice.options, undefined);
  g = choice(g, "1");
  assert.equal(g.players[0].progress.at(-1), "smith");
  assert.deepEqual(g.players[1].progress, ["mining"]);
  g.players[1].publicVP = 2;
  stock(g, "b", { coin: 2 });
  g = play(g, "master-merchant", { playerId: "b" });
  assert.equal(viewFor(g, "c").choice.max, undefined);
  assert.equal(viewFor(g, "a").choice.max.coin, 2);
  g = choice(g, undefined, "a", { coin: 2 });
  assert.equal(g.players[0].resources.coin, 2);
  conservation(g);
});
test("wedding, saboteur and commercial harbor preserve recipient choices and conservation", () => {
  let g = ready();
  g.players[1].publicVP = 1;
  stock(g, "b", { paper: 2 });
  g = play(g, "wedding");
  g = choice(g, undefined, "b", { paper: 2 });
  assert.equal(g.players[0].resources.paper, 2);
  conservation(g);
  g = ready();
  stock(g, "b", { wood: 4 });
  g = play(g, "saboteur");
  while (g.choices.length) {
    const c = g.choices[0],
      p = g.players.find((p) => p.id === c.playerId),
      cards = {};
    let n = c.required;
    for (const r of MATERIALS) {
      cards[r] = Math.min(n, p.resources[r]);
      n -= cards[r];
    }
    g = choice(g, undefined, c.playerId, cards);
  }
  conservation(g);
  g = ready();
  stock(g, "a", { wood: 1 });
  stock(g, "b", { coin: 1 });
  g = play(g, "commercial-harbor");
  g = act(g, { type: "harbor-trade", playerId: "b", resource: "wood" });
  assert.equal(g.choices[0].kind, "harbor-give");
  g = choice(g, undefined, "b", { coin: 1 });
  assert.equal(g.players[0].resources.coin, 1);
  assert.throws(() =>
    act(g, { type: "harbor-trade", playerId: "b", resource: "wood" }),
  );
  conservation(g);
});
test("deserter gives victim the removal choice and actor a replacement; diplomat removes open road", () => {
  let g = ready();
  const v = knightSites(g, "b")[0];
  k(g, "b", v, 2, true);
  g = play(g, "deserter", { playerId: "b" });
  g = choice(g, v);
  assert.equal(g.choices[0].kind, "desert-place");
  const dest = g.choices[0].options.find((o) => o.id !== "skip").id;
  g = choice(g, dest);
  assert.equal(g.knightPieces[0].level, 2);
  assert.equal(g.knightPieces[0].active, true);
  assert.equal(
    viewFor(g, "a").expansionLegal.knights[0].act,
    true,
    "active deserter may act immediately",
  );
  g = ready();
  const r = g.roads[0],
    before = g.roads.length;
  g = play(g, "diplomat", { edgeId: r.edgeId });
  assert.equal(g.roads.length, before - 1);
  assert.equal(g.choices[0].kind, "diplomat-road");
  g = choice(g, "skip");
  assert.equal(g.stage, "action");
});
test("13 points only on own turn; excess progress prevents end turn; expansion actions rejected in base mode", () => {
  let g = ready();
  g.players[0].publicVP = 7;
  g.players[0].defenderVP = 2;
  assert.equal(score(g, "a"), 12);
  g = act(g, { type: "end-turn" });
  assert.equal(g.winner, null);
  g.players[0].publicVP++;
  g.currentPlayerIndex = 0;
  g.stage = "action";
  g = act(g, { type: "cancel-trade" });
  assert.equal(g.winner, "a");
  assert.equal(g.stage, "game-over");
  g = ready();
  g.players[0].progress = Array(5).fill("mining");
  assert.throws(() => act(g, { type: "end-turn" }));
  g = act(g, { type: "discard-progress", index: 0 });
  g = act(g, { type: "end-turn" });
  assert.equal(g.currentPlayerIndex, 1);
  assert.throws(() =>
    act(createGame(players), { type: "hire-knight", vertexId: VERTICES[0].id }),
  );
});
test("legacy base saves acquire zero commodities without corrupting resources", () => {
  const g = createGame(players);
  for (const r of COMMODITIES) {
    delete g.bank[r];
    for (const p of g.players) delete p.resources[r];
  }
  const v = legalMoves(g, "a").settlements[0],
    n = act(g, { type: "build-settlement", vertexId: v });
  assert.ok(
    MATERIALS.every(
      (r) =>
        Number.isFinite(n.bank[r]) &&
        n.players.every((p) => Number.isFinite(p.resources[r])),
    ),
  );
});

test("Diplomat retains Longest Road through a relocation when equal-length opponent exists", () => {
  function route(avoid = new Set()) {
    function walk(v, path, seen) {
      if (path.length === 5) return path;
      for (const e of EDGES.filter(e => e.vertices.includes(v))) {
        const next = e.vertices.find(x => x !== v);
        if (seen.has(next) || avoid.has(next)) continue;
        const found = walk(next, [...path, e.id], new Set([...seen,next]));
        if (found) return found;
      }
    }
    for (const v of VERTICES.filter(v => !avoid.has(v.id))) {
      const found = walk(v.id, [], new Set([v.id]));
      if (found) return found;
    }
    throw new Error('No route');
  }
  let g = ready(); g.buildings = [];
  const a = route(), b = route(new Set(a.flatMap(id => EDGES.find(e => e.id === id).vertices)));
  g.roads = [...a.map(edgeId => ({edgeId,playerId:'a',color:'blue'})),...b.map(edgeId => ({edgeId,playerId:'b',color:'red'}))];
  g.longestRoad = 'a'; g.roadLengths = [5,5,0];
  g = play(g,'diplomat',{edgeId:a[0]});
  assert.equal(g.longestRoad,'a');
  g = choice(g,a[0]); assert.equal(g.longestRoad,'a'); assert.deepEqual(g.roadLengths,[5,5,0]);
});
test("Intrigue forces owner retreat; active knight chases robber only after first attack", () => {
  let g = ready(); g.buildings = [];
  const e = EDGES[0], from = e.vertices[0], to = e.vertices[1];
  g.roads = [{edgeId:e.id,playerId:'a',color:'blue'}];
  k(g,'b',from,3,true);
  g = play(g,'intrigue',{vertexId:from});
  assert.equal(g.knightPieces.length,0,'knight without own-road retreat leaves board');
  k(g,'a',to,1,true);g.robber=VERTICES.find(v=>v.id===to).tiles[0];
  assert.throws(()=>act(g,{type:'chase-robber',vertexId:to}));
  g.barbarianAttacks=1;g=act(g,{type:'chase-robber',vertexId:to});
  assert.equal(g.stage,'robber');assert.equal(g.knightPieces[0].active,false);
});
test("known ineffective progress cards cannot be used merely to discard them", () => {
  const g=ready();g.knightPieces=[];g.buildings=[];
  for(const type of ['mining','irrigation','warlord','wedding']) assert.throws(()=>play(structuredClone(g),type));
});
