import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Crosshair,
  Link,
  LogIn,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Send,
  Swords,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'

type RoomStatus = 'lobby' | 'guessing' | 'results'

type Player = {
  id: string
  name: string
  isHost: boolean
  connectedAt: number
}

type Room = {
  code: string
  createdAt: number
  round: number
  status: RoomStatus
  currentTarget: number | null
  players: Player[]
  submittedPlayerIds: string[]
  guessCount: number
}

type GuessResult = {
  playerId: string
  name: string
  guess: number
  target: number
  score: number
  submittedAt: number
}

type ServerMessage =
  | { event: 'connected'; playerId: string; room: Room }
  | { event: 'room_state'; room: Room }
  | { event: 'guess_submitted'; playerId: string; room: Room }
  | { event: 'round_started'; room: Room }
  | { event: 'round_result'; room: Room; round: number; target: number; guesses: GuessResult[] }
  | { event: 'error'; message: string }
  | { event: 'message'; playerId: string; payload: unknown }

const SERVER_WS_URL = import.meta.env.VITE_ANGLE_BATTLES_WS_URL?.replace(/\/$/, '') || ''
const NAME_KEY = 'angle-battles-name'
const PLAYER_ID_KEY = 'angle-battles-player-id'

const shellClass = 'mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:py-12'
const cardClass =
  'rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(12,17,29,0.07)]'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:hover:bg-slate-950'
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 transition hover:border-blue-500 hover:text-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300'
const fieldClass =
  'min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base font-bold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-100'

function getRoomFromPath() {
  const match = window.location.pathname.match(/\/(\d{4})(?:\/)?$/)
  return match?.[1] ?? ''
}

function createRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function setRoomPath(code: string) {
  const nextPath = `/${code}`
  if (window.location.pathname !== nextPath) {
    window.history.pushState({ roomCode: code }, '', nextPath)
  }
}

function formatCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

function getStoredValue(key: string, fallback = '') {
  try {
    return window.localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function setStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is only used to make reconnecting friendlier.
  }
}

function getOrCreatePlayerId() {
  const storedId = getStoredValue(PLAYER_ID_KEY)
  if (storedId) {
    return storedId
  }

  const nextId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)
  setStoredValue(PLAYER_ID_KEY, nextId)
  return nextId
}

function polarPoint(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (Math.PI / 180) * degrees
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy - Math.sin(radians) * radius,
  }
}

