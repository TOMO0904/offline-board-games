import { MAX_MESSAGE } from './protocol'
import { fingerprint } from './signaling'

// Keep UTF-8 frames below 16 KiB, including on browsers with small SCTP limits.
const CHUNK = 3500
export function frameMessage(raw: string): string[] {
  if (raw.length > MAX_MESSAGE) throw new Error('通信データが大きすぎます。')
  if (new TextEncoder().encode(raw).length < 12_000) return [raw]
  const count = Math.ceil(raw.length / CHUNK),
    id = fingerprint(raw)
  return Array.from(
    { length: count },
    (_, i) => `OBGF1:${id}:${i}:${count}:${raw.slice(i * CHUNK, (i + 1) * CHUNK)}`,
  )
}
export class FrameReceiver {
  private current: { id: string; count: number; at: number; chunks: Map<number, string> } | null =
    null
  reset() {
    this.current = null
  }
  receive(frame: string): string | null {
    if (!frame.startsWith('OBGF1:')) return frame
    const m = /^OBGF1:([a-z0-9]{1,8}):(\d+):(\d+):([\s\S]*)$/.exec(frame)
    if (!m) throw new Error('通信の分割形式が不正です。')
    const [, id, i, n, data] = m,
      index = Number(i),
      count = Number(n)
    if (
      count < 1 ||
      count > Math.ceil(MAX_MESSAGE / CHUNK) ||
      index < 0 ||
      index >= count ||
      data.length > CHUNK
    )
      throw new Error('通信の分割サイズが不正です。')
    if (this.current && Date.now() - this.current.at > 30_000) this.reset()
    if (!this.current) this.current = { id, count, at: Date.now(), chunks: new Map() }
    const transfer = this.current
    if (transfer.id !== id || transfer.count !== count) {
      this.reset()
      throw new Error('別の通信データが混在しています。盤面を再同期してください。')
    }
    transfer.chunks.set(index, data)
    if (transfer.chunks.size !== count) return null
    const raw = Array.from({ length: count }, (_, j) => transfer.chunks.get(j)).join('')
    this.reset()
    if (raw.length > MAX_MESSAGE || fingerprint(raw) !== id)
      throw new Error('通信データの復元に失敗しました。')
    return raw
  }
}
