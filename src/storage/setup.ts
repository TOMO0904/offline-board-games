import { isRecord } from '../games/core/types'
import { noClock, validTime, type TimeControl } from '../games/core/clock'
import {
  isPartyId,
  normalizeRules,
  partyCatalog,
  type PartyRules,
  type PlayableId,
} from '../party/catalog'
export interface GameSetup {
  time: TimeControl
  names: string[]
  rules: PartyRules
}
export function loadSetup(game: PlayableId): GameSetup {
  let stored: unknown = null
  try {
    const raw = localStorage.getItem(`obg:setup:${game}`)
    if (raw && raw.length < 6000) stored = JSON.parse(raw)
  } catch {
    /* Defaults remain usable. */
  }
  const s = isRecord(stored) ? stored : {},
    party = isPartyId(game) ? partyCatalog[game] : null
  const names =
    Array.isArray(s.names) &&
    s.names.length >= (party?.min ?? 2) &&
    s.names.length <= (party?.max ?? 2) &&
    s.names.every((n) => typeof n === 'string' && n.length <= 20)
      ? (s.names as string[])
      : Array.from(
          { length: party ? Math.min(party.max, Math.max(3, party.min)) : 2 },
          (_, i) => `プレイヤー${i + 1}`,
        )
  return {
    time: validTime(s.time) ? s.time : { ...noClock },
    names,
    rules: isPartyId(game) ? normalizeRules(game, s.rules) : {},
  }
}
export function saveSetup(game: PlayableId, setup: GameSetup) {
  try {
    localStorage.setItem(`obg:setup:${game}`, JSON.stringify(setup))
  } catch {
    /* Saving preferences is optional; do not block starting a game. */
  }
}
