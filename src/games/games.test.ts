import { describe, expect, it } from 'vitest'
import { othello, flips, scores } from './othello/engine'
import { chess, chessPosition, indexOf } from './chess/engine'
import { shogi, shogiLegal, inCheck, positionKey } from './shogi/engine'
import { gomoku } from './gomoku/engine'
import { connectFour } from './connect-four/engine'
import { engines } from './index'
import { gameIds, type GameState, type Move } from './core/types'
import { lineWinner } from './core/engine'

describe('Othello', () => {
  it('starts with two discs each and exactly four legal moves', () => {
    const s = othello.createInitialState()
    expect(scores(s)).toEqual([2, 2])
    expect(othello.getLegalMoves(s).map((m) => m.to)).toEqual([19, 26, 37, 44])
  })
  it('flips discs and rejects occupied or non-capturing squares', () => {
    const s = othello.applyMove(othello.createInitialState(), { to: 19 })
    expect(scores(s)).toEqual([4, 1])
    expect(s.turn).toBe(1)
    expect(othello.isLegalMove(s, { to: 19 })).toBe(false)
    expect(() => othello.applyMove(s, { to: 0 })).toThrow()
  })
  it('flips in all eight directions without wrapping at edges', () => {
    const s = othello.createInitialState()
    s.board.fill(null)
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      s.board[(3 + dy) * 8 + 3 + dx] = { owner: 1, kind: 'disc' }
      s.board[(3 + dy * 2) * 8 + 3 + dx * 2] = { owner: 0, kind: 'disc' }
    }
    expect(flips(s, 27)).toHaveLength(8)
    s.board.fill(null)
    s.board[8] = { owner: 1, kind: 'disc' }
    s.board[9] = { owner: 0, kind: 'disc' }
    expect(flips(s, 7)).toEqual([])
  })
  it('automatically passes the opponent when they have no legal move', () => {
    const s = othello.createInitialState()
    s.board.fill({ owner: 0, kind: 'disc' })
    s.board[0] = null
    s.board[1] = { owner: 1, kind: 'disc' }
    s.board[3] = null
    s.board[4] = { owner: 1, kind: 'disc' }
    const n = othello.applyMove(s, { to: 0 })
    expect(n.turn).toBe(0)
    expect(n.passed).toBe(1)
    expect(n.winner).toBeNull()
    const end = othello.applyMove(n, { to: 3 })
    expect(end.winner).toBe(0)
    expect(scores(end)).toEqual([64, 0])
  })
  it('ends with empty squares when neither player can move', () => {
    const s = othello.createInitialState()
    s.board.fill({ owner: 0, kind: 'disc' })
    s.board[0] = null
    s.board[63] = null
    s.board[1] = { owner: 1, kind: 'disc' }
    expect(othello.applyMove(s, { to: 0 }).winner).toBe(0)
  })
  it('detects a draw on the final placement', () => {
    const s = othello.createInitialState()
    s.board = Array.from({ length: 64 }, (_, i) => ({ owner: i < 30 ? 0 : 1, kind: 'disc' }))
    s.board[0] = null
    s.board[1] = { owner: 1, kind: 'disc' }
    s.board[30] = { owner: 0, kind: 'disc' }
    // At (0,0), (1,0) flips; all other rays are blocked by black.
    expect(scores(s)).toEqual([29, 34])
    // Adjust to a final 32–32 result.
    s.board[31] = { owner: 0, kind: 'disc' }
    const n = othello.applyMove(s, { to: 0 })
    expect(scores(n)).toEqual([32, 32])
    expect(n.winner).toBe('draw')
  })
})

const chessMove = (s: GameState, from: string, to: string, promotion?: string) =>
  chess.applyMove(s, { from: indexOf(from), to: indexOf(to), ...(promotion ? { promotion } : {}) })
