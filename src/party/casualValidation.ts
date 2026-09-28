import type { PartyView } from './types'
import { wolfPairs } from './words'

// Called after the shared schema has checked every field and array element.
export function validateCasualView(v: PartyView): boolean {
  const n = v.names.length
  switch (v.game) {
    case 'mini-mahjong':
      return (
        v.hand.length >= 13 &&
        v.hand.length <= 14 &&
        v.counts.every((c) => c === 13 || c === 14) &&
        v.board.length === v.trickPlayers.length &&
        v.selected.length <= 1 &&
        [0, 14].includes(v.table.length) &&
        v.selected.every((c) => v.hand.includes(c)) &&
        [...v.hand, ...v.board, ...v.table].every((c) => c < (v.rules.honors ? 136 : 108))
      )
    case 'hit-blow': {
      const digits = Number(v.rules.digits),
        width = digits + 3
      if (
        v.board.length % width ||
        v.board.length > width * Number(v.rules.attempts) ||
        ![0, digits].includes(v.table.length) ||
        v.hand.length
      )
        return false
      for (let i = 0; i < v.board.length; i += width) {
        const guess = v.board.slice(i + 1, i + 1 + digits),
          hit = v.board[i + 1 + digits],
          blow = v.board[i + 2 + digits]
        if (
          v.board[i] < 0 ||
          v.board[i] >= n ||
          !guess.every((x) => x >= 1 && x <= 6) ||
          new Set(guess).size !== digits ||
          hit < 0 ||
          blow < 0 ||
          hit + blow > digits
        )
          return false
      }
      return v.table.every((x) => x >= 1 && x <= 6) && new Set(v.table).size === v.table.length
    }
    case 'word-wolf':
      return (
        v.hand.length === 1 &&
        v.hand[0] < wolfPairs.length * 2 &&
        [0, n].includes(v.board.length) &&
        v.board.every((p) => p >= 0 && p < n) &&
        (v.table.length === 0 ||
          (v.table.length === 3 &&
            v.table[0] < n &&
            v.table.every((x) => x >= 0) &&
            v.table.slice(1).every((c) => c < wolfPairs.length * 2)))
      )
    default:
      return true
  }
}
