import { applyAction, viewFor, boardFor, COSTS, MATERIALS, RESOURCES, total, canPay } from "./shared/engine.js";

export const BOT_LEVELS = { easy: "קל", medium: "בינוני", hard: "קשה" };
export function botActor(room) {
  const g = room.game;
  if (!g || g.winner) return null;
  const required = Object.keys(g.pendingDiscards).filter(id => g.pendingDiscards[id] > 0);
  if (g.stage === "expansion-choice") required.push(g.choices[0]?.playerId);
  else if (g.stage === "gold-choice") required.push(g.goldClaims[0]?.playerId);
  else if (g.stage !== "discard") required.push(g.players[g.currentPlayerIndex].id);
  const actor = room.players.find(p => p.botDifficulty && required.includes(p.id));
  if (actor) return actor;
  if (g.stage === "action" && g.trade) return room.players.find(p => p.botDifficulty && p.id !== g.trade.from && (g.trade.from === g.players[g.currentPlayerIndex].id || p.id === g.players[g.currentPlayerIndex].id) && !(g.tradeResponses ?? []).some(r => r.playerId === p.id && r.offerId === g.trade.id)) ?? null;
  return null;
}

// Strategy uses the same private view that a human in this seat receives.
// The authoritative engine validates every candidate and the eventual move.
export function chooseBotAction(g, id, difficulty = "medium", rng = Math.random) {
  const v = viewFor(g, id), me = v.me, geometry = boardFor(v);
  const candidates = [];
  const add = (action, value = 0) => {
    const type = action.type.replace("build-", "");
    if (v.stage === "action" && COSTS[type] && !canPay(me.resources, COSTS[type])) return;
    if (action.type === "buy-development" && (v.mode === "cities-knights" || !canPay(me.resources, COSTS.development))) return;
    const costs = { "hire-knight": {sheep:1,stone:1}, "activate-knight": {wheat:1}, "promote-knight": {sheep:1,stone:1}, "build-wall": {brick:2} };
    if (costs[action.type] && !canPay(me.resources, costs[action.type])) return;
    if (action.type === "improve-city") {
      if (v.mode !== "cities-knights") return;
      const commodity = {science:"paper",politics:"coin",trade:"cloth"}[action.track];
      if (me.resources[commodity] < (me.improvements[action.track] + 1 - (v.crane ? 1 : 0))) return;
    }
    candidates.push({ action, value });
  };
  const weight = r => ({ wheat: 1.35, stone: 1.3, wood: 1.2, brick: 1.15, sheep: 1, paper: 1.4, cloth: 1.1, coin: 1.1 }[r] ?? 0);
  const siteValue = vertexId => {
    const vertex = geometry.vertices.find(x => x.id === vertexId);
    return (vertex?.tiles ?? []).reduce((n, tileId) => {
      const tile = v.tiles.find(t => t.id === tileId);
      if (!tile?.number) return n;
      const diversity = difficulty === "hard" && !v.buildings.some(b => b.playerId === id && v.tiles.some(t => t.resource === tile.resource && t.vertices.includes(b.vertexId))) ? 1.5 : 1;
      return n + (6 - Math.abs(7 - tile.number)) * weight(tile.resource) * diversity;
    }, 0);
  };
  const bundle = (count, max, keep = false, resources = MATERIALS) => {
    const cards = {};
    for (let i = 0; i < count; i++) {
      const choices = resources.filter(r => (cards[r] ?? 0) < (max[r] ?? 0));
      choices.sort((a, b) => keep ? weight(b) / (me.resources[b] + (cards[b] ?? 0) + 1) - weight(a) / (me.resources[a] + (cards[a] ?? 0) + 1) : (max[b] - (cards[b] ?? 0)) / weight(b) - (max[a] - (cards[a] ?? 0)) / weight(a));
      if (!choices.length) break;
      cards[choices[0]] = (cards[choices[0]] ?? 0) + 1;
    }
    return cards;
  };
  if (v.stage === "action" && v.trade && v.trade.from !== id && !(v.tradeResponses ?? []).some(r => r.playerId === id && r.offerId === v.trade.id) && (v.trade.from === v.players[v.currentPlayerIndex].id || id === v.players[v.currentPlayerIndex].id)) {
    const value = hand => MATERIALS.reduce((n,r) => n + (hand[r] ?? 0) * weight(r) / (me.resources[r] + 1), 0);
    const canAfford = MATERIALS.every(r => me.resources[r] >= (v.trade.want[r] ?? 0));
    if (canAfford && value(v.trade.give) >= value(v.trade.want) * (difficulty === "easy" ? .6 : 1)) add({type: "accept-trade", offerId: v.trade.id}, 1000);
    add({type: "reject-trade", offerId: v.trade.id}, 900);
  }
  if (g.pendingDiscards[id]) add({ type: "discard", cards: bundle(g.pendingDiscards[id], me.resources) });
  else if (v.choice?.playerId === id) {
    if (v.choice.options) for (const o of v.choice.options) add({ type: "expansion-choice", choice: o.id }, siteValue(o.id));
    else add({ type: "expansion-choice", cards: bundle(v.choice.required, v.choice.max ?? me.resources, v.choice.kind === "master-take", v.choice.kind === "harbor-give" ? ["paper", "cloth", "coin"] : MATERIALS) });
  } else if (v.goldChoice?.playerId === id) add({ type: "choose-gold", cards: bundle(v.goldChoice.required, v.bank, true, RESOURCES) });
  else if (v.players[v.currentPlayerIndex].id !== id) { /* Only the trade response above is available off turn. */ }
  else if (v.stage === "pre-roll") add({ type: "roll-dice" });
  else if (v.stage === "robber") {
    for (const tile of v.tiles) {
      const impact = v.buildings.filter(b => tile.vertices.includes(b.vertexId)).reduce((n, b) => n + (b.playerId === id ? -18 : 6 + (v.players.find(p => p.id === b.playerId)?.score ?? 0)), 0);
      add({ type: tile.resource === "sea" ? "move-pirate" : "move-robber", tileId: tile.id }, impact);
    }
  } else if (v.stage === "steal") for (const victimId of v.victims) add({ type: "steal", victimId, cardIndex: 0 }, v.players.find(p => p.id === victimId)?.score ?? 0);
  else {
    for (const vertexId of v.legal.settlements) add({ type: "build-settlement", vertexId }, 70 + siteValue(vertexId));
    for (const vertexId of v.legal.cities) add({ type: "build-city", vertexId }, 80 + siteValue(vertexId));
    const edgeValue = edgeId => {
      const edge = geometry.edges.find(e => e.id === edgeId);
      return Math.max(...(edge?.vertices ?? []).map(siteValue), 0);
    };
    for (const edgeId of v.legal.roads) add({ type: "build-road", edgeId }, 22 + edgeValue(edgeId));
    for (const edgeId of v.seaLegal?.ships ?? []) add({ type: "build-ship", edgeId }, 22 + edgeValue(edgeId));
    if (v.stage === "action") {
      add({ type: "buy-development" }, 35);
      for (const card of new Set(me.development.filter(c => c.boughtTurn < v.turnNumber).map(c => c.type))) {
        for (const resource of RESOURCES) add({ type: "play-development", card, resource, cards: bundle(Math.min(2, total(v.bank)), v.bank, true, RESOURCES) }, 55);
      }
      for (const vertexId of v.expansionLegal?.hire ?? []) if ((v.knightPieces ?? []).filter(k => k.playerId === id).length < Math.max(1, v.buildings.filter(b => b.playerId === id && b.type === "city").length)) add({ type: "hire-knight", vertexId }, 45 - siteValue(vertexId) / 2);
      for (const k of v.knightPieces ?? []) if (k.playerId === id) {
        add({ type: "activate-knight", vertexId: k.vertexId }, 58);
        add({ type: "promote-knight", vertexId: k.vertexId }, 36);
      }
      for (const b of v.buildings.filter(b => b.playerId === id && b.type === "city")) {
        add({ type: "build-wall", vertexId: b.vertexId }, 12);
        for (const track of ["science", "politics", "trade"]) add({ type: "improve-city", track, vertexId: b.vertexId }, track === "science" ? 64 : 48);
      }
      if ((me.progress?.length ?? 0) > 4) add({type: "discard-progress", index: 0}, -50);
      for (const card of new Set(me.progress ?? [])) {
        add({ type: "play-progress", card }, 52);
        for (const resource of MATERIALS) add({ type: "play-progress", card, resource }, 52);
        for (const b of v.buildings.filter(b => b.playerId === id)) add({ type: "play-progress", card, vertexId: b.vertexId }, 66);
        for (const other of v.players.filter(p => p.id !== id)) add({type: "play-progress", card, playerId: other.id}, 52);
        if (["merchant", "bishop"].includes(card)) for (const tile of v.tiles) add({type: "play-progress", card, tileId: tile.id}, 52);
      }
      // Trade with the bank only toward a concrete building, never cycle resources.
      for (const type of ["city", "settlement", "road", "development", ...(v.seafarers ? ["ship"] : [])]) {
        const cost = COSTS[type];
        const missing = Object.keys(cost).filter(r => me.resources[r] < cost[r]);
        if (!missing.length || missing.length > 2) continue;
        for (const resource of missing) for (const give of MATERIALS) {
          const ratio = me.ratios[give];
          if (give !== resource && me.resources[give] - (cost[give] ?? 0) >= ratio)
            add({ type: "bank-trade", give: { [give]: ratio }, want: { [resource]: 1 } }, type === "city" ? 40 : 28);
        }
      }
      add({ type: "end-turn" }, -100);
    }
  }
  if (difficulty === "easy") for (const c of candidates) c.value = c.action.type === "end-turn" ? -100 : rng() * 100;
  else for (const c of candidates) c.value += rng() * (difficulty === "hard" ? 0.2 : 5);
  candidates.sort((a, b) => b.value - a.value);
  for (const { action } of candidates) {
    try { applyAction(g, id, action, () => 0.5); return action; } catch { /* Try next legal candidate. */ }
  }
  return null;
}
