# Visual Games Workspace

This repository contains two Vite/React projects:

- `visual-estimathon`: the original visual estimation game suite.
- `angle-battles`: a live websocket angle guessing game.

Run either frontend from the repository root:

```sh
npm install
npm run dev:visual
npm run dev:angles
```

Deploy the Angle Battles websocket server to Modal:

```sh
npm run deploy:angles-server
```

Set this environment variable for the Angle Battles frontend in Vercel:

```txt
VITE_ANGLE_BATTLES_WS_URL=wss://your-modal-websocket-host
```

The server exposes:

- `GET /health`
- `GET /rooms/{code}`
- `WS /ws/{code}`
