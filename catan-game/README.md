# CATAN for friends

A Hebrew React + TypeScript client and an authoritative Socket.IO server implementing the **3–4 player base game and optional Cities & Knights expansion**. The host selects a mode when creating a room and may change it in the lobby; all participants see the same choice.

## Run in Codespaces

Use Node.js **22.12 or newer** (Node 24 recommended).

```sh
cd catan-game
npm ci
npm run dev
```

This one command starts both Node (3001) and Vite (5173). Open **5173** in Codespaces → Ports → Open in Browser. Socket.IO uses the same origin through Vite's proxy; the server port does not need to be public. Stop old server/Vite processes before starting this version.

To run separately, use `npm start` and `npm run dev:client` in two terminals. `npm run build` produces the client bundle; production hosting must serve the bundle and proxy `/socket.io` to the Node server. Vite preview alone is not a multiplayer production server.

## Play

1. Select **Base Game (10 VP)** or **Cities & Knights (13 VP)**, create a room and share its five-character code.
2. Join with 3–4 players in separate tabs/devices; the host starts.
3. Place a settlement and adjacent road in forward, then reverse player order. The second settlement grants adjacent resources.
4. Roll, trade, build, buy or play development cards, and end your turn. Highlighted locations are validated by the server.
5. Reach 10 victory points during your own turn to win.

The board has 19 terrain hexes, 54 intersections, 72 paths, nine harbors, standard resource/token counts, and no adjacent 6/8 tokens. Resources are finite (19 of each); a city produces twice as much as a settlement. Building enforces costs, distance, road connections, opponent blocking and piece supplies (15 roads, 5 settlements, 4 cities). City upgrades return the settlement piece to supply.

Seven triggers individual discard selection, relocation of the robber and random theft from an adjacent opponent. The robber blocks production. Bank trades support 4:1, generic ports 3:1 and matching resource ports 2:1. Player trade offers and counteroffers can only be accepted when one party is the active player; gifts and same-resource exchanges are rejected.

The 25-card development deck contains 14 knights, 5 victory points and 2 each of Road Building, Year of Plenty and Monopoly. Only one action card may be played per turn, including before rolling, and never on the purchase turn. Victory points count immediately and remain private until game end. Longest Road and Largest Army obey thresholds, ownership ties and road interruptions. A game ends only when its active player reaches 10 points.

## Cities & Knights

The expansion follows the [official 2020 Cities & Knights rules and almanac](https://www.catan.com/sites/default/files/2021-06/catan_c_k_2020_rule_book_200708.pdf). It starts with a settlement and city in snake order. Cities produce paper with lumber, cloth with wool, or coin with ore; hills and fields produce two resources. Initial city placement grants only one basic resource per adjacent terrain.

The event die moves the barbarian ship on three faces and awards science, politics or trade progress on the other three. Attacks occur after seven ship results, before production. Active knight strength defends against the total number of cities, including metropolises. A unique strongest defender gains a public VP; tied defenders choose a progress stack. On defeat, the weakest eligible players choose which non-metropolis city loses its wall and becomes a settlement. The robber stays in the desert until the first attack.

Knights occupy intersections, interrupt opponents' roads, and support recruitment, grain activation, promotion, road-network movement, displacement with owner-selected retreat, and robber expulsion. Each rank has a two-piece supply. Activation/action and once-per-turn promotion limits are enforced. Fortress is required for normal rank-three promotion. Walls cost two brick, protect two additional hand cards, and are limited to three.

Five improvement levels in each branch cost the corresponding commodity. Level three grants Aqueduct, Fortress or Trading House; level four can claim a metropolis, level five can take it from a weaker holder. Metropolises add two VP and are immune to pillaging. Resources and commodities use the same finite-bank, discard, theft and trade rules.

All **54 progress cards (25 distinct effects)** replace development cards. Choices use private, server-validated prompts: Spy and Master Merchant reveal the target hand only to the actor; other players choose their own wedding gifts, sabotage discards, deserters and harbor exchanges. Progress VP are public immediately. Cards return to the bottom of their stack when used or discarded. An off-turn fifth card requires an immediate choice; the active player must reduce to four before ending the turn. Alchemist alone is played before rolling. The Merchant grants one VP and resource-specific 2:1 trade; Merchant Fleet lasts only for the current turn. Largest Army is not used; Longest Road remains. Victory requires **13 points during your own turn**.

The UI shows numbered intersections, knight strength/activation, walls, metropolis crowns, merchant, event die, barbarian track, improvements and private progress cards. Choice of mode is locked once the game starts. Existing version-1 base-game saves remain compatible.

## Reconnect and saves

Each browser tab gets a random session token in `sessionStorage`. Refreshing or reconnecting **the same tab** restores its seat, color and private hand. Use separate tabs or devices for different players. Closing a tab without restoring its session loses that tab's identity; there is no account-based recovery yet. Disconnected players keep their seats and turns, so a game waits for them to return.

The server saves accepted state changes atomically to `.data/rooms.json` and loads them after a restart. Keep that directory on persistent storage; ephemeral hosting loses the saved games. It includes private hands and identity tokens: it is gitignored and must never be served publicly or committed. Current saved-game schema is version 1. Corrupt/unsupported save files stop startup rather than being overwritten. Older in-memory rooms from previous versions cannot be migrated.

The host can remove themselves from a lobby using Exit; a new host is selected from remaining players. A running game cannot be reset by sending Start again. Finished-game participants can leave and create new rooms.

## Validation

```sh
npm test
npm run lint
npm run build
```

Unit tests cover geometry, placement, resource conservation/shortages, building costs and supplies, seven/discards/theft, harbors and player trades, development cards, hidden information, longest road, army and victory. Expansion tests additionally cover commodity conservation, barbarian outcomes, timing, all progress-card effects, metropolis transfer and information privacy. The network tests run for **both modes**, create three Socket.IO clients, verifies authorization, completes setup, reconnects a player and restarts the server against a saved game. Test saves are created under the ignored `.data` directory and cleaned up.

## Structure

- `shared/engine.js`: pure board geometry and game rules; invalid actions leave the original state untouched.
- `shared/engine.d.ts`: typed client-facing state.
- `shared/expansion.js`: Cities & Knights rules, progress decks and private decision queue.
- `src/components/Expansion.tsx`: expansion controls, progress cards and choice prompts.
- `server.js`: stable identities, room membership, private views, persistence and request limits.
- `src/App.tsx`, `src/App.css`: responsive Hebrew interface, legal placement targets, hand/trade/development controls and game log.
- `src/socket.ts`: reconnecting same-origin client.
- `scripts/dev.js`: starts and stops both development processes.

Environment variables: `PORT` (default 3001), `CATAN_DATA_FILE` (save path), `CLIENT_ORIGIN` (comma-separated allowed browser origins), and `CATAN_SERVER_URL` (Vite proxy target, default `http://127.0.0.1:3001`).

Rules reference: [official CATAN base-game rulebooks](https://www.catan.com/understand-catan/game-rules) and [base-game FAQ](https://www.catan.com/faq/basegame). This is an independent friends project, not an official CATAN product.
