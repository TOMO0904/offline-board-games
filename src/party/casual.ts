import { initMahjong, playMahjong } from './mahjong'
import { gestureWords, wolfPairs, wolfWord } from './words'
import {
  deck,
  finishScores,
  rank,
  requireRule,
  shuffle,
  type PartyAction,
  type PartyState,
  type Random,
} from './types'

export const rpsNames = ['グー', 'チョキ', 'パー']
export function hitBlow(answer: number[], guess: number[]) {
  const hit = guess.filter((v, i) => v === answer[i]).length
  return [hit, guess.filter((v) => answer.includes(v)).length - hit]
}
function winnerOthers(s: PartyState, loser: number) {
  s.losers = [loser]
  s.winners = s.names.flatMap((_, i) => (i === loser ? [] : [i]))
  s.phase = 'finished'
}
function resetRps(s: PartyState) {
  s.hands = s.names.map(() => [])
  s.table = []
  s.phase = 'play'
  s.turn = s.round % s.names.length
  s.stalled = 0
  s.info = `${s.round + 1}回目。自分の手を秘密に選ぼう。`
}
function wolfDeal(s: PartyState, rng: Random) {
  const pair = Math.floor(rng() * wolfPairs.length),
    wolf = Math.floor(rng() * s.names.length),
    majority = Math.floor(rng() * 2)
  s.stock = [wolf]
  s.hands = s.names.map((_, p) => [pair * 2 + (p === wolf ? 1 - majority : majority)])
  s.pending = []
  s.board = []
  s.table = []
  s.phase = 'play'
  s.turn = 0
  s.stalled = 0
  s.info = '自分のお題を覚えて、ほかの人には見せずに確認ボタンを押してください。'
}
function gestureDeal(s: PartyState, rng: Random) {
  if (!s.stock.length)
    s.stock = shuffle(
      gestureWords.map((_, i) => i),
      rng,
    )
  s.hands = s.names.map(() => [])
  s.hands[s.turn] = [s.stock.pop()!]
  s.info = `${s.names[s.turn]}がお題を動きで伝える番です。`
}
export function initCasual(s: PartyState, rng: Random) {
  switch (s.game) {
    case 'mini-mahjong':
      initMahjong(s, rng)
      break
    case 'hit-blow':
      s.stock = shuffle([1, 2, 3, 4, 5, 6], rng).slice(0, Number(s.rules.digits))
      s.info = 'みんなで相談して、秘密の並びを当てよう。'
      break
    case 'high-low':
      s.stock = shuffle(deck(), rng)
      s.table = [s.stock.pop()!]
      break
    case 'number-mine':
      s.stock = [1 + Math.floor(rng() * Number(s.rules.limit))]
      s.board = [0, Number(s.rules.limit) + 1]
      break
    case 'rps':
      resetRps(s)
      break
    case 'word-wolf':
      wolfDeal(s, rng)
      break
    case 'charades':
      gestureDeal(s, rng)
      break
    case 'count-21':
      s.bank = 0
      break
    case 'tic-tac-toe':
      s.board = Array(9).fill(-1)
      break
  }
}
export function playCasual(s: PartyState, a: PartyAction, rng: Random) {
  const p = s.turn,
    n = s.names.length
  switch (s.game) {
    case 'mini-mahjong':
      playMahjong(s, a, rng)
      break
    case 'hit-blow': {
      requireRule(
        a.type === 'guess' &&
          a.cards?.length === Number(s.rules.digits) &&
          a.cards.every((x) => x >= 1 && x <= 6),
        '1〜6を重複なしで選んでください。',
      )
      const result = hitBlow(s.stock, a.cards)
      s.board.push(p, ...a.cards, ...result)
      s.stalled++
      s.info = `${s.names[p]}：${result[0]}ヒット・${result[1]}ブロー。`
      if (result[0] === Number(s.rules.digits) || s.stalled === Number(s.rules.attempts)) {
        s.phase = 'finished'
        s.table = [...s.stock]
        s.winners = result[0] === Number(s.rules.digits) ? s.names.map((_, i) => i) : []
        s.info +=
          result[0] === Number(s.rules.digits)
            ? ' みんなで解けました！'
            : ' 回数切れ。今回は解けませんでした。'
      } else s.turn = (p + 1) % n
      break
    }
    case 'high-low': {
      if (s.phase === 'reveal') {
        requireRule(a.type === 'next')
        s.table = s.table.slice(-1)
        s.phase = 'play'
        s.turn = (p + 1) % n
        s.round = Math.floor(s.stalled / n)
        if (s.stalled === n * Number(s.rules.rounds)) finishScores(s)
      } else {
        requireRule(a.type === 'guess' && (a.index === 0 || a.index === 1))
        const before = s.table[0]
        if (!s.stock.length)
          s.stock = shuffle(
            deck().filter((c) => c !== before),
            rng,
          )
        const after = s.stock.pop()!,
          ok = a.index === 0 ? rank(after) < rank(before) : rank(after) > rank(before)
        if (ok) s.scores[p]++
        s.table = [before, after]
        s.phase = 'reveal'
        s.stalled++
        s.info =
          rank(before) === rank(after) ? '同じ数字で0点。' : ok ? '正解！ 1点獲得。' : '残念、0点。'
      }
      break
    }
    case 'number-mine': {
      requireRule(
        a.type === 'guess' && a.index !== undefined && a.index > s.board[0] && a.index < s.board[1],
        '表示された範囲の数字を選んでください。',
      )
      const value = a.index
      if (value === s.stock[0]) {
        winnerOthers(s, p)
        s.table = [value]
        s.info = `${s.names[p]}が地雷の${value}を選びました！`
      } else {
        s.board[value < s.stock[0] ? 0 : 1] = value
        s.turn = (p + 1) % n
        s.info = `${value}は安全。地雷はもっと${value < s.stock[0] ? '大きい' : '小さい'}数字です。`
      }
      break
    }
    case 'rps': {
      if (s.phase === 'reveal') {
        requireRule(a.type === 'next')
        s.round++
        if (s.round >= Number(s.rules.rounds)) finishScores(s)
        else resetRps(s)
      } else {
        requireRule(
          a.type === 'choose' && a.index !== undefined && a.index <= 2 && !s.hands[p].length,
        )
        s.hands[p] = [a.index]
        s.stalled++
        if (s.stalled === n) {
          s.table = s.hands.map((h) => h[0])
          s.phase = 'reveal'
          const values = [...new Set(s.table)]
          const win =
            values.length === 2 ? values.find((x) => values.includes((x + 1) % 3)) : undefined
          s.roundScores = s.table.map((x) => (x === win ? 1 : 0))
          s.scores = s.scores.map((score, i) => score + s.roundScores[i])
          s.info =
            win === undefined ? 'あいこ！ 全員0点。' : `${rpsNames[win]}の勝ち！ 勝った人に1点。`
        } else s.turn = (p + 1) % n
      }
      break
    }
    case 'word-wolf': {
      if (s.phase === 'round-end') {
        requireRule(a.type === 'next')
        s.round++
        if (s.round >= Number(s.rules.rounds)) finishScores(s)
        else wolfDeal(s, rng)
      } else if (s.phase === 'play') {
        requireRule(a.type === 'next')
        s.stalled++
        if (s.stalled === n) {
          s.phase = 'challenge'
          s.turn = 0
          s.info =
            '全員で会話しよう。お題そのものは言わず、特徴を話してください。相談が終わったら投票へ。'
        } else s.turn++
      } else if (s.phase === 'challenge') {
        requireRule(a.type === 'next')
        s.phase = 'reveal'
        s.turn = 0
        s.info = '少数派だと思う人へ、秘密に投票してください。'
      } else {
        requireRule(
          s.phase === 'reveal' &&
            a.type === 'vote' &&
            a.target !== undefined &&
            a.target < n &&
            a.target !== p,
          '自分以外の人を選んでください。',
        )
        s.pending.push(a.target)
        if (s.pending.length === n) {
          const votes = s.names.map((_, i) => s.pending.filter((x) => x === i).length),
            max = Math.max(...votes),
            leaders = votes.flatMap((v, i) => (v === max ? [i] : [])),
            wolf = s.stock[0],
            caught = leaders.length === 1 && leaders[0] === wolf
          s.board = [...s.pending]
          s.roundScores = votes
          s.table = [wolf, s.hands[(wolf + 1) % n][0], s.hands[wolf][0]]
          s.scores = s.scores.map(
            (score, i) => score + ((caught ? i !== wolf : i === wolf) ? 1 : 0),
          )
          s.phase = 'round-end'
          s.info = `${caught ? '多数派の勝ち' : '少数派の勝ち'}。少数派は${s.names[wolf]}。多数派「${wolfWord(s.table[1])}」、少数派「${wolfWord(s.table[2])}」。`
        } else s.turn++
      }
      break
    }
    case 'charades': {
      requireRule(a.type === 'score' || a.type === 'pass')
      const word = gestureWords[s.hands[p][0]]
      if (a.type === 'score') s.scores[p]++
      s.stalled++
      s.round = Math.floor(s.stalled / n)
      const result = `${s.names[p]}のお題は「${word}」。${a.type === 'score' ? '1点獲得！' : 'パス。'}`
      if (s.stalled === n * Number(s.rules.rounds)) {
        s.hands = s.names.map(() => [])
        finishScores(s)
      } else {
        s.turn = (p + 1) % n
        gestureDeal(s, rng)
      }
      s.info = result
      break
    }
    case 'count-21': {
      requireRule(
        a.type === 'take' &&
          a.index !== undefined &&
          a.index >= 1 &&
          a.index <= 3 &&
          s.bank + a.index <= Number(s.rules.goal),
      )
      s.table = Array.from({ length: a.index }, (_, i) => s.bank + i + 1)
      s.bank += a.index
      s.info = `${s.names[p]}：${s.table.join('、')}`
      if (s.bank === Number(s.rules.goal)) {
        winnerOthers(s, p)
        s.info += '。最後の数字で負け！'
      } else s.turn = (p + 1) % n
      break
    }
    case 'tic-tac-toe': {
      requireRule(
        a.type === 'place' && a.index !== undefined && a.index < 9 && s.board[a.index] === -1,
      )
      s.board[a.index] = p
      const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
      ]
      if (lines.some((line) => line.every((i) => s.board[i] === p))) {
        s.winners = [p]
        s.phase = 'finished'
        s.info = '3つ並びました！'
      } else if (s.board.every((v) => v >= 0)) {
        s.phase = 'finished'
        s.info = 'マスが埋まり、引き分けです。'
      } else s.turn = 1 - p
      break
    }
  }
}
