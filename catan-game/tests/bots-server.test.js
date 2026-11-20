import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io } from "socket.io-client";

test("bot lobby permissions, two humans plus bot, automatic turns and restart recovery", {timeout:30000}, async () => {
  const dir = await mkdtemp(join(tmpdir(), "catan-bots-"));
  const port = 42000 + Math.floor(Math.random() * 8000);
  let server;
  const clients = [];
  const wait = async predicate => {
    const deadline = Date.now() + 6000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "timed out waiting for bot state");
      await new Promise(r => setTimeout(r, 20));
    }
  };
  const start = async () => {
    server = spawn(process.execPath, ["server.js"], {env:{...process.env,PORT:String(port),CATAN_DATA_FILE:join(dir,"rooms.json"),CATAN_BOT_DELAY_MS:"40"},stdio:["ignore","pipe","inherit"],windowsHide:true});
    await once(server.stdout,"data");
  };
  const connect = async (token = randomUUID()) => {
    const c = {token,room:null,game:null,id:null,socket:io(`http://127.0.0.1:${port}`,{auth:{token},autoConnect:false,reconnection:false})};
    c.socket.on("identity", id => c.id=id);
    c.socket.on("room-state", room => c.room=room);
    c.socket.on("game-state", game => c.game=game);
    clients.push(c);c.socket.connect();await once(c.socket,"connect");await wait(()=>c.id);return c;
  };
  const request = (c,event,data={}) => new Promise((resolve,reject)=>c.socket.timeout(5000).emit(event,data,(err,result)=>err?reject(err):resolve(result)));
  try {
    await start();
    const a=await connect(), b=await connect();
    assert.equal((await request(a,"create-room",{playerName:"A",mode:"base",ranked:true})).success,true);
    await wait(()=>a.room);
    assert.equal((await request(b,"join-room",{playerName:"B",roomCode:a.room.roomCode})).success,true);
    assert.equal((await request(b,"add-bot",{difficulty:"hard"})).success,false);
    assert.equal((await request(a,"add-bot",{difficulty:"invalid"})).success,false);
    assert.equal((await request(a,"add-bot",{difficulty:"hard"})).success,true);
    await wait(()=>a.room.players.length===3);
    const bot=a.room.players.find(p=>p.botDifficulty);
    assert.equal(bot.online,true);assert.equal(a.room.ranked,false);
    assert.equal((await request(a,"set-mode",{mode:"base",ranked:true})).success,false);
    assert.equal((await request(a,"remove-bot",{playerId:b.id})).success,false);
    assert.equal((await request(a,"remove-bot",{playerId:bot.id})).success,true);
    assert.equal((await request(a,"add-bot",{difficulty:"medium"})).success,true);
    assert.equal((await request(a,"start-game")).success,true);
    await wait(()=>a.game);
    assert.equal((await request(a,"add-bot",{difficulty:"easy"})).success,false);
    for (const human of [a,b]) {
      await wait(()=>human.game.players[human.game.currentPlayerIndex].id===human.id);
      assert.equal((await request(human,"game-action",{type:"build-settlement",vertexId:human.game.legal.settlements[0]})).success,true);
      await wait(()=>human.game.stage==="setup-road");
      assert.equal((await request(human,"game-action",{type:"build-road",edgeId:human.game.legal.roads[0]})).success,true);
    }
    await wait(()=>a.game.revision>=8);
    const revision=a.game.revision, token=a.token, botId=a.room.players.find(p=>p.botDifficulty).id;
    clients.forEach(c=>c.socket.disconnect());
    const exited=once(server,"exit");server.kill();await exited;
    await start();const restored=await connect(token);
    await wait(()=>restored.game);
    assert.ok(restored.game.revision>=revision);
    assert.equal(restored.room.players.find(p=>p.botDifficulty).id,botId);
    assert.equal(restored.room.players.find(p=>p.botDifficulty).botDifficulty,"medium");
  } finally {
    clients.forEach(c=>c.socket.disconnect());
    if(server?.exitCode===null){const exited=once(server,"exit");server.kill();await exited;}
    await rm(dir,{recursive:true,force:true});
  }
});
