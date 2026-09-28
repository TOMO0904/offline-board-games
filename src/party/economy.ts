import type { PartyAction, PartyState, PartyView, Random } from './types'
import { requireRule, shuffle } from './types'
import { initLife, playLife } from './life'
import { initMarket, playMarket } from './market'
// Compact per-player numeric records allow the existing indexed delta protocol.
export const LIFE_WIDTH = 10
export const L = {
  position: 0,
  job: 1,
  level: 2,
  education: 3,
  debt: 4,
  home: 5,
  insured: 6,
  joy: 7,
  finished: 8,
  route: 9,
} as const
export const MARKET_WIDTH = 8
export const M = {
  wood: 0,
  ore: 1,
  food: 2,
  farm: 3,
  mill: 4,
  mine: 5,
  port: 6,
  contracts: 7,
} as const
export type EconomyView = Pick<
  PartyView,
  'game' | 'economy' | 'scores' | 'board' | 'names' | 'rules'
>
export const jobs = [
  { name: '配達スタッフ', salary: 6, study: false },
  { name: 'ショップ店主', salary: 4, study: false },
  { name: 'エンジニア', salary: 11, study: true },
  { name: 'デザイナー', salary: 9, study: true },
]
export const homes = [
  { name: '賃貸', cost: 0, value: 0 },
  { name: '小さな家', cost: 25, value: 30 },
  { name: '海辺の家', cost: 45, value: 56 },
  { name: '丘の邸宅', cost: 70, value: 86 },
]
export const resourceNames = ['木材', '鉱石', '食料']
export const buildings = [
  { name: '農園', costs: [2, 0, 0], cash: 4, value: 8, produces: '食料＋2' },
  { name: '製材所', costs: [0, 2, 0], cash: 4, value: 8, produces: '木材＋2' },
  { name: '鉱山', costs: [0, 0, 2], cash: 5, value: 9, produces: '鉱石＋2' },
  { name: '交易港', costs: [3, 3, 0], cash: 8, value: 18, produces: '現金＋3' },
]
export const contracts = [
  { name: '桟橋の修理', need: [3, 1, 0], pay: 18 },
  { name: '船団のお弁当', need: [0, 0, 4], pay: 17 },
  { name: '灯台の改修', need: [1, 3, 0], pay: 19 },
  { name: '収穫祭の準備', need: [1, 0, 3], pay: 18 },
  { name: '新しい交易船', need: [4, 2, 0], pay: 28 },
  { name: '救援物資', need: [1, 1, 3], pay: 25 },
  { name: '山道の整備', need: [2, 2, 1], pay: 24 },
  { name: '遠洋航海', need: [2, 1, 4], pay: 33 },
  { name: '市場の新設', need: [3, 2, 2], pay: 34 },
  { name: '学校の建設', need: [3, 3, 1], pay: 35 },
  { name: '島の晩餐会', need: [0, 1, 5], pay: 29 },
  { name: '大灯台の建設', need: [4, 4, 2], pay: 48 },
]
export function stat(v: EconomyView, p: number, field: number) {
  return v.economy[p * (v.game === 'life-journey' ? LIFE_WIDTH : MARKET_WIDTH) + field]
}
export function setStat(s: PartyState, p: number, field: number, value: number) {
  s.economy[p * (s.game === 'life-journey' ? LIFE_WIDTH : MARKET_WIDTH) + field] = value
}
export function addStat(s: PartyState, p: number, field: number, value: number) {
  setStat(s, p, field, stat(s, p, field) + value)
}
export function assetValue(v: EconomyView, p: number) {
  if (v.game === 'life-journey')
    return (
      v.scores[p] + homes[stat(v, p, L.home)].value + stat(v, p, L.joy) * 3 - stat(v, p, L.debt)
    )
  return (
    v.scores[p] +
    [0, 1, 2].reduce((sum, i) => sum + stat(v, p, i) * v.board[i], 0) +
    buildings.reduce((sum, b, i) => sum + stat(v, p, i + 3) * b.value, 0)
  )
}
export function finishEconomy(s: PartyState) {
  const values = s.names.map((_, p) => assetValue(s, p)),
    best = Math.max(...values)
  s.winners = values.flatMap((v, p) => (v === best ? [p] : []))
  s.phase = 'finished'
  s.info = '最終資産を集計しました。同額なら同順位です。'
}
export function initEconomy(s: PartyState, rng: Random) {
  s.economy = Array(s.names.length * (s.game === 'life-journey' ? LIFE_WIDTH : MARKET_WIDTH)).fill(
    0,
  )
  if (s.game === 'life-journey') initLife(s)
  else {
    s.stock = shuffle(
      contracts.map((_, i) => i),
      rng,
    )
    initMarket(s, rng)
  }
}
export function playEconomy(s: PartyState, a: PartyAction, rng: Random) {
  requireRule(s.game === 'life-journey' || s.game === 'island-market')
  if (s.game === 'life-journey') playLife(s, a, rng)
  else playMarket(s, a, rng)
}
