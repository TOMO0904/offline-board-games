import { makeEngine, lineWinner } from '../core/engine'
import { other } from '../core/types'
export const gomoku = makeEngine({
  id: 'gomoku',
  name: '五目並べ',
  columns: 15,
  rows: 15,
  createInitialState: () => ({
    game: 'gomoku',
    board: Array.from({ length: 225 }, () => null),
    turn: 0,
    ply: 0,
    winner: null,
    history: [],
  }),
  getLegalMoves: (s) => (s.winner === null ? s.board.flatMap((p, to) => (p ? [] : [{ to }])) : []),
  next(s, m) {
    const board = [...s.board]
    board[m.to] = { owner: s.turn, kind: 'disc' }
    return {
      ...s,
      board,
      turn: other(s.turn),
      winner: lineWinner(board, 15, 15, m.to, 5) ? s.turn : board.every(Boolean) ? 'draw' : null,
    }
  },
})