function AngleArena({ guess, target = 72 }: { guess: number | string; target?: number | null }) {
  const normalizedTarget = Number(target ?? 72)
  const targetEnd = polarPoint(132, 164, 112, normalizedTarget)
  const guessEnd = polarPoint(132, 164, 96, Number(guess))
  const arcEnd = polarPoint(132, 164, 44, normalizedTarget)
  const largeArc = normalizedTarget > 180 ? 1 : 0

  return (
    <svg className="mx-auto block h-auto w-full max-w-xl" viewBox="0 0 264 204" role="img" aria-label="Angle battle round">
      <defs>
        <linearGradient id="arenaSurface" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff8db" />
          <stop offset="100%" stopColor="#e7f5ff" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="244" height="184" rx="8" fill="url(#arenaSurface)" />
      <path d="M 30 164 H 232" stroke="#17201a" strokeWidth="8" strokeLinecap="round" />
      <path d={`M 132 164 L ${targetEnd.x} ${targetEnd.y}`} stroke="#d9480f" strokeWidth="8" strokeLinecap="round" />
      <path d={`M 132 164 L ${guessEnd.x} ${guessEnd.y}`} stroke="#1864ab" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" />
      <path
        d={`M 176 164 A 44 44 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
        fill="none"
        stroke="#d9480f"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <circle cx="132" cy="164" r="9" fill="#17201a" />
      <text x="184" y="154" fill="#1864ab" fontSize="12" fontWeight="800">
        guess
      </text>
    </svg>
  )
}

function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const [playerId, setPlayerId] = useState(getOrCreatePlayerId)
  const [username, setUsername] = useState(() => getStoredValue(NAME_KEY, ''))
  const [roomCode, setRoomCode] = useState(getRoomFromPath)
  const [joinCode, setJoinCode] = useState(getRoomFromPath)
  const [room, setRoom] = useState<Room | null>(null)
  const [view, setView] = useState<'home' | 'room'>('home')
  const [guess, setGuess] = useState(45)
  const [copied, setCopied] = useState(false)
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState('')
  const [roundResult, setRoundResult] = useState<{ round: number; target: number; guesses: GuessResult[] } | null>(null)

  const shareUrl = roomCode ? `${window.location.origin}/${roomCode}` : ''
  const players = room?.players || []
  const submittedPlayerIds = room?.submittedPlayerIds || []
  const currentPlayer = useMemo(() => players.find((player) => player.id === playerId), [playerId, players])
  const isHost = Boolean(currentPlayer?.isHost)
  const isConnected = socketStatus === 'connected'
  const target = room?.currentTarget || roundResult?.target || 72
  const hasSubmitted =
    submittedPlayerIds.includes(playerId) || Boolean(roundResult?.guesses.some((entry) => entry.playerId === playerId))
  const roundIsLive = room?.status === 'guessing'
  const showingResults = room?.status === 'results' || Boolean(roundResult)

  useEffect(() => {
    const syncFromPath = () => {
      const code = getRoomFromPath()
      setRoomCode(code)
      setJoinCode(code)
      if (!socketRef.current) {
        setView('home')
      }
    }

    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [])

  useEffect(() => {
    return () => socketRef.current?.close()
  }, [])

  function sendEvent(event: string, payload: Record<string, unknown> = {}) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('Socket is not connected.')
      return
    }

    socketRef.current.send(JSON.stringify({ event, payload }))
  }

  function connectToRoom(code: string, requestedName: string) {
    const formattedCode = formatCode(code)
    const cleanName = requestedName.trim()

    if (!cleanName) {
      setConnectionError('Enter a username first.')
      return
    }

    if (formattedCode.length !== 4) {
      setConnectionError('Enter a 4 digit room code.')
      return
    }

    if (!SERVER_WS_URL) {
      setConnectionError('Missing VITE_ANGLE_BATTLES_WS_URL.')
      return
    }

    socketRef.current?.close()
    setStoredValue(NAME_KEY, cleanName)
    setConnectionError('')
    setSocketStatus('connecting')
    setRoom(null)
    setRoundResult(null)
    setGuess(45)
    setRoomCode(formattedCode)
    setJoinCode(formattedCode)
    setRoomPath(formattedCode)
    setView('room')

    const url = `${SERVER_WS_URL}/ws/${formattedCode}?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(cleanName)}`
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.addEventListener('open', () => setSocketStatus('connected'))

    socket.addEventListener('message', (event) => {
      let message: ServerMessage
      try {
        message = JSON.parse(event.data) as ServerMessage
      } catch {
        setConnectionError('Received a malformed socket message.')
        return
      }

      if (message.event === 'connected') {
        setPlayerId(message.playerId)
        setStoredValue(PLAYER_ID_KEY, message.playerId)
        setRoom(message.room)
        setView('room')
        return
      }

      if (message.event === 'room_state' || message.event === 'guess_submitted') {
        setRoom(message.room)
        return
      }

      if (message.event === 'round_started') {
        setRoom(message.room)
        setRoundResult(null)
        setGuess(45)
        setView('room')
        return
      }

      if (message.event === 'round_result') {
        setRoom(message.room)
        setRoundResult({
          round: message.round,
          target: message.target,
          guesses: message.guesses || [],
        })
        return
      }

      if (message.event === 'error') {
        setConnectionError(message.message || 'Something went wrong.')
      }
    })

    socket.addEventListener('close', () => {
      if (socketRef.current === socket) {
        setSocketStatus('disconnected')
      }
    })

    socket.addEventListener('error', () => {
      if (socketRef.current === socket) {
        setSocketStatus('error')
        setConnectionError('Could not connect to the game server.')
      }
    })
  }

  function createGame() {
    connectToRoom(createRoomCode(), username)
  }

  function joinGame(code = joinCode) {
    connectToRoom(code, username)
  }

  async function copyShareLink() {
    if (!shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  function leaveRoom() {
    socketRef.current?.close()
    socketRef.current = null
    setRoom(null)
    setRoundResult(null)
    setSocketStatus('idle')
    setConnectionError('')
    setView('home')
  }

  const resultForPlayer = (player: Player) => roundResult?.guesses.find((entry) => entry.playerId === player.id)

  return (
    <main className={shellClass}>
      <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-label="Angle Battles header">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700">Live room angle game</p>
          <h1 className="mt-2 text-5xl font-black leading-none text-slate-950 sm:text-6xl lg:text-7xl">Angle Battles</h1>
        </div>
        <div
          className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-md border px-3.5 text-sm font-black ${
            isConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          {isConnected ? <Wifi aria-hidden="true" size={18} /> : <WifiOff aria-hidden="true" size={18} />}
          {isConnected ? 'Connected' : socketStatus === 'connecting' ? 'Connecting' : 'Offline'}
        </div>
      </section>

      {view === 'home' ? (
        <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`${cardClass} grid min-h-[440px] items-center gap-6 p-5 sm:p-8 lg:grid-cols-[0.8fr_1fr]`}>
            <div>
              <Swords aria-hidden="true" className="text-blue-700" size={36} />
              <h2 className="mt-5 max-w-sm text-4xl font-black leading-none text-slate-950 sm:text-5xl">
                Make a room, share a code, and race to guess the angle.
              </h2>
            </div>
            <AngleArena guess={45} target={72} />
          </div>

          <div className={`${cardClass} grid content-start gap-5 p-5`}>
            <label className="grid gap-2" htmlFor="username">
              <span className="text-sm font-black text-slate-600">Username</span>
              <input
                className={fieldClass}
                id="username"
                maxLength={28}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setConnectionError('')
                }}
                placeholder="szyang"
                value={username}
              />
            </label>

            <button className={primaryButtonClass} onClick={createGame} type="button">
              <Plus aria-hidden="true" size={19} />
              Create game
            </button>

            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                joinGame()
              }}
            >
              <label className="text-sm font-black text-slate-600" htmlFor="room-code">
                Join game
              </label>
              <div className="grid grid-cols-[1fr_48px] gap-2">
                <input
                  className={fieldClass}
                  id="room-code"
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => {
                    setJoinCode(formatCode(event.target.value))
                    setConnectionError('')
                  }}
                  pattern="\d{4}"
                  placeholder="4821"
                  value={joinCode}
                />
                <button className={secondaryButtonClass} type="submit" aria-label="Join room" title="Join room">
                  <LogIn aria-hidden="true" size={19} />
                </button>
              </div>
            </form>

            {connectionError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{connectionError}</p>}
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_270px]">
          <aside className={`${cardClass} grid content-start gap-3 p-4`} aria-label="Room details">
            <div className="grid min-h-32 place-items-center rounded-lg bg-slate-950 text-white">
              <span className="text-xs font-black uppercase text-slate-300">Room</span>
              <strong className="text-5xl font-black leading-none">{roomCode}</strong>
            </div>
            <button className={primaryButtonClass} onClick={copyShareLink} type="button">
              {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm text-slate-600">
              <Link aria-hidden="true" size={17} />
              <span className="break-words [overflow-wrap:anywhere]">{shareUrl}</span>
            </div>
            <div className={`grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm font-bold ${isConnected ? 'text-emerald-700' : 'text-slate-600'}`}>
              <Radio aria-hidden="true" size={17} />
              <span>{isConnected ? `${players.length} connected` : socketStatus}</span>
            </div>
            <button className={secondaryButtonClass} onClick={leaveRoom} type="button">
              Leave room
            </button>
            {connectionError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{connectionError}</p>}
          </aside>

          <section className={`${cardClass} min-w-0 p-5`} aria-label="Game area">
            {!room || room.status === 'lobby' ? (
              <div className="grid min-h-[470px] place-items-center content-center gap-5 text-center">
                <Users aria-hidden="true" className="text-blue-700" size={38} />
                <h2 className="text-3xl font-black text-slate-950">Lobby</h2>
                <div className="grid w-full max-w-md gap-2">
                  {players.length ? (
                    players.map((player) => (
                      <div
                        className={`flex min-h-12 items-center justify-between rounded-md border px-3 ${
                          player.id === playerId ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
                        }`}
                        key={player.id}
                      >
                        <span className="font-bold text-slate-950">{player.name}</span>
                        <b className="text-sm text-emerald-700">{player.isHost ? 'Host' : 'Ready'}</b>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-white px-3">
                      <span className="font-bold text-slate-950">Connecting...</span>
                      <b className="text-sm text-slate-500">Wait</b>
                    </div>
                  )}
                </div>
                {isHost ? (
                  <button className={primaryButtonClass} disabled={!isConnected} onClick={() => sendEvent('start_round')} type="button">
                    <Play aria-hidden="true" size={19} />
                    Start round
                  </button>
                ) : (
                  <p className="text-slate-600">Waiting for the host to start.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-blue-700">Round {room.round}</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">{showingResults ? 'Results are in.' : 'Guess the shared angle.'}</h2>
                  </div>
                  <Crosshair aria-hidden="true" className="text-blue-700" size={28} />
                </div>

                <AngleArena guess={guess} target={target} />

                <div className="grid gap-3">
                  <label className="text-sm font-black text-slate-600" htmlFor="angle-guess">
                    Your angle
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_86px] sm:items-center">
                    <input
                      className="accent-blue-700"
                      disabled={!roundIsLive || hasSubmitted}
                      id="angle-guess"
                      max="180"
                      min="0"
                      onChange={(event) => setGuess(Number(event.target.value))}
                      type="range"
                      value={guess}
                    />
                    <output className="grid min-h-12 place-items-center rounded-md border border-slate-300 bg-white text-lg font-black text-slate-950">
                      {guess}°
                    </output>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={primaryButtonClass} disabled={!roundIsLive || hasSubmitted} onClick={() => sendEvent('submit_guess', { guess })} type="button">
                      <Send aria-hidden="true" size={18} />
                      {hasSubmitted ? 'Submitted' : 'Submit'}
                    </button>
                    {isHost && showingResults && (
                      <button className={secondaryButtonClass} onClick={() => sendEvent('start_round')} type="button">
                        <RefreshCcw aria-hidden="true" size={19} />
                        Next round
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className={`${cardClass} grid content-start gap-3 p-4`} aria-label="Scores">
            <h2 className="text-2xl font-black text-slate-950">Players</h2>
            <div className="grid gap-2">
              {players.map((player) => {
                const result = resultForPlayer(player)
                const submitted = submittedPlayerIds.includes(player.id)

                return (
                  <div
                    className={`flex min-h-12 items-center justify-between rounded-md border px-3 ${
                      player.id === playerId ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                    key={player.id}
                  >
                    <span className="font-bold text-slate-950">{player.name}</span>
                    <strong className="text-xl font-black text-slate-950">{result ? result.score : submitted ? '✓' : '...'}</strong>
                  </div>
                )
              })}
            </div>
            {roundResult ? (
              <div className="grid gap-2 text-slate-600">
                <p className="mb-1 font-bold">Target was {roundResult.target}°.</p>
                {roundResult.guesses.map((entry) => (
                  <div className="flex min-h-9 items-center justify-between rounded-md border border-slate-200 bg-white px-3" key={entry.playerId}>
                    <span>{entry.name}</span>
                    <b className="text-slate-950">{entry.guess}°</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">
                {room?.status === 'guessing' ? 'Waiting for every player to submit.' : 'Scores appear after each round.'}
              </p>
            )}
          </aside>
        </section>
      )}
    </main>
  )
}

export default App
