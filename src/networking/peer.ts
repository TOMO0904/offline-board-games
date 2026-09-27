import type { PlayableId as GameId } from '../party/catalog'
import { encodeSignal, type Signal } from './signaling'
import { MAX_MESSAGE } from './protocol'
import { frameMessage, FrameReceiver } from './framing'

export interface PeerDebug {
  connectionState: string
  iceConnectionState: string
  iceGatheringState: string
  signalingState: string
  dataChannel: string
  localCandidates: string[]
  remoteCandidates: string[]
  sentMessages: number
  receivedMessages: number
  sentBytes: number
  receivedBytes: number
}
export class PeerLink {
  pc?: RTCPeerConnection
  channel?: RTCDataChannel
  onMessage: (raw: string) => void = () => {}
  onOpen: () => void = () => {}
  onChange: () => void = () => {}
  onError: (message: string) => void = () => {}
  private timer?: ReturnType<typeof setTimeout>
  private frames = new FrameReceiver()
  private interrupted = false
  private counts = { sentMessages: 0, receivedMessages: 0, sentBytes: 0, receivedBytes: 0 }
  get open() {
    return (
      this.channel?.readyState === 'open' &&
      !['disconnected', 'failed', 'closed'].includes(this.pc?.connectionState || 'closed')
    )
  }
  get debug(): PeerDebug {
    const candidates = (sdp?: string) =>
      sdp?.split(/\r?\n/).filter((x) => x.startsWith('a=candidate:')) || []
    return {
      connectionState: this.pc?.connectionState || 'new',
      iceConnectionState: this.pc?.iceConnectionState || 'new',
      iceGatheringState: this.pc?.iceGatheringState || 'new',
      signalingState: this.pc?.signalingState || 'stable',
      dataChannel: this.channel?.readyState || 'closed',
      localCandidates: candidates(this.pc?.localDescription?.sdp),
      remoteCandidates: candidates(this.pc?.remoteDescription?.sdp),
      ...this.counts,
    }
  }
  private init() {
    this.close()
    if (typeof RTCPeerConnection === 'undefined')
      throw new Error(
        'このブラウザは近くの端末との対戦に対応していません。1台で2人対戦をご利用ください。',
      )
    const pc = new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 0 })
    this.pc = pc
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.interrupted = true
        this.onError(
          '接続が途切れました。同じWi-Fiを確認して、ホストが「接続情報を作り直す」で再接続してください。',
        )
      }
      if (pc.connectionState === 'connected') {
        clearTimeout(this.timer)
        if (this.interrupted && this.channel?.readyState === 'open') {
          this.interrupted = false
          this.onOpen()
        }
      }
      this.onChange()
    }
    pc.oniceconnectionstatechange = () => this.onChange()
    pc.onicegatheringstatechange = () => this.onChange()
    pc.onsignalingstatechange = () => this.onChange()
    pc.ondatachannel = (e) => this.bind(e.channel)
    return pc
  }
  private bind(channel: RTCDataChannel) {
    if (channel.label !== 'offline-games' || this.channel) {
      channel.close()
      return
    }
    this.channel = channel
    channel.onopen = () => {
      clearTimeout(this.timer)
      this.onChange()
      this.onOpen()
    }
    channel.onclose = () => {
      this.onChange()
      this.onError('相手との接続が切れました。再接続するまで盤面は保存されます。')
    }
    channel.onerror = () => this.onError('通信エラーです。同じWi-Fiを確認して再接続してください。')
    channel.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data.length > MAX_MESSAGE) {
        this.onError('大きすぎる、または未対応のメッセージを拒否しました。')
        return
      }
      this.counts.receivedMessages++
      this.counts.receivedBytes += new TextEncoder().encode(e.data).byteLength
      try {
        const raw = this.frames.receive(e.data)
        if (raw !== null) this.onMessage(raw)
      } catch (e) {
        this.onError(e instanceof Error ? e.message : '通信データを復元できません。')
      }
      this.onChange()
    }
  }
  private async gather(pc: RTCPeerConnection) {
    if (pc.iceGatheringState !== 'complete')
      await new Promise<void>((resolve, reject) => {
        const clean = () => {
          clearTimeout(timeout)
          pc.removeEventListener('icegatheringstatechange', changed)
          pc.removeEventListener('connectionstatechange', closed)
        }
        const changed = () => {
          if (pc.iceGatheringState === 'complete') {
            clean()
            resolve()
          }
        }
        const closed = () => {
          if (pc.connectionState === 'closed') {
            clean()
            reject(new Error('接続処理を終了しました。'))
          }
        }
        const timeout = setTimeout(() => {
          clean()
          reject(
            new Error('接続情報の作成がタイムアウトしました。Wi-FiをONにして再試行してください。'),
          )
        }, 20_000)
        pc.addEventListener('icegatheringstatechange', changed)
        pc.addEventListener('connectionstatechange', closed)
        changed()
      })
    if (this.pc !== pc || !pc.localDescription) throw new Error('接続情報の作成を中断しました。')
    if (!pc.localDescription.sdp.includes('a=candidate:'))
      throw new Error(
        'ローカル接続候補を取得できません。Wi-Fiやブラウザのローカルネットワーク権限を確認してください。',
      )
    return pc.localDescription.sdp
  }
  private startTimeout() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (!this.open)
        this.onError(
          '接続がタイムアウトしました。同じWi-Fi・テザリング、端末間通信の許可を確認し、接続情報を作り直してください。',
        )
    }, 45_000)
  }
  async offer(game: GameId, matchId: string) {
    const pc = this.init()
    this.bind(pc.createDataChannel('offline-games', { ordered: true }))
    await pc.setLocalDescription(await pc.createOffer())
    return encodeSignal({ v: 1, g: game, m: matchId, t: 'offer', s: await this.gather(pc) })
  }
  async answer(signal: Signal) {
    if (signal.t !== 'offer') throw new Error('ホストの接続情報を読み取ってください。')
    const pc = this.init()
    await pc.setRemoteDescription({ type: 'offer', sdp: signal.s })
    await pc.setLocalDescription(await pc.createAnswer())
    const text = encodeSignal({ ...signal, t: 'answer', s: await this.gather(pc) })
    this.startTimeout()
    return text
  }
  async accept(signal: Signal) {
    if (signal.t !== 'answer' || !this.pc || this.pc.signalingState !== 'have-local-offer')
      throw new Error(
        '相手の返信を読み取ってください。ホストの接続情報からやり直すこともできます。',
      )
    await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.s })
    this.startTimeout()
  }
  send(raw: string) {
    if (!this.open || !this.channel) throw new Error('相手に接続していません。再接続してください。')
    if (raw.length > MAX_MESSAGE || this.channel.bufferedAmount > 512_000)
      throw new Error('通信が混雑しています。少し待ってください。')
    for (const frame of frameMessage(raw)) {
      this.channel.send(frame)
      this.counts.sentMessages++
      this.counts.sentBytes += new TextEncoder().encode(frame).byteLength
    }
    this.onChange()
  }
  close() {
    clearTimeout(this.timer)
    this.frames.reset()
    this.interrupted = false
    if (this.channel) {
      this.channel.onclose = null
      this.channel.onmessage = null
      this.channel.onerror = null
      this.channel.onopen = null
      this.channel.close()
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null
      this.pc.oniceconnectionstatechange = null
      this.pc.onicegatheringstatechange = null
      this.pc.onsignalingstatechange = null
      this.pc.ondatachannel = null
      this.pc.close()
    }
    this.channel = undefined
    this.pc = undefined
  }
}
