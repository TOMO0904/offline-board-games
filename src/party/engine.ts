import { isRecord } from '../games/core/types'
import { normalizeRules, partyCatalog, type PartyId } from './catalog'
import { playDaifugo } from './daifugo'
import { initTabletop, playTabletop } from './tabletop'
import { initEconomy, playEconomy } from './economy'
import { initCasual, playCasual } from './casual'
import {
  cardText,
  deck,
  finishEmpty,
  finishScores,
  nextSeat,
  random,
  rank,
  rankText,
  removeCards,
  requireRule,
  shuffle,
  suit,
  type PartyAction,
  type PartyState,
  type PartyView,
  type Random,
} from './types'

function deal(s: PartyState, cards: number[], count?: number) {
  s.hands = s.names.map(() => [])
  const n = count ? count * s.names.length : cards.length
  cards.slice(0, n).forEach((c, i) => s.hands[i % s.names.length].push(c))
  s.stock = cards.slice(n)
  s.hands.forEach((h) => h.sort((a, b) => a - b))
}
function pairs(hand: number[]) {
  const result = [...hand]
  for (let r = 1; r <= 13; r++) {
    const found = result.filter((c) => rank(c) === r)
    const removed = found.slice(0, Math.floor(found.length / 2) * 2)
    for (const c of removed) result.splice(result.indexOf(c), 1)
  }
  return result
}
function books(s: PartyState, p: number) {
  for (let r = 1; r <= 13; r++)
    if (s.hands[p].filter((c) => rank(c) === r).length === 4) {
      s.hands[p] = s.hands[p].filter((c) => rank(c) !== r)
      s.scores[p]++
    }
}
function fishTurn(s: PartyState, p: number) {
  s.turn = p
  if (!s.hands[p].length && s.stock.length) s.hands[p].push(s.stock.pop()!)
  if (!s.hands[p].length) s.turn = nextSeat(s, p, (i) => s.hands[i].length > 0)
  if (s.scores.reduce((a, b) => a + b, 0) === 13) finishScores(s)
}
function heartsDeal(s: PartyState, rng: Random) {
  const cards = deck(),
    remove = 52 % s.names.length
  const discard = [40, 27, 41, 28, 42, 29] // Low non-scoring clubs / diamonds.
  for (const c of discard.slice(0, remove)) cards.splice(cards.indexOf(c), 1)
  deal(s, shuffle(cards, rng))
  s.table = []
  s.trickPlayers = []
  s.roundScores = s.names.map(() => 0)
  s.broken = false
  s.stalled = 0
  s.phase = 'play'
  const first = cards.filter((c) => suit(c) === 3).sort((a, b) => high(a) - high(b))[0]
  s.turn = s.hands.findIndex((h) => h.includes(first))
}
export function createParty(
  game: PartyId,
  names: string[],
  rules: unknown = {},
  rng: Random = random,
): PartyState {
  const info = partyCatalog[game]
  requireRule(
    names.length >= info.min && names.length <= info.max,
    'このゲームの人数に合っていません。',
  )
  const s: PartyState = {
    game,
    names: names.map((n, i) => n.trim().slice(0, 20) || `プレイヤー${i + 1}`),
    rules: normalizeRules(game, rules),
    turn: 0,
    step: 0,
    round: 0,
    phase: 'play',
    winners: [],
    ranking: [],
    losers: [],
    hands: [],
    stock: [],
    table: [],
    economy: [],
    board: [],
    scores: names.map(() => 0),
    roundScores: names.map(() => 0),
    passed: [],
    lastPlayer: -1,
    reversed: false,
    jBack: false,
    lock: [],
    tableKind: '',
    tableRank: 0,
    activeSuit: 0,
    drawn: false,
    stalled: 0,
    selected: [],
    matched: [],
    claim: 1,
    pending: [],
    challenges: [],
    trickPlayers: [],
    broken: false,
    roll: 0,
    bank: 0,
    info: 'ゲームを開始しました。',
  }
  deal(s, [])
  switch (game) {
    case 'life-journey':
    case 'island-market':
      initEconomy(s, rng)
      break
    case 'mini-mahjong':
    case 'hit-blow':
    case 'word-wolf':
      initCasual(s, rng)
      break
    case 'daifugo':
      deal(s, shuffle(deck(true), rng))
      s.turn = s.hands.findIndex((h) => h.includes(28))
      break
    case 'sevens':
      deal(s, shuffle(deck(), rng))
      s.board = [6, 19, 32, 45]
      s.hands = s.hands.map((h) => h.filter((c) => rank(c) !== 7))
      s.passed = names.map(() => 0)
      break
    case 'old-maid':
    case 'jiji': {
      const cards = shuffle(deck(game === 'old-maid'), rng)
      if (game === 'jiji') cards.pop()
      deal(s, cards)
      s.hands = s.hands.map(pairs)
      s.hands.forEach((h, p) => {
        if (!h.length) s.ranking.push(p)
      })
      s.turn = s.hands.findIndex((h) => h.length > 0)
      break
    }
    case 'doubt':
      deal(s, shuffle(deck(), rng))
      break
    case 'crazy-eights': {
      deal(s, shuffle(deck(), rng), 5)
      const start = s.stock.findIndex((c) => rank(c) !== 8)
      s.table = [s.stock.splice(start, 1)[0]]
      s.activeSuit = suit(s.table[0])
      break
    }
    case 'go-fish':
      deal(s, shuffle(deck(), rng), names.length <= 3 ? 7 : 5)
      names.forEach((_, p) => books(s, p))
      fishTurn(s, 0)
      break
    case 'memory':
      s.board = shuffle(
        Array.from({ length: Number(s.rules.pairs) }, (_, i) => [i, i + 13]).flat(),
        rng,
      )
      break
    case 'hearts':
      heartsDeal(s, rng)
      break
    case 'boxes': {
      const n = Number(s.rules.size)
      s.board = Array(2 * n * (n + 1)).fill(-1)
      s.matched = Array(n * n).fill(-1)
      break
    }
    case 'pig':
      break
    case 'mancala':
    case 'nim':
    case 'dominoes':
    case 'yacht':
      initTabletop(s, rng)
      break
  }
  return s
}
export function validateAction(a: unknown): a is PartyAction {
  return (
    isRecord(a) &&
    [
      'buy',
      'sell',
      'build',
      'deliver',
      'guess',
      'choose',
      'vote',
      'discard',
      'play',
      'pass',
      'draw',
      'ask',
      'flip',
      'next',
      'roll',
      'hold',
      'edge',
      'believe',
      'doubt',
      'sow',
      'take',
      'tile',
      'score',
    ].includes(String(a.type)) &&
    Object.keys(a).every((k) => ['type', 'cards', 'index', 'target', 'rank', 'suit'].includes(k)) &&
    (a.cards === undefined ||
      (Array.isArray(a.cards) &&
        a.cards.length <= 53 &&
        Array.from(a.cards).every((c) => Number.isInteger(c) && c >= 0 && c <= 52) &&
        new Set(a.cards).size === a.cards.length)) &&
    ['index', 'target', 'rank', 'suit'].every(
      (k) =>
        a[k] === undefined || (Number.isInteger(a[k]) && Number(a[k]) >= 0 && Number(a[k]) <= 135),
    )
  )
}
const points = (c: number) => (suit(c) === 1 ? 1 : c === 11 ? 13 : 0)
const high = (c: number) => (rank(c) === 1 ? 14 : rank(c))
function heartsPlay(s: PartyState, a: PartyAction, rng: Random) {
  const p = s.turn
  if (s.phase === 'round-end') {
    requireRule(a.type === 'next')
    s.round++
    heartsDeal(s, rng)
    return
  }
  if (s.phase === 'reveal') {
    requireRule(a.type === 'next')
    s.table = []
    s.trickPlayers = []
    s.phase = 'play'
    if (s.hands.every((h) => !h.length)) {
      const moon = s.rules.moon ? s.roundScores.indexOf(26) : -1
      s.scores = s.scores.map((n, i) => n + (moon < 0 ? s.roundScores[i] : moon === i ? 0 : 26))
      if (!s.rules.target || s.scores.some((n) => n >= Number(s.rules.target)))
        finishScores(s, true)
      else s.phase = 'round-end'
    }
    return
  }
  requireRule(a.type === 'play' && a.cards?.length === 1)
  const c = a.cards[0],
    h = s.hands[p],
    lead = s.table[0]
  if (s.table.length)
    requireRule(
      suit(c) === suit(lead) || !h.some((x) => suit(x) === suit(lead)),
      '最初の札と同じマークを出してください。',
    )
  else {
    if (s.stalled === 0) {
      const first = s.hands
        .flat()
        .filter((x) => suit(x) === 3)
        .sort((a, b) => high(a) - high(b))[0]
      requireRule(c === first, '初回は最小の♣から始めます。')
    }
    requireRule(
      s.broken || suit(c) !== 1 || h.every((x) => suit(x) === 1),
      'ハートが破られるまでは、他のマークから始めてください。',
    )
  }
  if (s.stalled === 0 && points(c) > 0)
    requireRule(
      !h.some(
        (x) =>
          points(x) === 0 &&
          (!s.table.length || suit(x) === suit(lead) || !h.some((t) => suit(t) === suit(lead))),
      ),
      '最初の巡回では失点札を避けてください。',
    )
  removeCards(s, p, [c])
  s.table.push(c)
  s.trickPlayers.push(p)
  if (suit(c) === 1) s.broken = true
  if (s.table.length === s.names.length) {
    const best = s.table.reduce(
      (b, x, i) => (suit(x) === suit(lead ?? s.table[0]) && high(x) > high(s.table[b]) ? i : b),
      0,
    )
    s.turn = s.trickPlayers[best]
    const cost = s.table.reduce((n, x) => n + points(x), 0)
    s.roundScores[s.turn] += cost
    s.stalled++
    s.phase = 'reveal'
    s.info = `${s.names[s.turn]}が札を取りました。失点${cost}。`
  } else s.turn = nextSeat(s, p, () => true)
}
function canCrazy(s: PartyState, c: number) {
  return rank(c) === 8 || rank(c) === rank(s.table.at(-1)!) || suit(c) === s.activeSuit
}
function resolveDoubt(s: PartyState) {
  if (!s.hands[s.lastPlayer].length) {
    s.winners = [s.lastPlayer]
    s.phase = 'finished'
  } else {
    s.turn = nextSeat(s, s.lastPlayer, () => true)
    s.phase = 'play'
    s.claim = (s.claim % 13) + 1
  }
  s.pending = []
  s.challenges = []
}
export function applyParty(
  state: PartyState,
  seat: number,
  action: unknown,
  rng: Random = random,
): PartyState {
  requireRule(validateAction(action), '操作データが不正です。')
  requireRule(state.phase !== 'finished' && seat === state.turn, 'あなたの手番ではありません。')
  requireRule(state.step < 10000, '操作上限です。新しいゲームを開始してください。')
  const s = structuredClone(state),
    a = action,
    p = seat
  switch (s.game) {
    case 'life-journey':
    case 'island-market':
      playEconomy(s, a, rng)
      break
    case 'mini-mahjong':
    case 'hit-blow':
    case 'word-wolf':
      playCasual(s, a, rng)
      break
    case 'mancala':
    case 'nim':
    case 'dominoes':
    case 'yacht':
      playTabletop(s, a, rng)
      break
    case 'daifugo':
      playDaifugo(s, a)
      break
    case 'sevens': {
      if (a.type === 'pass') {
        s.passed[p]++
        s.info = `${s.names[p]}はパス（${s.passed[p]}回）。`
        if (s.passed[p] > Number(s.rules.passes)) {
          s.losers.push(p)
          s.board.push(...s.hands[p])
          s.hands[p] = []
          s.info += ' パス上限で脱落。残りの札を公開しました。'
        }
      } else {
        requireRule(a.type === 'play' && a.cards?.length === 1)
        const c = a.cards[0]
        requireRule(
          [c - 1, c + 1].some((n) => suit(n) === suit(c) && s.board.includes(n)),
          '場にある同じマークの隣へつながる札を選んでください。',
        )
        removeCards(s, p, [c])
        s.board.push(c)
        s.info = `${s.names[p]}が${cardText(c)}を置きました。`
      }
      finishEmpty(s, p)
      if (s.phase !== 'finished') s.turn = nextSeat(s)
      break
    }
    case 'old-maid':
    case 'jiji': {
      requireRule(a.type === 'draw' && a.index !== undefined)
      const target = nextSeat(s, p, (i) => s.hands[i].length > 0)
      requireRule(target !== p && a.index < s.hands[target].length)
      s.hands[target] = shuffle(s.hands[target], rng)
      s.hands[p] = pairs([...s.hands[p], s.hands[target].splice(a.index, 1)[0]])
      finishEmpty(s, target)
      if (s.phase !== 'finished') finishEmpty(s, p)
      if (s.phase === 'finished') s.winners = s.ranking.slice(0, -1)
      else s.turn = nextSeat(s, p, (i) => s.hands[i].length > 0)
      s.info = `${s.names[p]}が1枚引きました。ペアは自動で捨てます。`
      break
    }
    case 'doubt': {
      if (s.phase === 'challenge') {
        requireRule(a.type === 'doubt' || a.type === 'believe')
        if (a.type === 'doubt') {
          const lie = s.pending.some((c) => rank(c) !== s.claim),
            target = lie ? s.lastPlayer : p
          s.hands[target].push(...s.table)
          s.info = `${s.pending.map(cardText).join(' ')} → ${lie ? '嘘でした' : '本当でした'}。${s.names[target]}が${s.table.length}枚引き取ります。`
          s.table = []
          resolveDoubt(s)
        } else {
          s.challenges.shift()
          if (s.challenges.length) s.turn = s.challenges[0]
          else resolveDoubt(s)
        }
      } else {
        requireRule(
          a.type === 'play' && a.cards?.length && a.cards.length <= Number(s.rules.maxPlay),
        )
        removeCards(s, p, a.cards)
        s.table.push(...a.cards)
        s.pending = [...a.cards]
        s.lastPlayer = p
        s.challenges = Array.from(
          { length: s.names.length - 1 },
          (_, i) => (p + i + 1) % s.names.length,
        )
        s.turn = s.challenges[0]
        s.phase = 'challenge'
        s.info = `${s.names[p]}「${rankText(s.claim)}を${a.cards.length}枚」。確認してください。`
      }
      break
    }
    case 'crazy-eights': {
      if (a.type === 'play') {
        requireRule(a.cards?.length === 1)
        const c = a.cards[0]
        requireRule(canCrazy(s, c), '同じ数字・マーク、または8を出してください。')
        if (rank(c) === 8)
          requireRule(a.suit !== undefined && a.suit <= 3, '次のマークを選んでください。')
        removeCards(s, p, [c])
        s.table.push(c)
        s.activeSuit = rank(c) === 8 ? a.suit! : suit(c)
        s.drawn = false
        s.stalled = 0
        if (!s.hands[p].length) {
          s.winners = [p]
          s.phase = 'finished'
        } else s.turn = nextSeat(s, p, () => true)
      } else if (a.type === 'draw') {
        requireRule(!s.drawn || !s.rules.drawOne, '1枚引きました。札を出すかパスしてください。')
        if (!s.stock.length && s.table.length > 1) {
          s.stock = shuffle(s.table.slice(0, -1), rng)
          s.table = s.table.slice(-1)
        }
        requireRule(s.stock.length, '山札がありません。パスしてください。')
        s.hands[p].push(s.stock.pop()!)
        s.drawn = true
      } else {
        requireRule(
          a.type === 'pass' &&
            !s.hands[p].some((c) => canCrazy(s, c)) &&
            ((s.rules.drawOne && s.drawn) || (!s.stock.length && s.table.length <= 1)),
          '出せる札を出すか、山札を引いてください。',
        )
        s.stalled++
        s.drawn = false
        s.turn = nextSeat(s, p, () => true)
        if (s.stalled >= s.names.length) {
          s.scores = s.hands.map((h) =>
            h.reduce((n, c) => n + (rank(c) === 8 ? 50 : Math.min(rank(c), 10)), 0),
          )
          finishScores(s, true)
        }
      }
      break
    }
    case 'go-fish': {
      requireRule(
        a.type === 'ask' &&
          a.target !== undefined &&
          a.target < s.names.length &&
          a.target !== p &&
          a.rank !== undefined &&
          s.hands[p].some((c) => rank(c) === a.rank),
        '自分が持つ数字と、他のプレイヤーを選んでください。',
      )
      requireRule(s.hands[a.target].length, '手札のある相手を選んでください。')
      const found = s.hands[a.target].filter((c) => rank(c) === a.rank)
      let success = found.length > 0
      if (success) {
        s.hands[a.target] = s.hands[a.target].filter((c) => rank(c) !== a.rank)
        s.hands[p].push(...found)
      } else if (s.stock.length) {
        const c = s.stock.pop()!
        s.hands[p].push(c)
        success = rank(c) === a.rank
      }
      s.info = `${s.names[p]}が${rankText(a.rank)}を質問。${found.length ? `${found.length}枚受け取りました` : success ? '山札から同じ数字を引きました' : 'ゴーフィッシュ！'}`
      books(s, p)
      fishTurn(s, success ? p : nextSeat(s, p, (i) => s.hands[i].length > 0 || s.stock.length > 0))
      break
    }
    case 'memory': {
      if (a.type === 'next') {
        requireRule(s.phase === 'reveal')
        const [x, y] = s.selected,
          ok = rank(s.board[x]) === rank(s.board[y])
        if (ok) {
          s.matched.push(x, y)
          s.scores[p]++
        }
        if (!ok || !s.rules.extraTurn) s.turn = nextSeat(s, p, () => true)
        s.selected = []
        s.phase = 'play'
        if (s.matched.length === s.board.length) finishScores(s)
      } else {
        requireRule(
          s.phase === 'play' &&
            a.type === 'flip' &&
            a.index !== undefined &&
            a.index < s.board.length &&
            !s.matched.includes(a.index) &&
            !s.selected.includes(a.index),
        )
        s.selected.push(a.index)
        if (s.selected.length === 2) s.phase = 'reveal'
      }
      break
    }
    case 'hearts':
      heartsPlay(s, a, rng)
      break
    case 'pig': {
      if (a.type === 'roll') {
        s.roll = 1 + Math.floor(rng() * 6)
        if (s.roll === 1) {
          s.bank = 0
          s.turn = nextSeat(s, p, () => true)
          s.info = '1！ 今の手番の得点は0です。'
        } else {
          s.bank += s.roll
          s.info = `${s.roll}が出ました。`
        }
      } else {
        requireRule(a.type === 'hold' && s.bank > 0)
        s.scores[p] += s.bank
        s.bank = 0
        s.turn = nextSeat(s, p, () => true)
        if (s.scores[p] >= Number(s.rules.target)) {
          s.winners = [p]
          s.phase = 'finished'
        }
      }
      break
    }
    case 'boxes': {
      requireRule(
        a.type === 'edge' &&
          a.index !== undefined &&
          a.index < s.board.length &&
          s.board[a.index] === -1,
      )
      s.board[a.index] = p
      const n = Number(s.rules.size),
        off = n * (n + 1)
      let gained = 0
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const box = y * n + x
          if (
            s.matched[box] < 0 &&
            [y * n + x, (y + 1) * n + x, off + y * (n + 1) + x, off + y * (n + 1) + x + 1].every(
              (i) => s.board[i] >= 0,
            )
          ) {
            s.matched[box] = p
            s.scores[p]++
            gained++
          }
        }
      if (s.matched.every((i) => i >= 0)) finishScores(s)
      else if (!gained) s.turn = nextSeat(s, p, () => true)
      break
    }
  }
  s.step++
  if (s.step === 10000 && s.phase !== 'finished') {
    s.phase = 'finished'
    s.winners = []
    s.info = '操作上限で引き分けです。新しいゲームで続けてください。'
  }
  return s
}
export function partyView(s: PartyState, seat: number): PartyView {
  requireRule(Number.isInteger(seat) && seat >= 0 && seat < s.names.length)
  return structuredClone({
    game: s.game,
    names: s.names,
    rules: s.rules,
    seat,
    turn: s.turn,
    step: s.step,
    round: s.round,
    phase: s.phase,
    winners: s.winners,
    ranking: s.ranking,
    losers: s.losers,
    hand: s.hands[seat],
    counts: s.hands.map((h) => h.length),
    stockCount: s.stock.length,
    table: s.game === 'doubt' ? [] : s.game === 'crazy-eights' ? s.table.slice(-1) : s.table,
    board:
      s.game === 'memory'
        ? s.board.map((c, i) => (s.matched.includes(i) ? -2 : s.selected.includes(i) ? c : -1))
        : s.game === 'boxes'
          ? [...s.board, ...s.matched]
          : s.board,
    economy: s.economy,
    scores: s.scores,
    roundScores: s.roundScores,
    passed: s.passed,
    reversed: s.reversed,
    jBack: s.jBack,
    lock: s.lock,
    activeSuit: s.activeSuit,
    selected: s.game === 'mini-mahjong' && seat !== s.turn ? [] : s.selected,
    claim: s.claim,
    pendingCount: s.game === 'doubt' ? s.table.length : 0,
    lastPlayer: s.lastPlayer,
    trickPlayers: s.trickPlayers,
    roll: s.roll,
    bank: s.bank,
    info: s.info,
  })
}
