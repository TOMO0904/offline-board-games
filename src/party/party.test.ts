import { describe, expect, it } from 'vitest'
import { createParty, applyParty, partyView, validateAction } from './engine'
import { partyIds, partyCatalog, normalizeRules } from './catalog'
import { cardText, deck, rank, type PartyAction, type PartyState } from './types'
import { applyDelta, diffView, encodeRoom, parseRoom, validateView } from './protocol'
import { PartyHost, PartyGuest } from './room'

function seeded(seed = 54) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
const names = (n = 3) => Array.from({ length: n }, (_, i) => `P${i + 1}`)
function custom(game: PartyState['game'], hands: number[][], rules = {}) {
  const s = createParty(game, names(hands.length), rules, seeded())
  s.hands = hands
  s.turn = 0
  s.table = []
  s.ranking = []
  s.losers = []
  return s
}
const play = (s: PartyState, cards: number[]) =>
  applyParty(s, s.turn, { type: 'play', cards }, seeded())
const pass = (s: PartyState) => applyParty(s, s.turn, { type: 'pass' }, seeded())

describe('大富豪の選択ルール', () => {
  it('同じ形と枚数、所有権を検証し元の状態を変更しない', () => {
    const s = custom('daifugo', [
      [2, 3, 4],
      [5, 6, 7],
      [8, 9, 10],
    ])
    const a = play(s, [2])
    expect(() => play(a, [3])).toThrow()
    expect(() => play(a, [5, 6])).toThrow()
    expect(s.hands[0]).toEqual([2, 3, 4])
    expect(a.turn).toBe(1)
  })
  it('革命は4枚で反転し、弱い数字で返す', () => {
    let s = custom(
      'daifugo',
      [
        [3, 16, 29, 42, 9],
        [2, 15, 28, 41, 8],
        [4, 17, 30, 43, 7],
      ],
      { eightCut: false },
    )
    s = play(s, [3, 16, 29, 42])
    expect(s.reversed).toBe(true)
    s = play(s, [2, 15, 28, 41])
    expect(s.reversed).toBe(false)
  })
  it('11バックは場が流れると元に戻る', () => {
    let s = custom(
      'daifugo',
      [
        [10, 4],
        [8, 12],
        [9, 11],
      ],
      { eightCut: false },
    )
    s = play(s, [10])
    expect(s.jBack).toBe(true)
    s = play(s, [8])
    s = pass(s)
    s = pass(s)
    expect(s.table).toEqual([])
    expect(s.jBack).toBe(false)
    expect(s.turn).toBe(1)
  })
  it('8切りは出した人が続け、上がったら次の人へ', () => {
    let s = custom('daifugo', [
      [7, 4],
      [5, 6],
      [8, 9],
    ])
    s = play(s, [7])
    expect(s.table).toEqual([])
    expect(s.turn).toBe(0)
    s = custom('daifugo', [[7], [5, 6], [8, 9]])
    s = play(s, [7])
    expect(s.turn).toBe(1)
    expect(s.ranking).toEqual([0])
  })
  it('マーク縛りは2回同じ構成で発生しスペ3返しは優先', () => {
    let s = custom(
      'daifugo',
      [
        [2, 4],
        [3, 5],
        [17, 7],
      ],
      { eightCut: false },
    )
    s = play(s, [2])
    s = play(s, [3])
    expect(s.lock).toEqual([0])
    expect(() => play(s, [17])).toThrow(/縛/)
    s = custom('daifugo', [
      [52, 4],
      [2, 5],
      [17, 7],
    ])
    s = play(s, [52])
    s.lock = [1]
    s = play(s, [2])
    expect(s.table).toEqual([])
    expect(s.turn).toBe(1)
  })
  it('階段の連続・スート・枚数、ジョーカーの代用範囲', () => {
    let s = custom(
      'daifugo',
      [
        [2, 3, 4, 9],
        [5, 6, 7, 10],
        [8, 11, 12],
      ],
      { eightCut: false },
    )
    s = play(s, [2, 3, 4])
    expect(s.tableKind).toBe('stairs')
    s = play(s, [5, 6, 7])
    expect(s.turn).toBe(2)
    expect(() =>
      play(
        custom('daifugo', [
          [2, 3, 52],
          [4, 5],
          [6, 7],
        ]),
        [2, 3, 52],
      ),
    ).toThrow()
    expect(
      play(
        custom('daifugo', [
          [2, 15, 52, 9],
          [4, 5],
          [6, 7],
        ]),
        [2, 15, 52],
      ).table.length,
    ).toBe(3)
  })
  it('禁止札上がりで進行が詰まらず最下位になる', () => {
    let s = custom('daifugo', [[7], [3], [4]], { forbiddenFinish: true })
    s = play(s, [7])
    expect(s.losers).toEqual([0])
    s = play(s, [3])
    expect(s.phase).toBe('finished')
    expect(s.ranking).toEqual([1, 2, 0])
    expect(s.winners).toEqual([1])
  })
  it('一度パスした人は場が流れるまで戻らない', () => {
    let s = custom(
      'daifugo',
      [
        [2, 9],
        [3, 10],
        [4, 11],
      ],
      { eightCut: false, jBack: false },
    )
    s = play(s, [2])
    s = pass(s)
    s = play(s, [4])
    expect(s.turn).toBe(0)
    s = play(s, [9])
    expect(s.turn).toBe(2)
  })
})
describe('他のカード・盤・ダイスの裁定', () => {
  it('七並べの飛び越し禁止とパス脱落による全札公開', () => {
    let s = custom('sevens', [[0, 1], [5], [7]], { passes: 0 })
    s.board = [6, 19, 32, 45]
    s.passed = [0, 0, 0]
    expect(() => play(s, [0])).toThrow()
    s = pass(s)
    expect(s.board).toContain(0)
    expect(s.losers).toEqual([0])
    expect(s.turn).toBe(1)
  })
  it('ババ抜き・ジジ抜きの配札は奇数、ペアなしで秘密の除外札を漏らさない', () => {
    for (const game of ['old-maid', 'jiji'] as const) {
      const s = createParty(game, names(7), {}, seeded())
      expect(s.hands.flat().length % 2).toBe(1)
      for (const h of s.hands) expect(new Set(h.map(rank)).size).toBe(h.length)
      expect(partyView(s, 0)).not.toHaveProperty('stock')
      expect(partyView(s, 0)).not.toHaveProperty('hands')
    }
  })
  it('ダウトの嘘・本当・確認後の勝利', () => {
    let s = custom('doubt', [[1, 5], [2], [3]])
    s = play(s, [1])
    expect(partyView(s, 1).table).toEqual([])
    s = applyParty(s, 1, { type: 'doubt' })
    expect(s.hands[0]).toContain(1)
    expect(s.turn).toBe(1)
    s = custom('doubt', [[0], [2], [3]])
    s = play(s, [0])
    s = applyParty(s, 1, { type: 'believe' })
    expect(s.phase).toBe('challenge')
    s = applyParty(s, 2, { type: 'doubt' })
    expect(s.winners).toEqual([0])
    expect(s.hands[2]).toContain(0)
  })
  it('クレイジーエイトの色指定・山札再利用・1枚制限', () => {
    let s = custom('crazy-eights', [
      [7, 2],
      [14, 9],
      [4, 5],
    ])
    s.table = [3, 16]
    s.stock = []
    s.activeSuit = 1
    s = applyParty(s, 0, { type: 'play', cards: [7], suit: 2 })
    expect(s.activeSuit).toBe(2)
    s = applyParty(s, 1, { type: 'draw' }, seeded())
    expect(s.stock.length).toBe(1)
    expect(() => applyParty(s, 1, { type: 'draw' })).toThrow()
  })
  it('ゴーフィッシュの4枚組と成功時の継続', () => {
    let s = custom('go-fish', [
      [0, 13, 26, 1],
      [39, 4],
      [5, 6],
    ])
    s.stock = [7]
    s = applyParty(s, 0, { type: 'ask', rank: 1, target: 1 })
    expect(s.scores[0]).toBe(1)
    expect(s.hands[0]).toEqual([1])
    expect(s.turn).toBe(0)
    expect(() => applyParty(s, 0, { type: 'ask', rank: 13, target: 1 })).toThrow()
  })
  it('神経衰弱の裏札は送らず、確認まで表札を維持', () => {
    let s = createParty('memory', names(), { pairs: 8 }, seeded())
    s.board = [0, 13, 1, 14]
    expect(partyView(s, 0).board).toEqual([-1, -1, -1, -1])
    s = applyParty(s, 0, { type: 'flip', index: 0 })
    s = applyParty(s, 0, { type: 'flip', index: 1 })
    expect(s.phase).toBe('reveal')
    expect(partyView(s, 1).board).toEqual([0, 13, -1, -1])
    s = applyParty(s, 0, { type: 'next' })
    expect(s.scores[0]).toBe(1)
    expect(s.turn).toBe(0)
  })
  it('ハーツのフォロースートとトリックの失点', () => {
    let s = custom('hearts', [
      [40, 0],
      [41, 13],
      [42, 11],
    ])
    s.stalled = 1
    s = play(s, [40])
    expect(() => play(s, [13])).toThrow(/マーク/)
    s = play(s, [41])
    s = play(s, [42])
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('reveal')
    s = applyParty(s, 2, { type: 'next' })
    s = play(s, [11])
    s = play(s, [0])
    s = play(s, [13])
    expect(s.roundScores[0]).toBe(14)
  })
  it('ピッグの1で手番得点を失い、確定時のみ目標を判定', () => {
    let s = createParty('pig', names(), { target: 50 })
    s = applyParty(s, 0, { type: 'roll' }, () => 0.99)
    expect(s.bank).toBe(6)
    s = applyParty(s, 0, { type: 'roll' }, () => 0)
    expect(s.bank).toBe(0)
    expect(s.turn).toBe(1)
    s.bank = 50
    s = applyParty(s, 1, { type: 'hold' })
    expect(s.winners).toEqual([1])
  })
  it('ドット＆ボックスの1辺で2マス獲得と連続手番', () => {
    let s = createParty('boxes', names(), { size: 3 })
    for (const e of [0, 1, 3, 4, 12, 14]) s.board[e] = 1
    s = applyParty(s, 0, { type: 'edge', index: 13 })
    expect(s.scores[0]).toBe(2)
    expect(s.turn).toBe(0)
  })
})

