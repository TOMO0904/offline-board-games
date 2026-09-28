import { initMahjong, playMahjong } from './mahjong'
import { wolfPairs, wolfWord } from './words'
import {
  finishScores,
  requireRule,
  shuffle,
  type PartyAction,
  type PartyState,
  type Random,
} from './types'

export function hitBlow(answer: number[], guess: number[]) {
  const hit = guess.filter((v, i) => v === answer[i]).length
  return [hit, guess.filter((v) => answer.includes(v)).length - hit]
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
export function initCasual(s: PartyState, rng: Random) {
  switch (s.game) {
    case 'mini-mahjong':
      initMahjong(s, rng)
      break
    case 'hit-blow':
      s.stock = shuffle([1, 2, 3, 4, 5, 6], rng).slice(0, Number(s.rules.digits))
      s.info = 'みんなで相談して、秘密の並びを当てよう。'
      break
    case 'word-wolf':
      wolfDeal(s, rng)
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
  }
}
