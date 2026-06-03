# Angle Battles

Angle Battles has a React/Vite frontend and a tiny Modal websocket server.

## Frontend Environment

Set this in Vercel:

```txt
VITE_ANGLE_BATTLES_WS_URL=wss://your-modal-websocket-host
```

Do not add a Modal token to the frontend. `VITE_` variables are visible in the browser.

## Server

Deploy:

```sh
npm run deploy:server
```

Serve during development through Modal:

```sh
npm run serve:server
```

Endpoints:

- `GET /health`
- `GET /rooms/{code}`
- `WS /ws/{code}`

Room codes must be 4 digits. The server keeps rooms in memory and is limited to one Modal container, so rooms disappear when the container scales down or restarts.
