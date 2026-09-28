import type { PartyId, PartyRules } from './catalog'
export interface PartyAction {
  type:
    | 'buy'
    | 'sell'
    | 'build'
    | 'deliver'
    | 'guess'
    | 'choose'
    | 'vote'
    | 'discard'
    | 'play'
    | 'pass'
    | 'draw'
    | 'ask'
    | 'flip'
    | 'next'
    | 'roll'
    | 'hold'
    | 'edge'
    | 'believe'
    | 'doubt'
    | 'sow'
    | 'take'
    | 'tile'
    | 'score'
  cards?: number[]
  index?: number
  target?: number
  rank?: number
  suit?: number
}
export interface PartyState {
  game: PartyId
  names: string[]
  rules: PartyRules
  turn: number
  step: number
  round: number
  phase: 'play' | 'reveal' | 'challenge' | 'round-end' | 'finished'
  winners: number[]
  ranking: number[]
  losers: number[]
  hands: number[][]
  stock: number[]
  table: number[]
  economy: number[]
  board: number[]
  scores: number[]
  roundScores: number[]
  passed: number[]
  lastPlayer: number
  reversed: boolean
  jBack: boolean
  lock: number[]
  tableKind: string
  tableRank: number
  activeSuit: number
  drawn: boolean
  stalled: number
  selected: number[]
  matched: number[]
  claim: number
  pending: number[]
  challenges: number[]
  trickPlayers: number[]
  broken: boolean
  roll: number
  bank: number
  info: string
}
export interface PartyView {
  game: PartyId
  names: string[]
  rules: PartyRules
  seat: number
  turn: number
  step: number
  round: number
  phase: PartyState['phase']
  winners: number[]
  ranking: number[]
  losers: number[]
  hand: number[]
  counts: number[]
  stockCount: number
  table: number[]
  economy: number[]
  board: number[]
  scores: number[]
  roundScores: number[]
  passed: number[]
  reversed: boolean
  jBack: boolean
  lock: number[]
  activeSuit: number
  selected: number[]
  claim: number
  pendingCount: number
  lastPlayer: number
  trickPlayers: number[]
  roll: number
  bank: number
  info: string
}
export type Random = () => number
export const random: Random = () => {
  const v = new Uint32Array(1)
  crypto.getRandomValues(v)
  return v[0] / 4294967296
}
export function shuffle<T>(items: T[], rng: Random = random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const rank = (c: number) => (c >= 52 ? 0 : (c % 13) + 1)
export const suit = (c: number) => Math.floor(c / 13)
export const strength = (c: number) => (c >= 52 ? 16 : rank(c) < 3 ? rank(c) + 13 : rank(c))
export const suits = ['♠', '♥', '♦', '♣']
export const rankText = (r: number) =>
  ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][r] || '?'
export const cardText = (c: number) =>
  c < 0 ? '裏向き' : c >= 52 ? 'JOKER' : `${suits[suit(c)]}${rankText(rank(c))}`
export const deck = (joker = false) => Array.from({ length: joker ? 53 : 52 }, (_, i) => i)
export function requireRule(
  ok: unknown,
  message = 'この操作は今のルールではできません。',
): asserts ok {
  if (!ok) throw new Error(message)
}
export function nextSeat(
  s: PartyState,
  from = s.turn,
  active = (p: number) => !s.ranking.includes(p) && !s.losers.includes(p),
) {
  for (let i = 1; i <= s.names.length; i++) {
    const p = (from + i) % s.names.length
    if (active(p)) return p
  }
  return from
}
export function finishScores(s: PartyState, low = false) {
  const best = (low ? Math.min : Math.max)(...s.scores)
  s.winners = s.scores.flatMap((n, p) => (n === best ? [p] : []))
  s.phase = 'finished'
}
export function finishEmpty(s: PartyState, p: number) {
  if (!s.hands[p].length && !s.ranking.includes(p) && !s.losers.includes(p)) s.ranking.push(p)
  const active = s.names
    .map((_, i) => i)
    .filter((i) => !s.ranking.includes(i) && !s.losers.includes(i))
  if (active.length <= 1) {
    s.ranking.push(...active, ...[...s.losers].reverse())
    s.winners = s.ranking.slice(0, 1)
    s.phase = 'finished'
  }
}
export function removeCards(s: PartyState, p: number, cards: number[]) {
  requireRule(
    cards.length > 0 &&
      new Set(cards).size === cards.length &&
      cards.every((c) => s.hands[p].includes(c)),
    '自分の手札から選んでください。',
  )
  s.hands[p] = s.hands[p].filter((c) => !cards.includes(c))
}
