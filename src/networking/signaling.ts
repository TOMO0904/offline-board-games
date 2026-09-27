import { strFromU8, strToU8, zlibSync, Unzlib } from 'fflate'
import { isRecord } from '../games/core/types'
import { isPlayableId, type PlayableId } from '../party/catalog'

export const MAX_SIGNAL = 48_000
const MAX_SDP = 32_000
export interface Signal {
  v: 1
  g: PlayableId
  m: string
  t: 'offer' | 'answer'
  s: string
}
export function fingerprint(value: string): string {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
export function validateSignal(value: unknown): Signal {
  if (
    !isRecord(value) ||
    value.v !== 1 ||
    !isPlayableId(value.g) ||
    typeof value.m !== 'string' ||
    !/^[\w-]{8,80}$/.test(value.m) ||
    !['offer', 'answer'].includes(String(value.t)) ||
    typeof value.s !== 'string' ||
    value.s.length > MAX_SDP ||
    !value.s.startsWith('v=0') ||
    !/^m=application /m.test(value.s) ||
    /^m=(audio|video) /m.test(value.s)
  )
    throw new Error('接続情報が不正です。相手に作り直してもらってください。')
  return value as unknown as Signal
}
export function encodeSignal(signal: Signal): string {
  validateSignal(signal)
  const bytes = zlibSync(strToU8(JSON.stringify(signal)), { level: 9 })
  return (
    'OBG1.' +
    btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
  )
}
export function decodeSignal(text: string): Signal {
  const input = text.trim()
  if (input.length > MAX_SIGNAL || !/^OBG1\.[A-Za-z0-9_-]+$/.test(input))
    throw new Error('接続テキストの形式または長さが正しくありません。全文を貼り付けてください。')
  try {
    const bytes = Uint8Array.from(
      atob(input.slice(5).replaceAll('-', '+').replaceAll('_', '/')),
      (c) => c.charCodeAt(0),
    )
    const chunks: Uint8Array[] = []
    let length = 0
    const inflater = new Unzlib((chunk) => {
      length += chunk.length
      if (length > MAX_SDP + 1000) throw new Error('展開サイズ上限')
      chunks.push(chunk)
    })
    for (let i = 0; i < bytes.length; i += 128)
      inflater.push(bytes.subarray(i, i + 128), i + 128 >= bytes.length)
    const output = new Uint8Array(length)
    let offset = 0
    for (const c of chunks) {
      output.set(c, offset)
      offset += c.length
    }
    return validateSignal(JSON.parse(strFromU8(output)))
  } catch {
    throw new Error(
      '接続情報を読み取れませんでした。コピーし直すか、QRをもう一度読み取ってください。',
    )
  }
}
export function splitSignal(text: string): string[] {
  if (text.length > MAX_SIGNAL) throw new Error('接続情報が大きすぎます。')
  const size = 550,
    total = Math.ceil(text.length / size),
    id = fingerprint(text)
  return Array.from(
    { length: total },
    (_, i) => `OBGQ1:${id}:${i + 1}:${total}:${text.slice(i * size, (i + 1) * size)}`,
  )
}
export class SignalCollector {
  private id = ''
  private total = 0
  private parts = new Map<number, string>()
  reset() {
    this.id = ''
    this.total = 0
    this.parts.clear()
  }
  add(value: string): { text?: string; received: number; total: number } {
    if (value.startsWith('OBG1.')) {
      decodeSignal(value)
      return { text: value, received: 1, total: 1 }
    }
    if (value.length > 700) throw new Error('このQRは接続情報ではありません。')
    const match = /^OBGQ1:([a-z0-9]{1,8}):(\d+):(\d+):(OBG1\.|[A-Za-z0-9_.-])/.exec(value)
    if (!match) throw new Error('Offline GamesのQRを読み取ってください。')
    const [, id, partText, totalText] = match
    const part = Number(partText),
      total = Number(totalText),
      chunk = value.split(':').slice(4).join(':')
    if (
      total < 1 ||
      total > 88 ||
      part < 1 ||
      part > total ||
      chunk.length > 550 ||
      !/^[A-Za-z0-9_.-]+$/.test(chunk)
    )
      throw new Error('QRの分割情報が不正です。')
    if (this.id && (this.id !== id || this.total !== total))
      throw new Error('別の接続のQRです。「読み取りをリセット」してからお試しください。')
    this.id = id
    this.total = total
    this.parts.set(part, chunk)
    if (this.parts.size !== total) return { received: this.parts.size, total }
    const text = Array.from({ length: total }, (_, i) => this.parts.get(i + 1)).join('')
    if (fingerprint(text) !== id) {
      this.reset()
      throw new Error('QRに欠落があります。読み取り直してください。')
    }
    decodeSignal(text)
    return { text, received: total, total }
  }
}
