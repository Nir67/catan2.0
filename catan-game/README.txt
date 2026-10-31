CATAN BUILD MENU

1. Replace src/App.tsx with App.tsx from this folder.
2. Replace server.js with server.js from this folder.
3. Save both files.
4. Restart the server: node server.js
5. Create a NEW room after restarting the server.

Build flow:
- Click the build toolbar on the left.
- Choose Road / Settlement / City.
- Click a highlighted valid location on the board.
- The new piece is synchronized to every player.

Current rules implemented:
- Only the current player can build.
- A road cannot be placed on an occupied edge.
- A settlement cannot be placed on an occupied vertex.
- A city can only upgrade your own settlement.

Resource costs, road connectivity, and Catan distance rules are not enforced yet.
