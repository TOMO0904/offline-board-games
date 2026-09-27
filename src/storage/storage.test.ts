import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  loadGame,
  loadHistory,
  loadSettings,
  recordHistory,
  saveGame,
  saveSettings,
  getStorageError,
} from './storage'
import { engines } from '../games'
import { loadSetup, saveSetup } from './setup'
import { loadPartyHistory, recordPartyHistory } from '../party/storage'
const values = new Map<string, string>()
beforeEach(() => {
  values.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())
it('ゲームごとの人数・時計・ルールを保存し、破損や範囲外は初期化する', () => {
  saveSetup('daifugo', {
    time: { minutes: 0, increment: 0, byoyomi: 0 },
    names: ['A', 'B', 'C', 'D'],
    rules: { jBack: false },
  })
  expect(loadSetup('daifugo').names).toHaveLength(4)
  expect(loadSetup('daifugo').rules.jBack).toBe(false)
  expect(loadSetup('mancala').names).toHaveLength(2)
  values.set('obg:setup:shogi', '{broken')
  expect(loadSetup('shogi').time.minutes).toBe(0)
  saveSettings({ ...loadSettings(), lastGame: 'yacht' })
  expect(loadSettings().lastGame).toBe('yacht')
})
it('多人数の勝者を保存し、重複せず、容量不足を報告する', () => {
  const h = {
    id: 'party-test',
    game: 'yacht' as const,
    at: '2026-09-27T00:00:00Z',
    names: ['A', 'B', 'C'],
    winners: [0, 2],
    moves: 100,
    mode: 'local' as const,
  }
  recordPartyHistory(h)
  recordPartyHistory(h)
  expect(loadPartyHistory()).toEqual([h])
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
  })
  expect(recordPartyHistory(h)).toMatch(/保存できません/)
  expect(loadPartyHistory()).toEqual([])
})
it('uses safe defaults for broken settings and saves preferences', () => {
  values.set('obg:settings', '{bad')
  expect(loadSettings().theme).toBe('system')
  saveSettings({ ...loadSettings(), theme: 'dark', sound: true })
  expect(loadSettings()).toMatchObject({ theme: 'dark', sound: true })
})
it('replays saved games and rejects corrupt histories', () => {
  const state = engines.othello.applyMove(engines.othello.createInitialState(), { to: 19 })
  saveGame(state, null, 'test-id')
  expect(loadGame('othello')?.state).toEqual(state)
  values.set(
    'obg:game:othello',
    JSON.stringify({
      state: '{"v":1,"game":"othello","moves":[{"to":0}]}',
      id: 'test-id',
      winner: null,
    }),
  )
  expect(loadGame('othello')).toBeNull()
})
it('does not change the end time when a completed game is reopened', () => {
  const h = {
    id: 'game-id',
    game: 'othello' as const,
    at: '2026-09-26T00:00:00Z',
    winner: 0 as const,
    moves: 60,
    mode: 'local' as const,
  }
  recordHistory(h)
  recordHistory({ ...h, at: '2026-09-27T00:00:00Z' })
  expect(loadHistory()).toEqual([h])
})
it('handles quota errors and restricts history to 100 entries', () => {
  for (let i = 0; i < 101; i++)
    recordHistory({
      id: String(i),
      game: 'gomoku',
      at: '2026-09-26T00:00:00Z',
      winner: 0,
      moves: 9,
      mode: 'local',
    })
  expect(loadHistory()).toHaveLength(100)
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceeded')
    },
  })
  expect(() => saveSettings(loadSettings())).not.toThrow()
  expect(getStorageError()).toContain('保存できません')
})
