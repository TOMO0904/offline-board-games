import type { PartyView } from './types'
import { L, LIFE_WIDTH, MARKET_WIDTH, stat } from './economy'
export function validateEconomyView(v: PartyView) {
  if (v.game !== 'life-journey' && v.game !== 'island-market') return v.economy.length === 0
  if (
    v.hand.length ||
    v.counts.some((c) => c !== 0) ||
    v.scores.some((c) => c < 0) ||
    v.economy.some((c) => c < -1 || c > 100000)
  )
    return false
  if (v.game === 'life-journey')
    return (
      v.economy.length === v.names.length * LIFE_WIDTH &&
      v.board.length === 1 &&
      v.board[0] >= 0 &&
      v.board[0] <= 5 &&
      v.stockCount === 0 &&
      ['play', 'challenge', 'reveal', 'finished'].includes(v.phase) &&
      v.names.every((_, p) => {
        const val = (f: number) => stat(v, p, f)
        return (
          val(L.position) >= 0 &&
          val(L.position) <= 36 &&
          val(L.job) >= -1 &&
          val(L.job) <= 3 &&
          val(L.level) >= 0 &&
          val(L.level) <= 3 &&
          [L.education, L.insured, L.finished, L.route].every((f) => [0, 1].includes(val(f))) &&
          val(L.home) >= 0 &&
          val(L.home) <= 3 &&
          val(L.debt) >= 0 &&
          val(L.joy) >= 0 &&
          (val(L.finished) === 1) === (val(L.position) === 36)
        )
      })
    )
  return (
    v.economy.length === v.names.length * MARKET_WIDTH &&
    v.economy.every((x) => x >= 0) &&
    v.names.every((_, p) => [3, 4, 5, 6].every((f) => stat(v, p, f) <= 5)) &&
    v.board.length === 7 &&
    v.board.slice(0, 3).every((x) => x >= 2 && x <= 6) &&
    v.board.slice(3, 6).every((x) => x >= -1 && x < 12) &&
    new Set(v.board.slice(3, 6).filter((x) => x >= 0)).size ===
      v.board.slice(3, 6).filter((x) => x >= 0).length &&
    v.board[6] >= 0 &&
    v.board[6] < 6 &&
    v.round >= 1 &&
    v.round <= Number(v.rules.rounds) &&
    v.bank >= 0 &&
    v.bank <= 2 &&
    ['play', 'finished'].includes(v.phase)
  )
}
