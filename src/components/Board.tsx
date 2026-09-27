import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { engines, playerName } from '../games'
import { type GameState, type Move, type Player } from '../games/core/types'
import { shogiLabels } from '../games/shogi/engine'

const chessSymbols: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const chessNames: Record<string, string> = {
  k: 'キング',
  q: 'クイーン',
  r: 'ルーク',
  b: 'ビショップ',
  n: 'ナイト',
  p: 'ポーン',
}
export function Board({
  state,
  onMove,
  interactive,
  player,
}: {
  state: GameState
  onMove(move: Move): void
  interactive: boolean
  player?: Player
}) {
  const engine = engines[state.game]
  const legal = useMemo(() => engine.getLegalMoves(state), [state, engine])
  const [from, setFrom] = useState<number | null>(null),
    [drop, setDrop] = useState<string | null>(null)
  const [options, setOptions] = useState<Move[]>([]),
    [pending, setPending] = useState<Move | null>(null)
  const [flipped, setFlipped] = useState(player === 1),
    [focus, setFocus] = useState(0),
    [zoom, setZoom] = useState(false)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    setFrom(null)
    setDrop(null)
    setPending(null)
    setOptions([])
  }, [state])
  const pieces = state.game === 'chess' || state.game === 'shogi'
  const precise = state.game === 'gomoku'
  const moves = legal.filter((m) =>
    drop ? m.drop === drop : from !== null ? m.from === from : m.from === undefined && !m.drop,
  )
  const destinations = new Set(moves.map((m) => m.to))
  const last = state.history.at(-1)
  function commit(move: Move) {
    onMove(move)
    setFrom(null)
    setDrop(null)
    setOptions([])
    setPending(null)
  }
  function click(index: number) {
    if (!interactive) return
    if (state.game === 'connect-four') {
      const move = legal.find((m) => m.to % 7 === index % 7)
      if (move) commit(move)
      return
    }
    if (pieces && state.board[index]?.owner === state.turn) {
      setFrom(from === index ? null : index)
      setDrop(null)
      setOptions([])
      return
    }
    const choices = moves.filter((m) => m.to === index)
    if (choices.length > 1) setOptions(choices)
    else if (choices.length) {
      if (precise) setPending(choices[0])
      else commit(choices[0])
    }
  }
  function keyboard(e: KeyboardEvent<HTMLButtonElement>, displayIndex: number) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -engine.columns,
      ArrowDown: engine.columns,
      Home: -displayIndex,
      End: state.board.length - 1 - displayIndex,
    }
    if (!(e.key in deltas)) return
    e.preventDefault()
    const next = Math.max(0, Math.min(state.board.length - 1, displayIndex + deltas[e.key]))
    setFocus(next)
    cells.current[next]?.focus()
  }
  function hand(owner: Player) {
    if (!state.hands) return null
    const list = Object.entries(state.hands[owner]).filter(([, count]) => count > 0)
    return (
      <div className={`hand ${owner === state.turn ? 'active' : ''}`}>
        <span>{playerName(state.game, owner)}の持ち駒</span>
        <div>
          {!list.length && <small>なし</small>}
          {list.map(([kind, count]) => (
            <button
              key={kind}
              aria-label={`${playerName(state.game, owner)}の${shogiLabels[kind]} ${count}枚`}
              aria-pressed={drop === kind && owner === state.turn}
              disabled={!interactive || owner !== state.turn}
              onClick={() => {
                setDrop(drop === kind ? null : kind)
                setFrom(null)
              }}
            >
              {shogiLabels[kind]}
              <small>×{count}</small>
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="board-section">
      {state.game === 'shogi' && hand(flipped ? 0 : 1)}
      <div className={`board-scroll ${zoom ? 'zoomed' : ''}`}>
        <div
          className={`board ${state.game}`}
          style={{ '--columns': engine.columns } as CSSProperties}
          role="group"
          aria-label={`${engine.name}の盤面`}
        >
          {state.board.map((_, displayIndex) => {
            const index = flipped && pieces ? state.board.length - 1 - displayIndex : displayIndex
            const piece = state.board[index],
              x = index % engine.columns,
              y = Math.floor(index / engine.columns)
            const label = piece
              ? state.game === 'chess'
                ? chessNames[piece.kind]
                : state.game === 'shogi'
                  ? shogiLabels[(piece.promoted ? '+' : '') + piece.kind]
                  : '石'
              : '空き'
            const marker = destinations.has(index) && interactive
            return (
              <button
                key={index}
                ref={(el) => {
                  cells.current[displayIndex] = el
                }}
                tabIndex={displayIndex === focus ? 0 : -1}
                onFocus={() => setFocus(displayIndex)}
                onKeyDown={(e) => keyboard(e, displayIndex)}
                className={`cell ${(x + y) % 2 ? 'odd' : 'even'} ${marker ? 'legal' : ''} ${from === index || pending?.to === index ? 'selected' : ''} ${last?.to === index ? 'last-move' : ''}`}
                aria-label={`${x + 1}列${y + 1}行 ${piece ? playerName(state.game, piece.owner) + 'の' : ''}${label}${marker ? ' 合法手' : ''}`}
                aria-disabled={!interactive}
                aria-pressed={from === index || pending?.to === index}
                onClick={() => click(index)}
              >
                {piece && (
                  <span
                    className={`piece owner-${piece.owner} ${piece.promoted ? 'promoted' : ''} ${state.game === 'shogi' && (piece.owner === 1) !== flipped ? 'inverted' : ''}`}
                    aria-hidden="true"
                  >
                    {state.game === 'chess'
                      ? chessSymbols[piece.kind]
                      : state.game === 'shogi'
                        ? label
                        : ''}
                  </span>
                )}
                {marker && !piece && !precise && <span className="legal-dot" aria-hidden="true" />}
                {last?.to === index && <span className="last-dot" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
      {state.game === 'shogi' && hand(flipped ? 1 : 0)}
      <div className="board-caption">
        <span>
          {pieces
            ? drop
              ? '打つ場所を選んでください'
              : from !== null
                ? '光っているマスへ移動'
                : '駒を選んで、移動先をタップ'
            : precise
              ? '場所を選び、下のボタンで確定'
              : state.game === 'connect-four'
                ? '落としたい列をタップ'
                : '点のあるマスに置けます'}
        </span>
        {pieces && (
          <button className="text-button" onClick={() => setFlipped(!flipped)}>
            ↻ 盤面を反転
          </button>
        )}
        {precise && (
          <button className="text-button" onClick={() => setZoom(!zoom)}>
            {zoom ? '全体表示' : '盤面を拡大'}
          </button>
        )}
      </div>
      {precise && (
        <button
          className="primary full"
          disabled={!pending || !interactive}
          onClick={() => pending && commit(pending)}
        >
          {pending
            ? `${(pending.to % 15) + 1}列 ${Math.floor(pending.to / 15) + 1}行に置く`
            : '盤面で置く場所を選択'}
        </button>
      )}
      {options.length > 1 && (
        <div className="promotion panel" role="group" aria-label="昇格・成りの選択">
          <strong>{state.game === 'chess' ? '昇格する駒を選択' : '成りますか？'}</strong>
          <div className="button-row">
            {options.map((m, i) => (
              <button className="primary" key={i} onClick={() => commit(m)}>
                {m.promotion ? chessNames[m.promotion] : m.promote ? '成る' : '成らない'}
              </button>
            ))}
            <button className="secondary" onClick={() => setOptions([])}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
