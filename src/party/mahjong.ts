import {
  finishScores,
  requireRule,
  shuffle,
  type PartyAction,
  type PartyState,
  type Random,
} from './types'

export const mahjongText = (id: number) => {
  const t = Math.floor(id / 4)
  return t < 27
    ? `${(t % 9) + 1}${['萬', '筒', '索'][Math.floor(t / 9)]}`
    : ['東', '南', '西', '北', '白', '發', '中'][t - 27]
}
const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

// Tile types, not physical IDs: the recursive search restores every count before returning.
export function winningTypes(tiles: number[]): boolean {
  if (tiles.length !== 14 || tiles.some((t) => !Number.isInteger(t) || t < 0 || t > 33))
    return false
  const counts = Array<number>(34).fill(0)
  for (const t of tiles) if (++counts[t] > 4) return false
  if (counts.filter((n) => n === 2).length === 7) return true
  if (terminals.every((t) => counts[t] >= 1) && tiles.every((t) => terminals.includes(t)))
    return true
  function groups(): boolean {
    const i = counts.findIndex((n) => n > 0)
    if (i < 0) return true
    if (counts[i] >= 3) {
      counts[i] -= 3
      const ok = groups()
      counts[i] += 3
      if (ok) return true
    }
    if (i < 27 && i % 9 <= 6 && counts[i + 1] && counts[i + 2]) {
      counts[i]--
      counts[i + 1]--
      counts[i + 2]--
      const ok = groups()
      counts[i]++
      counts[i + 1]++
      counts[i + 2]++
      if (ok) return true
    }
    return false
  }
  for (let i = 0; i < 34; i++)
    if (counts[i] >= 2) {
      counts[i] -= 2
      const ok = groups()
      counts[i] += 2
      if (ok) return true
    }
  return false
}
export function mahjongWaits(hand: number[], honors = true): number[] {
  if (hand.length !== 13) return []
  const types = hand.map((c) => Math.floor(c / 4))
  return Array.from({ length: honors ? 34 : 27 }, (_, t) => t).filter((t) =>
    winningTypes([...types, t]),
  )
}
export function canRon(s: PartyState, p: number, tile: number) {
  const waits = mahjongWaits(s.hands[p], !!s.rules.honors)
  return (
    waits.includes(Math.floor(tile / 4)) &&
    !s.board.some((c, i) => s.trickPlayers[i] === p && waits.includes(Math.floor(c / 4)))
  )
}
function endHand(s: PartyState, p: number | null, info: string, extra?: number) {
  s.table =
    p === null ? [] : [...s.hands[p], ...(extra === undefined ? [] : [extra])].sort((a, b) => a - b)
  s.lastPlayer = p ?? -1
  if (p !== null) s.scores[p]++
  s.info = info
  s.phase = 'round-end'
  if (s.round + 1 >= Number(s.rules.rounds)) finishScores(s)
}
function draw(s: PartyState) {
  if (!s.stock.length) {
    endHand(s, null, '山が尽きたので流局。アガリなしです。')
    return
  }
  const tile = s.stock.pop()!
  s.hands[s.turn].push(tile)
  s.hands[s.turn].sort((a, b) => a - b)
  s.selected = [tile]
  if (winningTypes(s.hands[s.turn].map((c) => Math.floor(c / 4))))
    endHand(s, s.turn, `${s.names[s.turn]}のツモ！ 1点獲得。`)
}
export function initMahjong(s: PartyState, rng: Random) {
  s.stock = shuffle(
    Array.from({ length: s.rules.honors ? 136 : 108 }, (_, i) => i),
    rng,
  )
  s.hands = s.names.map(() => [])
  for (let i = 0; i < 13; i++) for (const hand of s.hands) hand.push(s.stock.pop()!)
  s.hands.forEach((h) => h.sort((a, b) => a - b))
  s.turn = s.round % s.names.length
  s.board = []
  s.trickPlayers = []
  s.table = []
  s.selected = []
  s.phase = 'play'
  s.lastPlayer = -1
  s.info = `${s.round + 1}局目。牌を1枚選んで捨ててください。`
  draw(s)
}
export function playMahjong(s: PartyState, a: PartyAction, rng: Random) {
  if (s.phase === 'round-end') {
    requireRule(a.type === 'next')
    s.round++
    initMahjong(s, rng)
    return
  }
  requireRule(
    s.phase === 'play' &&
      a.type === 'discard' &&
      a.index !== undefined &&
      s.hands[s.turn].includes(a.index),
    '自分の手牌から捨てる牌を選んでください。',
  )
  const p = s.turn,
    tile = a.index
  s.hands[p] = s.hands[p].filter((c) => c !== tile)
  s.board.push(tile)
  s.trickPlayers.push(p)
  s.selected = []
  s.info = `${s.names[p]}が${mahjongText(tile)}を捨てました。`
  for (let i = 1; i < s.names.length; i++) {
    const q = (p + i) % s.names.length
    if (canRon(s, q, tile)) {
      endHand(s, q, `${s.names[q]}のロン！ ${mahjongText(tile)}で完成、1点獲得。`, tile)
      return
    }
  }
  s.turn = (p + 1) % s.names.length
  draw(s)
}
