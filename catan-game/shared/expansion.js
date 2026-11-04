// Cities & Knights, 2020 English rules. All choices are validated by the server.
import {
  VERTICES,
  EDGES,
  TILES,
  RESOURCES,
  MATERIALS,
  COMMODITIES,
  total,
  score,
  roadLocations,
  resolveProduction,
} from "./engine.js";

export const TRACKS = { science: "paper", politics: "coin", trade: "cloth" };
export const PROGRESS = {
  alchemist: ["science", 2, "אלכימאי", "בחר את שתי קוביות המספר לפני הגלגול."],
  crane: ["science", 2, "מנוף", "שיפור עיר אחד בתור זה עולה סחורה אחת פחות."],
  engineer: ["science", 1, "מהנדס", "בנה חומת עיר בחינם."],
  inventor: ["science", 2, "ממציא", "החלף שני מספרים בלוח, למעט 2, 6, 8, 12."],
  irrigation: ["science", 2, "השקיה", "קבל שתי חיטה לכל שדה סמוך למבנים שלך."],
  medicine: [
    "science",
    2,
    "רפואה",
    "שדרג יישוב לעיר תמורת חיטה אחת ושני מחצבים.",
  ],
  mining: ["science", 2, "כרייה", "קבל שני מחצבים לכל הר סמוך למבנים שלך."],
  printer: ["science", 1, "דפוס", "נקודת ניצחון גלויה מיד עם קבלת הקלף."],
  "road-building": ["science", 2, "בניית דרכים", "בנה עד שתי דרכים בחינם."],
  smith: ["science", 2, "נפח", "קדם עד שני אבירים דרגה אחת בחינם."],
  bishop: [
    "politics",
    2,
    "בישוף",
    "הזז את השודד וגנוב מכל יריב הסמוך למשושה החדש.",
  ],
  constitution: ["politics", 1, "חוקה", "נקודת ניצחון גלויה מיד עם קבלת הקלף."],
  deserter: [
    "politics",
    2,
    "עריק",
    "יריב מסיר אביר לבחירתו; תוכל להציב אביר באותה דרגה.",
  ],
  diplomat: [
    "politics",
    2,
    "דיפלומט",
    "הסר דרך פתוחה. דרך שלך ניתן להציב מחדש.",
  ],
  intrigue: ["politics", 2, "תככים", "דחוק אביר יריב המחובר לדרך שלך."],
  saboteur: [
    "politics",
    2,
    "חבלן",
    "יריבים עם לפחות מספר הנקודות שלך משליכים חצי מהיד.",
  ],
  spy: ["politics", 3, "מרגל", "הבט בקלפי ההתקדמות של יריב וקח אחד."],
  warlord: ["politics", 2, "מצביא", "הפעל את כל האבירים שלך בחינם."],
  wedding: [
    "politics",
    2,
    "חתונה",
    "יריבים עם יותר נקודות מוסרים לך עד שני קלפים לבחירתם.",
  ],
  "commercial-harbor": [
    "trade",
    2,
    "נמל מסחרי",
    "החלף משאב אחד תמורת סחורה לבחירת כל יריב, פעם ליריב בתור.",
  ],
  "master-merchant": [
    "trade",
    2,
    "סוחר מומחה",
    "הבט ביד של יריב עם יותר נקודות וקח עד שני קלפים.",
  ],
  merchant: [
    "trade",
    6,
    "סוחר",
    "הצב סוחר סמוך למבנה שלך: נקודה ויחס 2:1 למשאב המשושה.",
  ],
  "merchant-fleet": [
    "trade",
    2,
    "צי סוחר",
    "יחס 2:1 לחומר אחד לבחירתך עד סוף התור.",
  ],
  "resource-monopoly": [
    "trade",
    4,
    "מונופול משאבים",
    "קח מכל יריב עד שני קלפים ממשאב אחד.",
  ],
  "trade-monopoly": [
    "trade",
    2,
    "מונופול סחורות",
    "קח מכל יריב קלף אחד מסחורה אחת.",
  ],
};
const check = (ok, text) => {
  if (!ok) throw new Error(text);
};
const vertex = (id) => VERTICES.find((v) => v.id === id);
const edge = (id) => EDGES.find((e) => e.id === id);
const building = (g, id) => g.buildings.find((b) => b.vertexId === id);
const knight = (g, id) => g.knightPieces.find((k) => k.vertexId === id);
const occupied = (g, id) => building(g, id) || knight(g, id);
const cities = (g, id) =>
  g.buildings.filter((b) => b.playerId === id && b.type === "city");
