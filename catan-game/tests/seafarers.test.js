import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyAction,
  legalMoves,
  boardFor,
  score,
  longestPath,
  roadLocations,
  RESOURCES,
  MATERIALS,
  viewFor,
} from "../shared/engine.js";
import { shipLocations, movableShips } from "../shared/seafarers.js";
const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const fresh = (mode = "base") =>
  createGame(players, Math.random, {
    mode,
    seafarers: true,
    friendlyRobber: true,
  });
const act = (g, a, id = "a", rng = () => 0.2) => applyAction(g, id, a, rng);
function stock(g) {
  for (const r of RESOURCES) {
    g.bank[r] += g.players[0].resources[r] - 5;
    g.players[0].resources[r] = 5;
  }
  return g;
}
function ready(mode = "base") {
  let g = fresh(mode);
  while (g.stage.startsWith("setup")) {
    const id = g.players[g.currentPlayerIndex].id,
      m = legalMoves(g, id);
    g = act(
      g,
      g.stage === "setup-settlement"
        ? { type: "build-settlement", vertexId: m.settlements[0] }
        : { type: "build-road", edgeId: m.roads[0] },
      id,
    );
  }
  g.stage = "action";
  g.hasRolled = true;
  g.turnNumber = 2;
  return stock(g);
}
const edge = (g, id) => boardFor(g).edges.find((e) => e.id === id);
function seaBase(mode = "base") {
  const g = ready(mode),
    coast = boardFor(g).edges.find(
      (e) =>
        e.tiles.some((i) => g.tiles[i].resource === "sea") &&
        e.tiles.some((i) => g.tiles[i].island === 0),
    );
  g.roads = [];
  g.buildings = [
    {
      vertexId: coast.vertices[0],
      playerId: "a",
      color: "blue",
      type: "settlement",
    },
  ];
  return { g, coast };
}
function conserve(g) {
  for (const r of MATERIALS)
    assert.equal(
      g.bank[r] + g.players.reduce((n, p) => n + p.resources[r], 0),
      ["coin", "cloth", "paper"].includes(r)
        ? g.mode === "cities-knights"
          ? 12
          : 0
        : 19,
    );
}
test("Seafarers rooms own their geometry; standard boards remain 19 tiles and 54 vertices", () => {
  const g = fresh();
  assert.equal(g.tiles.length, 61);
  assert.equal(g.tiles.filter((t) => t.resource === "gold").length, 2);
  assert.equal(g.tiles.filter((t) => t.island === 0).length, 19);
  assert.equal(g.targetScore, 14);
  assert.equal(fresh("cities-knights").targetScore, 17);
  assert.equal(createGame(players).tiles.length, 19);
  assert.equal(boardFor(createGame(players)).vertices.length, 54);
  for (const e of boardFor(g).edges)
    assert.ok(
      e.vertices.every((v) => boardFor(g).vertices.some((x) => x.id === v)),
    );
  assert.equal(g.geometry.ports.length, 9);
});
test("setup permits only main-island settlements and lets a ship replace the adjacent road", () => {
  let g = fresh(),
    v = legalMoves(g, "a").settlements.find((v) =>
      boardFor(g)
        .vertices.find((x) => x.id === v)
        .tiles.some((i) => g.tiles[i].resource === "sea"),
    );
  assert.ok(v);
  assert.ok(
    legalMoves(g, "a").settlements.every((v) =>
      boardFor(g)
        .vertices.find((x) => x.id === v)
        .tiles.some((i) => g.tiles[i].island === 0),
    ),
  );
  g = act(g, { type: "build-settlement", vertexId: v });
  g = act(g, { type: "build-ship", edgeId: shipLocations(g, "a", v)[0] });
  assert.equal(g.roads[0].type, "ship");
  assert.equal(g.currentPlayerIndex, 1);
  assert.equal(g.players[0].resources.wood, 0);
});
test("ship costs, coastal occupancy and land-only roads; road and ship need a settlement to join", () => {
  let { g, coast } = seaBase();
  const before = g.players[0].resources.wood;
  g = act(g, { type: "build-ship", edgeId: coast.id });
  assert.equal(g.players[0].resources.wood, before - 1);
  assert.ok(!roadLocations(g, "a").includes(coast.id));
  const tip = coast.vertices[1],
    candidate = boardFor(g).edges.find(
      (e) =>
        e.vertices.includes(tip) &&
        e.id !== coast.id &&
        e.tiles.some((i) => g.tiles[i].resource !== "sea"),
    );
  if (candidate) assert.ok(!roadLocations(g, "a").includes(candidate.id));
  const inland = boardFor(g).edges.find(
    (e) =>
      e.tiles.length === 2 &&
      e.tiles.every((i) => g.tiles[i].resource !== "sea"),
  );
  assert.throws(() => act(g, { type: "build-ship", edgeId: inland.id }));
  conserve(g);
});
test("ship movement only permits an old open endpoint once per turn; pirate locks adjacent ships", () => {
  let { g, coast } = seaBase();
  g = act(g, { type: "build-ship", edgeId: coast.id });
  assert.equal(movableShips(g, "a").length, 0);
  g.turnNumber++;
  assert.ok(movableShips(g, "a").includes(coast.id));
  const without = structuredClone(g);
  without.roads = [];
  const dest = shipLocations(without, "a").find((id) => id !== coast.id);
  assert.ok(dest);
  g = act(g, { type: "move-ship", edgeId: coast.id, destination: dest });
  assert.equal(g.roads[0].edgeId, dest);
  assert.equal(movableShips(g, "a").length, 0);
  g.turnNumber++;
  g.pirate = edge(g, dest).tiles.find((i) => g.tiles[i].resource === "sea");
  assert.equal(movableShips(g, "a").length, 0);
  conserve(g);
});
test("gold choice is private to its owner, selects basic resources and respects finite bank", () => {
  for (const mode of ["base", "cities-knights"]) {
    let g = ready(mode),
      t = g.tiles.find((t) => t.resource === "gold");
    g.buildings = [
      { vertexId: t.vertices[0], playerId: "a", color: "blue", type: "city" },
    ];
    g.players[0].improvements && (g.players[0].improvements.science = 3);
    g.stage = "pre-roll";
    g.hasRolled = false;
    const values = [0, (t.number - 2) / 6 + 0.001, 0.2];
    g = act(g, { type: "roll-dice" }, "a", () => values.shift());
    assert.equal(g.stage, "gold-choice");
    assert.equal(g.goldClaims[0].required, 2);
    assert.equal(
      g.choices?.length || 0,
      0,
      "gold production prevents Aqueduct",
    );
    assert.throws(() =>
      act(g, { type: "choose-gold", cards: { wood: 2 } }, "b"),
    );
    assert.throws(() => act(g, { type: "choose-gold", cards: { paper: 2 } }));
    g = act(g, { type: "choose-gold", cards: { wood: 1, sheep: 1 } });
    assert.equal(g.stage, "action");
    conserve(g);
    assert.ok(viewFor(g, "a").geometry);
  }
});
test("island settlement awards two VP once per island in addition to its building", () => {
  let g = ready(),
    t = g.tiles.find((t) => t.island === 1),
    v = t.vertices[0],
    e = boardFor(g).edges.find(
      (e) =>
        e.vertices.includes(v) &&
        e.tiles.some((i) => g.tiles[i].resource === "sea"),
    );
  g.buildings = [];
  g.roads = [
    { edgeId: e.id, playerId: "a", color: "blue", type: "ship", builtTurn: 1 },
  ];
  g = act(g, { type: "build-settlement", vertexId: v });
  assert.equal(score(g, "a"), 3);
  assert.deepEqual(g.players[0].discoveredIslands, [1]);
  conserve(g);
});
test("seven/knight permits pirate instead of robber, steals from adjacent ships, robber never moves to sea", () => {
  let { g, coast } = seaBase();
  const sea = coast.tiles.find((i) => g.tiles[i].resource === "sea");
  g.roads = [
    {
      edgeId: coast.id,
      playerId: "b",
      color: "red",
      type: "ship",
      builtTurn: 1,
    },
  ];
  g.stage = "robber";
  g.returnStage = "action";
  for (const r of MATERIALS) {
    g.bank[r] += g.players[1].resources[r];
    g.players[1].resources[r] = 0;
  }
  g.players[1].resources.wood++;
  g.bank.wood--;
  assert.throws(() => act(g, { type: "move-robber", tileId: sea }));
  g = act(g, { type: "move-pirate", tileId: sea });
  assert.equal(g.pirate, sea);
  assert.equal(g.stage, "action");
  assert.equal(g.players[1].resources.wood, 0);
  assert.ok(!shipLocations(g, "a").includes(coast.id));
  conserve(g);
});
test("friendly robber protects a two-point opponent and stops protecting at three points", () => {
  let g = ready();
  g.buildings = g.buildings.filter((b) => b.playerId === "b");
  const b = g.buildings[0],
    t = g.tiles.find(
      (t) =>
        t.id !== g.robber &&
        t.resource !== "sea" &&
        t.vertices.includes(b.vertexId),
    );
  g.stage = "robber";
  g.returnStage = "action";
  assert.equal(score(g, "b", false), 2);
  assert.throws(() => act(g, { type: "move-robber", tileId: t.id }));
  b.type = "city";
  g = act(g, { type: "move-robber", tileId: t.id });
  assert.equal(g.robber, t.id);
});
test("Longest Trade Route counts ships but cannot change between road and ship without a building", () => {
  const { g, coast } = seaBase(),
    tip = coast.vertices[1],
    next = boardFor(g).edges.find(
      (e) => e.id !== coast.id && e.vertices.includes(tip),
    );
  g.roads = [
    { edgeId: coast.id, playerId: "a", type: "ship" },
    { edgeId: next.id, playerId: "a" },
  ];
  assert.equal(longestPath(g, "a"), 1);
  g.buildings.push({ vertexId: tip, playerId: "a", type: "settlement" });
  assert.equal(longestPath(g, "a"), 2);
});

