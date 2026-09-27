import { makeEngine } from '../core/engine'
import { other, type GameState, type Player } from '../core/types'

const directions = [-1, 0, 1].flatMap((y) => [-1, 0, 1].filter((x) => x || y).map((x) => [x, y]))
export function flips(s: GameState, to: number, player = s.turn): number[] {
  if (s.board[to]) return []
  const result: number[] = []
  for (const [dx, dy] of directions) {
    const ray: number[] = []
    let x = (to % 8) + dx,
      y = Math.floor(to / 8) + dy
    while (x >= 0 && x < 8 && y >= 0 && y < 8 && s.board[y * 8 + x]?.owner === other(player)) {
      ray.push(y * 8 + x)
      x += dx
      y += dy
    }
    if (x >= 0 && x < 8 && y >= 0 && y < 8 && s.board[y * 8 + x]?.owner === player)
      result.push(...ray)
  }
  return result
}
function legal(s: GameState, player = s.turn) {
  return s.board.flatMap((p, to) => (!p && flips(s, to, player).length ? [{ to }] : []))
}
export function scores(s: GameState): [number, number] {
  return [
    s.board.filter((p) => p?.owner === 0).length,
    s.board.filter((p) => p?.owner === 1).length,
  ]
}
export const othello = makeEngine({
  id: 'othello',
  name: 'オセロ',
  columns: 8,
  rows: 8,
  createInitialState() {
    const board: GameState['board'] = Array.from({ length: 64 }, () => null)
    for (const [i, p] of [
      [27, 1],
      [28, 0],
      [35, 0],
      [36, 1],
    ])
      board[i] = { owner: p as Player, kind: 'disc' }
    return { game: 'othello', board, turn: 0, ply: 0, winner: null, history: [] }
  },
  getLegalMoves: (s) => (s.winner === null ? legal(s) : []),
  next(s, m) {
    const board = [...s.board]
    for (const i of [m.to, ...flips(s, m.to)]) board[i] = { owner: s.turn, kind: 'disc' }
    const next: GameState = { ...s, board, turn: other(s.turn), passed: undefined }
    if (!legal(next).length) {
      next.passed = next.turn
      next.turn = s.turn
      if (!legal(next).length) {
        const [a, b] = scores(next)
        next.winner = a === b ? 'draw' : a > b ? 0 : 1
      }
    }
    return next
  },
})
