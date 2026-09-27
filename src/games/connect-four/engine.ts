import { makeEngine, lineWinner } from '../core/engine'
import { other } from '../core/types'
export const connectFour = makeEngine({
  id: 'connect-four',
  name: 'Connect Four',
  columns: 7,
  rows: 6,
  createInitialState: () => ({
    game: 'connect-four',
    board: Array.from({ length: 42 }, () => null),
    turn: 0,
    ply: 0,
    winner: null,
    history: [],
  }),
  getLegalMoves: (s) =>
    s.winner === null
      ? Array.from({ length: 7 }, (_, col) => {
          for (let row = 5; row >= 0; row--)
            if (!s.board[row * 7 + col]) return { to: row * 7 + col }
          return null
        }).filter((m) => m !== null)
      : [],
  next(s, m) {
    const board = [...s.board]
    board[m.to] = { owner: s.turn, kind: 'disc' }
    return {
      ...s,
      board,
      turn: other(s.turn),
      winner: lineWinner(board, 7, 6, m.to, 4) ? s.turn : board.every(Boolean) ? 'draw' : null,
    }
  },
})
