import json
import re
import secrets
import time

import modal


image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]==0.115.6"
)
app = modal.App("angle-battles-server")

ROOM_CODE_RE = re.compile(r"^\d{4}$")
ROUND_TARGETS = [23, 37, 52, 68, 79, 101, 117, 131, 146, 163]


def make_message(event, **payload):
    return {"event": event, **payload}


def choose_target(room_code, round_number):
    index = (int(room_code) + round_number * 7) % len(ROUND_TARGETS)
    return ROUND_TARGETS[index]


def score_guess(guess, target):
    error = abs(int(guess) - int(target))
    return max(0, 100 - round(error * 1.35))


def build_web_app():
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware

    web_app = FastAPI(title="Angle Battles Server")
    rooms = {}

    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def send_json(socket, payload):
        await socket.send_text(json.dumps(payload))

    async def broadcast(room_code, payload, exclude=None):
        room = rooms.get(room_code)
        if not room:
            return

        stale_players = []
        message = json.dumps(payload)
        for player in list(room["players"].values()):
            socket = player["socket"]
            if socket is exclude:
                continue
            try:
                await socket.send_text(message)
            except RuntimeError:
                stale_players.append(player["id"])

        for player_id in stale_players:
            room["players"].pop(player_id, None)
            room["guesses"].pop(player_id, None)

    def serialize_room(room_code):
        room = rooms.get(room_code)
        if not room:
            return None

        return {
            "code": room_code,
            "createdAt": room["created_at"],
            "round": room["round"],
            "status": room["status"],
            "currentTarget": room["target"],
            "players": [
                {
                    "id": player["id"],
                    "name": player["name"],
                    "isHost": player["is_host"],
                    "connectedAt": player["connected_at"],
                }
                for player in room["players"].values()
            ],
            "submittedPlayerIds": list(room["guesses"].keys()),
            "guessCount": len(room["guesses"]),
        }

    @web_app.get("/health")
    async def health():
        return {"ok": True, "rooms": len(rooms)}

    @web_app.get("/rooms/{room_code}")
    async def room_status(room_code: str):
        if not ROOM_CODE_RE.match(room_code):
            return {"ok": False, "error": "Room codes must be 4 digits."}

        room = serialize_room(room_code)
        if room is None:
            return {"ok": False, "error": "Room not found."}

        return {"ok": True, "room": room}

    @web_app.websocket("/ws/{room_code}")
    async def room_socket(socket: WebSocket, room_code: str):
        await socket.accept()

        if not ROOM_CODE_RE.match(room_code):
            await send_json(socket, make_message("error", message="Room codes must be 4 digits."))
            await socket.close(code=1008)
            return

        player_id = socket.query_params.get("playerId") or secrets.token_hex(4)
        player_name = (socket.query_params.get("name") or f"Player {player_id[-4:]}").strip()
        player_name = player_name[:28] or f"Player {player_id[-4:]}"
        room = rooms.setdefault(
            room_code,
            {
                "created_at": int(time.time()),
                "round": 0,
                "status": "lobby",
                "target": None,
                "players": {},
                "guesses": {},
            },
        )

        is_host = len(room["players"]) == 0
        room["players"][player_id] = {
            "id": player_id,
            "name": player_name,
            "is_host": is_host,
            "connected_at": int(time.time()),
            "socket": socket,
        }

        await send_json(
            socket,
            make_message(
                "connected",
                playerId=player_id,
                room=serialize_room(room_code),
            ),
        )
        await broadcast(room_code, make_message("room_state", room=serialize_room(room_code)))

        try:
            while True:
                raw_message = await socket.receive_text()
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    await send_json(socket, make_message("error", message="Messages must be JSON."))
                    continue

                event = message.get("event")
                payload = message.get("payload") or {}

                if event == "start_round":
                    player = room["players"].get(player_id)
                    if not player or not player["is_host"]:
                        await send_json(socket, make_message("error", message="Only the host can start a round."))
                        continue

                    requested_round = payload.get("round")
                    room["round"] = int(requested_round or room["round"] + 1)
                    room["target"] = choose_target(room_code, room["round"])
                    room["status"] = "guessing"
                    room["guesses"] = {}
                    await broadcast(
                        room_code,
                        make_message("round_started", room=serialize_room(room_code)),
                    )
                    continue

                if event == "submit_guess":
                    if room["status"] != "guessing" or room["target"] is None:
                        await send_json(socket, make_message("error", message="No active round."))
                        continue

                    try:
                        guess = max(0, min(180, int(payload.get("guess"))))
                    except (TypeError, ValueError):
                        await send_json(socket, make_message("error", message="Guess must be a number."))
                        continue

                    room["guesses"][player_id] = {
                        "playerId": player_id,
                        "name": player_name,
                        "guess": guess,
                        "target": room["target"],
                        "score": score_guess(guess, room["target"]),
                        "submittedAt": int(time.time()),
                    }

                    await broadcast(
                        room_code,
                        make_message("guess_submitted", playerId=player_id, room=serialize_room(room_code)),
                    )

                    if room["players"] and len(room["guesses"]) >= len(room["players"]):
                        room["status"] = "results"
                        await broadcast(
                            room_code,
                            make_message(
                                "round_result",
                                room=serialize_room(room_code),
                                round=room["round"],
                                target=room["target"],
                                guesses=list(room["guesses"].values()),
                            ),
                        )
                    continue

                await broadcast(
                    room_code,
                    make_message("message", playerId=player_id, event=event, payload=payload),
                    exclude=socket,
                )
        except WebSocketDisconnect:
            pass
        finally:
            current_room = rooms.get(room_code)
            if not current_room:
                return

            current_room["players"].pop(player_id, None)
            current_room["guesses"].pop(player_id, None)

            if current_room["players"]:
                next_host_id = next(iter(current_room["players"]))
                for player in current_room["players"].values():
                    player["is_host"] = player["id"] == next_host_id
                await broadcast(room_code, make_message("room_state", room=serialize_room(room_code)))
            else:
                rooms.pop(room_code, None)

    return web_app


@app.function(image=image, max_containers=1, scaledown_window=15)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def fastapi_app():
    return build_web_app()
