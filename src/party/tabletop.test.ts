import { describe, expect, it } from 'vitest'
import { createParty, applyParty, partyView } from './engine'
import { dominoTiles, yachtScore } from './tabletop'
import { validateView } from './protocol'
const names = ['A', 'B', 'C']
describe('マンカラ・ニム', () => {
  it('カラハのゴールで連続手番・捕獲・終局時の掃き集め', () => {
    let s = createParty('mancala', names.slice(0, 2))
    s = applyParty(s, 0, { type: 'sow', index: 2 })
    expect(s.turn).toBe(0)
    expect(s.board[6]).toBe(1)
    s.board = Array(14).fill(0)
    s.board[0] = 1
    s.board[2] = 1
    s.board[7] = 1
    s.board[9] = 4
    s.turn = 0
    s = applyParty(s, 0, { type: 'sow', index: 2 })
    expect(s.board[6]).toBe(5)
    expect(s.board[9]).toBe(0)
    expect(s.turn).toBe(1)
    s = createParty('mancala', names.slice(0, 2))
    s.board = [0, 0, 0, 0, 0, 1, 0, 4, 4, 4, 4, 4, 4, 0]
    s = applyParty(s, 0, { type: 'sow', index: 5 })
    expect(s.phase).toBe('finished')
    expect(s.scores).toEqual([1, 24])
    expect(s.winners).toEqual([1])
  })
  it('相手のゴールを飛ばし、石数を保存する', () => {
    let s = createParty('mancala', names.slice(0, 2), { seeds: 6, capture: false })
    s.board[0] += 8
    s.board[1] -= 4
    s.board[2] -= 4
    const before = s.board.reduce((a, b) => a + b, 0)
    s = applyParty(s, 0, { type: 'sow', index: 0 })
    expect(s.board[13]).toBe(0)
    expect(s.board.reduce((a, b) => a + b, 0)).toBe(before)
    expect(validateView(partyView(s, 0))).toBe(true)
    expect(() => applyParty(s, s.turn, { type: 'sow', index: s.turn === 0 ? 7 : 0 })).toThrow()
  })
  it('ニムは1山だけから上限内、最後を取る勝敗を切り替え', () => {
    let s = createParty('nim', names, { misere: true, maxTake: 3 })
    expect(() => applyParty(s, 0, { type: 'take', index: 2, rank: 4 })).toThrow()
    s.board = [1]
    s = applyParty(s, 0, { type: 'take', index: 0, rank: 1 })
    expect(s.winners).toEqual([1, 2])
    expect(s.phase).toBe('finished')
  })
})
describe('ドミノ', () => {
  it('28枚は重複なし、7人の配札でも秘密の山札を送らない', () => {
    expect(new Set(dominoTiles.map((p) => p.join(','))).size).toBe(28)
    const s = createParty(
      'dominoes',
      Array.from({ length: 7 }, (_, i) => String(i)),
    )
    expect(s.hands.every((h) => h.length === 4)).toBe(true)
    expect(new Set(s.hands.flat()).size).toBe(28)
    expect(partyView(s, 0)).not.toHaveProperty('hands')
  })
  it('両端の接続・所有権・出せない場合の山札と詰まり', () => {
    let s = createParty('dominoes', names)
    const id = (a: number, b: number) => dominoTiles.findIndex((t) => t[0] === a && t[1] === b)
    s.hands = [
      [id(2, 4), 0],
      [id(4, 6), 1],
      [id(0, 1), 3],
    ]
    s.turn = 0
    s = applyParty(s, 0, { type: 'tile', index: id(2, 4), target: 0 })
    s = applyParty(s, 1, { type: 'tile', index: id(4, 6), target: 1 })
    expect(s.board).toEqual([2, 6])
    expect(() => applyParty(s, 2, { type: 'tile', index: id(0, 1), target: 0 })).toThrow()
    s.stock = [id(2, 3)]
    s = applyParty(s, 2, { type: 'draw' })
    expect(s.hands[2]).toContain(id(2, 3))
    expect(() => applyParty(s, 2, { type: 'pass' })).toThrow()
    s.board = [6, 6]
    s.rules.draw = false
    s.hands = [[0, 1], [2], [3]]
    s.turn = 0
    for (let i = 0; i < 3; i++) s = applyParty(s, i, { type: 'pass' })
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([0])
  })
})
describe('ヨット・ダイス', () => {
  it('全12枠の得点、フルハウスとヨットの区別', () => {
    expect(yachtScore([2, 2, 2, 5, 5], 1)).toBe(6)
    expect(yachtScore([2, 2, 2, 5, 5], 8)).toBe(16)
    expect(yachtScore([6, 6, 6, 6, 2], 7)).toBe(26)
    expect(yachtScore([1, 2, 3, 4, 4], 9)).toBe(15)
    expect(yachtScore([2, 3, 4, 5, 6], 10)).toBe(30)
    expect(yachtScore([6, 6, 6, 6, 6], 11)).toBe(50)
    expect(yachtScore([6, 6, 6, 6, 6], 8)).toBe(0)
    expect(yachtScore([1, 2, 3, 4, 6], 10)).toBe(0)
    expect(yachtScore([1, 2, 3, 4, 6], 6)).toBe(16)
  })
  it('キープした出目を保存し、回数超過と枠の重複を拒否', () => {
    let s = createParty('yacht', names)
    s = applyParty(s, 0, { type: 'roll' }, () => 0)
    s = applyParty(s, 0, { type: 'roll', cards: [0, 1] }, () => 0.99)
    expect(s.table).toEqual([1, 1, 6, 6, 6])
    s = applyParty(s, 0, { type: 'roll', cards: [0, 1] }, () => 0.5)
    expect(s.selected).toEqual([0, 1])
    expect(() => applyParty(s, 0, { type: 'roll' })).toThrow()
    s = applyParty(s, 0, { type: 'score', index: 0 })
    expect(s.scores[0]).toBe(2)
    s.turn = 0
    s.table = [1, 1, 1, 1, 1]
    s.roll = 1
    expect(() => applyParty(s, 0, { type: 'score', index: 0 })).toThrow()
  })
  it('63点のボーナスは1回だけ加算し、全員の12枠で終了', () => {
    let s = createParty('yacht', names, { bonus: true })
    s.board = Array(36).fill(0)
    s.board.splice(0, 6, 3, 6, 9, 12, 15, -1)
    s.turn = 0
    s.table = [6, 6, 6, 1, 1]
    s.roll = 1
    s = applyParty(s, 0, { type: 'score', index: 5 })
    expect(s.scores[0]).toBe(98)
    expect(s.phase).toBe('finished')
    expect(s.winners).toEqual([0])
  })
})