const ownsRoad = (g, id, v) =>
  g.roads.some((r) => r.playerId === id && edge(r.edgeId).vertices.includes(v));
const available = (g, id, level) =>
  g.knightPieces.filter((k) => k.playerId === id && k.level === level).length <
  2;
export const knightSites = (g, id) =>
  VERTICES.filter((v) => !occupied(g, v.id) && ownsRoad(g, id, v.id)).map(
    (v) => v.id,
  );
export function connectedSites(g, id, start) {
  const seen = new Set([start]),
    queue = [start];
  while (queue.length) {
    const v = queue.shift();
    if (
      v !== start &&
      occupied(g, v)?.playerId &&
      occupied(g, v).playerId !== id
    )
      continue;
    for (const r of g.roads.filter(
      (r) => r.playerId === id && edge(r.edgeId).vertices.includes(v),
    ))
      for (const n of edge(r.edgeId).vertices)
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
  }
  return [...seen].filter((v) => v !== start);
}
const canPromote = (g, p, k) =>
  k.playerId === p.id &&
  k.level < 3 &&
  k.promotedTurn !== g.turnNumber &&
  (k.level < 2 || p.improvements.politics >= 3) &&
  available(g, p.id, k.level + 1);
const canAct = (g, k) =>
  k.active && k.activatedTurn < g.turnNumber && k.actedTurn !== g.turnNumber;
const promote = (g, p, k) => {
  check(k && canPromote(g, p, k), "אי אפשר לקדם אביר זה");
  k.level++;
  k.promotedTurn = g.turnNumber;
};
const deactivate = (g, k) => {
  k.active = false;
  k.actedTurn = g.turnNumber;
};
const activate = (g, k) => {
  k.active = true;
  k.activatedTurn = g.turnNumber;
};
const option = (id, label = id) => ({ id: String(id), label: String(label) });
const sites = (ids) =>
  ids.map((id) =>
    option(id, `צומת ${VERTICES.findIndex((v) => v.id === id) + 1}`),
  );
