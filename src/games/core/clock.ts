import { isRecord, type Player } from './types'
export interface TimeControl {
  minutes: number
  increment: number
  byoyomi: number
}
export const noClock: TimeControl = { minutes: 0, increment: 0, byoyomi: 0 }
export function validTime(v: unknown): v is TimeControl {
  return (
    isRecord(v) &&
    [0, 1, 3, 5, 10, 15, 30, 60].includes(Number(v.minutes)) &&
    [0, 2, 3, 5, 10, 30].includes(Number(v.increment)) &&
    [0, 10, 20, 30, 60].includes(Number(v.byoyomi)) &&
    typeof v.minutes === 'number' &&
    typeof v.increment === 'number' &&
    typeof v.byoyomi === 'number' &&
    !(v.increment && v.byoyomi) &&
    !!(v.minutes || (!v.increment && !v.byoyomi))
  )
}
export interface ClockData {
  config: TimeControl
  remaining: [number, number]
  period: number
  turn: Player
  running: boolean
  expired: Player | null
}
export function validClock(v: unknown): v is ClockData {
  return (
    isRecord(v) &&
    validTime(v.config) &&
    Array.isArray(v.remaining) &&
    v.remaining.length === 2 &&
    v.remaining.every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100_000_000,
    ) &&
    typeof v.period === 'number' &&
    Number.isFinite(v.period) &&
    v.period >= 0 &&
    v.period <= v.config.byoyomi * 1000 &&
    [0, 1].includes(Number(v.turn)) &&
    typeof v.turn === 'number' &&
    typeof v.running === 'boolean' &&
    [null, 0, 1].includes(v.expired as null | number)
  )
}
export class GameClock {
  private remaining: [number, number]
  private period: number
  private anchor: number | null = null
  turn: Player = 0
  expired: Player | null = null
  constructor(
    public config: TimeControl = noClock,
    private now: () => number = () => Date.now(),
  ) {
    this.remaining = [config.minutes * 60000, config.minutes * 60000]
    this.period = config.byoyomi * 1000
  }
  get enabled() {
    return this.config.minutes > 0
  }
  get running() {
    return this.anchor !== null
  }
  snapshot(): ClockData {
    const elapsed = this.anchor === null ? 0 : Math.max(0, this.now() - this.anchor),
      remaining: [number, number] = [...this.remaining],
      main = remaining[this.turn]
    remaining[this.turn] = Math.max(0, main - elapsed)
    return {
      config: { ...this.config },
      remaining,
      period: Math.max(0, this.period - Math.max(0, elapsed - main)),
      turn: this.turn,
      running: this.running,
      expired: this.expired,
    }
  }
  restore(data: ClockData) {
    this.config = { ...data.config }
    this.remaining = [...data.remaining]
    this.period = data.period
    this.turn = data.turn
    this.expired = data.expired
    this.anchor = data.running && this.enabled && data.expired === null ? this.now() : null
  }
  private settle() {
    const s = this.snapshot()
    this.remaining = s.remaining
    this.period = s.period
    if (this.running) this.anchor = this.now()
  }
  start(turn = this.turn) {
    if (this.enabled && this.expired === null && !this.running) {
      this.turn = turn
      this.anchor = this.now()
    }
  }
  pause() {
    this.check()
    this.settle()
    this.anchor = null
  }
  check() {
    if (this.enabled && this.running && this.expired === null) {
      const s = this.snapshot()
      if (s.remaining[this.turn] + s.period <= 0) {
        this.expired = this.turn
        this.settle()
        this.anchor = null
      }
    }
    return this.expired
  }
  move(next: Player) {
    if (this.check() !== null) return false
    this.settle()
    if (this.enabled) this.remaining[this.turn] += this.config.increment * 1000
    this.turn = next
    this.period = this.config.byoyomi * 1000
    if (this.running) this.anchor = this.now()
    return true
  }
  reset() {
    this.remaining = [this.config.minutes * 60000, this.config.minutes * 60000]
    this.period = this.config.byoyomi * 1000
    this.turn = 0
    this.expired = null
    this.anchor = null
  }
}
export function timeLabel(c: TimeControl) {
  return !c.minutes
    ? '持ち時間なし'
    : `${c.minutes}分${c.increment ? ` ＋1手${c.increment}秒加算` : c.byoyomi ? ` ／使い切ったら1手${c.byoyomi}秒` : '切れ負け'}`
}
