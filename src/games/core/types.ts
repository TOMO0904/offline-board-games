export const gameIds = ['othello', 'chess', 'shogi', 'gomoku', 'connect-four'] as const
export type GameId = (typeof gameIds)[number]
export type Player = 0 | 1
export type Winner = Player | 'draw' | null
export interface Piece {
  owner: Player
  kind: string
  promoted?: boolean
}
export interface Move {
  to: number
  from?: number
  drop?: string
  promote?: boolean
  promotion?: string
}
export interface PositionRecord {
  key: string
  checking: Player | null
  mover?: Player
}
export interface GameState {
  game: GameId
  board: (Piece | null)[]
  turn: Player
  ply: number
  winner: Winner
  history: Move[]
  check?: boolean
  passed?: Player
  hands?: [Record<string, number>, Record<string, number>]
  positions?: PositionRecord[]
  initialFen?: string
  fen?: string
  reason?: string
}
export interface GameEngine {
  id: GameId
  name: string
  columns: number
  rows: number
  createInitialState(): GameState
  getLegalMoves(state: GameState): Move[]
  isLegalMove(state: GameState, move: Move): boolean
  applyMove(state: GameState, move: Move): GameState
  isGameOver(state: GameState): boolean
  getWinner(state: GameState): Winner
  serialize(state: GameState): string
  deserialize(value: string): GameState
}
export const other = (p: Player): Player => (p === 0 ? 1 : 0)
export const isGameId = (v: unknown): v is GameId => gameIds.some((id) => id === v)
export const sameMove = (a: Move, b: Move) =>
  a.to === b.to &&
  a.from === b.from &&
  a.drop === b.drop &&
  !!a.promote === !!b.promote &&
  a.promotion === b.promotion
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
export function validMove(v: unknown): v is Move {
  if (!isRecord(v) || !Number.isInteger(v.to) || (v.to as number) < 0 || (v.to as number) > 224)
    return false
  if (Object.keys(v).some((k) => !['to', 'from', 'drop', 'promote', 'promotion'].includes(k)))
    return false
  return (
    (v.from === undefined ||
      (Number.isInteger(v.from) && (v.from as number) >= 0 && (v.from as number) <= 224)) &&
    (v.drop === undefined || (typeof v.drop === 'string' && /^[PLNSGBR]$/.test(v.drop))) &&
    (v.promote === undefined || typeof v.promote === 'boolean') &&
    (v.promotion === undefined || (typeof v.promotion === 'string' && /^[qrbn]$/.test(v.promotion)))
  )
}
