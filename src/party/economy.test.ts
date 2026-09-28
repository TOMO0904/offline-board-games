import { describe, it, expect } from 'vitest'
import { createParty, applyParty, partyView } from './engine'
import { L, M, stat, setStat, assetValue, homes, contracts } from './economy'
import { economyIds } from './economyCatalog'
import { isPartyId } from './catalog'
import { applyDelta, diffView, validateView } from './protocol'
import { PartyHost, PartyGuest } from './room'
import type { PartyState, PartyAction } from './types'
const names = (n = 3) => Array.from({ length: n }, (_, i) => `P${i + 1}`)
function seeded(seed = 8) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
const act = (s: PartyState, a: PartyAction, rng = () => 0) => applyParty(s, s.turn, a, rng)
function life() {
  return act(createParty('life-journey', names()), { type: 'choose', index: 0 })
}
describe('ライフジャーニーの選択と精算', () => {
  it('削除したゲームは新規作成・通信のカタログで受け付けない', () => {
    for (const id of ['high-low', 'rps', 'count-21', 'number-mine', 'charades', 'tic-tac-toe'])
      expect(isPartyId(id)).toBe(false)
  })
  it('進学は20万、専門職への転職は学歴必須', () => {
    let s = createParty('life-journey', names())
    s = act(s, { type: 'choose', index: 1 })
    expect(s.scores[0]).toBe(10)
    expect(stat(s, 0, L.education)).toBe(1)
    expect(stat(s, 0, L.job)).toBe(2)
    s = life()
    s.phase = 'challenge'
    s.board = [1]
    expect(() => act(s, { type: 'choose', index: 2 })).toThrow(/進学/)
    expect(() => act(s, { type: 'choose', index: 135 })).toThrow()
  })
  it('借入と利息と自動返済を分け、負の現金にしない', () => {
    let s = life()
    s.phase = 'challenge'
    s.board = [2]
    s.scores[0] = 5
    s = act(s, { type: 'choose', index: 3 })
    expect(stat(s, 0, L.debt)).toBe(65)
    expect(s.scores[0]).toBe(0)
    expect(assetValue(s, 0)).toBe(21)
    s.phase = 'play'
    setStat(s, 0, L.position, 5)
    s = act(s, { type: 'roll' })
    expect(s.scores[0]).toBe(0)
    expect(stat(s, 0, L.debt)).toBe(66)
    expect(s.info).toContain('利息7万')
    s.scores[0] = 30
    s.phase = 'play'
    setStat(s, 0, L.position, 11)
    s = act(s, { type: 'roll' })
    expect(stat(s, 0, L.debt)).toBe(56)
    expect(s.scores[0]).toBe(19)
  })
  it('住宅の下取り、同じ家の選択、経験評価で資産を計算', () => {
    let s = life()
    s.phase = 'challenge'
    s.board = [2]
    s = act(s, { type: 'choose', index: 1 })
    expect(s.scores[0]).toBe(5)
    s.phase = 'challenge'
    s = act(s, { type: 'choose', index: 1 })
    expect(s.scores[0]).toBe(5)
    s.phase = 'challenge'
    s = act(s, { type: 'choose', index: 2 })
    expect(s.scores[0]).toBe(0)
    expect(stat(s, 0, L.debt)).toBe(10)
    setStat(s, 0, L.joy, 2)
    expect(assetValue(s, 0)).toBe(homes[2].value + 6 - 10)
  })
  it('12と24の分岐では大きい目でも停止し、給料は1回', () => {
    let s = life()
    setStat(s, 0, L.position, 11)
    s = act(s, { type: 'roll' }, () => 0.99)
    expect(stat(s, 0, L.position)).toBe(12)
    expect(s.scores[0]).toBe(36)
    expect(s.board).toEqual([5])
    s = act(s, { type: 'choose', index: 1 })
    expect(stat(s, 0, L.route)).toBe(1)
    expect(stat(s, 0, L.joy)).toBe(2)
    s.phase = 'play'
    setStat(s, 0, L.position, 23)
    s = act(s, { type: 'roll' }, () => 0.99)
    expect(stat(s, 0, L.position)).toBe(24)
  })
  it('保険はイベント支出のみ半額、波乱と挑戦の倍率も適用', () => {
    let s = life()
    s.rules.risk = true
    setStat(s, 0, L.route, 1)
    setStat(s, 0, L.insured, 1)
    setStat(s, 0, L.position, 2)
    const rolls = [0, 2.1 / 12]
    s = act(s, { type: 'roll' }, () => rolls.shift()!)
    expect(s.scores[0]).toBe(6)
    expect(s.info).toContain('支出24万')
  })
  it('挑戦の投資の確率境界、昇進上限、保険二重購入を裁定', () => {
    const s = life()
    s.phase = 'challenge'
    s.board = [3]
    setStat(s, 0, L.route, 1)
    expect(act(s, { type: 'choose', index: 1 }, () => 0.59).scores[0]).toBe(46)
    expect(act(s, { type: 'choose', index: 1 }, () => 0.6).scores[0]).toBe(22)
    s.board = [1]
    setStat(s, 0, L.level, 3)
    expect(() => act(s, { type: 'choose', index: 4 })).toThrow()
    s.board = [4]
    setStat(s, 0, L.insured, 1)
    expect(() => act(s, { type: 'choose', index: 1 })).toThrow()
  })
  it('ゴールした人を飛ばし、全員到着で借金込み順位・同順位', () => {
    let s = life()
    s.names.forEach((_, p) => {
      setStat(s, p, L.job, 0)
      setStat(s, p, L.position, 36)
      setStat(s, p, L.finished, 1)
    })
    s.phase = 'reveal'
    s.scores = [0, 20, 20]
    setStat(s, 0, L.debt, 30)
    s = act(s, { type: 'next' })
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([1, 2])
    expect(assetValue(s, 0)).toBe(-30)
    s = life()
    setStat(s, 1, L.position, 36)
    setStat(s, 1, L.finished, 1)
    s.phase = 'reveal'
    s = act(s, { type: 'next' })
    expect(s.turn).toBe(2)
  })
})
describe('アイランド商会の経済と全員公平なラウンド', () => {
  it('売買で現金と在庫が保存され、空売りと資金不足を拒否', () => {
    let s = createParty('island-market', names(), {}, () => 0)
    s = act(s, { type: 'buy', index: 0 })
    expect(s.scores[0]).toBe(18)
    expect(stat(s, 0, M.wood)).toBe(3)
    s = act(s, { type: 'sell', index: 0 })
    expect(s.scores[0]).toBe(20)
    expect(stat(s, 0, M.wood)).toBe(2)
    expect(s.turn).toBe(1)
    s.scores[1] = 0
    expect(() => act(s, { type: 'buy', index: 0 })).toThrow()
    setStat(s, 1, M.food, 0)
    expect(() => act(s, { type: 'sell', index: 2 })).toThrow()
  })
  it('建設で材料と費用を消費し、生産は全員の手番後にだけ行う', () => {
    let s = createParty('island-market', names(2), {}, () => 0)
    s = act(s, { type: 'build', index: 0 })
    expect(s.scores[0]).toBe(16)
    expect(stat(s, 0, M.wood)).toBe(0)
    expect(stat(s, 0, M.food)).toBe(2)
    s = act(s, { type: 'next' })
    expect(s.round).toBe(1)
    s = act(s, { type: 'next' })
    expect(s.round).toBe(2)
    expect(stat(s, 0, M.food)).toBe(4)
    setStat(s, s.turn, M.farm, 5)
    setStat(s, s.turn, M.wood, 20)
    expect(() => act(s, { type: 'build', index: 0 })).toThrow()
  })
  it('契約は一度の納品で置換、材料不足や未定義の契約を拒否', () => {
    let s = createParty('island-market', names(), {}, () => 0)
    const id = s.board[3],
      c = contracts[id]
    c.need.forEach((v, i) => setStat(s, 0, i, v))
    const before = s.stock.length
    s = act(s, { type: 'deliver', index: 0 })
    expect(s.scores[0]).toBe(20 + c.pay)
    expect(s.board[3]).not.toBe(id)
    expect(s.stock.length).toBe(before - 1)
    expect(stat(s, 0, M.contracts)).toBe(1)
    expect(() => act(s, { type: 'deliver', index: 0 })).toThrow()
    s.board[3] = -1
    expect(() => act(s, { type: 'deliver', index: 0 })).toThrow()
  })
  it('最終ラウンドも生産し、最後の価格で在庫と施設を評価', () => {
    let s = createParty('island-market', names(2), { rounds: 6 }, () => 0)
    s.round = 6
    s.turn = 1
    setStat(s, 0, M.farm, 1)
    setStat(s, 1, M.port, 1)
    s = act(s, { type: 'next' }, () => 0.99)
    expect(s.phase).toBe('finished')
    expect(stat(s, 0, M.food)).toBe(4)
    expect(s.scores[1]).toBe(20)
    expect(assetValue(s, 0)).toBe(44)
    expect(assetValue(s, 1)).toBe(50)
    expect(s.winners).toEqual([1])
  })
  it('未対応アクション・範囲外の引数・他人の操作を拒否して状態を保つ', () => {
    const s = createParty('island-market', names())
    const original = structuredClone(s)
    for (const a of [
      { type: 'roll' },
      { type: 'buy', index: 3 },
      { type: 'build', index: 99 },
      { type: 'buy', index: -1 },
    ] as PartyAction[])
      expect(() => act(s, a)).toThrow()
    expect(() => applyParty(s, 1, { type: 'next' })).toThrow()
    expect(s).toEqual(original)
  })
})
describe('経営ゲームの同期と最後までの進行', () => {
  it.each(economyIds)('%s の不正な資産・盤面・配列を拒否する', (game) => {
    const v = partyView(createParty(game, names()), 0)
    expect(validateView(v)).toBe(true)
    for (const patch of [
      { economy: [] },
      { economy: Array(v.economy.length).fill(-2) },
      { board: [999] },
      { scores: [-1, 0, 0] },
    ])
      expect(validateView({ ...v, ...patch })).toBe(false)
    expect(() => applyDelta(v, { economy: { n: 121, p: [] } })).toThrow()
  })
  it.each(economyIds)('%s を2・5・7人、異なる乱数で最後まで差分検証', (game) => {
    for (const n of [2, 5, 7])
      for (const seed of [3, 19, 83]) {
        const rng = seeded(seed)
        let s = createParty(game, names(n), { rounds: 6 }, rng),
          count = 0
        while (s.phase !== 'finished' && count++ < 1000) {
          const before = partyView(s, 0)
          let actions: PartyAction[]
          if (game === 'life-journey')
            actions =
              s.phase === 'challenge'
                ? [0, 1, 2, 3, 4]
                    .sort(() => rng() - 0.5)
                    .map((index) => ({ type: 'choose', index }))
                : [{ type: s.phase === 'reveal' ? 'next' : 'roll' }]
          else
            actions = [
              { type: 'build', index: Math.floor(rng() * 4) },
              { type: 'deliver', index: Math.floor(rng() * 3) },
              { type: rng() < 0.5 ? 'buy' : 'sell', index: Math.floor(rng() * 3) },
              { type: 'next' },
            ]
          let next: PartyState | undefined
          for (const a of actions) {
            try {
              next = applyParty(s, s.turn, a, rng)
              break
            } catch {
              /* Try another legal option. */
            }
          }
          expect(next).toBeDefined()
          s = next!
          const after = partyView(s, 0)
          expect(validateView(after)).toBe(true)
          expect(applyDelta(before, diffView(before, after))).toEqual(after)
        }
        expect(s.phase).toBe('finished')
        expect(s.winners.length).toBeGreaterThan(0)
      }
  })
  it.each(economyIds)('%s の7人通常着手は差分だけで合計8KiB未満、再同期と再戦', (game) => {
    const host = new PartyHost('economy-room-test', createParty(game, names(7)), () => 0),
      guests: PartyGuest[] = [],
      queue: (() => void)[] = [],
      traffic: string[] = []
    for (let seat = 1; seat < 7; seat++) {
      host.attach(seat, {
        open: true,
        send: (raw) => {
          traffic.push(raw)
          queue.push(() => guests[seat - 1].receive(raw))
        },
      })
      guests.push(
        new PartyGuest(host.room, seat, {
          open: true,
          send: (raw) => queue.push(() => host.receive(seat, raw)),
        }),
      )
      guests[seat - 1].opened()
    }
    const flush = () => {
      let n = 0
      while (queue.length) {
        expect(n++).toBeLessThan(150)
        queue.shift()!()
      }
    }
    flush()
    host.start()
    flush()
    traffic.length = 0
    host.act(
      0,
      game === 'life-journey' ? { type: 'choose', index: 1 } : { type: 'build', index: 0 },
    )
    flush()
    expect(traffic.every((raw) => JSON.parse(raw).t === 'delta')).toBe(true)
    expect(
      traffic.reduce((sum, raw) => sum + new TextEncoder().encode(raw).length, 0),
    ).toBeLessThan(8192)
    guests.forEach((g) => expect(g.view).toEqual(partyView(host.state, g.seat)))
    guests[0].sync()
    flush()
    expect(guests[0].view).toEqual(partyView(host.state, 1))
    host.vote(0)
    guests.forEach((g) => g.vote())
    flush()
    expect(host.state.step).toBe(0)
    guests.forEach((g) => expect(g.view).toEqual(partyView(host.state, g.seat)))
    host.receive(
      1,
      JSON.stringify({ v: 2, room: host.room, t: 'vote', seq: 0, data: { generation: 0 } }),
    )
    flush()
    expect(host.votes).toEqual([])
  })
})
