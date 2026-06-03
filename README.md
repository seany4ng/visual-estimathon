# Visual Games Workspace

This repository contains two Vite/React projects:

- `estimathon-suite`: the original Visual Estimathon game suite.
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

If Vercel imports the repository root instead of `angle-battles`, the root
`vercel.json` builds `angle-battles` and serves `angle-battles/dist`.

The server exposes:

- `GET /health`
- `GET /rooms/{code}`
- `WS /ws/{code}`
