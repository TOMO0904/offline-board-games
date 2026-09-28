import { requireRule, type PartyState, type PartyAction, type Random } from './types'
import { M, buildings, contracts, stat, addStat, finishEconomy } from './economy'
export const marketEvents = [
  '穏やかな海：通常の生産',
  '豊作：全員に食料＋1',
  '漂着木材：全員に木材＋1',
  '鉱脈の発見：全員に鉱石＋1',
  '商船の来航：全員に現金＋2',
  '荒波：交易港の収入が今回は0',
]
export function initMarket(s: PartyState, rng: Random) {
  s.scores.fill(20)
  s.names.forEach((_, p) => [0, 1, 2].forEach((i) => addStat(s, p, i, 2)))
  s.board = [3, 3, 3, ...[0, 1, 2].map(() => s.stock.pop()!), 0]
  s.bank = 2
  s.round = 1
  for (let i = 0; i < 3; i++) s.board[i] = 2 + Math.floor(rng() * 5)
  s.info = '2アクションで売買・建設・契約納品。全員が終えると生産と相場更新。'
}
export function canBuild(
  s: Pick<PartyState, 'economy' | 'game' | 'scores' | 'board' | 'names' | 'rules'>,
  p: number,
  i: number,
) {
  const b = buildings[i]
  return (
    !!b &&
    s.scores[p] >= b.cash &&
    b.costs.every((c, r) => stat(s, p, r) >= c) &&
    stat(s, p, i + 3) < 5
  )
}
export function canDeliver(
  s: Pick<PartyState, 'economy' | 'game' | 'scores' | 'board' | 'names' | 'rules'>,
  p: number,
  i: number,
) {
  const c = contracts[s.board[i + 3]]
  return !!c && c.need.every((v, r) => stat(s, p, r) >= v)
}
function endTurn(s: PartyState, rng: Random) {
  if (s.turn === s.names.length - 1) {
    const event = Math.floor(rng() * marketEvents.length)
    s.board[6] = event
    s.names.forEach((_, p) => {
      addStat(s, p, M.food, stat(s, p, M.farm) * 2 + (event === 1 ? 1 : 0))
      addStat(s, p, M.wood, stat(s, p, M.mill) * 2 + (event === 2 ? 1 : 0))
      addStat(s, p, M.ore, stat(s, p, M.mine) * 2 + (event === 3 ? 1 : 0))
      s.scores[p] += (event === 5 ? 0 : stat(s, p, M.port) * 3) + (event === 4 ? 2 : 0)
    })
    if (s.round >= Number(s.rules.rounds)) {
      finishEconomy(s)
      return
    }
    s.round++
    for (let i = 0; i < 3; i++) s.board[i] = 2 + Math.floor(rng() * 5)
    s.info = `生産完了。${marketEvents[event]}。新しい相場です。`
  }
  s.turn = (s.turn + 1) % s.names.length
  s.bank = 2
}
export function playMarket(s: PartyState, a: PartyAction, rng: Random) {
  const p = s.turn,
    i = a.index
  requireRule(s.phase === 'play' && s.bank > 0)
  if (a.type === 'next') {
    s.info = `${s.names[p]}は残りの行動を終了。`
    endTurn(s, rng)
    return
  }
  requireRule(i !== undefined)
  if (a.type === 'buy' || a.type === 'sell') {
    requireRule(i <= 2)
    const cost = s.board[i],
      buy = a.type === 'buy'
    requireRule(
      buy ? s.scores[p] >= cost : stat(s, p, i) > 0,
      buy ? '現金が足りません。' : '在庫がありません。',
    )
    s.scores[p] += buy ? -cost : cost
    addStat(s, p, i, buy ? 1 : -1)
    s.info = `${s.names[p]}が${['木材', '鉱石', '食料'][i]}を1個${buy ? '購入' : '売却'}（${cost}コイン）。`
  } else if (a.type === 'build') {
    requireRule(i < 4 && canBuild(s, p, i), '建設費・資源不足、または同じ施設が5棟あります。')
    const b = buildings[i]
    s.scores[p] -= b.cash
    b.costs.forEach((cost, r) => addStat(s, p, r, -cost))
    addStat(s, p, i + 3, 1)
    s.info = `${s.names[p]}が${b.name}を建設。次の生産から稼働！`
  } else {
    requireRule(
      a.type === 'deliver' && i < 3 && canDeliver(s, p, i),
      '納品する資源が足りないか、契約が終了しています。',
    )
    const c = contracts[s.board[i + 3]]
    c.need.forEach((cost, r) => addStat(s, p, r, -cost))
    s.scores[p] += c.pay
    addStat(s, p, M.contracts, 1)
    s.board[i + 3] = s.stock.pop() ?? -1
    s.info = `${s.names[p]}が「${c.name}」を達成。${c.pay}コイン！`
  }
  s.bank--
  if (!s.bank) endTurn(s, rng)
}