describe('Chess (bundled chess.js)', () => {
  it('has 20 opening moves and moves a pawn two squares', () => {
    expect(chess.getLegalMoves(chess.createInitialState())).toHaveLength(20)
    const s = chessMove(chess.createInitialState(), 'e2', 'e4')
    expect(s.board[indexOf('e4')]).toEqual({ owner: 0, kind: 'p' })
    expect(s.turn).toBe(1)
  })
  it('detects check and prevents exposing a king', () => {
    const s = chessPosition('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')
    expect(s.check).toBe(true)
    expect(chess.isLegalMove(s, { from: indexOf('e1'), to: indexOf('e2') })).toBe(true)
  })
  it('castles and moves the rook; forbids castling through check', () => {
    const s = chessMove(chessPosition('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1', 'g1')
    expect(s.board[indexOf('f1')]?.kind).toBe('r')
    const checked = chessPosition('r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1')
    expect(chess.isLegalMove(checked, { from: indexOf('e1'), to: indexOf('g1') })).toBe(false)
  })
  it('captures en passant', () => {
    let s = chess.createInitialState()
    for (const [f, t] of [
      ['e2', 'e4'],
      ['a7', 'a6'],
      ['e4', 'e5'],
      ['d7', 'd5'],
      ['e5', 'd6'],
    ])
      s = chessMove(s, f, t)
    expect(s.board[indexOf('d5')]).toBeNull()
    expect(s.board[indexOf('d6')]?.kind).toBe('p')
  })
  it('allows all four promotions', () => {
    const s = chessPosition('7k/P7/8/8/8/8/8/7K w - - 0 1')
    expect(
      chess
        .getLegalMoves(s)
        .filter((m) => m.from === indexOf('a7'))
        .map((m) => m.promotion)
        .sort(),
    ).toEqual(['b', 'n', 'q', 'r'])
    expect(chessMove(s, 'a7', 'a8', 'n').board[0]?.kind).toBe('n')
  })
  it('detects checkmate with Fool’s mate', () => {
    let s = chess.createInitialState()
    for (const [f, t] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ])
      s = chessMove(s, f, t)
    expect(s.winner).toBe(1)
    expect(s.reason).toBe('チェックメイト')
    expect(chess.getLegalMoves(s)).toEqual([])
  })
  it('detects stalemate, insufficient material and the fifty-move rule', () => {
    expect(chessPosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').reason).toBe('ステイルメイト')
    expect(chessPosition('7k/8/8/8/8/8/8/K7 w - - 0 1').winner).toBe('draw')
    expect(chessPosition('7k/8/8/8/8/8/8/KR6 w - - 100 51').winner).toBe('draw')
  })
  it('preserves repetition history across serialization', () => {
    let s = chess.createInitialState()
    for (let n = 0; n < 2; n++)
      for (const [f, t] of [
        ['g1', 'f3'],
        ['g8', 'f6'],
        ['f3', 'g1'],
        ['f6', 'g8'],
      ])
        s = chessMove(s, f, t)
    expect(s.winner).toBe('draw')
    expect(chess.deserialize(chess.serialize(s)).reason).toBe('同一局面3回')
  })
})

function emptyShogi(): GameState {
  const s = shogi.createInitialState()
  s.board.fill(null)
  s.board[76] = { owner: 0, kind: 'K' }
  s.board[4] = { owner: 1, kind: 'K' }
  s.hands = [{}, {}]
  s.positions = []
  return s
}
describe('Shogi', () => {
  it('starts with forty pieces and thirty legal moves', () => {
    const s = shogi.createInitialState()
    expect(s.board.filter(Boolean)).toHaveLength(40)
    expect(shogi.getLegalMoves(s)).toHaveLength(30)
    expect(shogi.applyMove(s, { from: 54, to: 45 }).board[45]).toMatchObject({
      owner: 0,
      kind: 'P',
    })
  })
  it('offers promotion and non-promotion when entering the zone', () => {
    const s = emptyShogi()
    s.board[27] = { owner: 0, kind: 'P' }
    const options = shogi.getLegalMoves(s).filter((m) => m.from === 27 && m.to === 18)
    expect(options).toHaveLength(2)
    expect(shogi.applyMove(s, { from: 27, to: 18, promote: true }).board[18]?.promoted).toBe(true)
  })
  it('forces promotion of a pawn on the final rank and a knight on the last two', () => {
    const s = emptyShogi()
    s.board[9] = { owner: 0, kind: 'P' }
    s.board[28] = { owner: 0, kind: 'N' }
    expect(shogi.isLegalMove(s, { from: 9, to: 0 })).toBe(false)
    expect(shogi.isLegalMove(s, { from: 9, to: 0, promote: true })).toBe(true)
    expect(
      shogiLegal(s)
        .filter((m) => m.from === 28)
        .every((m) => m.promote),
    ).toBe(true)
  })
  it('captures and demotes a promoted piece into the hand', () => {
    const s = emptyShogi()
    s.board[40] = { owner: 0, kind: 'R' }
    s.board[31] = { owner: 1, kind: 'S', promoted: true }
    const n = shogi.applyMove(s, { from: 40, to: 31 })
    expect(n.hands?.[0].S).toBe(1)
    expect(n.board[31]?.kind).toBe('R')
  })
  it('drops pieces and consumes the correct hand', () => {
    const s = emptyShogi()
    s.hands![0].S = 1
    const n = shogi.applyMove(s, { to: 40, drop: 'S' })
    expect(n.hands?.[0].S).toBe(0)
    expect(n.board[40]).toEqual({ owner: 0, kind: 'S' })
  })
  it('rejects nifu but allows a pawn on a file with a promoted pawn', () => {
    const s = emptyShogi()
    s.board[54] = { owner: 0, kind: 'P' }
    s.hands![0].P = 1
    expect(shogi.isLegalMove(s, { to: 36, drop: 'P' })).toBe(false)
    s.board[54]!.promoted = true
    expect(shogi.isLegalMove(s, { to: 36, drop: 'P' })).toBe(true)
  })
  it('rejects dead-rank drops for both players', () => {
    const s = emptyShogi()
    s.hands![0] = { P: 1, L: 1, N: 1 }
    for (const k of ['P', 'L', 'N']) expect(shogi.isLegalMove(s, { to: 0, drop: k })).toBe(false)
    expect(shogi.isLegalMove(s, { to: 9, drop: 'N' })).toBe(false)
    s.turn = 1
    s.hands![1] = { P: 1, L: 1, N: 1 }
    for (const k of ['P', 'L', 'N']) expect(shogi.isLegalMove(s, { to: 80, drop: k })).toBe(false)
  })
  it('detects check and filters pinned piece moves', () => {
    const s = emptyShogi()
    s.board[40] = { owner: 1, kind: 'R' }
    expect(inCheck(s)).toBe(true)
    s.board[67] = { owner: 0, kind: 'G' }
    expect(inCheck(s)).toBe(false)
    expect(shogi.isLegalMove(s, { from: 67, to: 66 })).toBe(false)
  })
  it('rejects pawn-drop mate while allowing a pawn move that mates', () => {
    const s = emptyShogi()
    s.board[3] = { owner: 1, kind: 'L' }
    s.board[5] = { owner: 1, kind: 'L' }
    s.board[21] = { owner: 0, kind: 'G' }
    s.board[23] = { owner: 0, kind: 'G' }
    s.hands![0].P = 1
    expect(shogi.isLegalMove(s, { to: 13, drop: 'P' })).toBe(false)
    s.board[22] = { owner: 0, kind: 'P' }
    const n = shogi.applyMove(s, { from: 22, to: 13 })
    expect(n.check).toBe(true)
    expect(n.winner).toBe(0)
    expect(n.reason).toBe('詰み')
  })
  it('allows a checking pawn drop when the king can escape', () => {
    const s = emptyShogi()
    s.hands![0].P = 1
    expect(shogi.isLegalMove(s, { to: 13, drop: 'P' })).toBe(true)
  })
  it('moves promoted rook and bishop with additional king steps', () => {
    const s = emptyShogi()
    s.board[40] = { owner: 0, kind: 'R', promoted: true }
    expect(shogi.isLegalMove(s, { from: 40, to: 30 })).toBe(true)
    s.board[40] = { owner: 0, kind: 'B', promoted: true }
    expect(shogi.isLegalMove(s, { from: 40, to: 31 })).toBe(true)
  })
  it('draws on four repetitions of board, turn, and hands', () => {
    let s = emptyShogi()
    s.positions = [{ key: positionKey(s), checking: null }]
    for (let n = 0; n < 3; n++)
      for (const [from, to] of [
        [76, 75],
        [4, 5],
        [75, 76],
        [5, 4],
      ])
        s = shogi.applyMove(s, { from, to })
    expect(s.winner).toBe('draw')
    expect(s.reason).toBe('千日手')
  })
  it('makes perpetual checking player lose', () => {
    let s = emptyShogi()
    s.board[22] = { owner: 0, kind: 'R' }
    s.turn = 1
    s.positions = [{ key: positionKey(s), checking: 0, mover: 0 }]
    for (let n = 0; n < 3; n++)
      for (const [from, to] of [
        [4, 5],
        [22, 23],
        [5, 4],
        [23, 22],
      ])
        s = shogi.applyMove(s, { from, to })
    expect(s.winner).toBe(1)
    expect(s.reason).toContain('連続王手')
  })
})

describe.each([
  ['horizontal', [0, 1, 2, 3, 4]],
  ['vertical', [0, 15, 30, 45, 60]],
  ['diagonal', [0, 16, 32, 48, 64]],
  ['anti-diagonal', [4, 18, 32, 46, 60]],
] as const)('Gomoku %s', (_, line) => {
  it('wins on a five-stone line', () => {
    let s = gomoku.createInitialState()
    for (let n = 0; n < line.length; n++) {
      s = gomoku.applyMove(s, { to: line[n] })
      if (n < 4) s = gomoku.applyMove(s, { to: 150 + n * 2 })
    }
    expect(s.winner).toBe(0)
  })
})
describe('Connect Four', () => {
  function play(columns: number[]) {
    return columns.reduce(
      (s, col) =>
        connectFour.applyMove(
          s,
          connectFour.getLegalMoves(s).find((m) => m.to % 7 === col)!,
        ),
      connectFour.createInitialState(),
    )
  }
  it('drops to the bottom and stacks upward', () => {
    const s = play([0, 0])
    expect(s.board[35]?.owner).toBe(0)
    expect(s.board[28]?.owner).toBe(1)
  })
  it('wins horizontally', () => expect(play([0, 6, 1, 6, 2, 6, 3]).winner).toBe(0))
  it('wins vertically', () => expect(play([0, 1, 0, 1, 0, 1, 0]).winner).toBe(0))
  it('wins diagonally', () => expect(play([0, 1, 1, 2, 3, 2, 2, 3, 4, 3, 3]).winner).toBe(0))
  it('rejects full columns', () =>
    expect(connectFour.getLegalMoves(play([0, 0, 0, 0, 0, 0])).some((m) => m.to % 7 === 0)).toBe(
      false,
    ))
  it('does not wrap line detection at board edges', () => {
    const s = connectFour.createInitialState()
    for (const i of [5, 6, 7, 8]) s.board[i] = { owner: 0, kind: 'disc' }
    expect(lineWinner(s.board, 7, 6, 7, 4)).toBe(false)
  })
})
describe.each(gameIds)('%s serialization and input safety', (game) => {
  const engine = engines[game]
  it('round-trips a legal position and preserves the source state', () => {
    const initial = engine.createInitialState(),
      before = JSON.stringify(initial)
    const next = engine.applyMove(initial, engine.getLegalMoves(initial)[0])
    expect(JSON.stringify(initial)).toBe(before)
    expect(engine.deserialize(engine.serialize(next))).toEqual(next)
  })
  it('rejects corrupted, oversized, cross-game and illegal data', () => {
    expect(() => engine.deserialize('{')).toThrow()
    expect(() => engine.deserialize(' '.repeat(160_001))).toThrow()
    expect(() => engine.deserialize(JSON.stringify({ v: 1, game: 'wrong', moves: [] }))).toThrow()
    expect(() => engine.deserialize(JSON.stringify({ v: 1, game, moves: [{ to: -1 }] }))).toThrow()
    expect(engine.isLegalMove(engine.createInitialState(), { to: 999 })).toBe(false)
    expect(engine.isLegalMove(engine.createInitialState(), { to: 0, evil: true } as Move)).toBe(
      false,
    )
  })
})
