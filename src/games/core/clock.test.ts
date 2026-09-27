import { describe, expect, it } from 'vitest'
import { GameClock, noClock, validClock, validTime } from './clock'
describe('対局時計', () => {
  it('10分の持ち時間、交代、時間切れを実経過で計算', () => {
    let now = 0
    const c = new GameClock({ minutes: 10, increment: 0, byoyomi: 0 }, () => now)
    c.start()
    now = 10000
    c.move(1)
    expect(c.snapshot().remaining).toEqual([590000, 600000])
    now = 610000
    expect(c.check()).toBe(1)
    expect(c.running).toBe(false)
  })
  it('加算は指し手1回ごと、同じ手番へのパスも加算', () => {
    let now = 0
    const c = new GameClock({ minutes: 5, increment: 3, byoyomi: 0 }, () => now)
    c.start()
    now = 5000
    c.move(0)
    expect(c.snapshot().remaining[0]).toBe(298000)
    expect(c.turn).toBe(0)
  })
  it('秒読みは主時間の超過を差し引き、指した後に回復', () => {
    let now = 0
    const c = new GameClock({ minutes: 1, increment: 0, byoyomi: 30 }, () => now)
    c.start()
    now = 75000
    expect(c.snapshot().period).toBe(15000)
    c.move(1)
    now = 80000
    c.move(0)
    expect(c.snapshot().period).toBe(30000)
    now = 110000
    expect(c.check()).toBe(0)
  })
  it('一時停止と復旧は端末間の時刻差に依存しない', () => {
    let now = 0
    const c = new GameClock({ minutes: 10, increment: 0, byoyomi: 0 }, () => now)
    c.start()
    now = 12000
    c.pause()
    now = 900000
    expect(c.snapshot().remaining[0]).toBe(588000)
    c.start()
    const remote = new GameClock(noClock, () => 50)
    remote.restore(c.snapshot())
    expect(remote.snapshot().remaining).toEqual(c.snapshot().remaining)
  })
  it('期限以後の指し手を拒否し、再戦でリセット', () => {
    let now = 0
    const c = new GameClock({ minutes: 1, increment: 0, byoyomi: 0 }, () => now)
    c.start()
    now = 60001
    expect(c.move(1)).toBe(false)
    c.reset()
    expect(c.expired).toBeNull()
    expect(c.snapshot().remaining).toEqual([60000, 60000])
  })
  it('無制限と受信値の検証', () => {
    const c = new GameClock()
    c.start()
    expect(c.enabled).toBe(false)
    expect(c.check()).toBeNull()
    expect(validClock(c.snapshot())).toBe(true)
    expect(validTime({ minutes: 10, increment: 3, byoyomi: 30 })).toBe(false)
    expect(validClock({ ...c.snapshot(), remaining: [NaN, 1] })).toBe(false)
  })
})
