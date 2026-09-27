import { isGameId, isRecord, validMove, type GameId } from '../games/core/types'

export const messageTypes = [
  'hello',
  'ready',
  'game_start',
  'move',
  'state_request',
  'state_sync',
  'clock_sync',
  'resign',
  'restart_request',
  'restart_accept',
  'ping',
  'pong',
  'error',
] as const
export type MessageType = (typeof messageTypes)[number]
export interface Packet {
  protocolVersion: 1
  game: GameId
  matchId: string
  type: MessageType
  sequence: number
  payload: Record<string, unknown>
}
export const MAX_MESSAGE = 200_000
export function parsePacket(raw: unknown): Packet {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE)
    throw new Error('メッセージのサイズが不正です。')
  const p: unknown = JSON.parse(raw)
  if (
    !isRecord(p) ||
    p.protocolVersion !== 1 ||
    !isGameId(p.game) ||
    typeof p.matchId !== 'string' ||
    !/^[\w-]{8,80}$/.test(p.matchId) ||
    !messageTypes.includes(p.type as MessageType) ||
    !Number.isSafeInteger(p.sequence) ||
    (p.sequence as number) < 0 ||
    !isRecord(p.payload)
  )
    throw new Error('通信プロトコルが一致しません。両端末のアプリを更新してください。')
  if (
    p.type === 'move' &&
    (!validMove(p.payload.move) ||
      typeof p.payload.before !== 'string' ||
      typeof p.payload.after !== 'string')
  )
    throw new Error('不正な指し手を受信しました。')
  return p as unknown as Packet
}
export const encodePacket = (p: Packet) => {
  const raw = JSON.stringify(p)
  parsePacket(raw)
  return raw
}
export const classifySequence = (current: number, next: number): 'next' | 'duplicate' | 'gap' =>
  next <= current ? 'duplicate' : next === current + 1 ? 'next' : 'gap'
