import { engines } from '../games'
import { isGameId, isRecord, type GameId, type GameState, type Winner } from '../games/core/types'
import { isPlayableId, type PlayableId } from '../party/catalog'

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  sound: boolean
  debug: boolean
  installDismissed: boolean
  lastGame: PlayableId
}
export interface HistoryEntry {
  id: string
  game: GameId
  at: string
  winner: Winner
  moves: number
  mode: 'local' | 'nearby'
}
const defaults: Settings = {
  theme: 'system',
  sound: false,
  debug: false,
  installDismissed: false,
  lastGame: 'othello',
}
let storageError = ''
export const getStorageError = () => storageError
function read(key: string): unknown {
  try {
    const value = localStorage.getItem(`obg:${key}`)
    return value && value.length < 300_000 ? JSON.parse(value) : null
  } catch {
    storageError = '保存データを読み込めませんでした。この画面では引き続き遊べます。'
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`obg:${key}`, JSON.stringify(value))
    storageError = ''
  } catch {
    storageError = '端末に保存できません。空き容量やプライベートブラウズ設定を確認してください。'
  }
}
export function loadSettings(): Settings {
  const s = read('settings')
  if (!isRecord(s)) return { ...defaults }
  return {
    theme: s.theme === 'dark' || s.theme === 'light' ? s.theme : 'system',
    sound: s.sound === true,
    debug: s.debug === true,
    installDismissed: s.installDismissed === true,
    lastGame: isPlayableId(s.lastGame) ? s.lastGame : 'othello',
  }
}
export const saveSettings = (s: Settings) => write('settings', s)
export function loadHistory(): HistoryEntry[] {
  const h = read('history')
  if (!Array.isArray(h)) return []
  return h
    .filter(
      (x): x is HistoryEntry =>
        isRecord(x) &&
        typeof x.id === 'string' &&
        isGameId(x.game) &&
        typeof x.at === 'string' &&
        Number.isFinite(Date.parse(x.at)) &&
        [0, 1, 'draw'].includes(x.winner as number | string) &&
        Number.isInteger(x.moves) &&
        (x.moves as number) >= 0 &&
        ['local', 'nearby'].includes(String(x.mode)),
    )
    .slice(0, 100)
}
export function recordHistory(h: HistoryEntry) {
  const history = loadHistory()
  const previous = history.find((x) => x.id === h.id)
  if (previous && previous.winner === h.winner && previous.moves === h.moves) return
  write(
    'history',
    [{ ...h, at: previous?.at || h.at }, ...history.filter((x) => x.id !== h.id)].slice(0, 100),
  )
}
export function saveGame(state: GameState, winner: Winner, id: string) {
  write(`game:${state.game}`, { state: engines[state.game].serialize(state), winner, id })
}
export function loadGame(game: GameId): { state: GameState; winner: Winner; id: string } | null {
  const value = read(`game:${game}`)
  if (
    !isRecord(value) ||
    typeof value.state !== 'string' ||
    typeof value.id !== 'string' ||
    ![null, 0, 1, 'draw'].includes(value.winner as Winner)
  )
    return null
  try {
    return {
      state: engines[game].deserialize(value.state),
      winner: value.winner as Winner,
      id: value.id,
    }
  } catch {
    storageError = '前回の対局データが破損しているため、新しい対局を開始します。'
    return null
  }
}