test("combined C&K: Road Building creates ships, Diplomat retains their type, active knight chases pirate", () => {
  let { g, coast } = seaBase("cities-knights");
  g.players[0].progress = ["road-building", "diplomat"];
  g = act(g, { type: "play-progress", card: "road-building" });
  g = act(g, { type: "build-ship", edgeId: coast.id });
  g = act(g, { type: "build-ship", edgeId: shipLocations(g, "a")[0] });
  assert.equal(g.stage, "action");
  assert.equal(g.roads.length, 2);
  const endpoint = g.roads.find((r) =>
    movableShips({ ...g, turnNumber: g.turnNumber + 1 }, "a").includes(
      r.edgeId,
    ),
  );
  assert.ok(endpoint);
  g = act(g, {
    type: "play-progress",
    card: "diplomat",
    edgeId: endpoint.edgeId,
  });
  const dest = g.choices[0].options.find((o) => o.id !== "skip").id;
  g = act(g, { type: "expansion-choice", choice: dest });
  assert.equal(g.roads.find((r) => r.edgeId === dest).type, "ship");
  const v = coast.vertices[0];
  g.knightPieces = [
    {
      playerId: "a",
      vertexId: v,
      color: "blue",
      level: 1,
      active: true,
      activatedTurn: 0,
      actedTurn: -1,
      promotedTurn: -1,
    },
  ];
  g.barbarianAttacks = 1;
  g.pirate = coast.tiles.find((i) => g.tiles[i].resource === "sea");
  assert.equal(viewFor(g, "a").expansionLegal.knights[0].pirate, true);
  g = act(g, { type: "chase-pirate", vertexId: v });
  assert.equal(g.stage, "robber");
  assert.equal(g.knightPieces[0].active, false);
  assert.throws(() =>
    act(g, {
      type: "move-robber",
      tileId: g.tiles.find((t) => t.resource === "gold").id,
    }),
  );
  g = act(g, {
    type: "move-pirate",
    tileId: g.tiles.find((t) => t.resource === "sea" && t.id !== g.pirate).id,
  });
  assert.equal(g.stage, "action");
  conserve(g);
});
