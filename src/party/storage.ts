import { isRecord } from '../games/core/types'
import { isPartyId, type PartyId } from './catalog'
export interface PartyHistory {
  id: string
  game: PartyId
  at: string
  names: string[]
  winners: number[]
  moves: number
  mode: 'local' | 'nearby'
}
export function loadPartyHistory(): PartyHistory[] {
  try {
    const raw = localStorage.getItem('obg:party-history')
    if (!raw || raw.length > 300000) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value)
      ? value
          .filter(
            (v): v is PartyHistory =>
              isRecord(v) &&
              typeof v.id === 'string' &&
              isPartyId(v.game) &&
              typeof v.at === 'string' &&
              Number.isFinite(Date.parse(v.at)) &&
              Array.isArray(v.names) &&
              v.names.length >= 2 &&
              v.names.length <= 7 &&
              v.names.every((n) => typeof n === 'string' && n.length <= 20) &&
              Array.isArray(v.winners) &&
              v.winners.every(
                (p) => Number.isInteger(p) && p >= 0 && p < (v.names as unknown[]).length,
              ) &&
              Number.isInteger(v.moves) &&
              Number(v.moves) >= 0 &&
              ['local', 'nearby'].includes(String(v.mode)),
          )
          .slice(0, 100)
      : []
  } catch {
    return []
  }
}
export function recordPartyHistory(entry: PartyHistory) {
  try {
    const old = loadPartyHistory()
    if (old.some((h) => h.id === entry.id)) return
    localStorage.setItem('obg:party-history', JSON.stringify([entry, ...old].slice(0, 100)))
    return ''
  } catch {
    return 'この端末に対局履歴を保存できませんでした。'
  }
}
