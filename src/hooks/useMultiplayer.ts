import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameId, GameState } from '../games/core/types'
import { PeerLink } from '../networking/peer'
import { Match } from '../networking/match'
import { decodeSignal } from '../networking/signaling'
import { newId } from '../utils/id'
import { noClock, type TimeControl } from '../games/core/clock'

export function useMultiplayer(
  game: GameId,
  enabled: boolean,
  initial?: GameState,
  time: TimeControl = noClock,
) {
  const [link] = useState(() => new PeerLink()),
    session = useRef<Match | null>(null)
  const [, render] = useState(0),
    [outgoing, setOutgoing] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [role, setRole] = useState<'host' | 'guest' | null>(null)
  const initialState = useRef(initial)
  const changed = useCallback(() => render((n) => n + 1), [])
  useEffect(() => {
    link.onChange = () => {
      session.current?.tick()
      changed()
    }
    link.onError = setError
    link.onMessage = (raw) => session.current?.receive(raw)
    link.onOpen = () => {
      setError('')
      try {
        session.current?.opened()
      } catch (e) {
        setError(String(e))
      }
    }
    const timer = setInterval(() => {
      if (enabled && document.visibilityState === 'visible') {
        try {
          session.current?.heartbeat()
        } catch {
          /* Connection events show the failure. */
        }
        changed()
      }
    }, 30_000)
    const clockTimer = setInterval(() => {
      if (enabled && session.current?.clock.enabled) {
        session.current.tick()
        changed()
      }
    }, 250)
    return () => {
      clearInterval(timer)
      clearInterval(clockTimer)
      link.close()
    }
  }, [link, changed, enabled])
  function create(role: 'host' | 'guest', id: string) {
    const match = new Match(
      game,
      id,
      role,
      link,
      role === 'host' ? initialState.current : undefined,
      time,
    )
    match.onChange = changed
    session.current = match
    setRole(role)
    return match
  }
  async function host() {
    if (busy) return
    setBusy(true)
    setError('')
    setOutgoing('')
    try {
      const match = session.current?.role === 'host' ? session.current : create('host', newId())
      match.ready = false
      setOutgoing(await link.offer(game, match.matchId))
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続情報を作れませんでした。')
    } finally {
      setBusy(false)
    }
  }
  async function receive(text: string) {
    if (busy) return
    const signal = decodeSignal(text)
    if (signal.g !== game) throw new Error('相手と同じゲームを選択してください。')
    if (role === 'host' && signal.t === 'offer')
      throw new Error('ホスト側では相手の返信QRを読み取ってください。')
    if (
      signal.t === 'answer' &&
      (!session.current || session.current.role !== 'host' || session.current.matchId !== signal.m)
    )
      throw new Error('この対局への返信ではありません。新しいQRを交換してください。')
    setBusy(true)
    setError('')
    try {
      if (signal.t === 'offer') {
        create('guest', signal.m)
        setOutgoing(await link.answer(signal))
      } else await link.accept(signal)
      changed()
    } finally {
      setBusy(false)
    }
  }
  return {
    link,
    match: session.current,
    outgoing,
    error,
    busy,
    role,
    host,
    receive,
    join: () => {
      link.close()
      session.current = null
      setOutgoing('')
      setRole('guest')
      setError('')
    },
  }
}
