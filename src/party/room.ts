import type { Transport } from '../networking/match'
import { applyParty, createParty, partyView } from './engine'
import {
  applyDelta,
  diffView,
  encodeRoom,
  parseRoom,
  validateView,
  viewHash,
  type RoomPacket,
} from './protocol'
import {
  random,
  requireRule,
  type PartyAction,
  type PartyState,
  type PartyView,
  type Random,
} from './types'

export class PartyHost {
  sequence = 0
  started = false
  votes: number[] = []
  online: boolean[]
  notice = ''
  onChange: () => void = () => {}
  links = new Map<number, Transport>()
  private sent = new Map<number, PartyView>()
  private generation = 0
  constructor(
    readonly room: string,
    public state: PartyState,
    private rng: Random = random,
  ) {
    this.online = state.names.map((_, i) => i === 0)
  }
  get view() {
    return partyView(this.state, 0)
  }
  get allOnline() {
    return this.online.every(Boolean)
  }
  private packet(seat: number, t: RoomPacket['t'], data: Record<string, unknown> = {}) {
    const link = this.links.get(seat)
    if (link?.open) link.send(encodeRoom({ v: 2, room: this.room, t, seq: this.sequence, data }))
  }
  private status() {
    return {
      started: this.started,
      online: this.online,
      votes: this.votes,
      generation: this.generation,
    }
  }
  private publish(fullSeat?: number) {
    for (const [seat, link] of this.links) {
      if (!link.open) continue
      const next = partyView(this.state, seat),
        before = this.sent.get(seat),
        full = !before || fullSeat === seat
      try {
        this.packet(seat, full ? 'snapshot' : 'delta', {
          ...this.status(),
          view: full ? next : diffView(before!, next),
          hash: viewHash(next),
        })
        this.sent.set(seat, next)
      } catch {
        this.notice = '送信が中断されました。接続を確認して再同期してください。'
      }
    }
    this.onChange()
  }
  attach(seat: number, link: Transport) {
    requireRule(seat > 0 && seat < this.state.names.length)
    this.links.set(seat, link)
    this.sent.delete(seat)
  }
  presence(seat: number) {
    const open = !!this.links.get(seat)?.open
    if (this.online[seat] !== open) {
      this.online[seat] = open
      this.sequence++
      this.publish(open ? seat : undefined)
    }
  }
  start() {
    requireRule(!this.started && this.allOnline, '全員の接続を待ってください。')
    this.started = true
    this.sequence++
    this.publish()
  }
  act(seat: number, a: PartyAction) {
    requireRule(this.started && this.allOnline, '全員の接続がそろうと再開します。')
    this.state = applyParty(this.state, seat, a, this.rng)
    this.sequence++
    this.votes = []
    this.publish()
  }
  vote(seat: number) {
    requireRule(this.started && this.allOnline, '全員の接続を待ってください。')
    if (!this.votes.includes(seat)) this.votes.push(seat)
    if (this.votes.length === this.state.names.length) {
      this.state = createParty(this.state.game, this.state.names, this.state.rules, this.rng)
      this.votes = []
      this.generation++
    }
    this.sequence++
    this.publish()
  }
  receive(seat: number, raw: string) {
    try {
      const p = parseRoom(raw)
      requireRule(p.room === this.room && this.links.get(seat)?.open, '別の部屋のデータです。')
      if (p.t === 'hello' || p.t === 'sync') {
        this.online[seat] = true
        this.sequence++
        this.publish(seat)
      } else if (p.t === 'ping') this.packet(seat, 'pong')
      else if (p.t === 'action' || p.t === 'vote') {
        if (p.seq !== this.sequence) {
          this.publish(seat)
          return
        }
        if (p.t === 'action') this.act(seat, p.data.action as PartyAction)
        else this.vote(seat)
      } else if (p.t !== 'pong') throw new Error('参加側からのこのメッセージは受け付けません。')
    } catch (e) {
      this.notice = e instanceof Error ? e.message : '通信データを処理できません。'
      this.packet(seat, 'error', { message: this.notice })
      this.onChange()
    }
  }
  heartbeat() {
    for (const [seat, link] of this.links) {
      this.presence(seat)
      if (link.open) this.packet(seat, 'ping')
    }
  }
  get roundId() {
    return this.generation
  }
}
export class PartyGuest {
  sequence = 0
  started = false
  online: boolean[] = []
  votes: number[] = []
  generation = 0
  view: PartyView | null = null
  notice = ''
  onChange: () => void = () => {}
  constructor(
    readonly room: string,
    readonly seat: number,
    private link: Transport,
  ) {}
  private send(t: RoomPacket['t'], data: Record<string, unknown> = {}) {
    this.link.send(encodeRoom({ v: 2, room: this.room, t, seq: this.sequence, data }))
  }
  opened() {
    this.send('hello')
  }
  sync() {
    this.send('sync')
  }
  act(action: PartyAction) {
    requireRule(this.started && this.online.every(Boolean) && this.link.open)
    this.send('action', { action })
  }
  vote() {
    this.send('vote')
  }
  receive(raw: string) {
    try {
      const p = parseRoom(raw)
      requireRule(p.room === this.room)
      if (p.t === 'snapshot' || p.t === 'delta') {
        if (p.seq < this.sequence) return
        if (p.t === 'delta' && (p.seq !== this.sequence + 1 || !this.view)) {
          if (p.seq > this.sequence) this.sync()
          return
        }
        const v = p.t === 'snapshot' ? p.data.view : applyDelta(this.view!, p.data.view)
        requireRule(
          validateView(v) &&
            v.seat === this.seat &&
            (!this.view || v.game === this.view.game) &&
            viewHash(v) === p.data.hash,
        )
        const d = p.data,
          n = v.names.length
        requireRule(
          typeof d.started === 'boolean' &&
            Array.isArray(d.online) &&
            d.online.length === n &&
            d.online.every((x) => typeof x === 'boolean') &&
            Array.isArray(d.votes) &&
            d.votes.length <= n &&
            d.votes.every((x) => Number.isInteger(x) && x >= 0 && x < n) &&
            Number.isSafeInteger(d.generation) &&
            Number(d.generation) >= 0,
        )
        this.view = v
        this.sequence = p.seq
        this.started = d.started
        this.online = d.online
        this.votes = d.votes
        this.generation = Number(d.generation)
        this.notice = ''
      } else if (p.t === 'ping') this.send('pong')
      else if (p.t === 'error') {
        this.notice =
          typeof p.data.message === 'string'
            ? p.data.message.slice(0, 160)
            : '操作が受理されませんでした。'
      } else if (p.t !== 'pong') throw new Error('予期しないメッセージです。')
    } catch {
      this.notice = '通信内容に不一致があります。再同期してください。'
      try {
        this.sync()
      } catch {
        /* Link status is shown separately. */
      }
    }
    this.onChange()
  }
}
