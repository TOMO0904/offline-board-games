import {
  finishScores,
  nextSeat,
  requireRule,
  shuffle,
  type PartyAction,
  type PartyState,
  type Random,
} from './types'

export const dominoTiles: Array<[number, number]> = Array.from({ length: 7 }, (_, a) =>
  Array.from({ length: 7 - a }, (_, b) => [a, a + b] as [number, number]),
).flat()
export const tileText = (id: number) => dominoTiles[id]?.join('│') ?? '?'
export const yachtCategories = [
  '1の目',
  '2の目',
  '3の目',
  '4の目',
  '5の目',
  '6の目',
  'チョイス',
  'フォーダイス',
  'フルハウス',
  '小ストレート',
  '大ストレート',
  'ヨット',
]
export function yachtScore(dice: number[], category: number) {
  requireRule(
    dice.length === 5 &&
      dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) &&
      Number.isInteger(category) &&
      category >= 0 &&
      category < 12,
  )
  const counts = Array.from({ length: 6 }, (_, i) => dice.filter((d) => d === i + 1).length),
    total = dice.reduce((a, b) => a + b, 0)
  if (category < 6) return counts[category] * (category + 1)
  if (category === 6) return total
  if (category === 7) return Math.max(...counts) >= 4 ? total : 0
  if (category === 8) return counts.includes(3) && counts.includes(2) ? total : 0
  if (category === 9)
    return [1, 2, 3].some((start) =>
      [start, start + 1, start + 2, start + 3].every((d) => dice.includes(d)),
    )
      ? 15
      : 0
  if (category === 10)
    return [1, 2].some((start) =>
      [start, start + 1, start + 2, start + 3, start + 4].every((d) => dice.includes(d)),
    )
      ? 30
      : 0
  return Math.max(...counts) === 5 ? 50 : 0
}
export function initTabletop(s: PartyState, rng: Random) {
  switch (s.game) {
    case 'mancala':
      s.board = Array.from({ length: 14 }, (_, i) =>
        i === 6 || i === 13 ? 0 : Number(s.rules.seeds),
      )
      break
    case 'nim':
      s.board = Array.from({ length: Number(s.rules.piles) }, (_, i) => 1 + i * 2)
      break
    case 'dominoes': {
      const cards = shuffle(
          dominoTiles.map((_, i) => i),
          rng,
        ),
        size = s.names.length === 2 ? 7 : s.names.length <= 4 ? 5 : 4
      s.hands = s.names.map(() => [])
      cards.slice(0, size * s.names.length).forEach((c, i) => s.hands[i % s.names.length].push(c))
      s.stock = cards.slice(size * s.names.length)
      s.board = []
      break
    }
    case 'yacht':
      s.board = Array(s.names.length * 12).fill(-1)
      s.table = []
      s.roll = 0
      break
  }
}
export function playTabletop(s: PartyState, a: PartyAction, rng: Random) {
  const p = s.turn
  switch (s.game) {
    case 'mancala': {
      requireRule(
        a.type === 'sow' &&
          a.index !== undefined &&
          a.index >= p * 7 &&
          a.index < p * 7 + 6 &&
          s.board[a.index] > 0,
        '自分側の石がある穴を選んでください。',
      )
      let count = s.board[a.index],
        position = a.index
      const goal = p * 7 + 6,
        skip = (1 - p) * 7 + 6
      s.board[position] = 0
      while (count) {
        position = (position + 1) % 14
        if (position === skip) continue
        s.board[position]++
        count--
      }
      if (
        s.rules.capture &&
        position >= p * 7 &&
        position < p * 7 + 6 &&
        s.board[position] === 1 &&
        s.board[12 - position] > 0
      ) {
        s.board[goal] += 1 + s.board[12 - position]
        s.board[position] = 0
        s.board[12 - position] = 0
      }
      if ([0, 7].some((start) => s.board.slice(start, start + 6).every((n) => n === 0))) {
        for (const start of [0, 7])
          for (let i = start; i < start + 6; i++) {
            s.board[start + 6] += s.board[i]
            s.board[i] = 0
          }
        s.scores = [s.board[6], s.board[13]]
        finishScores(s)
      } else {
        if (!s.rules.extraTurn || position !== goal) s.turn = 1 - p
        s.scores = [s.board[6], s.board[13]]
      }
      s.info = `${s.names[p]}が穴${(a.index % 7) + 1}から石をまきました。`
      break
    }
    case 'nim': {
      requireRule(
        a.type === 'take' &&
          a.index !== undefined &&
          a.index < s.board.length &&
          a.rank !== undefined &&
          a.rank >= 1 &&
          a.rank <= s.board[a.index] &&
          (!s.rules.maxTake || a.rank <= Number(s.rules.maxTake)),
        '1つの山から、上限以内の石を取ってください。',
      )
      s.board[a.index] -= a.rank
      s.info = `${s.names[p]}が山${a.index + 1}から${a.rank}個取りました。`
      if (s.board.every((n) => n === 0)) {
        s.phase = 'finished'
        s.winners = s.rules.misere ? s.names.flatMap((_, i) => (i !== p ? [i] : [])) : [p]
      } else s.turn = nextSeat(s, p, () => true)
      break
    }
    case 'dominoes': {
      const fits = (id: number) =>
        !s.board.length || dominoTiles[id].some((n) => s.board.includes(n))
      if (a.type === 'tile') {
        requireRule(
          a.index !== undefined &&
            s.hands[p].includes(a.index) &&
            a.target !== undefined &&
            [0, 1].includes(a.target),
          '自分のタイルと、つなぐ側を選んでください。',
        )
        const tile = dominoTiles[a.index]
        if (!s.board.length) s.board = [...tile]
        else {
          const end = s.board[a.target]
          requireRule(tile.includes(end), '端と同じ数字をつないでください。')
          s.board[a.target] = tile[0] === end ? tile[1] : tile[0]
        }
        s.hands[p] = s.hands[p].filter((id) => id !== a.index)
        s.table.push(a.index)
        s.stalled = 0
        s.info = `${s.names[p]}が${tileText(a.index)}を置きました。`
        if (!s.hands[p].length) {
          s.phase = 'finished'
          s.winners = [p]
        } else s.turn = nextSeat(s, p, () => true)
      } else {
        requireRule(!s.hands[p].some(fits), 'つなげられるタイルを出してください。')
        if (a.type === 'draw') {
          requireRule(s.rules.draw && s.stock.length, '山札を引けません。')
          s.hands[p].push(s.stock.pop()!)
        } else {
          requireRule(
            a.type === 'pass' && (!s.rules.draw || !s.stock.length),
            '山札を引いてください。',
          )
          s.stalled++
          s.turn = nextSeat(s, p, () => true)
          if (s.stalled >= s.names.length) {
            s.scores = s.hands.map((h) =>
              h.reduce((n, id) => n + dominoTiles[id][0] + dominoTiles[id][1], 0),
            )
            finishScores(s, true)
          }
        }
      }
      break
    }
    case 'yacht': {
      if (a.type === 'roll') {
        const held = a.cards ?? []
        requireRule(
          s.roll < Number(s.rules.rolls) &&
            held.every((i) => i < 5) &&
            held.length < 5 &&
            (!held.length || s.roll > 0),
          '振り直し回数と残すサイコロを確認してください。',
        )
        s.table = Array.from({ length: 5 }, (_, i) =>
          held.includes(i) ? s.table[i] : 1 + Math.floor(rng() * 6),
        )
        s.roll++
        s.info = `${s.names[p]}の${s.roll}回目のロール。`
        s.selected = [...held]
      } else {
        requireRule(
          a.type === 'score' &&
            a.index !== undefined &&
            a.index < 12 &&
            s.roll > 0 &&
            s.board[p * 12 + a.index] === -1,
          '未使用の役を選んでください。',
        )
        const points = yachtScore(s.table, a.index)
        s.board[p * 12 + a.index] = points
        const sheet = s.board.slice(p * 12, p * 12 + 12),
          upper = sheet.slice(0, 6).reduce((sum, n) => sum + Math.max(n, 0), 0)
        s.scores[p] =
          sheet.reduce((sum, n) => sum + Math.max(n, 0), 0) +
          (s.rules.bonus && upper >= 63 ? 35 : 0)
        s.info = `${s.names[p]}：${yachtCategories[a.index]}に${points}点を記録。`
        s.table = []
        s.roll = 0
        s.selected = []
        if (s.board.every((n) => n >= 0)) finishScores(s)
        else s.turn = nextSeat(s, p, () => true)
      }
      break
    }
  }
}
