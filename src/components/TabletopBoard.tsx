import { useState } from 'react'
import { tileText, yachtCategories, yachtScore } from '../party/tabletop'
import type { PartyAction, PartyView } from '../party/types'
export function TabletopBoard({
  view: v,
  enabled,
  onAction,
}: {
  view: PartyView
  enabled: boolean
  onAction(a: PartyAction): void
}) {
  const [selected, setSelected] = useState(-1),
    [amount, setAmount] = useState(1),
    [side, setSide] = useState(0),
    [held, setHeld] = useState<number[]>(v.selected)
  if (v.game === 'mancala')
    return (
      <section className="mancala-board" aria-label="マンカラの盤面">
        <div className="mancala-stores">
          <span>
            {v.names[1]}のゴール <strong>{v.board[13]}</strong>
          </span>
          <span>
            {v.names[0]}のゴール <strong>{v.board[6]}</strong>
          </span>
        </div>
        {[
          [12, 11, 10, 9, 8, 7],
          [0, 1, 2, 3, 4, 5],
        ].map((row, r) => (
          <div className="mancala-row" key={r}>
            {row.map((i) => (
              <button
                key={i}
                className="mancala-pit"
                disabled={!enabled || Math.floor(i / 7) !== v.turn || v.board[i] === 0}
                aria-label={`${v.names[Math.floor(i / 7)]}の穴${(i % 7) + 1} 石${v.board[i]}個`}
                onClick={() => onAction({ type: 'sow', index: i })}
              >
                <strong>{v.board[i]}</strong>
              </button>
            ))}
          </div>
        ))}
        <p className="small muted">
          上：{v.names[1]} ／ 下：{v.names[0]}。自分側の穴から石をまきます。
        </p>
      </section>
    )
  if (v.game === 'nim')
    return (
      <section className="panel nim-board">
        <div>
          {v.board.map((count, i) => (
            <button
              key={i}
              className={`nim-pile ${selected === i ? 'selected' : ''}`}
              disabled={!enabled || !count}
              aria-pressed={selected === i}
              onClick={() => {
                setSelected(i)
                setAmount(1)
              }}
            >
              <span>
                山{i + 1}・{count}個
              </span>
              <span aria-hidden="true">{'●'.repeat(count) || '—'}</span>
            </button>
          ))}
        </div>
        <label>
          取る数
          <select
            value={amount}
            disabled={selected < 0}
            onChange={(e) => setAmount(Number(e.target.value))}
          >
            {Array.from(
              {
                length:
                  selected < 0 ? 1 : Math.min(v.board[selected], Number(v.rules.maxTake) || 99),
              },
              (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}個
                </option>
              ),
            )}
          </select>
        </label>
        <button
          className="primary"
          disabled={!enabled || selected < 0}
          onClick={() => onAction({ type: 'take', index: selected, rank: amount })}
        >
          この山から取る
        </button>
      </section>
    )
  if (v.game === 'dominoes')
    return (
      <>
        <section className="table-cards panel">
          <h2>
            {v.board.length ? `左端 ${v.board[0]} ／ 右端 ${v.board[1]}` : '最初のタイルを選ぼう'}
          </h2>
          <div className="domino-chain">
            {v.table.map((id, i) => (
              <span className="domino-tile" key={i}>
                {tileText(id)}
              </span>
            ))}
          </div>
          <p>山札 {v.stockCount}枚</p>
        </section>
        <section className="hand-area">
          <h2>
            {v.names[v.seat]}の手札 <small>{v.hand.length}枚</small>
          </h2>
          <div className="card-row">
            {v.hand.map((id) => (
              <button
                className={`domino-tile ${selected === id ? 'selected' : ''}`}
                key={id}
                aria-pressed={selected === id}
                disabled={!enabled}
                onClick={() => setSelected(id)}
              >
                {tileText(id)}
              </button>
            ))}
          </div>
        </section>
        <div className="party-controls">
          <label>
            つなぐ側
            <select value={side} onChange={(e) => setSide(Number(e.target.value))}>
              <option value={0}>左端 {v.board[0] ?? ''}</option>
              <option value={1}>右端 {v.board[1] ?? ''}</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={!enabled || selected < 0}
            onClick={() => onAction({ type: 'tile', index: selected, target: side })}
          >
            タイルを置く
          </button>
          {v.rules.draw && (
            <button
              className="secondary"
              disabled={!enabled || !v.stockCount}
              onClick={() => onAction({ type: 'draw' })}
            >
              山札から1枚引く
            </button>
          )}
          <button
            className="secondary"
            disabled={!enabled}
            onClick={() => onAction({ type: 'pass' })}
          >
            パス
          </button>
        </div>
      </>
    )
  if (v.game === 'yacht')
    return (
      <section className="yacht-board">
        <div className="dice-row">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              className={`yacht-die ${held.includes(i) ? 'selected' : ''}`}
              disabled={!enabled || !v.roll}
              aria-pressed={held.includes(i)}
              aria-label={`サイコロ${i + 1} ${v.table[i] ?? '未ロール'}を残す`}
              onClick={() =>
                setHeld((old) => (old.includes(i) ? old.filter((n) => n !== i) : [...old, i]))
              }
            >
              {['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v.table[i] ?? 0]}
              <small>{held.includes(i) ? '残す' : '振る'}</small>
            </button>
          ))}
        </div>
        <p className="small muted">
          {v.roll} / {String(v.rules.rolls)}回。残す出目を選び、振り直せます。
        </p>
        <button
          className="primary"
          disabled={!enabled || v.roll >= Number(v.rules.rolls) || held.length === 5}
          onClick={() => onAction({ type: 'roll', cards: held })}
        >
          {v.roll ? '選んでいないサイコロを振り直す' : '5個のサイコロを振る'}
        </button>
        <h2>得点を記録する</h2>
        <div className="yacht-categories">
          {yachtCategories.map((label, i) => {
            const used = v.board[v.seat * 12 + i],
              possible = v.roll ? yachtScore(v.table, i) : 0
            return (
              <button
                key={i}
                disabled={!enabled || !v.roll || used >= 0}
                onClick={() => onAction({ type: 'score', index: i })}
              >
                <span>{label}</span>
                <strong>{used >= 0 ? `${used}点 ✓` : `${possible}点`}</strong>
              </button>
            )
          })}
        </div>
        <p className="small muted">
          上段は同じ出目の合計。チョイスは全合計。フォーダイスとフルハウスは成立時の全合計。小ストレート15点、大ストレート30点、ヨット50点。
        </p>
        <details>
          <summary>全員のスコアシート</summary>
          <div className="score-table-wrap">
            <table className="score-table">
              <thead>
                <tr>
                  <th>役</th>
                  {v.names.map((name, i) => (
                    <th key={i}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yachtCategories.map((label, i) => (
                  <tr key={i}>
                    <th>{label}</th>
                    {v.names.map((_, p) => (
                      <td key={p}>{v.board[p * 12 + i] < 0 ? '—' : v.board[p * 12 + i]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    )
  return null
}
