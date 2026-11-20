import test from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, viewFor } from "../shared/engine.js";
import { botActor, chooseBotAction } from "../bots.js";

for (const difficulty of ["easy", "medium", "hard"]) {
  test(`bots ${difficulty}: complete a base match with only legal actions`, () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const players = ["a", "b", "c"].map(id => ({ id, name: id, botDifficulty: difficulty }));
    let g = createGame(players, rng);
    for (let step = 0; step < 2200 && !g.winner; step++) {
      const actor = botActor({ game: g, players });
      assert.ok(actor, g.stage);
      const action = chooseBotAction(g, actor.id, difficulty, rng);
      assert.ok(action, `No move in ${g.stage}`);
      const original = JSON.stringify(g);
      const next = applyAction(g, actor.id, action, rng);
      assert.equal(JSON.stringify(g), original, "candidate evaluation and action leave original intact");
      g = next;
    }
    assert.ok(g.winner, `match did not finish at turn ${g.turnNumber}`);
  });
}
for (const seafarers of [false, true]) {
  test(`bots: expansion choices and defense${seafarers ? " with seafarers" : ""}`, () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const players = ["a", "b", "c"].map(id => ({ id, name: id, botDifficulty: "hard" }));
    let g = createGame(players, rng, { mode: "cities-knights", seafarers });
    for (let step = 0; step < 650 && !g.winner; step++) {
      const actor = botActor({ game: g, players });
      assert.ok(actor, g.stage);
      const action = chooseBotAction(g, actor.id, "hard", rng);
      assert.ok(action, `No move in ${g.stage}`);
      g = applyAction(g, actor.id, action, rng);
    }
    assert.ok(g.turnNumber > 40 || g.winner);
  });
}
test("bots handle off-turn discards and respond to human trade offers", () => {
  const players = [{id:"a",name:"human"},{id:"b",name:"bot",botDifficulty:"hard"},{id:"c",name:"human2"}];
  let g = createGame(players); g.stage = "action";
  g.players[1].resources.wood = 4; g.players[0].resources.brick = 1;
  g = applyAction(g, "a", {type:"offer-trade",give:{brick:1},want:{wood:1}});
  assert.equal(botActor({game:g,players}).id, "b");
  const response = chooseBotAction(g,"b","hard",()=>.5);
  assert.ok(["accept-trade","reject-trade"].includes(response.type));
  g = applyAction(g,"b",response);
  assert.equal(botActor({game:g,players}),null);
  g.stage="discard";g.pendingDiscards={b:2};
  const action=chooseBotAction(g,"b","hard");
  assert.equal(action.type,"discard");
  g=applyAction(g,"b",action);
  assert.equal(g.pendingDiscards.b,undefined);
  assert.equal(viewFor(g,"a").players[1].resources,undefined);
});
