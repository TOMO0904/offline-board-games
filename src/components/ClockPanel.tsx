import { playerName } from '../games'
import type { GameId, Player } from '../games/core/types'
import { timeLabel, type GameClock } from '../games/core/clock'
const display = (ms: number) => {
  const sec = Math.ceil(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
export function ClockPanel({ clock, game }: { clock: GameClock; game: GameId }) {
  if (!clock.enabled) return null
  const c = clock.snapshot()
  return (
    <section className="clock-panel" aria-label="対局時計">
      <p className="small muted">
        {timeLabel(c.config)}
        {!c.running && c.expired === null ? '・停止中' : ''}
      </p>
      <div className="clocks">
        {([0, 1] as Player[]).map((p) => (
          <div
            key={p}
            className={`clock ${p === c.turn && c.running ? 'active' : ''} ${c.expired === p ? 'expired' : ''}`}
          >
            <span>{playerName(game, p)}</span>
            <strong aria-label={`${playerName(game, p)} 残り時間`}>
              {display(c.remaining[p] || (p === c.turn ? c.period : c.config.byoyomi * 1000))}
            </strong>
            {c.config.byoyomi > 0 && c.remaining[p] === 0 && <small>秒読み</small>}
          </div>
        ))}
      </div>
      {c.expired !== null && <p role="status">{playerName(game, c.expired)}の時間切れ</p>}
    </section>
  )
}
