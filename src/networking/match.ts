import { engines } from '../games'
import {
  other,
  type GameId,
  type GameState,
  type Move,
  type Player,
  type Winner,
} from '../games/core/types'
import { classifySequence, encodePacket, parsePacket, type MessageType } from './protocol'
import { fingerprint } from './signaling'
import { newId } from '../utils/id'
import { GameClock, noClock, validClock, type TimeControl } from '../games/core/clock'

export interface Transport {
  open: boolean
  send(raw: string): void
}
export class Match {
  state: GameState
  sequence = 0
  round = 0
  resigned: Player | null = null
  ready = false
  notice = ''
  pendingRestart: string | null = null
  requestedRestart: string | null = null
  lastSeen = 0
  clock: GameClock
  onChange: () => void = () => {}
  constructor(
    readonly game: GameId,
    readonly matchId: string,
    readonly role: 'host' | 'guest',
    private transport: Transport,
    initial?: GameState,
    time: TimeControl = noClock,
  ) {
    this.state = initial || engines[game].createInitialState()
    this.clock = new GameClock(time)
  }
  get player(): Player {
    return this.role === 'host' ? 0 : 1
  }
  get winner(): Winner {
    if (this.clock.expired !== null) return other(this.clock.expired)
    return this.resigned === null ? this.state.winner : other(this.resigned)
  }
  get canMove() {
    return (
      this.ready && this.transport.open && this.state.turn === this.player && this.winner === null
    )
  }
  get hash() {
    return fingerprint(
      JSON.stringify([engines[this.game].serialize(this.state), this.resigned, this.round]),
    )
  }
  private send(type: MessageType, payload: Record<string, unknown> = {}, sequence = this.sequence) {
    this.transport.send(
      encodePacket({
        protocolVersion: 1,
        game: this.game,
        matchId: this.matchId,
        type,
        sequence,
        payload,
      }),
    )
  }
  opened() {
    if (this.role === 'host') this.clock.pause()
    this.ready = false
    this.notice = ''
    this.send('hello', { role: this.role })
    this.onChange()
  }
  heartbeat() {
    if (this.ready && this.transport.open) this.send('ping')
  }
  sync() {
    if (this.role === 'host') this.send('state_sync', this.snapshot())
    else this.send('state_request')
  }
  private snapshot() {
    return {
      state: engines[this.game].serialize(this.state),
      resigned: this.resigned,
      round: this.round,
      hash: this.hash,
      clock: this.clock.snapshot(),
    }
  }
  move(move: Move) {
    this.tick()
    if (!this.canMove) throw new Error('相手の手番か、接続待ちです。')
    const next = engines[this.game].applyMove(this.state, move)
    const before = this.hash
    const after = fingerprint(
      JSON.stringify([engines[this.game].serialize(next), this.resigned, this.round]),
    )
    if (this.role === 'host' && !this.clock.move(next.turn)) {
      this.send('clock_sync', { clock: this.clock.snapshot() })
      this.onChange()
      throw new Error('持ち時間がなくなりました。')
    }
    this.send(
      'move',
      {
        move,
        before,
        after,
        ...(this.role === 'host' && this.clock.enabled ? { clock: this.clock.snapshot() } : {}),
      },
      this.sequence + 1,
    )
    this.state = next
    if (this.role === 'host' && this.winner !== null) this.clock.pause()
    this.sequence++
    this.notice = ''
    this.onChange()
  }
  resign() {
    if (!this.ready || !this.transport.open || this.winner !== null) return
    this.send('resign', { player: this.player, before: this.hash }, this.sequence + 1)
    this.resigned = this.player
    this.clock.pause()
    this.sequence++
    this.onChange()
  }
  requestRestart() {
    if (!this.ready || !this.transport.open) return
    const id = newId()
    this.send('restart_request', { id })
    this.requestedRestart = id
    this.notice = '相手の再戦承認を待っています。'
    this.onChange()
  }
  acceptRestart() {
    if (!this.pendingRestart || !this.transport.open) return
    this.send('restart_accept', { id: this.pendingRestart, before: this.hash }, this.sequence + 1)
    this.reset()
    if (this.role === 'host' && this.clock.enabled)
      this.send('clock_sync', { clock: this.clock.snapshot() })
    this.onChange()
  }
  private reset() {
    this.state = engines[this.game].createInitialState()
    this.resigned = null
    this.clock.reset()
    if (this.role === 'host') this.clock.start()
    this.round++
    this.sequence++
    this.pendingRestart = null
    this.requestedRestart = null
    this.notice = '新しい対局を開始しました。'
  }
  tick() {
    if (this.role !== 'host') {
      if (!this.transport.open && this.clock.running)
        this.clock.restore({ ...this.clock.snapshot(), running: false })
      return
    }
    if (!this.transport.open || !this.ready) {
      this.clock.pause()
      return
    }
    const before = this.clock.expired
    if (this.clock.check() !== null && before === null) {
      this.send('clock_sync', { clock: this.clock.snapshot() })
      this.notice = '持ち時間がなくなりました。'
      this.onChange()
    }
  }
  receive(raw: string) {
    try {
      const p = parsePacket(raw)
      if (p.game !== this.game || p.matchId !== this.matchId)
        throw new Error('別の対局のデータを拒否しました。')
      this.lastSeen = Date.now()
      const data = p.payload
      switch (p.type) {
        case 'hello':
          if (data.role !== (this.role === 'host' ? 'guest' : 'host'))
            throw new Error('ホストと参加側の役割が一致しません。')
          this.send('ready')
          break
        case 'ready':
          if (this.role === 'host') {
            this.ready = true
            if (this.winner === null) this.clock.start(this.state.turn)
            this.send('game_start', this.snapshot())
          }
          break
        case 'game_start':
        case 'state_sync': {
          if (this.role !== 'guest') throw new Error('ホスト以外からの盤面同期を拒否しました。')
          if (
            typeof data.state !== 'string' ||
            !Number.isSafeInteger(data.round) ||
            (data.round as number) < 0 ||
            ![null, 0, 1].includes(data.resigned as null | number)
          )
            throw new Error('同期データが不正です。')
          const state = engines[this.game].deserialize(data.state)
          const hash = fingerprint(
            JSON.stringify([engines[this.game].serialize(state), data.resigned, data.round]),
          )
          if (hash !== data.hash) throw new Error('同期データの検証に失敗しました。')
          if (!validClock(data.clock))
            throw new Error('持ち時間の情報が不正です。アプリを更新してください。')
          this.state = state
          this.resigned = data.resigned as Player | null
          this.round = data.round as number
          this.sequence = p.sequence
          this.ready = true
          this.clock.restore(data.clock)
          this.notice =
            p.type === 'state_sync' ? '盤面を再同期しました。' : '接続完了。対局を開始できます。'
          this.pendingRestart = null
          this.requestedRestart = null
          break
        }
        case 'state_request':
          if (this.role === 'host') this.sync()
          break
        case 'clock_sync':
          if (this.role !== 'guest' || !validClock(data.clock))
            throw new Error('時計データが不正です。')
          this.clock.restore(data.clock)
          break
        case 'move':
        case 'resign':
        case 'restart_accept': {
          if (!this.ready) throw new Error('対局の開始待ちです。')
          const order = classifySequence(this.sequence, p.sequence)
          if (order === 'duplicate') break
          if (order === 'gap' || data.before !== this.hash) {
            this.notice = '盤面の差を検出しました。再同期します。'
            this.sync()
            break
          }
          if (p.type === 'move') {
            this.tick()
            if (this.role === 'host' && this.winner !== null) {
              this.sync()
              break
            }
            if (this.state.turn === this.player || this.winner !== null)
              throw new Error('相手の手番ではありません。')
            const next = engines[this.game].applyMove(this.state, data.move as unknown as Move)
            const hash = fingerprint(
              JSON.stringify([engines[this.game].serialize(next), this.resigned, this.round]),
            )
            if (hash !== data.after) {
              this.sync()
              break
            }
            if (this.role === 'guest' && this.clock.enabled && !validClock(data.clock))
              throw new Error('時計データが不正です。')
            if (this.role === 'host') {
              if (!this.clock.move(next.turn)) {
                this.sync()
                break
              }
              this.state = next
              if (this.winner !== null) this.clock.pause()
              if (this.clock.enabled) this.send('clock_sync', { clock: this.clock.snapshot() })
            } else {
              this.state = next
              if (validClock(data.clock)) this.clock.restore(data.clock)
              if (this.winner !== null) this.clock.pause()
            }
            this.sequence++
            this.notice = ''
          } else if (p.type === 'resign') {
            if (data.player !== other(this.player) || this.winner !== null)
              throw new Error('投了情報が不正です。')
            this.resigned = other(this.player)
            this.clock.pause()
            this.sequence++
          } else {
            if (!this.requestedRestart || data.id !== this.requestedRestart)
              throw new Error('要求していない再戦を拒否しました。')
            this.reset()
            if (this.role === 'host' && this.clock.enabled)
              this.send('clock_sync', { clock: this.clock.snapshot() })
          }
          break
        }
        case 'restart_request':
          if (!this.ready || typeof data.id !== 'string' || !/^[\w-]{8,80}$/.test(data.id))
            throw new Error('再戦要求が不正です。')
          this.pendingRestart = data.id
          break
        case 'ping':
          this.send('pong')
          break
        case 'pong':
          break
        case 'error':
          this.notice = '相手が通信データの不一致を検出しました。盤面を再同期してください。'
          break
      }
    } catch (error) {
      this.notice = error instanceof Error ? error.message : '通信データを処理できませんでした。'
      // Do not echo arbitrary peer input or create an error-response loop.
    }
    this.onChange()
  }
}
