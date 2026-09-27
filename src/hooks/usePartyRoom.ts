import { useCallback, useEffect, useRef, useState } from 'react'
import { PeerLink } from '../networking/peer'
import { decodeSignal } from '../networking/signaling'
import { newId } from '../utils/id'
import { createParty } from '../party/engine'
import { PartyGuest, PartyHost } from '../party/room'
import type { PartyId, PartyRules } from '../party/catalog'

export function usePartyRoom(game: PartyId, names: string[], rules: PartyRules) {
  const [, render] = useState(0),
    [role, setRole] = useState<'host' | 'guest' | null>(null),
    [outgoing, setOutgoing] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [seat, setSeat] = useState(1)
  const host = useRef<PartyHost | null>(null),
    guest = useRef<PartyGuest | null>(null),
    links = useRef(new Map<number, PeerLink>()),
    ids = useRef(new Map<number, string>()),
    guestLink = useRef<PeerLink | null>(null)
  const changed = useCallback(() => render((n) => n + 1), [])
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        host.current?.heartbeat()
      } catch {
        /* Connection status is visible. */
      }
    }, 60_000)
    const peers = links.current
    return () => {
      clearInterval(timer)
      for (const l of peers.values()) l.close()
      guestLink.current?.close()
    }
  }, [])
  function create() {
    if (!host.current) {
      host.current = new PartyHost(newId(), createParty(game, names, rules))
      host.current.onChange = changed
    }
    setRole('host')
    guestLink.current?.close()
    guest.current = null
    changed()
  }
  async function invite(p = seat) {
    if (busy) return
    create()
    setSeat(p)
    setBusy(true)
    setError('')
    setOutgoing('')
    try {
      const h = host.current!
      links.current.get(p)?.close()
      const link = new PeerLink()
      links.current.set(p, link)
      h.attach(p, link)
      h.presence(p)
      link.onChange = () => {
        h.presence(p)
        changed()
      }
      link.onError = setError
      link.onMessage = (raw) => h.receive(p, raw)
      link.onOpen = () => h.presence(p)
      const id = ids.current.get(p) || `${h.room}_${p}_${newId().replaceAll('-', '').slice(0, 8)}`
      ids.current.set(p, id)
      setOutgoing(await link.offer(game, id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続情報を作れませんでした。')
    } finally {
      setBusy(false)
    }
  }
  async function receive(text: string) {
    if (busy) return
    const signal = decodeSignal(text)
    if (signal.g !== game) throw new Error('全員で同じゲームを選択してください。')
    setBusy(true)
    setError('')
    try {
      if (signal.t === 'answer') {
        if (role !== 'host' || signal.m !== ids.current.get(seat))
          throw new Error('選択中の席への返信ではありません。席を確認してください。')
        await links.current.get(seat)!.accept(signal)
      } else {
        if (role === 'host') throw new Error('ホストでは参加側の返信を読み取ってください。')
        const parts = /^([\w-]{8,50})_([1-6])_([\w-]{8})$/.exec(signal.m)
        if (!parts) throw new Error('多人数対戦の接続情報ではありません。')
        const link = guestLink.current ?? new PeerLink()
        guestLink.current = link
        const p = Number(parts[2])
        setSeat(p)
        if (!guest.current || guest.current.room !== parts[1] || guest.current.seat !== p)
          guest.current = new PartyGuest(parts[1], p, link)
        const g = guest.current
        g.onChange = changed
        link.onChange = changed
        link.onError = setError
        link.onMessage = (raw) => g.receive(raw)
        link.onOpen = () => g.opened()
        setRole('guest')
        setOutgoing(await link.answer(signal))
      }
      changed()
    } finally {
      setBusy(false)
    }
  }
  return {
    role,
    host: host.current,
    guest: guest.current,
    links: links.current,
    guestLink: guestLink.current,
    seat,
    setSeat: (p: number) => {
      setSeat(p)
      setOutgoing('')
    },
    outgoing,
    busy,
    error,
    create,
    invite,
    receive,
    join: () => {
      setRole('guest')
      setOutgoing('')
      setError('')
    },
    changed,
  }
}
