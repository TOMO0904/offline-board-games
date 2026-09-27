import { isRecord } from '../games/core/types'
import { fingerprint } from '../networking/signaling'
import { isPartyId, normalizeRules, partyCatalog } from './catalog'
import { requireRule, type PartyView } from './types'

const arrays = [
  'names',
  'winners',
  'ranking',
  'losers',
  'hand',
  'counts',
  'table',
  'board',
  'scores',
  'roundScores',
  'passed',
  'lock',
  'selected',
  'trickPlayers',
] as const
const numbers = [
  'seat',
  'turn',
  'step',
  'round',
  'stockCount',
  'activeSuit',
  'claim',
  'pendingCount',
  'lastPlayer',
  'roll',
  'bank',
] as const
const fields = ['game', 'rules', 'phase', 'reversed', 'jBack', 'info', ...arrays, ...numbers]
export function validateView(v: unknown): v is PartyView {
  if (
    !isRecord(v) ||
    !isPartyId(v.game) ||
    Object.keys(v).length !== fields.length ||
    Object.keys(v).some((k) => !fields.includes(k))
  )
    return false
  if (
    !Array.isArray(v.names) ||
    v.names.length < 2 ||
    v.names.length > 7 ||
    !Array.from(v.names).every((n) => typeof n === 'string' && n.length <= 20)
  )
    return false
  if (
    !isRecord(v.rules) ||
    JSON.stringify(normalizeRules(v.game, v.rules)) !== JSON.stringify(v.rules)
  )
    return false
  if (
    !['play', 'reveal', 'challenge', 'round-end', 'finished'].includes(String(v.phase)) ||
    typeof v.reversed !== 'boolean' ||
    typeof v.jBack !== 'boolean' ||
    typeof v.info !== 'string' ||
    v.info.length > 1000
  )
    return false
  if (
    !numbers.every(
      (k) => Number.isSafeInteger(v[k]) && Number(v[k]) >= -1 && Number(v[k]) <= 1_000_000,
    )
  )
    return false
  if (
    !arrays
      .filter((k) => k !== 'names')
      .every(
        (k) =>
          Array.isArray(v[k]) &&
          (v[k] as unknown[]).length <= 120 &&
          Array.from(v[k] as unknown[]).every(
            (n) => Number.isSafeInteger(n) && Number(n) >= -2 && Number(n) <= 1_000_000,
          ),
      )
  )
    return false
  const n = v.names.length
  if (n < partyCatalog[v.game].min || n > partyCatalog[v.game].max) return false
  if (v.game === 'mancala' && (v.board as number[]).length !== 14) return false
  if (
    v.game === 'yacht' &&
    ((v.board as number[]).length !== n * 12 || ![0, 5].includes((v.table as number[]).length))
  )
    return false
  if (
    v.game === 'dominoes' &&
    (![0, 2].includes((v.board as number[]).length) ||
      ![...(v.hand as number[]), ...(v.table as number[])].every((id) => id >= 0 && id < 28))
  )
    return false
  return (
    Number(v.seat) >= 0 &&
    Number(v.seat) < n &&
    Number(v.turn) >= 0 &&
    Number(v.turn) < n &&
    Number(v.step) <= 10000 &&
    Number(v.stockCount) >= 0 &&
    Number(v.stockCount) <= 53 &&
    Number(v.activeSuit) >= 0 &&
    Number(v.activeSuit) <= 3 &&
    Number(v.claim) >= 1 &&
    Number(v.claim) <= 13 &&
    Number(v.roll) >= 0 &&
    Number(v.roll) <= 6 &&
    Number(v.lastPlayer) < n &&
    (v.board as number[]).every((x) => x >= -2 && x <= (v.game === 'mancala' ? 72 : 52)) &&
    (v.selected as number[]).every((x) => x >= 0 && x < 120) &&
    (v.lock as number[]).every((x) => x >= 0 && x <= 3) &&
    ['counts', 'scores', 'roundScores'].every((k) => (v[k] as unknown[]).length === n) &&
    ['winners', 'ranking', 'losers', 'trickPlayers'].every((k) =>
      (v[k] as number[]).every((p) => p >= 0 && p < n),
    ) &&
    (v.hand as number[]).every((c) => c >= 0 && c <= 52) &&
    new Set(v.hand as number[]).size === (v.hand as number[]).length &&
    (v.table as number[]).every((c) => c >= 0 && c <= 52) &&
    (v.counts as number[]).every((c) => c >= 0 && c <= 53)
  )
}
export interface Delta {
  [field: string]: unknown
}
export const viewHash = (v: PartyView) => fingerprint(JSON.stringify(v))
export function diffView(before: PartyView, after: PartyView): Delta {
  const a = before as unknown as Record<string, unknown>,
    b = after as unknown as Record<string, unknown>,
    delta: Delta = {}
  for (const key of fields) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue
    if (Array.isArray(b[key]) && Array.isArray(a[key])) {
      const old = a[key] as unknown[],
        next = b[key] as unknown[]
      delta[key] = { n: next.length, p: next.flatMap((x, i) => (x === old[i] ? [] : [[i, x]])) }
    } else delta[key] = b[key]
  }
  return delta
}
export function applyDelta(before: PartyView, delta: unknown): PartyView {
  requireRule(
    isRecord(delta) && Object.keys(delta).every((k) => fields.includes(k)),
    '差分データが不正です。',
  )
  const next = structuredClone(before) as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(delta)) {
    if (arrays.includes(key as (typeof arrays)[number])) {
      requireRule(
        isRecord(value) &&
          Number.isInteger(value.n) &&
          Number(value.n) >= 0 &&
          Number(value.n) <= 120 &&
          Array.isArray(value.p) &&
          value.p.length <= 120,
      )
      const a = [...(next[key] as unknown[])]
      a.length = Number(value.n)
      for (const pair of value.p) {
        requireRule(
          Array.isArray(pair) &&
            pair.length === 2 &&
            Number.isInteger(pair[0]) &&
            pair[0] >= 0 &&
            pair[0] < a.length,
        )
        a[pair[0]] = pair[1]
      }
      next[key] = a
    } else next[key] = value
  }
  requireRule(validateView(next), '更新後の盤面を検証できません。')
  return next
}
export interface RoomPacket {
  v: 2
  room: string
  t: 'hello' | 'action' | 'snapshot' | 'delta' | 'sync' | 'vote' | 'ping' | 'pong' | 'error'
  seq: number
  data: Record<string, unknown>
}
export function parseRoom(raw: unknown): RoomPacket {
  requireRule(typeof raw === 'string' && raw.length <= 32_000, '通信サイズが大きすぎます。')
  const p: unknown = JSON.parse(raw)
  requireRule(
    isRecord(p) &&
      p.v === 2 &&
      typeof p.room === 'string' &&
      /^[\w-]{8,80}$/.test(p.room) &&
      ['hello', 'action', 'snapshot', 'delta', 'sync', 'vote', 'ping', 'pong', 'error'].includes(
        String(p.t),
      ) &&
      Number.isSafeInteger(p.seq) &&
      Number(p.seq) >= 0 &&
      Number(p.seq) <= 1_000_000 &&
      isRecord(p.data),
    '通信データが不正です。',
  )
  return p as unknown as RoomPacket
}
export const encodeRoom = (p: RoomPacket) => {
  const raw = JSON.stringify(p)
  parseRoom(raw)
  return raw
}