function candidates(s: PartyState): PartyAction[] {
  const h = s.hands[s.turn]
  switch (s.game) {
    case 'mancala':
      return s.board.flatMap((n, i) =>
        n > 0 && i >= s.turn * 7 && i < s.turn * 7 + 6 ? [{ type: 'sow' as const, index: i }] : [],
      )
    case 'nim':
      return s.board.flatMap((n, i) =>
        n > 0 ? [{ type: 'take' as const, index: i, rank: 1 }] : [],
      )
    case 'dominoes':
      return [
        ...h.flatMap((index) => [
          { type: 'tile' as const, index, target: 0 },
          { type: 'tile' as const, index, target: 1 },
        ]),
        { type: 'draw' },
        { type: 'pass' },
      ]
    case 'yacht':
      return s.roll
        ? [{ type: 'score', index: s.board.slice(s.turn * 12, s.turn * 12 + 12).indexOf(-1) }]
        : [{ type: 'roll' }]
    case 'life-journey':
      return s.phase === 'challenge'
        ? [0, 1, 2, 3, 4].map((index) => ({ type: 'choose', index }))
        : [{ type: s.phase === 'reveal' ? 'next' : 'roll' }]
    case 'island-market':
      return [{ type: 'next' }]
    case 'mini-mahjong':
      return s.phase === 'round-end' ? [{ type: 'next' }] : [{ type: 'discard', index: h[0] }]
    case 'hit-blow':
      return [{ type: 'guess', cards: [...s.stock] }]
    case 'word-wolf':
      return s.phase === 'reveal'
        ? [{ type: 'vote', target: (s.turn + 1) % s.names.length }]
        : [{ type: 'next' }]
    case 'daifugo':
      return [...h.map((c) => ({ type: 'play' as const, cards: [c] })), { type: 'pass' }]
    case 'sevens':
      return [...h.map((c) => ({ type: 'play' as const, cards: [c] })), { type: 'pass' }]
    case 'old-maid':
    case 'jiji':
      return [{ type: 'draw', index: 0 }]
    case 'doubt':
      return s.phase === 'challenge'
        ? [{ type: 'believe' }]
        : h.map((c) => ({ type: 'play', cards: [c] }))
    case 'crazy-eights':
      return [
        ...h.map((c) => ({ type: 'play' as const, cards: [c], suit: 0 })),
        { type: 'draw' },
        { type: 'pass' },
      ]
    case 'go-fish':
      return [...new Set(h.map(rank))]
        .flatMap((r) => s.names.map((_, target) => ({ type: 'ask' as const, rank: r, target })))
        .sort(
          (a, b) =>
            Number(b.target !== s.turn && s.hands[b.target].some((c) => rank(c) === b.rank)) -
            Number(a.target !== s.turn && s.hands[a.target].some((c) => rank(c) === a.rank)),
        )
    case 'memory':
      return s.phase === 'reveal'
        ? [{ type: 'next' }]
        : s.board.flatMap((_, i) =>
            s.matched.includes(i) || s.selected.includes(i)
              ? []
              : [{ type: 'flip' as const, index: i }],
          )
    case 'hearts':
      return s.phase === 'reveal' || s.phase === 'round-end'
        ? [{ type: 'next' }]
        : h.map((c) => ({ type: 'play', cards: [c] }))
    case 'pig':
      return [{ type: s.bank >= 20 ? 'hold' : 'roll' }]
    case 'boxes':
      return s.board.flatMap((owner, i) => (owner < 0 ? [{ type: 'edge' as const, index: i }] : []))
  }
}
describe('全追加ゲームの人数別プレイ', () => {
  for (const game of partyIds)
    for (const n of [2, 3, 5, 7].filter(
      (n) => n >= partyCatalog[game].min && n <= partyCatalog[game].max,
    ))
      it(`${game} ${n}人: 合法手で終了し全員のビューを検証`, () => {
        const rng = seeded(n + 21)
        let s = createParty(game, names(n), { target: 0 }, rng)
        for (let steps = 0; s.phase !== 'finished' && steps < 6000; steps++) {
          const actions = candidates(s)
          // Memory uses complete recall in this simulation after revealing the first card.
          if (game === 'memory' && s.selected.length === 1)
            actions.sort(
              (a, b) =>
                Number(rank(s.board[b.index!]) === rank(s.board[s.selected[0]])) -
                Number(rank(s.board[a.index!]) === rank(s.board[s.selected[0]])),
            )
          let next: PartyState | undefined
          for (const a of actions) {
            try {
              next = applyParty(s, s.turn, a, rng)
              break
            } catch {
              /* Try the next candidate. */
            }
          }
          expect(next, `${game} ${n}人 ${s.step}手の合法手なし`).toBeDefined()
          s = next!
          for (let p = 0; p < n; p++) expect(validateView(partyView(s, p))).toBe(true)
        }
        expect(s.phase, `${game}: ${s.step}手で未終了`).toBe('finished')
        expect(s.winners.length).toBeGreaterThan(0)
      }, 15000)
})

