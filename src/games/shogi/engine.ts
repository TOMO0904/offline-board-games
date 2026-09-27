import { makeEngine } from '../core/engine'
import { other, type GameState, type Move, type Piece, type Player } from '../core/types'

export const shogiLabels: Record<string, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
  '+R': '龍',
  '+B': '馬',
  '+S': '全',
  '+N': '圭',
  '+L': '杏',
  '+P': 'と',
}
const gold = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]
const diagonals = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]
const straights = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]
const inside = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 9
const zone = (row: number, owner: Player) => (owner === 0 ? row <= 2 : row >= 6)
const dead = (kind: string, row: number, owner: Player) =>
  kind === 'P' || kind === 'L'
    ? row === (owner === 0 ? 0 : 8)
    : kind === 'N' && (owner === 0 ? row <= 1 : row >= 7)

function targets(s: GameState, from: number): number[] {
  const p = s.board[from]
  if (!p) return []
  let steps: number[][] = [],
    rays: number[][] = []
  if (p.promoted && ['P', 'L', 'N', 'S'].includes(p.kind)) steps = gold
  else
    switch (p.kind) {
      case 'K':
        steps = [...diagonals, ...straights]
        break
      case 'G':
        steps = gold
        break
      case 'S':
        steps = [...diagonals, [0, -1]]
        break
      case 'N':
        steps = [
          [-1, -2],
          [1, -2],
        ]
        break
      case 'P':
        steps = [[0, -1]]
        break
      case 'L':
        rays = [[0, -1]]
        break
      case 'B':
        rays = diagonals
        if (p.promoted) steps = straights
        break
      case 'R':
        rays = straights
        if (p.promoted) steps = diagonals
        break
    }
  const result: number[] = [],
    sign = p.owner === 0 ? 1 : -1
  for (const [dx, dy] of steps) {
    const x = (from % 9) + dx * sign,
      y = Math.floor(from / 9) + dy * sign
    if (inside(x, y) && s.board[y * 9 + x]?.owner !== p.owner) result.push(y * 9 + x)
  }
  for (const [dx, dy] of rays) {
    let x = (from % 9) + dx * sign,
      y = Math.floor(from / 9) + dy * sign
    while (inside(x, y)) {
      const piece = s.board[y * 9 + x]
      if (piece?.owner === p.owner) break
      result.push(y * 9 + x)
      if (piece) break
      x += dx * sign
      y += dy * sign
    }
  }
  return result
}
export function inCheck(s: GameState, owner = s.turn): boolean {
  const king = s.board.findIndex((p) => p?.owner === owner && p.kind === 'K')
  if (king < 0) return true
  return s.board.some((p, from) => p?.owner === other(owner) && targets(s, from).includes(king))
}
function basic(s: GameState, m: Move): GameState {
  const board = [...s.board]
  const hands: NonNullable<GameState['hands']> = [{ ...s.hands![0] }, { ...s.hands![1] }]
  if (m.drop) {
    hands[s.turn][m.drop]--
    board[m.to] = { owner: s.turn, kind: m.drop }
  } else {
    const piece = board[m.from!]!
    const captured = board[m.to]
    if (captured) hands[s.turn][captured.kind] = (hands[s.turn][captured.kind] || 0) + 1
    board[m.to] = { ...piece, promoted: piece.promoted || !!m.promote }
    board[m.from!] = null
  }
  return { ...s, board, hands, turn: other(s.turn) }
}
export function shogiLegal(s: GameState, skipPawnMate = false): Move[] {
  if (s.winner !== null) return []
  const moves: Move[] = []
  for (let from = 0; from < 81; from++) {
    const p = s.board[from]
    if (p?.owner !== s.turn) continue
    for (const to of targets(s, from)) {
      if (s.board[to]?.kind === 'K') continue
      const canPromote =
        !p.promoted &&
        !['K', 'G'].includes(p.kind) &&
        (zone(Math.floor(from / 9), s.turn) || zone(Math.floor(to / 9), s.turn))
      if (!canPromote || !dead(p.kind, Math.floor(to / 9), s.turn)) moves.push({ from, to })
      if (canPromote) moves.push({ from, to, promote: true })
    }
  }
  for (const [kind, count] of Object.entries(s.hands?.[s.turn] || {})) {
    if (!count) continue
    for (let to = 0; to < 81; to++) {
      if (s.board[to] || dead(kind, Math.floor(to / 9), s.turn)) continue
      if (
        kind === 'P' &&
        s.board.some(
          (p, i) => i % 9 === to % 9 && p?.owner === s.turn && p.kind === 'P' && !p.promoted,
        )
      )
        continue
      moves.push({ to, drop: kind })
    }
  }
  return moves.filter((m) => {
    const n = basic(s, m)
    if (inCheck(n, s.turn)) return false
    // A checking pawn drop touches the king: a reply cannot block it with another drop.
    if (!skipPawnMate && m.drop === 'P' && inCheck(n) && !shogiLegal(n, true).length) return false
    return true
  })
}
export function positionKey(s: GameState): string {
  return JSON.stringify([
    s.turn,
    s.board.map((p) => (p ? `${p.owner}${p.promoted ? '+' : ''}${p.kind}` : '')),
    [0, 1].map((p) => 'PLNSGBR'.split('').map((k) => s.hands?.[p][k] || 0)),
  ])
}
function initial(): GameState {
  const board: (Piece | null)[] = Array.from({ length: 81 }, () => null)
  for (let i = 0; i < 9; i++) {
    board[i] = { owner: 1, kind: 'LNSGKGSNL'[i] }
    board[72 + i] = { owner: 0, kind: 'LNSGKGSNL'[i] }
    board[18 + i] = { owner: 1, kind: 'P' }
    board[54 + i] = { owner: 0, kind: 'P' }
  }
  board[10] = { owner: 1, kind: 'R' }
  board[16] = { owner: 1, kind: 'B' }
  board[64] = { owner: 0, kind: 'B' }
  board[70] = { owner: 0, kind: 'R' }
  const s: GameState = {
    game: 'shogi',
    board,
    hands: [{}, {}],
    turn: 0,
    ply: 0,
    winner: null,
    history: [],
    positions: [],
  }
  s.positions = [{ key: positionKey(s), checking: null }]
  return s
}
export const shogi = makeEngine({
  id: 'shogi',
  name: '将棋',
  columns: 9,
  rows: 9,
  createInitialState: initial,
  getLegalMoves: (s) => shogiLegal(s),
  next(s, m) {
    const n = basic(s, m)
    n.check = inCheck(n)
    const key = positionKey(n)
    n.positions = [
      ...(s.positions || []),
      { key, checking: n.check ? s.turn : null, mover: s.turn },
    ]
    if (!shogiLegal(n).length) {
      n.winner = s.turn
      n.reason = n.check ? '詰み' : '合法手なし'
    }
    const repeats = n.positions.flatMap((p, i) => (p.key === key ? [i] : []))
    if (repeats.length >= 4) {
      const cycle = n.positions.slice(repeats[repeats.length - 4] + 1)
      const checker = ([0, 1] as Player[]).find((p) => {
        const turns = cycle.filter((r) => r.mover === p)
        return turns.length > 0 && turns.every((r) => r.checking === p)
      })
      n.winner = checker === undefined ? 'draw' : other(checker)
      n.reason = checker === undefined ? '千日手' : '連続王手の千日手（王手側の負け）'
    }
    return n
  },
})