const enqueue = (g, task) => g.choices.push(task);
const choose = (g, playerId, kind, title, options, extra = {}) => {
  if (options.length) enqueue(g, { playerId, kind, title, options, ...extra });
};
const player = (g, id) => g.players.find((p) => p.id === id);
const hand = () => Object.fromEntries(MATERIALS.map((r) => [r, 0]));
function transfer(from, to, cards) {
  for (const r of MATERIALS) {
    from.resources[r] -= cards[r] || 0;
    to.resources[r] += cards[r] || 0;
  }
}
function validateCards(p, cards, count, allowed = MATERIALS) {
  check(
    cards && typeof cards === "object" && !Array.isArray(cards),
    "בחר קלפים",
  );
  check(
    Object.keys(cards).every((r) => allowed.includes(r) || cards[r] === 0),
    "חומר לא חוקי",
  );
  for (const r of MATERIALS)
    check(
      Number.isInteger(cards[r] ?? 0) &&
        (cards[r] ?? 0) >= 0 &&
        (cards[r] ?? 0) <= p.resources[r],
      "כמות קלפים לא חוקית",
    );
  check(total(cards) === count, `בחר בדיוק ${count} קלפים`);
}
export function initializeExpansion(g, rng) {
  g.mode = "cities-knights";
  g.targetScore = 13;
  g.deck = [];
  g.knightPieces = [];
  g.barbarianPosition = 0;
  g.barbarianAttacks = 0;
  g.eventDie = null;
  g.metropolises = {};
  g.merchant = null;
  g.choices = [];
  g.progressDecks = {};
  for (const track of Object.keys(TRACKS)) {
    const deck = Object.entries(PROGRESS).flatMap(([type, [t, count]]) =>
      t === track ? Array(count).fill(type) : [],
    );
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    g.progressDecks[track] = deck;
  }
  for (const r of COMMODITIES) g.bank[r] = 12;
  for (const p of g.players) {
    p.resources = { ...hand(), ...p.resources };
    p.improvements = { science: 0, politics: 0, trade: 0 };
    p.progress = [];
    p.publicVP = 0;
    p.defenderVP = 0;
  }
}
function draw(g, p, track) {
  const type = g.progressDecks[track].pop();
  if (!type) return;
  if (["printer", "constitution"].includes(type)) {
    p.publicVP++;
    return;
  }
  p.progress.push(type);
  if (p.progress.length > 4 && p.id !== g.players[g.currentPlayerIndex].id)
    choose(
      g,
      p.id,
      "discard-progress",
      "בחר קלף התקדמות להחזרה (מותר להחזיק ארבעה)",
      p.progress.map((c, i) => option(i, PROGRESS[c][2])),
    );
}
function displace(g, k) {
  const from = k.vertexId;
  g.knightPieces = g.knightPieces.filter((x) => x !== k);
  const dest = connectedSites(g, k.playerId, from).filter(
    (v) => !occupied(g, v),
  );
  choose(
    g,
    k.playerId,
    "relocate",
    "האביר נדחק: בחר צומת פנוי ברשת הדרכים שלך",
    sites(dest),
    { knight: k },
  );
}
export function expansionEvent(g, rng, ctx) {
  const roll = Math.floor(rng() * 6);
  g.eventDie =
    roll < 3 ? "barbarians" : ["science", "politics", "trade"][roll - 3];
  if (g.eventDie !== "barbarians") {
    for (let i = 0; i < g.players.length; i++) {
      const p = g.players[(g.currentPlayerIndex + i) % g.players.length];
      if (
        p.improvements[g.eventDie] > 0 &&
        g.dice[0] <= p.improvements[g.eventDie] + 1
      )
        draw(g, p, g.eventDie);
    }
  } else if (++g.barbarianPosition === 7) {
    const strengths = g.players.map((p) =>
      g.knightPieces
        .filter((k) => k.playerId === p.id && k.active)
        .reduce((s, k) => s + k.level, 0),
    );
    const attack = g.buildings.filter((b) => b.type === "city").length;
    const defense = strengths.reduce((a, b) => a + b, 0);
    g.lastBattle = { attack, defense, won: defense >= attack };
    ctx.note(
      g,
      `פלישת ברברים: התקפה ${attack}, הגנה ${defense} — ${defense >= attack ? "קטאן ניצלה" : "הברברים ניצחו"}`,
    );
    if (defense >= attack) {
      const best = Math.max(...strengths),
        winners = g.players.filter((_, i) => strengths[i] === best);
      if (winners.length === 1) winners[0].defenderVP++;
      else
        for (let i = 0; i < g.players.length; i++) {
          const p = g.players[(g.currentPlayerIndex + i) % g.players.length];
          if (winners.includes(p))
            choose(
              g,
              p.id,
              "reward",
              "הגנת קטאן: בחר ערימת התקדמות",
              Object.keys(TRACKS).map((t) =>
                option(
                  t,
                  { science: "מדע", politics: "פוליטיקה", trade: "מסחר" }[t],
                ),
              ),
            );
        }
    } else {
      const eligible = g.players.filter((p) =>
        cities(g, p.id).some((b) => !b.metropolis),
      );
      const weakest = Math.min(
        ...eligible.map((p) => strengths[g.players.indexOf(p)]),
      );
      for (const p of eligible.filter(
        (p) => strengths[g.players.indexOf(p)] === weakest,
      ))
        choose(
          g,
          p.id,
          "pillage",
          "הברברים ניצחו: בחר עיר שתהפוך ליישוב",
          sites(
            cities(g, p.id)
              .filter((b) => !b.metropolis)
              .map((b) => b.vertexId),
          ),
        );
    }
    for (const k of g.knightPieces) k.active = false;
    g.barbarianPosition = 0;
    g.barbarianAttacks++;
  }
  if (g.choices.length) {
    g.stage = "expansion-choice";
    g.pendingProduction = true;
  } else resolveProduction(g, ctx);
}
export function expansionProduction(g, sum, ctx) {
  const received = new Set();
  for (const r of MATERIALS) {
    const claims = g.players.map((p) =>
      g.buildings
        .filter((b) => b.playerId === p.id)
        .reduce(
          (n, b) =>
            n +
            vertex(b.vertexId).tiles.reduce((s, i) => {
              const t = g.tiles[i];
              if (i === g.robber || t.number !== sum) return s;
              const commodity = {
                wood: "paper",
                sheep: "cloth",
                stone: "coin",
              }[t.resource];
              return (
                s +
                (r === t.resource
                  ? b.type === "city" && !commodity
                    ? 2
                    : 1
                  : b.type === "city" && r === commodity
                    ? 1
                    : 0)
              );
            }, 0),
          0,
        ),
    );
    if (
      claims.reduce((a, b) => a + b, 0) > g.bank[r] &&
      claims.filter((n) => n > 0).length > 1
    )
      continue;
    claims.forEach((n, i) => {
      const amount = Math.min(n, g.bank[r]);
      if (amount) received.add(g.players[i].id);
      ctx.give(g, g.players[i], { [r]: amount });
    });
  }
  for (let i = 0; i < g.players.length; i++) {
    const p = g.players[(g.currentPlayerIndex + i) % g.players.length];
    if (p.improvements.science >= 3 && !received.has(p.id))
      choose(
        g,
        p.id,
        "aqueduct",
        "אמת מים: בחר משאב אחד",
        RESOURCES.filter((r) => g.bank[r] > 0).map((r) =>
          option(r, ctx.names[r]),
        ),
      );
  }
  if (g.choices.length) g.stage = "expansion-choice";
}
function improve(g, p, track, dest, discount, ctx) {
  check(Object.hasOwn(TRACKS, track), "בחר תחום שיפור");
  const level = p.improvements[track];
  check(
    cities(g, p.id).length && level < 5,
    "נדרשת עיר והשיפור מוגבל לחמש דרגות",
  );
  const holder = g.metropolises[track],
    holderPlayer = holder && player(g, holder.playerId);
  const gains =
    level + 1 >= 4 &&
    (!holder ||
      (holder.playerId !== p.id &&
        level + 1 > holderPlayer.improvements[track]));
  if (level >= 3 && holder?.playerId !== p.id)
    check(
      cities(g, p.id).some((b) => !b.metropolis),
      "נדרשת עיר פנויה למטרופולין",
    );
  let b;
  if (gains) {
    b = building(g, dest);
    check(
      b?.playerId === p.id && b.type === "city" && !b.metropolis,
      "בחר עיר פנויה למטרופולין",
    );
  }
  ctx.pay(g, p, { [TRACKS[track]]: Math.max(0, level + 1 - discount) });
  p.improvements[track]++;
  if (gains) {
    if (holder) delete building(g, holder.vertexId).metropolis;
    b.metropolis = track;
    g.metropolises[track] = { playerId: p.id, vertexId: dest };
  }
}
function wall(g, p, dest, free, ctx) {
  const b = building(g, dest);
  check(
    b?.playerId === p.id &&
      b.type === "city" &&
      !b.wall &&
      cities(g, p.id).filter((b) => b.wall).length < 3,
    "בחר עיר ללא חומה (עד שלוש חומות)",
  );
  if (!free) ctx.pay(g, p, { brick: 2 });
  b.wall = true;
}
function randomTheft(g, p, victim, rng) {
  let n = Math.floor(rng() * total(victim.resources));
  for (const r of MATERIALS) {
    if (n < victim.resources[r]) {
      transfer(victim, p, { [r]: 1 });
      break;
    }
    n -= victim.resources[r];
  }
}
function progressEffect(g, p, a, rng, ctx) {
  const type = a.card;
  const ownKnights = g.knightPieces.filter((k) => k.playerId === p.id);
  const higher = (x) => score(g, x.id) > score(g, p.id);
  if (type === "alchemist") {
    check(
      Array.isArray(a.dice) &&
        a.dice.length === 2 &&
        a.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6),
      "בחר שתי קוביות בין 1 ל־6",
    );
    g.chosenDice = a.dice;
  } else if (type === "crane") {
    check(!g.crane, "מנוף כבר ממתין לשימוש");
    g.crane = true;
  } else if (type === "engineer") wall(g, p, a.vertexId, true, ctx);
  else if (type === "inventor") {
    const [one, two] = (a.tiles || []).map((i) => g.tiles[i]);
    check(
      one &&
        two &&
        one !== two &&
        [one, two].every((t) => [3, 4, 5, 9, 10, 11].includes(t.number)),
      "בחר שני משושים עם מספרים מותרים",
    );
    [one.number, two.number] = [two.number, one.number];
  } else if (["mining", "irrigation"].includes(type)) {
    const r = type === "mining" ? "stone" : "wheat";
    const count =
      g.tiles.filter(
        (t) =>
          t.resource === r &&
          g.buildings.some(
            (b) => b.playerId === p.id && t.vertices.includes(b.vertexId),
          ),
      ).length * 2;
    check(
      count > 0 && g.bank[r] > 0,
      "הקלף לא יפיק חומר — אין אפשרות לשחק אותו כעת",
    );
    ctx.give(g, p, { [r]: Math.min(count, g.bank[r]) });
  } else if (type === "medicine") {
    const b = building(g, a.vertexId);
    check(
      b?.playerId === p.id &&
        b.type === "settlement" &&
        cities(g, p.id).length < 4,
      "בחר יישוב שלך לשדרוג",
    );
    ctx.pay(g, p, { wheat: 1, stone: 2 });
    b.type = "city";
  } else if (type === "road-building") {
    check(roadLocations(g, p.id).length, "אין מיקום לדרך");
    g.freeRoads = 2;
    g.returnStage = "action";
    g.stage = "road-building";
  } else if (type === "smith") {
    check(
      Array.isArray(a.knights) &&
        a.knights.length >= 1 &&
        a.knights.length <= 2 &&
        new Set(a.knights).size === a.knights.length,
      "בחר אביר אחד או שניים",
    );
    for (const id of a.knights) promote(g, p, knight(g, id));
  } else if (type === "warlord") {
    check(
      ownKnights.some((k) => !k.active),
      "אין אביר לא פעיל להפעלה",
    );
    for (const k of ownKnights) if (!k.active) activate(g, k);
  } else if (type === "bishop") {
    check(g.barbarianAttacks > 0, "השודד נשאר במדבר עד הפלישה הראשונה");
    check(g.tiles[a.tileId] && a.tileId !== g.robber, "בחר משושה אחר");
    g.robber = a.tileId;
    for (const victim of g.players.filter(
      (x) =>
        x.id !== p.id &&
        total(x.resources) &&
        g.buildings.some(
          (b) =>
            b.playerId === x.id &&
            TILES[a.tileId].vertices.includes(b.vertexId),
        ),
    ))
      randomTheft(g, p, victim, rng);
  } else if (type === "merchant") {
    check(
      g.tiles[a.tileId]?.resource !== "desert" &&
        g.buildings.some(
          (b) =>
            b.playerId === p.id &&
            g.tiles[a.tileId]?.vertices.includes(b.vertexId),
        ),
      "בחר משושה סמוך למבנה שלך",
    );
    g.merchant = { playerId: p.id, tileId: a.tileId };
  } else if (type === "merchant-fleet") {
    check(MATERIALS.includes(a.resource), "בחר חומר");
    g.fleet = [...(g.fleet || []), a.resource];
  } else if (["resource-monopoly", "trade-monopoly"].includes(type)) {
    check(
      (type === "resource-monopoly" ? RESOURCES : COMMODITIES).includes(
        a.resource,
      ),
      "בחר חומר מתאים",
    );
    for (const other of g.players.filter((x) => x.id !== p.id))
      transfer(other, p, {
        [a.resource]: Math.min(
          other.resources[a.resource],
          type === "resource-monopoly" ? 2 : 1,
        ),
      });
  } else if (["saboteur", "wedding"].includes(type)) {
    const before = g.choices.length;
    for (const other of g.players.filter(
      (x) =>
        x.id !== p.id &&
        (type === "wedding" ? higher(x) : score(g, x.id) >= score(g, p.id)),
    )) {
      const count =
        type === "wedding"
          ? Math.min(2, total(other.resources))
          : Math.floor(total(other.resources) / 2);
      if (count)
        enqueue(g, {
          playerId: other.id,
          kind: type,
          title:
            type === "wedding"
              ? "חתונה: בחר קלפים למסירה"
              : "חבלן: בחר קלפים להשלכה",
          required: count,
          recipient: p.id,
        });
    }
    check(g.choices.length > before, "אין שחקן שיושפע מהקלף כעת");
  } else if (["spy", "master-merchant"].includes(type)) {
    const other = player(g, a.playerId);
    check(
      other &&
        other.id !== p.id &&
        (type === "spy"
          ? other.progress.length
          : higher(other) && total(other.resources)),
      "בחר יריב מתאים",
    );
    enqueue(
      g,
      type === "spy"
        ? {
            playerId: p.id,
            kind: "spy-take",
            title: "בחר קלף התקדמות מהיריב",
            target: other.id,
            options: other.progress.map((c, i) => option(i, PROGRESS[c][2])),
          }
        : {
            playerId: p.id,
            kind: "master-take",
            title: "בחר עד שני קלפים מיד היריב",
            target: other.id,
            required: Math.min(2, total(other.resources)),
          },
    );
  } else if (type === "deserter") {
    const other = player(g, a.playerId);
    check(other && other.id !== p.id, "בחר יריב");
    const ks = g.knightPieces.filter((k) => k.playerId === other.id);
    check(ks.length, "אין ליריב אבירים");
    choose(
      g,
      other.id,
      "desert-remove",
      "עריק: בחר אביר להסרה",
      sites(ks.map((k) => k.vertexId)),
      { recipient: p.id },
    );
  } else if (type === "intrigue") {
    const k = knight(g, a.vertexId);
    check(
      k && k.playerId !== p.id && ownsRoad(g, p.id, a.vertexId),
      "בחר אביר יריב המחובר לדרך שלך",
    );
    displace(g, k);
  } else if (type === "diplomat") {
    const r = g.roads.find((r) => r.edgeId === a.edgeId);
    check(
      r &&
        edge(r.edgeId).vertices.some(
          (v) =>
            occupied(g, v)?.playerId !== r.playerId &&
            !g.roads.some(
              (x) =>
                x !== r &&
                x.playerId === r.playerId &&
                edge(x.edgeId).vertices.includes(v),
            ),
        ),
      "הדרך אינה פתוחה",
    );
    g.roads = g.roads.filter((x) => x !== r);
    if (r.playerId === p.id)
      choose(g, p.id, "diplomat-road", "בחר מיקום חדש לדרך, או ותר", [
        option("skip", "וותר"),
        ...roadLocations(g, p.id).map((e) =>
          option(e, `דרך ${EDGES.findIndex((x) => x.id === e) + 1}`),
        ),
      ]);
  } else if (type === "commercial-harbor") {
    g.harbor = { used: [] };
  } else throw new Error("קלף לא מוכר");
}
function settleChoice(g, p, a, ctx) {
  const c = g.choices[0];
  check(c?.playerId === p.id, "ממתינים לבחירה של שחקן אחר");
  if (c.options)
    check(
      c.options.some((o) => o.id === String(a.choice)),
      "בחר אפשרות חוקית",
    );
  const value = String(a.choice),
    target = player(g, c.target);
  g.choices.shift();
  if (c.kind === "pillage") {
    const b = building(g, value);
    b.type = "settlement";
    delete b.wall;
  } else if (c.kind === "reward") draw(g, p, value);
  else if (c.kind === "aqueduct") ctx.give(g, p, { [value]: 1 });
  else if (c.kind === "relocate") {
    c.knight.vertexId = value;
    g.knightPieces.push(c.knight);
  } else if (c.kind === "discard-progress") {
    const [card] = p.progress.splice(Number(value), 1);
    g.progressDecks[PROGRESS[card][0]].unshift(card);
  } else if (c.kind === "spy-take") {
    p.progress.push(target.progress.splice(Number(value), 1)[0]);
  } else if (c.kind === "master-take") {
    validateCards(target, a.cards, c.required);
    transfer(target, p, a.cards);
  } else if (["wedding", "saboteur", "harbor-give"].includes(c.kind)) {
    validateCards(
      p,
      a.cards,
      c.required,
      c.kind === "harbor-give" ? COMMODITIES : MATERIALS,
    );
    if (c.kind === "saboteur") ctx.pay(g, p, a.cards);
    else {
      const to = player(g, c.recipient);
      transfer(p, to, a.cards);
      if (c.kind === "harbor-give") transfer(to, p, { [c.resource]: 1 });
    }
  } else if (c.kind === "desert-remove") {
    const k = knight(g, value);
    g.knightPieces = g.knightPieces.filter((x) => x !== k);
    let level = k.level;
    if (!available(g, c.recipient, level)) level = 1;
    if (available(g, c.recipient, level))
      choose(
        g,
        c.recipient,
        "desert-place",
        "הצב אביר חלופי",
        [option("skip", "וותר"), ...sites(knightSites(g, c.recipient))],
        { level, active: k.active },
      );
  } else if (c.kind === "desert-place" && value !== "skip")
    g.knightPieces.push({
      vertexId: value,
      playerId: p.id,
      color: p.color,
      level: c.level,
      active: c.active,
      // An active deserter may act immediately (official C&K FAQ).
      activatedTurn: g.turnNumber - 1,
      actedTurn: -1,
      promotedTurn: -1,
    });
  else if (c.kind === "diplomat-road" && value !== "skip")
    g.roads.push({ edgeId: value, playerId: p.id, color: p.color });
  if (!g.choices.length) {
    g.stage = "action";
    if (g.pendingProduction) {
      g.pendingProduction = false;
      resolveProduction(g, ctx);
    }
  }
}
export function expansionAction(g, p, a, rng, ctx) {
  if (g.mode !== "cities-knights") return false;
  if (a.type === "expansion-choice") {
    check(g.stage === "expansion-choice", "אין בחירה ממתינה");
    settleChoice(g, p, a, ctx);
    return true;
  }
  if (a.type === "discard-progress") {
    check(
      g.stage === "action" &&
        g.players[g.currentPlayerIndex].id === p.id &&
        p.progress.length > 4,
      "אין צורך להחזיר קלף",
    );
    check(Number.isInteger(a.index) && p.progress[a.index], "בחר קלף");
    const [card] = p.progress.splice(a.index, 1);
    g.progressDecks[PROGRESS[card][0]].unshift(card);
    return true;
  }
  const types = [
    "hire-knight",
    "activate-knight",
    "promote-knight",
    "move-knight",
    "chase-robber",
    "build-wall",
    "improve-city",
    "play-progress",
    "harbor-trade",
  ];
  if (!types.includes(a.type)) return false;
  check(g.players[g.currentPlayerIndex].id === p.id, "זה לא התור שלך");
  check(
    a.type === "play-progress" && a.card === "alchemist"
      ? g.stage === "pre-roll"
      : g.stage === "action",
    "השלם גלגול ובחירות תחילה",
  );
  const k = knight(g, a.vertexId);
  if (a.type === "hire-knight") {
    check(
      knightSites(g, p.id).includes(a.vertexId) && available(g, p.id, 1),
      "בחר צומת פנוי המחובר לדרך שלך (עד שני אבירים בכל דרגה)",
    );
    ctx.pay(g, p, { sheep: 1, stone: 1 });
    g.knightPieces.push({
      vertexId: a.vertexId,
      playerId: p.id,
      color: p.color,
      level: 1,
      active: false,
      activatedTurn: -1,
      actedTurn: -1,
      promotedTurn: -1,
    });
  } else if (a.type === "activate-knight") {
    check(k?.playerId === p.id && !k.active, "בחר אביר לא פעיל שלך");
    ctx.pay(g, p, { wheat: 1 });
    activate(g, k);
  } else if (a.type === "promote-knight") {
    promote(g, p, k);
    ctx.pay(g, p, { sheep: 1, stone: 1 });
  } else if (["move-knight", "chase-robber"].includes(a.type)) {
    check(
      k?.playerId === p.id && canAct(g, k),
      "האביר צריך להיות פעיל מתור קודם ולא לפעול כבר בתור זה",
    );
    if (a.type === "chase-robber") {
      check(
        g.barbarianAttacks && vertex(k.vertexId).tiles.includes(g.robber),
        "השודד אינו סמוך או שהפלישה הראשונה טרם הגיעה",
      );
      deactivate(g, k);
      g.stage = "robber";
      g.returnStage = "action";
    } else {
      check(
        connectedSites(g, p.id, k.vertexId).includes(a.destination) &&
          !building(g, a.destination),
        "היעד צריך להיות מחובר לרשת הדרכים שלך",
      );
      const other = knight(g, a.destination);
      check(
        !other || (other.playerId !== p.id && other.level < k.level),
        "אפשר לדחוק רק אביר יריב חלש יותר",
      );
      if (other) {
        const from = k.vertexId;
        k.vertexId = a.destination;
        deactivate(g, k);
        displace(g, other);
        ctx.note(g, `אביר נדחק מצומת ${from}`);
      } else {
        k.vertexId = a.destination;
        deactivate(g, k);
      }
    }
  } else if (a.type === "build-wall") wall(g, p, a.vertexId, false, ctx);
  else if (a.type === "improve-city") {
    improve(g, p, a.track, a.vertexId, g.crane ? 1 : 0, ctx);
    g.crane = false;
  } else if (a.type === "play-progress") {
    const index = p.progress.indexOf(a.card);
    check(index >= 0, "אין לך קלף זה");
    // Remove before resolving, so a spy cannot steal the card being played.
    p.progress.splice(index, 1);
    progressEffect(g, p, a, rng, ctx);
    g.progressDecks[PROGRESS[a.card][0]].unshift(a.card);
    ctx.note(g, `${p.name} שיחק/ה ${PROGRESS[a.card][2]}`);
  } else if (a.type === "harbor-trade") {
    const other = player(g, a.playerId);
    check(
      g.harbor &&
        other &&
        other.id !== p.id &&
        !g.harbor.used.includes(other.id),
      "עסקה זו אינה זמינה",
    );
    check(
      RESOURCES.includes(a.resource) && p.resources[a.resource] > 0,
      "בחר משאב למסירה",
    );
    g.harbor.used.push(other.id);
    if (COMMODITIES.some((r) => other.resources[r] > 0))
      enqueue(g, {
        playerId: other.id,
        kind: "harbor-give",
        title: `נמל מסחרי: קבל ${ctx.names[a.resource]} ובחר סחורה למסירה`,
        recipient: p.id,
        required: 1,
        resource: a.resource,
      });
  }
  if (g.choices.length) g.stage = "expansion-choice";
  return true;
}
export function expansionView(g, id) {
  if (g.mode !== "cities-knights") return {};
  const c = g.choices[0];
  return {
    choices: undefined,
    progressDecks: undefined,
    chosenDice: undefined,
    choice: c
      ? c.playerId === id
        ? {
            ...c,
            ...(c.kind === "master-take"
              ? { max: player(g, c.target).resources }
              : {}),
          }
        : { playerId: c.playerId, title: "ממתינים לבחירה של שחקן אחר" }
      : null,
    progressRemaining: Object.fromEntries(
      Object.entries(g.progressDecks).map(([t, cards]) => [t, cards.length]),
    ),
    expansionLegal: {
      hire: available(g, id, 1) ? knightSites(g, id) : [],
      knights: g.knightPieces
        .filter((k) => k.playerId === id)
        .map((k) => ({
          vertexId: k.vertexId,
          promote: canPromote(g, player(g, id), k),
          act: canAct(g, k),
          chase:
            canAct(g, k) &&
            g.barbarianAttacks > 0 &&
            vertex(k.vertexId).tiles.includes(g.robber),
          destinations: canAct(g, k)
            ? connectedSites(g, id, k.vertexId).filter(
                (v) =>
                  !building(g, v) &&
                  (!knight(g, v) ||
                    (knight(g, v).playerId !== id &&
                      knight(g, v).level < k.level)),
              )
            : [],
        })),
    },
  };
}