function room(n = 7) {
  const rng = seeded(),
    host = new PartyHost('room-test-123', createParty('sevens', names(n), {}, rng), rng),
    guests: PartyGuest[] = [],
    queue: Array<() => void> = [],
    traffic: string[] = []
  for (let seat = 1; seat < n; seat++) {
    const h = {
        open: true,
        send: (raw: string) => {
          traffic.push(raw)
          queue.push(() => guests[seat - 1].receive(raw))
        },
      },
      g = {
        open: true,
        send: (raw: string) => {
          traffic.push(raw)
          queue.push(() => host.receive(seat, raw))
        },
      }
    host.attach(seat, h)
    guests.push(new PartyGuest(host.room, seat, g))
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
  return { host, guests, flush, traffic }
}
describe('多人数プロトコル・プライバシー・通信量', () => {
  it('不完全な配列や範囲外の盤面を拒否する', () => {
    const v = partyView(createParty('memory', names(), {}, seeded()), 0)
    expect(() => applyDelta(v, { board: { n: 120, p: [] } })).toThrow()
    expect(() => applyDelta(v, { names: { n: 7, p: [] } })).toThrow()
    expect(validateView({ ...v, roll: 1000 })).toBe(false)
  })
  it('7人に配る手札は本人だけ、差分更新で1手の合計4KiB未満', () => {
    const { host, guests, flush, traffic } = room()
    for (const g of guests) {
      expect(g.view!.hand).toEqual(host.state.hands[g.seat])
      expect(g.view).not.toHaveProperty('hands')
      expect(g.view).not.toHaveProperty('stock')
    }
    host.act(0, { type: 'pass' })
    flush()
    const bytes = traffic.reduce((n, raw) => n + new TextEncoder().encode(raw).length, 0)
    expect(bytes).toBeLessThan(4096)
    expect(traffic.every((raw) => parseRoom(raw).t === 'delta')).toBe(true)
    expect(guests.every((g) => g.view!.turn === host.state.turn)).toBe(true)
  })
  it('順序飛び・再接続の再同期、不正操作・重複を拒否', () => {
    const { host, guests, flush, traffic } = room(3),
      guest = guests[0]
    host.act(0, { type: 'pass' })
    flush()
    const seq = host.sequence
    guest.act({ type: 'play', cards: [52] })
    flush()
    expect(host.sequence).toBe(seq)
    guest.act({ type: 'pass' })
    flush()
    const raw = traffic.findLast((raw) => parseRoom(raw).t === 'action')!
    host.receive(1, raw)
    flush()
    expect(host.state.step).toBe(2)
    guest.sequence -= 2
    guest.sync()
    flush()
    expect(guest.sequence).toBe(host.sequence)
    expect(guest.view).toEqual(partyView(host.state, 1))
    host.links.get(2)!.open = false
    host.presence(2)
    flush()
    expect(() => host.act(0, { type: 'pass' })).toThrow(/接続/)
    host.links.get(2)!.open = true
    guests[1].opened()
    flush()
    expect(host.allOnline).toBe(true)
  })
  it('全員の承認でのみ再戦し、1人の重複票では始めない', () => {
    const { host, guests, flush } = room(3)
    host.vote(0)
    host.vote(0)
    flush()
    expect(host.roundId).toBe(0)
    guests[0].vote()
    flush()
    guests[1].vote()
    flush()
    expect(host.roundId).toBe(1)
    expect(guests[0].generation).toBe(1)
  })
  it('差分のprototype汚染・壊れた入力・巨大データを拒否', () => {
    const v = partyView(createParty('memory', names(), {}, seeded()), 0)
    expect(() => applyDelta(v, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow()
    expect(() => parseRoom('x'.repeat(33000))).toThrow()
    expect(validateAction({ type: 'play', cards: [1, 1] })).toBe(false)
    expect(validateAction({ type: 'ask', target: -1 })).toBe(false)
    expect(() => encodeRoom({ v: 2, room: 'x', t: 'action', seq: -1, data: {} })).toThrow()
  })
  it('可変長配列と盤面の差分を復元', () => {
    const s = createParty('memory', names(), {}, seeded()),
      a = partyView(s, 0),
      b = partyView(applyParty(s, 0, { type: 'flip', index: 0 }), 0)
    expect(applyDelta(a, diffView(a, b))).toEqual(b)
    expect(Object.keys(diffView(a, b))).not.toContain('hand')
  })
  it('ルールは有効な値だけを採用', () => {
    expect(normalizeRules('pig', { target: -1 })).toEqual({ target: 100 })
    expect(deck().map(cardText).length).toBe(52)
  })
})
