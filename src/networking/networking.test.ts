import { describe, expect, it, vi } from 'vitest'
import { noClock, type TimeControl } from '../games/core/clock'
import { decodeSignal, encodeSignal, SignalCollector, splitSignal, type Signal } from './signaling'
import { classifySequence, encodePacket, parsePacket, type Packet } from './protocol'
import { Match, type Transport } from './match'
import { engines } from '../games'
import { frameMessage, FrameReceiver } from './framing'
const signal: Signal = {
  v: 1,
  g: 'othello',
  m: 'abcdefgh-12345678',
  t: 'offer',
  s: 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1 1 udp 123 192.168.1.2 5000 typ host\r\n',
}
describe('manual and multipart QR signaling', () => {
  it('compresses, encodes and decodes SDP', () =>
    expect(decodeSignal(encodeSignal(signal))).toEqual(signal))
  it('rejects malformed and oversized input', () => {
    for (const text of ['garbage', 'OBG1.notbase64', 'OBG1.' + 'A'.repeat(48000)])
      expect(() => decodeSignal(text)).toThrow()
    expect(() => encodeSignal({ ...signal, s: 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96' })).toThrow()
  })
  it('assembles split QR in any order and ignores duplicate frames', () => {
    const text = encodeSignal({
      ...signal,
      s:
        signal.s +
        Array.from(
          { length: 80 },
          (_, i) => `a=candidate:${i} 1 udp ${i * 345} 192.168.1.${i + 1} ${1234 + i} typ host\r\n`,
        ).join(''),
    })
    const parts = splitSignal(text),
      collector = new SignalCollector()
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length < 600)).toBe(true)
    collector.add(parts.at(-1)!)
    collector.add(parts.at(-1)!)
    let result
    for (const p of [...parts].reverse()) result = collector.add(p)
    expect(result?.text).toBe(text)
  })
  it('rejects mixed sessions and invalid indices', () => {
    const c = new SignalCollector()
    c.add('OBGQ1:abc:1:2:OBG1.AAAA')
    expect(() => c.add('OBGQ1:def:2:2:AAAA')).toThrow()
    expect(() => c.add('OBGQ1:abc:0:2:AAAA')).toThrow()
  })
})
describe('protocol', () => {
  const p: Packet = {
    protocolVersion: 1,
    game: 'othello',
    matchId: 'abcdefgh',
    sequence: 1,
    type: 'move',
    payload: { move: { to: 19 }, before: 'a', after: 'b' },
  }
  it('serializes and deserializes', () => expect(parsePacket(encodePacket(p))).toEqual(p))
  it('detects next, duplicate, reversed, and missing sequence numbers', () => {
    expect(classifySequence(4, 5)).toBe('next')
    expect(classifySequence(4, 4)).toBe('duplicate')
    expect(classifySequence(4, 2)).toBe('duplicate')
    expect(classifySequence(4, 7)).toBe('gap')
  })
  it('rejects unknown versions, malformed JSON, invalid moves and large payloads', () => {
    for (const raw of [
      '{',
      'x'.repeat(200001),
      JSON.stringify({ ...p, protocolVersion: 2 }),
      JSON.stringify({ ...p, payload: { move: { to: -1 }, before: '', after: '' } }),
    ])
      expect(() => parsePacket(raw)).toThrow()
  })
})
describe('bounded DataChannel frames', () => {
  it('leaves small moves alone and splits large sync data below 16 KiB', () => {
    expect(frameMessage('{"move":19}')).toEqual(['{"move":19}'])
    const raw = JSON.stringify({ state: '盤'.repeat(40000) }),
      frames = frameMessage(raw),
      receiver = new FrameReceiver()
    expect(frames.length).toBeGreaterThan(1)
    expect(frames.every((f) => new TextEncoder().encode(f).length < 16384)).toBe(true)
    let complete: string | null = null
    for (const f of frames) complete = receiver.receive(f)
    expect(complete).toBe(raw)
  })
  it('rejects oversize frames, mixed transfers, and corrupt data', () => {
    const receiver = new FrameReceiver()
    expect(() => receiver.receive('OBGF1:abc:0:1000:bad')).toThrow()
    receiver.receive('OBGF1:abc:0:2:first')
    expect(() => receiver.receive('OBGF1:def:1:2:second')).toThrow()
    expect(() => receiver.receive('OBGF1:abc:0:1:bad')).toThrow()
  })
})
function pair(time: TimeControl = noClock) {
  const queue: { to: 'host' | 'guest'; raw: string }[] = []
  const sent: string[] = []
  const hostTransport: Transport = {
    open: true,
    send: (raw) => {
      queue.push({ to: 'guest', raw })
      sent.push(raw)
    },
  }
  const guestTransport: Transport = {
    open: true,
    send: (raw) => {
      queue.push({ to: 'host', raw })
      sent.push(raw)
    },
  }
  const host = new Match('othello', 'abcdefgh-12345678', 'host', hostTransport, undefined, time)
  const guest = new Match('othello', 'abcdefgh-12345678', 'guest', guestTransport)
  const flush = () => {
    let n = 0
    while (queue.length) {
      if (++n > 40) throw new Error('protocol loop')
      const m = queue.shift()!
      ;(m.to === 'host' ? host : guest).receive(m.raw)
    }
  }
  host.opened()
  guest.opened()
  flush()
  return { host, guest, flush, sent, queue, hostTransport, guestTransport }
}
describe('P2P match session', () => {
  it('ホストの時計設定で加算・時間切れ・切断停止・再戦を同期する', () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    try {
      const { host, guest, flush, sent, hostTransport } = pair({
        minutes: 1,
        increment: 3,
        byoyomi: 0,
      })
      expect(guest.clock.config).toEqual(host.clock.config)
      sent.length = 0
      vi.setSystemTime(105000)
      host.move({ to: 19 })
      flush()
      expect(guest.clock.snapshot().remaining[0]).toBe(58000)
      vi.setSystemTime(110000)
      guest.move({ to: 18 })
      flush()
      expect(host.clock.snapshot().remaining[1]).toBe(58000)
      expect(sent.filter((s) => parsePacket(s).type === 'clock_sync')).toHaveLength(1)
      hostTransport.open = false
      host.tick()
      vi.setSystemTime(900000)
      expect(host.clock.snapshot().remaining[0]).toBe(58000)
      hostTransport.open = true
      host.opened()
      guest.opened()
      flush()
      vi.setSystemTime(960000)
      host.tick()
      flush()
      expect(host.winner).toBe(1)
      expect(guest.winner).toBe(1)
      guest.requestRestart()
      flush()
      host.acceptRestart()
      flush()
      expect(guest.clock.running).toBe(true)
      expect(guest.winner).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
  it('時間切れ後に届いた参加側の一手を適用せず再同期する', () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    try {
      const { host, guest, flush } = pair({ minutes: 1, increment: 0, byoyomi: 0 })
      host.move({ to: 19 })
      flush()
      vi.setSystemTime(161000)
      guest.move({ to: 18 })
      flush()
      expect(host.state.ply).toBe(1)
      expect(guest.state.ply).toBe(1)
      expect(guest.winner).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
  it('handshakes and exchanges only moves during normal play', () => {
    const { host, guest, flush, sent } = pair()
    expect(host.ready && guest.ready).toBe(true)
    sent.length = 0
    host.move({ to: 19 })
    flush()
    guest.move({ to: 18 })
    flush()
    expect(host.hash).toBe(guest.hash)
    expect(host.sequence).toBe(2)
    expect(sent.map((s) => parsePacket(s).type)).toEqual(['move', 'move'])
    expect(sent.every((s) => s.length < 300)).toBe(true)
  })
  it('rejects wrong-turn and illegal moves without changing state', () => {
    const { host, guest, flush } = pair()
    expect(() => guest.move({ to: 19 })).toThrow()
    expect(() => host.move({ to: 0 })).toThrow()
    const before = host.hash
    host.receive(
      encodePacket({
        protocolVersion: 1,
        game: 'othello',
        matchId: host.matchId,
        type: 'move',
        sequence: 1,
        payload: { move: { to: 19 }, before: host.hash, after: 'bad' },
      }),
    )
    flush()
    expect(host.hash).toBe(before)
    expect(host.notice).toContain('手番')
  })
  it('ignores duplicates', () => {
    const { host, guest, flush, sent } = pair()
    host.move({ to: 19 })
    const raw = sent.at(-1)!
    flush()
    guest.receive(raw)
    expect(guest.sequence).toBe(1)
    expect(guest.state.ply).toBe(1)
  })
  it('resyncs after a sequence gap or divergent state', () => {
    const { host, guest, flush } = pair()
    host.move({ to: 19 })
    flush()
    guest.state = engines.othello.createInitialState()
    guest.sequence = 0
    guest.receive(
      encodePacket({
        protocolVersion: 1,
        game: 'othello',
        matchId: host.matchId,
        type: 'move',
        sequence: 3,
        payload: { move: { to: 18 }, before: 'wrong', after: 'wrong' },
      }),
    )
    flush()
    expect(guest.hash).toBe(host.hash)
    expect(guest.sequence).toBe(1)
  })
  it('uses host state on reconnect and restores an unreceived move', () => {
    const { host, guest, flush, queue } = pair()
    host.move({ to: 19 })
    queue.length = 0
    host.opened()
    guest.opened()
    flush()
    expect(guest.hash).toBe(host.hash)
  })
  it('requires a requested and accepted restart', () => {
    const { host, guest, flush } = pair()
    host.move({ to: 19 })
    flush()
    host.requestRestart()
    flush()
    expect(guest.pendingRestart).toBeTruthy()
    guest.acceptRestart()
    flush()
    expect(host.state.ply).toBe(0)
    expect(host.round).toBe(1)
    expect(host.hash).toBe(guest.hash)
  })
  it('validates resignations and synchronizes the result', () => {
    const { host, guest, flush } = pair()
    guest.resign()
    flush()
    expect(host.winner).toBe(0)
    expect(guest.winner).toBe(0)
    expect(host.canMove).toBe(false)
  })
  it('rejects guest snapshots and foreign matches', () => {
    const { host } = pair()
    const before = host.hash
    host.receive(
      encodePacket({
        protocolVersion: 1,
        game: 'othello',
        matchId: host.matchId,
        type: 'state_sync',
        sequence: 999,
        payload: {},
      }),
    )
    expect(host.hash).toBe(before)
    expect(host.notice).toContain('ホスト以外')
    host.receive(
      encodePacket({
        protocolVersion: 1,
        game: 'othello',
        matchId: 'different-id',
        type: 'resign',
        sequence: 1,
        payload: { player: 1 },
      }),
    )
    expect(host.winner).toBeNull()
  })
  it('never commits a local move if transport.send fails', () => {
    const { host, hostTransport } = pair()
    hostTransport.send = () => {
      throw new Error('closed')
    }
    expect(() => host.move({ to: 19 })).toThrow()
    expect(host.state.ply).toBe(0)
  })
})
