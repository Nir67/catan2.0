# Free cloud hosting

The production app serves its compiled client and Socket.IO backend from one Node service. `render.yaml` selects Render Free. Use an existing Neon Free PostgreSQL connection as the secret `DATABASE_URL`; do not add a paid disk or a paid database plan.

Build: `npm ci --include=dev && npm run build`

Start: `npm start`

Health endpoint: `/healthz`

Set `DATABASE_URL` as a hosting secret, never in Git. The application verifies the database TLS certificate, persists the complete authoritative game/account state to PostgreSQL, serializes state changes, and uses revision checks to prevent a stale server from overwriting newer data. Without this variable it continues to use the private local `.data/rooms.json` file.

Render Free may sleep after inactivity and take time to wake. It continues to work independently of the developer's computer. Free service quotas still apply; do not upgrade automatically.

The local save file is not included in deployments. Existing local games/accounts remain on that computer unless separately migrated into an empty cloud database.
