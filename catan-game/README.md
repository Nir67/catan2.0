# CATAN for friends

A Hebrew React + TypeScript client and an authoritative Socket.IO server implementing the **3–4 player base game**, without expansions or two-player house rules.

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

1. Create a room and share its five-character code.
2. Join with 3–4 players in separate tabs/devices; the host starts.
3. Place a settlement and adjacent road in forward, then reverse player order. The second settlement grants adjacent resources.
4. Roll, trade, build, buy or play development cards, and end your turn. Highlighted locations are validated by the server.
5. Reach 10 victory points during your own turn to win.

The board has 19 terrain hexes, 54 intersections, 72 paths, nine harbors, standard resource/token counts, and no adjacent 6/8 tokens. Resources are finite (19 of each); a city produces twice as much as a settlement. Building enforces costs, distance, road connections, opponent blocking and piece supplies (15 roads, 5 settlements, 4 cities). City upgrades return the settlement piece to supply.

Seven triggers individual discard selection, relocation of the robber and random theft from an adjacent opponent. The robber blocks production. Bank trades support 4:1, generic ports 3:1 and matching resource ports 2:1. Player trade offers and counteroffers can only be accepted when one party is the active player; gifts and same-resource exchanges are rejected.

The 25-card development deck contains 14 knights, 5 victory points and 2 each of Road Building, Year of Plenty and Monopoly. Only one action card may be played per turn, including before rolling, and never on the purchase turn. Victory points count immediately and remain private until game end. Longest Road and Largest Army obey thresholds, ownership ties and road interruptions. A game ends only when its active player reaches 10 points.

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

Unit tests cover geometry, placement, resource conservation/shortages, building costs and supplies, seven/discards/theft, harbors and player trades, development cards, hidden information, longest road, army and victory. The network test creates three Socket.IO clients, verifies authorization, completes setup, reconnects a player and restarts the server against a saved game. Test saves are created under the ignored `.data` directory and cleaned up.

## Structure

- `shared/engine.js`: pure board geometry and game rules; invalid actions leave the original state untouched.
- `shared/engine.d.ts`: typed client-facing state.
- `server.js`: stable identities, room membership, private views, persistence and request limits.
- `src/App.tsx`, `src/App.css`: responsive Hebrew interface, legal placement targets, hand/trade/development controls and game log.
- `src/socket.ts`: reconnecting same-origin client.
- `scripts/dev.js`: starts and stops both development processes.

Environment variables: `PORT` (default 3001), `CATAN_DATA_FILE` (save path), `CLIENT_ORIGIN` (comma-separated allowed browser origins), and `CATAN_SERVER_URL` (Vite proxy target, default `http://127.0.0.1:3001`).

Rules reference: [official CATAN base-game rulebooks](https://www.catan.com/understand-catan/game-rules) and [base-game FAQ](https://www.catan.com/faq/basegame). This is an independent friends project, not an official CATAN product.
