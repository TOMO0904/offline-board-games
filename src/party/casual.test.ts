import { describe, expect, it } from 'vitest'
import { createParty, applyParty, partyView, validateAction } from './engine'
import { winningTypes, mahjongWaits, canRon } from './mahjong'
import { hitBlow } from './casual'
import { casualIds } from './casualCatalog'
import { partyCatalog, type PartyId } from './catalog'
import { applyDelta, diffView, validateView } from './protocol'
import { PartyHost, PartyGuest } from './room'
import type { PartyState, PartyAction } from './types'

function rng(seed = 182) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`)
const create = (game: PartyId, n = 3, rules = {}) => createParty(game, names(n), rules, rng())
const act = (s: PartyState, a: PartyAction) => applyParty(s, s.turn, a, rng())
function tiles(types: number[]) {
  const seen = Array<number>(34).fill(0)
  return types.map((t) => t * 4 + seen[t]++)
}
const ready = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 4, 5]

describe('かんたん麻雀の形・進行・秘密情報', () => {
  it('4面子1雀頭、刻子と順子が重なる形を判定する', () => {
    expect(winningTypes([...ready, 3])).toBe(true)
    expect(winningTypes([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4])).toBe(true)
    expect(winningTypes([0, 1, 2, 3, 4, 5, 9, 10, 11, 27, 27, 27, 28, 28])).toBe(true)
    expect(winningTypes([...ready, 7])).toBe(false)
  })
  it('七対子は7種類、国士無双は13種類と対子', () => {
    expect(winningTypes([0, 0, 2, 2, 9, 9, 18, 18, 27, 27, 30, 30, 33, 33])).toBe(true)
    expect(winningTypes([0, 0, 0, 0, 9, 9, 18, 18, 27, 27, 30, 30, 33, 33])).toBe(false)
    expect(winningTypes([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33])).toBe(true)
    expect(winningTypes([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 32, 32])).toBe(false)
  })
  it('字牌の連番・色をまたぐ連番・5枚使い・不正値を拒否', () => {
    for (const bad of [
      [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 29, 33, 33],
      [7, 8, 9, 12, 13, 14, 18, 19, 20, 27, 27, 27, 33, 33],
      [0, 0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 33],
      [...ready, 34],
      [...ready, NaN],
      ready,
    ])
      expect(winningTypes(bad)).toBe(false)
  })
  it('待ちの片方を自分で捨てたら全待ちでフリテン', () => {
    const s = create('mini-mahjong')
    s.hands[1] = tiles(ready)
    expect(mahjongWaits(s.hands[1])).toEqual([3, 6])
    expect(canRon(s, 1, 6 * 4)).toBe(true)
    s.board = [3 * 4]
    s.trickPlayers = [1]
    expect(canRon(s, 1, 6 * 4)).toBe(false)
    s.trickPlayers = [2]
    expect(canRon(s, 1, 6 * 4)).toBe(true)
  })
  it('字牌OFFの配牌で108枚を保存し、ツモ牌を他人へ送らない', () => {
    const s = create('mini-mahjong', 4, { honors: false })
    const all = [...s.stock, ...s.hands.flat()]
    expect(new Set(all).size).toBe(108)
    expect(all.every((t) => t < 108)).toBe(true)
    expect(s.hands.map((h) => h.length)).toEqual([14, 13, 13, 13])
    expect(partyView(s, 1).selected).toEqual([])
    expect(partyView(s, 0).selected).toHaveLength(1)
    expect(partyView(s, 1)).not.toHaveProperty('stock')
  })
  it('不正な捨て牌を拒否し、捨てる→次の人が引くを保存', () => {
    const s = create('mini-mahjong', 4),
      tile = s.hands[0][0]
    expect(() => act(s, { type: 'discard', index: s.stock[0] })).toThrow()
    const next = act(s, { type: 'discard', index: tile })
    expect(s.board).toEqual([])
    expect(next.board).toEqual([tile])
    expect(next.hands.map((h) => h.length)).toEqual([13, 14, 13, 13])
    expect(new Set([...next.stock, ...next.hands.flat(), ...next.board]).size).toBe(136)
  })
  it('ロンを自動で確定し、手牌を公開する', () => {
    const s = create('mini-mahjong')
    s.hands[1] = tiles(ready)
    s.hands[0][0] = 24
    const next = act(s, { type: 'discard', index: 24 })
    expect(next.phase).toBe('finished')
    expect(next.winners).toEqual([1])
    expect(next.scores[1]).toBe(1)
    expect(next.table).toHaveLength(14)
  })
  it('フリテンでも自分で引けばツモ、山切れは流局', () => {
    const s = create('mini-mahjong', 2)
    s.hands[1] = tiles(ready)
    s.stock = [24]
    s.board = [12]
    s.trickPlayers = [1]
    s.hands[0][0] = 132
    const next = act(s, { type: 'discard', index: 132 })
    expect(next.info).toContain('ツモ')
    expect(next.winners).toEqual([1])
    s.stock = []
    expect(act(s, { type: 'discard', index: 132 }).info).toContain('流局')
  })
  it('複数局では得点を引き継ぎ開始席を交代', () => {
    const s = create('mini-mahjong', 3, { rounds: 4 })
    s.phase = 'round-end'
    s.scores = [1, 0, 0]
    const next = act(s, { type: 'next' })
    expect(next.round).toBe(1)
    expect(next.turn).toBe(1)
    expect(next.scores).toEqual([1, 0, 0])
    expect(next.board).toEqual([])
  })
})

describe('会話・推理・短時間ゲーム', () => {
  it('ヒットとブロー、重複禁止、全員成功・回数切れを判定', () => {
    expect(hitBlow([1, 2, 3], [1, 3, 4])).toEqual([1, 1])
    let s = create('hit-blow', 3, { attempts: 8 })
    s.stock = [1, 2, 3]
    expect(() => act(s, { type: 'guess', cards: [1, 1, 2] })).toThrow()
    expect(() => act(s, { type: 'guess', cards: [0, 2, 3] })).toThrow()
    expect(partyView(s, 0).table).toEqual([])
    expect(act(s, { type: 'guess', cards: [1, 2, 3] }).winners).toEqual([0, 1, 2])
    for (let i = 0; i < 8; i++) s = act(s, { type: 'guess', cards: [4, 5, 6] })
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([])
    expect(s.table).toEqual([1, 2, 3])
  })
  it('ハイローはAが最小、同値は0点、全員の回数が同じ', () => {
    let s = create('high-low', 2, { rounds: 1 })
    s.table = [0]
    s.stock = [12]
    s = act(s, { type: 'guess', index: 1 })
    expect(s.scores).toEqual([1, 0])
    expect(s.table).toEqual([0, 12])
    s = act(s, { type: 'next' })
    s.stock = [25]
    s = act(s, { type: 'guess', index: 0 })
    expect(s.scores).toEqual([1, 0])
    expect(s.info).toContain('同じ')
    s = act(s, { type: 'next' })
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([0])
  })
  it('地雷は範囲を狭め、外れた数字の再選択を拒否', () => {
    let s = create('number-mine')
    s.stock = [50]
    s = act(s, { type: 'guess', index: 20 })
    expect(s.board).toEqual([20, 101])
    expect(() => act(s, { type: 'guess', index: 20 })).toThrow()
    s = act(s, { type: 'guess', index: 70 })
    expect(s.board).toEqual([20, 70])
    s = act(s, { type: 'guess', index: 50 })
    expect(s.losers).toEqual([2])
    expect(s.winners).toEqual([0, 1])
  })
  it.each([
    [0, 1, 0],
    [1, 2, 1],
    [2, 0, 2],
  ])('じゃんけん %s対%sは%sが勝ち、全員まで非公開', (a, b, win) => {
    let s = create('rps', 3, { rounds: 1 })
    s = act(s, { type: 'choose', index: a })
    expect(partyView(s, 1).table).toEqual([])
    expect(partyView(s, 1).hand).toEqual([])
    s = act(s, { type: 'choose', index: b })
    s = act(s, { type: 'choose', index: a })
    expect(s.table).toEqual([a, b, a])
    expect(s.scores).toEqual([1, 0, 1])
    expect(s.table[0]).toBe(win)
    s = act(s, { type: 'next' })
    expect(s.winners).toEqual([0, 2])
  })
  it('じゃんけんの3種類と全員同じはあいこ', () => {
    for (const choices of [
      [0, 1, 2],
      [2, 2, 2],
    ]) {
      let s = create('rps')
      for (const index of choices) s = act(s, { type: 'choose', index })
      expect(s.scores).toEqual([0, 0, 0])
    }
  })
  it('ワードウルフは少数派1人、投票途中は非公開、多数派勝利', () => {
    let s = create('word-wolf', 3, { rounds: 1 })
    s.stock = [2]
    s.hands = [[0], [0], [1]]
    for (let i = 0; i < 3; i++) s = act(s, { type: 'next' })
    expect(s.phase).toBe('challenge')
    s = act(s, { type: 'next' })
    expect(() => act(s, { type: 'vote', target: 0 })).toThrow()
    s = act(s, { type: 'vote', target: 2 })
    expect(partyView(s, 1).board).toEqual([])
    expect(partyView(s, 1).table).toEqual([])
    s = act(s, { type: 'vote', target: 2 })
    s = act(s, { type: 'vote', target: 0 })
    expect(s.board).toEqual([2, 2, 0])
    expect(s.scores).toEqual([1, 1, 0])
    expect(s.table).toEqual([2, 0, 1])
    s = act(s, { type: 'next' })
    expect(s.winners).toEqual([0, 1])
  })
  it('ワードウルフの同票は少数派勝利、次のお題で票を消去', () => {
    let s = create('word-wolf', 3, { rounds: 3 })
    const wolf = s.stock[0]
    expect(s.hands.filter((h) => h[0] === s.hands[wolf][0])).toHaveLength(1)
    for (let i = 0; i < 4; i++) s = act(s, { type: 'next' })
    for (const target of [1, 2, 0]) s = act(s, { type: 'vote', target })
    expect(s.scores[wolf]).toBe(1)
    s = act(s, { type: 'next' })
    expect(s.board).toEqual([])
    expect(s.pending).toEqual([])
    expect(s.round).toBe(1)
  })
  it('ジェスチャーのお題は演じる人だけ、得点とパス', () => {
    let s = create('charades', 2, { rounds: 1 })
    expect(partyView(s, 0).hand).toHaveLength(1)
    expect(partyView(s, 1).hand).toEqual([])
    s = act(s, { type: 'score' })
    expect(s.hands[0]).toEqual([])
    expect(s.hands[1]).toHaveLength(1)
    s = act(s, { type: 'pass' })
    expect(s.phase).toBe('finished')
    expect(s.scores).toEqual([1, 0])
  })
  it('21の直前で超過・0を拒否し、最後の人だけが負け', () => {
    const s = create('count-21')
    s.bank = 20
    expect(() => act(s, { type: 'take', index: 0 })).toThrow()
    expect(() => act(s, { type: 'take', index: 2 })).toThrow()
    expect(act(s, { type: 'take', index: 1 }).winners).toEqual([1, 2])
  })
  it.each([
    [0, 3, 1, 4, 2],
    [0, 1, 3, 2, 6],
    [0, 1, 4, 2, 8],
  ])('三目並べで縦横斜めに勝つ %j', (...moves: number[]) => {
    let s = create('tic-tac-toe', 2)
    for (const index of moves) s = act(s, { type: 'place', index })
    expect(s.winners).toEqual([0])
    expect(() => act(s, { type: 'place', index: 5 })).toThrow()
  })
  it('三目並べの埋まったマスを拒否し引き分けを判定', () => {
    let s = create('tic-tac-toe', 2)
    s = act(s, { type: 'place', index: 0 })
    expect(() => act(s, { type: 'place', index: 0 })).toThrow()
    for (const index of [1, 2, 4, 3, 5, 7, 6, 8]) s = act(s, { type: 'place', index })
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([])
  })
})

describe('新ゲームの通信境界', () => {
  it('不完全な入力配列とゲーム固有の不正ビューを拒否', () => {
    expect(validateAction({ type: 'guess', cards: Array(3) })).toBe(false)
    const cases: [PartyId, Record<string, unknown>][] = [
      ['mini-mahjong', { hand: [136] }],
      ['number-mine', { board: [40, 20] }],
      ['rps', { table: [0, 8, 2] }],
      ['word-wolf', { table: [9, 0, 1] }],
      ['hit-blow', { board: [0, 1, 2, 3, 3, 3] }],
      ['tic-tac-toe', { board: Array(9).fill(2) }],
    ]
    for (const [game, fields] of cases) {
      const v = partyView(create(game, partyCatalog[game].min), 0)
      expect(validateView({ ...v, ...fields })).toBe(false)
    }
  })
  it('非公開の山札を変えても公開ビューは同じ', () => {
    for (const game of ['mini-mahjong', 'hit-blow', 'number-mine', 'word-wolf'] as const) {
      const s = create(game),
        a = partyView(s, 1)
      s.stock.reverse()
      if (game === 'number-mine') s.stock = [s.stock[0] === 1 ? 2 : 1]
      expect(partyView(s, 1)).toEqual(a)
    }
  })
  it('麻雀の1打は差分だけで4人合計4KiB未満、再同期しても他人の手牌なし', () => {
    const host = new PartyHost('mahjong-network-test', create('mini-mahjong', 4)),
      guests: PartyGuest[] = [],
      queue: (() => void)[] = [],
      traffic: string[] = []
    for (let seat = 1; seat < 4; seat++) {
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
      let count = 0
      while (queue.length) {
        expect(count++).toBeLessThan(100)
        queue.shift()!()
      }
    }
    flush()
    host.start()
    flush()
    traffic.length = 0
    host.act(0, { type: 'discard', index: host.state.hands[0][0] })
    flush()
    expect(traffic.every((raw) => JSON.parse(raw).t === 'delta')).toBe(true)
    expect(
      traffic.reduce((sum, raw) => sum + new TextEncoder().encode(raw).length, 0),
    ).toBeLessThan(4096)
    for (const g of guests) expect(g.view).toEqual(partyView(host.state, g.seat))
    guests[1].sync()
    flush()
    expect(guests[1].view!.selected).toEqual([])
  })
  it.each(casualIds)('%s の開始ビューを差分経由でも検証できる', (game) => {
    const v = partyView(create(game, partyCatalog[game].min), 0)
    expect(validateView(v)).toBe(true)
    expect(applyDelta(v, diffView(v, v))).toEqual(v)
  })
})
