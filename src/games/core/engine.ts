import { isRecord, sameMove, validMove, type GameEngine, type GameState, type Move } from './types'

export const MAX_PLIES = 2000
type Rules = Pick<
  GameEngine,
  'id' | 'name' | 'columns' | 'rows' | 'createInitialState' | 'getLegalMoves'
> & {
  next(state: GameState, move: Move): GameState
}

export function makeEngine(rules: Rules): GameEngine {
  const engine: GameEngine = {
    ...rules,
    isLegalMove: (s, m) =>
      validMove(m) &&
      s.winner === null &&
      s.ply < MAX_PLIES &&
      rules.getLegalMoves(s).some((x) => sameMove(x, m)),
    applyMove(s, m) {
      if (!engine.isLegalMove(s, m))
        throw new Error('この手は指せません。盤面と手番を確認してください。')
      const next = rules.next(s, m)
      next.history = [...s.history, { ...m }]
      next.ply = s.ply + 1
      if (next.ply >= MAX_PLIES && next.winner === null) {
        next.winner = 'draw'
        next.reason = '2000手の上限に達したため引き分け'
      }
      return next
    },
    isGameOver: (s) => s.winner !== null,
    getWinner: (s) => s.winner,
    serialize: (s) => JSON.stringify({ v: 1, game: rules.id, moves: s.history }),
    deserialize(value) {
      if (value.length > 160_000) throw new Error('保存データが大きすぎます。')
      const data: unknown = JSON.parse(value)
      if (
        !isRecord(data) ||
        data.v !== 1 ||
        data.game !== rules.id ||
        !Array.isArray(data.moves) ||
        data.moves.length > MAX_PLIES ||
        !data.moves.every(validMove)
      )
        throw new Error('ゲームデータが不正です。')
      return data.moves.reduce<GameState>(
        (s, m) => engine.applyMove(s, m),
        rules.createInitialState(),
      )
    },
  }
  return engine
}

export function lineWinner(
  board: GameState['board'],
  width: number,
  height: number,
  last: number,
  length: number,
): boolean {
  const owner = board[last]?.owner
  if (owner === undefined) return false
  const x = last % width,
    y = Math.floor(last / width)
  return [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ].some(([dx, dy]) => {
    let count = 1
    for (const sign of [-1, 1])
      for (let step = 1; ; step++) {
        const nx = x + dx * step * sign,
          ny = y + dy * step * sign
        if (
          nx < 0 ||
          nx >= width ||
          ny < 0 ||
          ny >= height ||
          board[ny * width + nx]?.owner !== owner
        )
          break
        count++
      }
    return count >= length
  })
}
