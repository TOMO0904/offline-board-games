import {
  finishEmpty,
  nextSeat,
  rank,
  removeCards,
  requireRule,
  strength,
  suit,
  type PartyAction,
  type PartyState,
} from './types'

function combination(cards: number[], stairs: boolean) {
  const plain = cards.filter((c) => c < 52),
    ranks = plain.map(strength).sort((a, b) => a - b)
  if (new Set(ranks).size <= 1) return { kind: 'group', value: ranks[0] ?? 16 }
  if (
    stairs &&
    cards.length >= 3 &&
    plain.length === cards.length &&
    new Set(plain.map(suit)).size === 1 &&
    ranks.every((r, i) => !i || r === ranks[i - 1] + 1)
  )
    return { kind: 'stairs', value: ranks[0] }
  throw new Error('同じ数字の組、または同じマークの連続3枚以上を選んでください。')
}
function flush(s: PartyState) {
  s.table = []
  s.tableKind = ''
  s.passed = []
  s.jBack = false
  s.lock = []
  s.turn =
    s.ranking.includes(s.lastPlayer) || s.losers.includes(s.lastPlayer)
      ? nextSeat(s, s.lastPlayer)
      : s.lastPlayer
  s.info += ' 場が流れました。'
}
function advance(s: PartyState) {
  const eligible = (p: number) =>
    p !== s.lastPlayer && !s.ranking.includes(p) && !s.losers.includes(p) && !s.passed.includes(p)
  if (!s.names.some((_, i) => eligible(i))) flush(s)
  else s.turn = nextSeat(s, s.turn, eligible)
}
export function playDaifugo(s: PartyState, a: PartyAction) {
  const p = s.turn
  if (a.type === 'pass') {
    requireRule(s.table.length, '場が空なので、カードを出してください。')
    s.passed.push(p)
    s.info = `${s.names[p]}はパス。`
    advance(s)
    return
  }
  requireRule(a.type === 'play' && a.cards?.length)
  const cards = a.cards,
    combo = combination(cards, !!s.rules.stairs),
    inverted = s.reversed !== s.jBack
  const spadeReturn =
    !!s.rules.spadeThree &&
    cards.length === 1 &&
    cards[0] === 2 &&
    s.table.length === 1 &&
    s.table[0] === 52
  const marks = cards.map(suit).sort((a, b) => a - b)
  if (s.table.length && !spadeReturn) {
    requireRule(
      cards.length === s.table.length && combo.kind === s.tableKind,
      '場と同じ枚数・同じ形で出してください。',
    )
    requireRule(
      combo.value === 16
        ? s.tableRank !== 16
        : s.tableRank !== 16 && (inverted ? combo.value < s.tableRank : combo.value > s.tableRank),
      '場のカードより強い札を選んでください。',
    )
    if (s.lock.length)
      requireRule(JSON.stringify(marks) === JSON.stringify(s.lock), 'マークが縛られています。')
  }
  removeCards(s, p, cards)
  if (
    s.rules.lock &&
    s.table.length &&
    !cards.includes(52) &&
    !s.table.includes(52) &&
    JSON.stringify(marks) === JSON.stringify(s.table.map(suit).sort((a, b) => a - b))
  )
    s.lock = marks
  const forbidden =
    !!s.rules.forbiddenFinish &&
    !s.hands[p].length &&
    cards.some(
      (c) => c === 52 || strength(c) === (inverted ? 3 : 15) || (s.rules.eightCut && rank(c) === 8),
    )
  if (s.rules.revolution && (combo.kind === 'group' ? cards.length >= 4 : cards.length >= 5))
    s.reversed = !s.reversed
  if (s.rules.jBack && cards.some((c) => rank(c) === 11)) s.jBack = !s.jBack
  s.table = [...cards]
  s.tableKind = combo.kind
  s.tableRank = combo.value
  s.lastPlayer = p
  s.info = `${s.names[p]}が${cards.length}枚出しました。`
  if (forbidden) {
    s.losers.push(p)
    s.info += ' 禁止札上がりで反則負け。'
  }
  finishEmpty(s, p)
  if (s.phase === 'finished') return
  if (spadeReturn || (s.rules.eightCut && cards.some((c) => rank(c) === 8))) flush(s)
  else advance(s)
}
