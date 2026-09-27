import { Chess, DEFAULT_POSITION, type Square } from 'chess.js'
import { makeEngine } from '../core/engine'
import { type GameState, type Move, type Piece } from '../core/types'

export const square = (index: number) =>
  `${'abcdefgh'[index % 8]}${8 - Math.floor(index / 8)}` as Square
export const indexOf = (s: string) => (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0])
function instance(s: GameState) {
  const c = new Chess(s.initialFen || DEFAULT_POSITION)
  for (const m of s.history)
    c.move({ from: square(m.from!), to: square(m.to), promotion: m.promotion })
  return c
}
function position(c: Chess, initialFen = DEFAULT_POSITION): GameState {
  const board: (Piece | null)[] = c
    .board()
    .flat()
    .map((p) => (p ? { owner: p.color === 'w' ? 0 : 1, kind: p.type } : null))
  const turn = c.turn() === 'w' ? 0 : 1
  return {
    game: 'chess',
    board,
    turn,
    ply: 0,
    history: [],
    initialFen,
    fen: c.fen(),
    check: c.isCheck(),
    winner: c.isCheckmate() ? (turn === 0 ? 1 : 0) : c.isDraw() ? 'draw' : null,
    reason: c.isCheckmate()
      ? 'チェックメイト'
      : c.isStalemate()
        ? 'ステイルメイト'
        : c.isThreefoldRepetition()
          ? '同一局面3回'
          : c.isDrawByFiftyMoves()
            ? '50手ルール'
            : c.isInsufficientMaterial()
              ? '戦力不足'
              : undefined,
  }
}
export const chessPosition = (fen: string) => position(new Chess(fen), fen)
export const chess = makeEngine({
  id: 'chess',
  name: 'チェス',
  columns: 8,
  rows: 8,
  createInitialState: () => position(new Chess()),
  getLegalMoves: (s) =>
    s.winner === null
      ? instance(s)
          .moves({ verbose: true })
          .map((m) => {
            const move: Move = { from: indexOf(m.from), to: indexOf(m.to) }
            if (m.promotion) move.promotion = m.promotion
            return move
          })
      : [],
  next(s, m) {
    const c = instance(s)
    c.move({ from: square(m.from!), to: square(m.to), promotion: m.promotion })
    return position(c, s.initialFen)
  },
})
