import * as Matter from 'matter-js'
import {
  ArrowLeft,
  Clock3,
  Gauge,
  Play,
  Ruler,
  Target,
  TriangleRight,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type GameId = 'angles' | 'lines' | 'velocity' | 'projectiles' | 'time'
type Page = 'home' | GameId
type MotionPhase = 'ready' | 'playing' | 'guessing'

type GameInfo = {
  id: GameId
  title: string
  description: string
  hint: string
  Icon: LucideIcon
}

type AngleTrial = {
  id: number
  answer: number
  startDeg: number
  sweepDeg: number
}

type LineTrial = {
  id: number
  answer: number
  rotation: number
}

type VelocityTrial = {
  id: number
  answer: number
  firstDurationMs: number
  secondDurationMs: number
}

type ProjectileTrial = {
  id: number
  answer: number
}

type TimeTrial = {
  id: number
  answer: number
  durationMs: number
}

type GuessTone = 'neutral' | 'hint' | 'correct' | 'wrong'

const games: GameInfo[] = [
  {
    id: 'angles',
    title: 'Angles',
    description:
      'Two rays point in arbitrary directions. Guess the integer degree measure between them.',
    hint: 'Enter the angle in whole degrees.',
    Icon: TriangleRight,
  },
  {
    id: 'lines',
    title: 'Lines',
    description:
      'Compare a short parallel line to a longer one. Guess the shorter line as a whole-number percentage of the longer line.',
    hint: 'Enter an integer from 10 to 90.',
    Icon: Ruler,
  },
  {
    id: 'velocity',
    title: 'Velocity',
    description:
      'Watch one ball cross the track, then a second ball cross the same track at a different speed.',
    hint: "Enter the second ball's speed as a whole-number percentage of the first ball.",
    Icon: Gauge,
  },
  {
    id: 'projectiles',
    title: 'Projectiles',
    description:
      'Watch a baseline projectile, then a second projectile with the same horizontal velocity and different gravity.',
    hint: 'Enter the second gravity strength relative to the baseline, from 0.5x to 4.0x.',
    Icon: Target,
  },
  {
    id: 'time',
    title: 'Time',
    description:
      'Watch a green circle stay on, then guess how many seconds it was visible.',
    hint: 'Enter seconds to two decimal places.',
    Icon: Clock3,
  },
]

const gameMap = new Map(games.map((game) => [game.id, game]))

const shellClass = 'mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:py-12'
const cardClass =
  'rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(12,17,29,0.07)]'
const iconTileClass = 'grid size-11 place-items-center rounded-md bg-blue-50 text-blue-700'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300'
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 transition hover:border-blue-500 hover:text-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300'
const panelClass = `${cardClass} p-5 sm:p-6`

function App() {
  const [page, setPage] = useState<Page>(readPageFromHash)

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigateTo(nextPage: Page) {
    window.location.hash = nextPage === 'home' ? '' : nextPage
    setPage(nextPage)
  }

  if (page !== 'home') {
    return <GamePage gameId={page} onBack={() => navigateTo('home')} />
  }

  return <HomePage onChooseGame={navigateTo} />
}

function HomePage({ onChooseGame }: { onChooseGame: (gameId: GameId) => void }) {
  return (
    <main className={shellClass}>
      <section className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h1 className="max-w-3xl text-5xl font-black leading-none text-slate-950 sm:text-6xl lg:text-7xl">
            Welcome to the visual estimathon!
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            Pick a game mode to sharpen your eye for angles, distance, motion,
            arcs, and time.
          </p>
        </div>

        <PreviewBoard />
      </section>

      <section className="border-t border-slate-200 pt-7" aria-labelledby="games-heading">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="games-heading" className="text-2xl font-black text-slate-950">
              Choose a game
            </h2>
            <p className="mt-1 text-slate-600">Each round gives you two guesses.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Estimation games">
          {games.map(({ id, title, description, Icon }) => (
            <button
              aria-label={title}
              className={`${cardClass} group flex min-h-44 flex-col items-start justify-between p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-[0_18px_38px_rgba(37,99,235,0.13)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300`}
              key={id}
              onClick={() => onChooseGame(id)}
              type="button"
            >
              <span className={iconTileClass}>
                <Icon aria-hidden="true" size={24} strokeWidth={2} />
              </span>
              <span>
                <span className="block text-lg font-black text-slate-950">{title}</span>
                <span className="mt-2 block text-sm leading-5 text-slate-600">{description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function GamePage({ gameId, onBack }: { gameId: GameId; onBack: () => void }) {
  const game = gameMap.get(gameId) ?? games[0]

  return (
    <main className={shellClass}>
      <button className={`${secondaryButtonClass} w-fit`} onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={18} />
        Back
      </button>

      <header className="mt-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <span className={iconTileClass}>
            <game.Icon aria-hidden="true" size={24} strokeWidth={2} />
          </span>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700">{game.title}</p>
        </div>
        <h1 className="mt-4 text-lg font-semibold leading-snug text-slate-700 sm:text-xl lg:max-w-none">
          {game.description}
        </h1>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GameStage gameId={gameId} game={game} />
      </section>
    </main>
  )
}

function GameStage({ gameId, game }: { gameId: GameId; game: GameInfo }) {
  if (gameId === 'angles') {
    return <AnglesGame game={game} />
  }
  if (gameId === 'lines') {
    return <LinesGame game={game} />
  }
  if (gameId === 'velocity') {
    return <VelocityGame game={game} />
  }
  if (gameId === 'projectiles') {
    return <ProjectilesGame game={game} />
  }
  return <TimeGame game={game} />
}

function AnglesGame({ game }: { game: GameInfo }) {
  const [trial, setTrial] = useState<AngleTrial | null>(null)
  const [roundDone, setRoundDone] = useState(false)

  function play() {
    setTrial(createAngleTrial())
    setRoundDone(false)
  }

  return (
    <>
      <StageCard>{trial ? <AngleStage trial={trial} /> : <ReadyState game={game} />}</StageCard>
      <SidePanel
        game={game}
        onPlay={play}
        playLabel={trial ? 'Play again' : 'Play'}
        showPlay={!trial || roundDone}
      >
        {trial && (
          <GuessPanel
            key={trial.id}
            answer={trial.answer}
            decimals={0}
            label="Angle"
            max={179}
            min={1}
            onDone={() => setRoundDone(true)}
            step={1}
            suffix="degrees"
          />
        )}
      </SidePanel>
    </>
  )
}

function LinesGame({ game }: { game: GameInfo }) {
  const [trial, setTrial] = useState<LineTrial | null>(null)
  const [roundDone, setRoundDone] = useState(false)

  function play() {
    setTrial(createLineTrial())
    setRoundDone(false)
  }

  return (
    <>
      <StageCard>{trial ? <LineStage trial={trial} /> : <ReadyState game={game} />}</StageCard>
      <SidePanel
        game={game}
        onPlay={play}
        playLabel={trial ? 'Play again' : 'Play'}
        showPlay={!trial || roundDone}
      >
        {trial && (
          <GuessPanel
            key={trial.id}
            answer={trial.answer}
            decimals={0}
            label="Length"
            max={90}
            min={10}
            onDone={() => setRoundDone(true)}
            step={1}
            suffix="%"
          />
        )}
      </SidePanel>
    </>
  )
}

function VelocityGame({ game }: { game: GameInfo }) {
  const [trial, setTrial] = useState<VelocityTrial | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('ready')
  const [roundDone, setRoundDone] = useState(false)

  function play() {
    setTrial(createVelocityTrial())
    setPhase('playing')
    setRoundDone(false)
  }

  return (
    <>
      <StageCard>
        {trial ? (
          <VelocityStage
            key={trial.id}
            phase={phase}
            trial={trial}
            onComplete={() => setPhase('guessing')}
          />
        ) : (
          <ReadyState game={game} />
        )}
      </StageCard>
      <SidePanel
        game={game}
        onPlay={play}
        playLabel={trial ? 'Play again' : 'Play'}
        showPlay={!trial || roundDone}
      >
        {phase === 'playing' && (
          <p className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-blue-800">
            Watch both crossings. The response box will appear when the motion ends.
          </p>
        )}
        {trial && phase === 'guessing' && (
          <GuessPanel
            key={trial.id}
            answer={trial.answer}
            decimals={0}
            label="Speed"
            max={500}
            min={100}
            onDone={() => setRoundDone(true)}
            step={1}
            suffix="%"
          />
        )}
      </SidePanel>
    </>
  )
}

function ProjectilesGame({ game }: { game: GameInfo }) {
  const [trial, setTrial] = useState<ProjectileTrial | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('ready')
  const [roundDone, setRoundDone] = useState(false)

  function play() {
    setTrial(createProjectileTrial())
    setPhase('playing')
    setRoundDone(false)
  }

  return (
    <>
      <StageCard>
        {trial ? (
          <ProjectileStage
            key={trial.id}
            phase={phase}
            trial={trial}
            onComplete={() => setPhase('guessing')}
          />
        ) : (
          <ReadyState game={game} />
        )}
      </StageCard>
      <SidePanel
        game={game}
        onPlay={play}
        playLabel={trial ? 'Play again' : 'Play'}
        showPlay={!trial || roundDone}
      >
        {phase === 'playing' && (
          <p className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-blue-800">
            Watch the baseline shot, then the mystery gravity shot.
          </p>
        )}
        {trial && phase === 'guessing' && (
          <GuessPanel
            key={trial.id}
            answer={trial.answer}
            decimals={1}
            example="1.2"
            label="Gravity"
            max={4}
            min={0.5}
            onDone={() => setRoundDone(true)}
            step={0.1}
            suffix="x"
          />
        )}
      </SidePanel>
    </>
  )
}

function TimeGame({ game }: { game: GameInfo }) {
  const [trial, setTrial] = useState<TimeTrial | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('ready')
  const [roundDone, setRoundDone] = useState(false)

  function play() {
    setTrial(createTimeTrial())
    setPhase('playing')
    setRoundDone(false)
  }

  return (
    <>
      <StageCard>
        {trial ? (
          <TimeStage
            key={trial.id}
            phase={phase}
            trial={trial}
            onComplete={() => setPhase('guessing')}
          />
        ) : (
          <ReadyState game={game} />
        )}
      </StageCard>
      <SidePanel
        game={game}
        onPlay={play}
        playLabel={trial ? 'Play again' : 'Play'}
        showPlay={!trial || roundDone}
      >
        {phase === 'playing' && (
          <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Watch the green circle. The response box will appear after it shuts off.
          </p>
        )}
        {trial && phase === 'guessing' && (
          <GuessPanel
            key={trial.id}
            answer={trial.answer}
            decimals={2}
            label="Time"
            max={5}
            min={1}
            onDone={() => setRoundDone(true)}
            step={0.01}
            suffix="seconds"
          />
        )}
      </SidePanel>
    </>
  )
}

function StageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cardClass} min-h-[360px] overflow-hidden p-4 sm:p-6`}>
      <div className="grid h-full min-h-[320px] place-items-center rounded-lg border border-slate-200 bg-white/75">
        {children}
      </div>
    </div>
  )
}

function ReadyState({ game }: { game: GameInfo }) {
  return (
    <div className="max-w-sm p-6 text-center">
      <span className={`${iconTileClass} mx-auto`}>
        <game.Icon aria-hidden="true" size={24} strokeWidth={2} />
      </span>
      <p className="mt-4 text-lg font-black text-slate-950">Ready for {game.title}?</p>
      <p className="mt-2 text-sm text-slate-600">Press Play when you are ready.</p>
    </div>
  )
}

function SidePanel({
  children,
  game,
  onPlay,
  playLabel,
  showPlay,
}: {
  children: React.ReactNode
  game: GameInfo
  onPlay: () => void
  playLabel: string
  showPlay: boolean
}) {
  return (
    <aside className={`${panelClass} h-fit`}>
      <p className="text-sm font-black uppercase tracking-wide text-slate-500">Prompt</p>
      <p className="mt-2 text-base font-semibold text-slate-900">{game.hint}</p>
      <div className="mt-5 space-y-4">
        {showPlay && (
          <button className={primaryButtonClass} onClick={onPlay} type="button">
            <Play aria-hidden="true" size={18} fill="currentColor" />
            {playLabel}
          </button>
        )}
        {children}
      </div>
    </aside>
  )
}

function GuessPanel({
  answer,
  decimals,
  example,
  label,
  max,
  min,
  onDone,
  step,
  suffix,
}: {
  answer: number
  decimals: number
  example?: string
  label: string
  max: number
  min: number
  onDone: () => void
  step: number
  suffix: string
}) {
  const [draft, setDraft] = useState('')
  const [guesses, setGuesses] = useState<number[]>([])
  const [message, setMessage] = useState('You have two guesses.')
  const [tone, setTone] = useState<GuessTone>('neutral')
  const [done, setDone] = useState(false)

  function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      return
    }

    const guess = normalizeNumber(parsed, decimals)
    const isCorrect = isSameAnswer(guess, answer, decimals)
    const nextGuesses = [...guesses, guess]

    setGuesses(nextGuesses)
    setDraft('')

    if (isCorrect) {
      setMessage(`Nice! You nailed it. The answer is ${formatAnswer(answer, decimals, suffix)}.`)
      setTone('correct')
      setDone(true)
      onDone()
      return
    }

    if (nextGuesses.length === 1) {
      setMessage(`The true answer is ${answer > guess ? 'higher' : 'lower'}.`)
      setTone('hint')
      return
    }

    setMessage(`Not quite. The answer was ${formatAnswer(answer, decimals, suffix)}.`)
    setTone('wrong')
    setDone(true)
    onDone()
  }

  return (
    <form
      className={`rounded-lg border p-4 transition ${guessPanelToneClass(tone)}`}
      noValidate
      onSubmit={submitGuess}
    >
      <label className="text-sm font-bold text-slate-700" htmlFor="guess-input">
        {label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
          disabled={done}
          id="guess-input"
          inputMode={decimals === 0 ? 'numeric' : 'decimal'}
          max={max}
          min={min}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={example ?? (decimals === 0 ? '42' : '1.25')}
          step={step}
          type="number"
          value={draft}
        />
        <button className={secondaryButtonClass} disabled={done || draft === ''} type="submit">
          Guess
        </button>
      </div>
      <p className={`mt-3 text-sm font-bold ${guessMessageToneClass(tone)}`}>{message}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Guesses used: {guesses.length}/2
      </p>
    </form>
  )
}

function AngleStage({ trial }: { trial: AngleTrial }) {
  const center = { x: 260, y: 150 }
  const radius = 82
  const first = polarPoint(center.x, center.y, 125, trial.startDeg)
  const second = polarPoint(center.x, center.y, 125, trial.startDeg + trial.sweepDeg)
  const arcStart = polarPoint(center.x, center.y, radius, trial.startDeg)
  const arcEnd = polarPoint(center.x, center.y, radius, trial.startDeg + trial.sweepDeg)
  const sweepFlag = trial.sweepDeg > 0 ? 1 : 0

  return (
    <svg className="h-full w-full max-w-2xl" viewBox="0 0 520 300" role="img">
      <BoardGrid />
      <path
        d={`M ${center.x} ${center.y} L ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${arcEnd.x} ${arcEnd.y} Z`}
        fill="rgba(245,158,11,0.18)"
        stroke="#f59e0b"
        strokeWidth="2"
      />
      <line
        stroke="#111827"
        strokeLinecap="round"
        strokeWidth="4"
        x1={center.x}
        x2={first.x}
        y1={center.y}
        y2={first.y}
      />
      <line
        stroke="#2563eb"
        strokeLinecap="round"
        strokeWidth="4"
        x1={center.x}
        x2={second.x}
        y1={center.y}
        y2={second.y}
      />
      <circle cx={center.x} cy={center.y} fill="#111827" r="4" />
    </svg>
  )
}

function LineStage({ trial }: { trial: LineTrial }) {
  const longLength = 360
  const shortLength = Math.round((longLength * trial.answer) / 100)
  const centerX = 260

  return (
    <svg className="h-full w-full max-w-2xl" viewBox="0 0 520 300" role="img">
      <BoardGrid showGrid={false} />
      <g transform={`rotate(${trial.rotation} ${centerX} 150)`}>
        <line
          stroke="#111827"
          strokeLinecap="round"
          strokeWidth="5"
          x1={centerX - longLength / 2}
          x2={centerX + longLength / 2}
          y1="120"
          y2="120"
        />
        <line
          stroke="#0f8b8d"
          strokeLinecap="round"
          strokeWidth="5"
          x1={centerX - shortLength / 2}
          x2={centerX + shortLength / 2}
          y1="184"
          y2="184"
        />
      </g>
    </svg>
  )
}

function VelocityStage({
  onComplete,
  phase,
  trial,
}: {
  onComplete: () => void
  phase: MotionPhase
  trial: VelocityTrial
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    const start = performance.now()
    const gapMs = 450
    const totalMs = trial.firstDurationMs + gapMs + trial.secondDurationMs
    let frame = 0
    let completed = false

    function tick(now: number) {
      const nextElapsed = Math.min(now - start, totalMs)
      setElapsed(nextElapsed)

      if (nextElapsed >= totalMs) {
        if (!completed) {
          completed = true
          onComplete()
        }
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onComplete, phase, trial])

  const gapMs = 450
  const firstProgress = clamp(elapsed / trial.firstDurationMs)
  const secondElapsed = elapsed - trial.firstDurationMs - gapMs
  const secondProgress = clamp(secondElapsed / trial.secondDurationMs)
  const showSecond = secondElapsed >= 0 || phase === 'guessing'

  return (
    <svg className="h-full w-full max-w-2xl" viewBox="0 0 520 300" role="img">
      <BoardGrid />
      <Track y={105} />
      <Track y={190} />
      <text className="fill-slate-500 text-sm font-bold" x="52" y="74">
        Baseline
      </text>
      <text className="fill-slate-500 text-sm font-bold" x="52" y="159">
        Mystery
      </text>
      <circle cx={trackX(firstProgress)} cy="105" fill="#2563eb" r="9" />
      {showSecond && <circle cx={trackX(secondProgress)} cy="190" fill="#ef476f" r="9" />}
    </svg>
  )
}

function ProjectileStage({
  onComplete,
  phase,
  trial,
}: {
  onComplete: () => void
  phase: MotionPhase
  trial: ProjectileTrial
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    const start = performance.now()
    const flightMs = 2300
    const gapMs = 550
    const totalMs = flightMs * 2 + gapMs
    let frame = 0
    let completed = false

    function tick(now: number) {
      const nextElapsed = Math.min(now - start, totalMs)
      setElapsed(nextElapsed)

      if (nextElapsed >= totalMs) {
        if (!completed) {
          completed = true
          onComplete()
        }
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onComplete, phase, trial.id])

  const flightMs = 2300
  const gapMs = 550
  const baselineProgress = clamp(elapsed / flightMs)
  const mysteryElapsed = elapsed - flightMs - gapMs
  const mysteryProgress = clamp(mysteryElapsed / flightMs)
  const showMystery = mysteryElapsed >= 0 || phase === 'guessing'
  const baselineCurrent = projectilePoint(1, baselineProgress)
  const mysteryCurrent = projectilePoint(trial.answer, mysteryProgress)

  return (
    <svg className="h-full w-full max-w-2xl" viewBox="0 0 520 300" role="img">
      <BoardGrid />
      <line
        stroke="#cbd5e1"
        strokeLinecap="round"
        strokeWidth="2"
        x1="72"
        x2="448"
        y1="236"
        y2="236"
      />
      <circle cx={baselineCurrent.x} cy={baselineCurrent.y} fill="#2563eb" r="6" />
      {showMystery && (
        <circle cx={mysteryCurrent.x} cy={mysteryCurrent.y} fill="#ef476f" r="6" />
      )}
    </svg>
  )
}

function TimeStage({
  onComplete,
  phase,
  trial,
}: {
  onComplete: () => void
  phase: MotionPhase
  trial: TimeTrial
}) {
  const [isOn, setIsOn] = useState(false)

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    const onTimer = window.setTimeout(() => setIsOn(true), 500)
    const offTimer = window.setTimeout(() => {
      setIsOn(false)
      onComplete()
    }, 500 + trial.durationMs)

    return () => {
      window.clearTimeout(onTimer)
      window.clearTimeout(offTimer)
    }
  }, [onComplete, phase, trial.durationMs, trial.id])

  return (
    <div className="grid h-full w-full place-items-center p-8">
      <div
        className={`grid size-48 place-items-center rounded-full border-[12px] transition-all duration-300 ${
          isOn
            ? 'border-emerald-300 bg-emerald-500 shadow-[0_0_70px_rgba(16,185,129,0.45)]'
            : 'border-slate-200 bg-slate-100'
        }`}
      >
        <span className={`text-sm font-black uppercase tracking-wide ${isOn ? 'text-white' : 'text-slate-400'}`}>
          {isOn ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  )
}

function PreviewBoard() {
  return (
    <div className={`${cardClass} p-4`}>
      <svg className="block min-h-72 w-full" viewBox="0 0 460 320" role="img">
        <BoardGrid />
        <g>
          <path
            d="M82 232 L174 232 A92 92 0 0 0 147 166 Z"
            fill="rgba(245,158,11,0.18)"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <line x1="82" x2="184" y1="232" y2="232" stroke="#111827" strokeLinecap="round" strokeWidth="4" />
          <line x1="82" x2="151" y1="232" y2="160" stroke="#111827" strokeLinecap="round" strokeWidth="4" />
        </g>
        <path
          d="M210 174 C250 88 324 86 362 205"
          fill="none"
          stroke="#2563eb"
          strokeDasharray="1 16"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <circle cx="362" cy="205" fill="#ef476f" r="6" />
        <line x1="245" x2="370" y1="224" y2="224" stroke="#0f8b8d" strokeLinecap="round" strokeWidth="4" />
        <line x1="245" x2="245" y1="210" y2="238" stroke="#0f8b8d" strokeLinecap="round" strokeWidth="4" />
        <line x1="370" x2="370" y1="210" y2="238" stroke="#0f8b8d" strokeLinecap="round" strokeWidth="4" />
        <circle cx="348" cy="106" fill="rgba(15,139,141,0.08)" r="42" stroke="#0f8b8d" strokeWidth="3" />
        <path d="M348 106 L348 74 M348 106 L375 121" stroke="#0f8b8d" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </div>
  )
}

function BoardGrid({ showGrid = true }: { showGrid?: boolean }) {
  return (
    <>
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="rgba(91,100,116,0.16)" />
        </pattern>
      </defs>
      <rect fill="#fff" height="100%" rx="14" width="100%" />
      {showGrid && <rect fill="url(#grid)" height="100%" opacity="0.9" rx="14" width="100%" />}
      <rect fill="none" height="100%" rx="14" stroke="#d9dee8" strokeWidth="2" width="100%" />
    </>
  )
}

function Track({ y }: { y: number }) {
  return (
    <>
      <line stroke="#cbd5e1" strokeLinecap="round" strokeWidth="4" x1="54" x2="466" y1={y} y2={y} />
      <line stroke="#94a3b8" strokeLinecap="round" strokeWidth="2" x1="54" x2="54" y1={y - 18} y2={y + 18} />
      <line stroke="#94a3b8" strokeLinecap="round" strokeWidth="2" x1="466" x2="466" y1={y - 18} y2={y + 18} />
    </>
  )
}

function readPageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return isGameId(hash) ? hash : 'home'
}

function isGameId(value: string): value is GameId {
  return games.some((game) => game.id === value)
}

function createAngleTrial(): AngleTrial {
  const answer = randomInt(15, 165)
  const direction = Math.random() > 0.5 ? 1 : -1
  return {
    id: Date.now(),
    answer,
    startDeg: randomInt(0, 359),
    sweepDeg: answer * direction,
  }
}

function createLineTrial(): LineTrial {
  return {
    id: Date.now(),
    answer: randomInt(10, 90),
    rotation: randomInt(-10, 10),
  }
}

function createVelocityTrial(): VelocityTrial {
  const firstDurationMs = randomInt(3000, 4000)
  const answer = randomInt(125, 400)

  return {
    id: Date.now(),
    answer,
    firstDurationMs,
    secondDurationMs: Math.round((firstDurationMs * 100) / answer),
  }
}

function createProjectileTrial(): ProjectileTrial {
  const options = Array.from({ length: 36 }, (_, index) => (index + 5) / 10).filter(
    (value) => value !== 1,
  )

  return {
    id: Date.now(),
    answer: options[randomInt(0, options.length - 1)],
  }
}

function createTimeTrial(): TimeTrial {
  const durationMs = randomInt(100, 500) * 10

  return {
    id: Date.now(),
    answer: durationMs / 1000,
    durationMs,
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function normalizeNumber(value: number, decimals: number) {
  const multiplier = 10 ** decimals
  return Math.round(value * multiplier) / multiplier
}

function isSameAnswer(guess: number, answer: number, decimals: number) {
  return Math.abs(guess - answer) < 1 / 10 ** (decimals + 1)
}

function formatAnswer(answer: number, decimals: number, suffix: string) {
  const value = answer.toFixed(decimals)
  return suffix === '%' || suffix === 'x' ? `${value}${suffix}` : `${value} ${suffix}`
}

function guessPanelToneClass(tone: GuessTone) {
  if (tone === 'correct') {
    return 'border-emerald-300 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
  }
  if (tone === 'wrong') {
    return 'border-rose-300 bg-rose-50 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
  }
  if (tone === 'hint') {
    return 'border-amber-300 bg-amber-50'
  }
  return 'border-slate-200 bg-slate-50'
}

function guessMessageToneClass(tone: GuessTone) {
  if (tone === 'correct') {
    return 'text-emerald-800'
  }
  if (tone === 'wrong') {
    return 'text-rose-800'
  }
  if (tone === 'hint') {
    return 'text-amber-800'
  }
  return 'text-slate-700'
}

function polarPoint(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy + Math.sin(radians) * radius,
  }
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1)
}

function trackX(progress: number) {
  return 54 + progress * 412
}

function projectilePoint(gravityFactor: number, progress: number) {
  const groundY = 236
  const start = Matter.Vector.create(96, groundY)
  const velocity = Matter.Vector.create(240, -250)
  const gravity = Matter.Vector.create(0, 250 * gravityFactor)
  const impactProgress = gravityFactor >= 1 ? 1 / gravityFactor : 1
  const t = Math.min(progress, impactProgress)
  const linear = Matter.Vector.mult(velocity, t)
  const acceleration = Matter.Vector.mult(gravity, t * t)
  const position = Matter.Vector.add(start, Matter.Vector.add(linear, acceleration))

  return {
    x: position.x,
    y: Math.min(Math.max(position.y, 42), groundY),
  }
}

export default App
