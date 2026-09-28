import { useState } from 'react'
import { TabletopBoard } from './TabletopBoard'
import { EconomyBoard } from './EconomyBoard'
import { isEconomyId } from '../party/economyCatalog'
import { CasualBoard } from './CasualBoard'
import { isCasualId } from '../party/casualCatalog'
import {
  cardText,
  rank,
  rankText,
  suit,
  suits,
  type PartyAction,
  type PartyView,
} from '../party/types'
export function PartyBoard({
  view: v,
  enabled,
  onAction,
}: {
  view: PartyView
  enabled: boolean
  onAction(a: PartyAction): void
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [chosenSuit, setChosenSuit] = useState(0),
    [target, setTarget] = useState(() => v.counts.findIndex((n, i) => i !== v.seat && n > 0))
  const act = (a: PartyAction) => {
    onAction(a)
    setSelected([])
  }
  const card = (c: number, key: number, onClick?: () => void, pressed = false) => (
    <button
      key={key}
      type="button"
      className={`playing-card ${c >= 0 && c < 52 && [1, 2].includes(suit(c)) ? 'red' : ''} ${pressed ? 'selected' : ''}`}
      aria-label={cardText(c)}
      aria-pressed={onClick ? pressed : undefined}
      disabled={!enabled || !onClick}
      onClick={onClick}
    >
      {cardText(c)}
    </button>
  )
  if (isEconomyId(v.game)) return <EconomyBoard v={v} enabled={enabled} act={act} />
  if (isCasualId(v.game)) return <CasualBoard view={v} enabled={enabled} onAction={onAction} />
  if (v.phase === 'finished')
    return (
      <div className="panel">
        <h2>
          {v.winners.length ? v.winners.map((i) => v.names[i]).join('・') + ' の勝ち' : '引き分け'}
        </h2>
        {v.ranking.length > 0 && (
          <ol>
            {v.ranking.map((p) => (
              <li key={p}>
                {v.names[p]}
                {v.losers.includes(p) ? '（反則・脱落）' : ''}
              </li>
            ))}
          </ol>
        )}
        <p>{v.info}</p>
      </div>
    )
  if (['mancala', 'nim', 'dominoes', 'yacht'].includes(v.game))
    return <TabletopBoard view={v} enabled={enabled} onAction={onAction} />
  if (v.game === 'memory')
    return (
      <section>
        <div className="memory-grid">
          {v.board.map((c, i) => (
            <button
              key={i}
              className={`playing-card ${c === -2 ? 'matched' : ''}`}
              disabled={!enabled || c !== -1 || v.phase !== 'play'}
              aria-label={
                c === -1
                  ? `カード${i + 1}をめくる`
                  : c === -2
                    ? `カード${i + 1} 獲得済み`
                    : cardText(c)
              }
              onClick={() => act({ type: 'flip', index: i })}
            >
              {c === -1 ? '?' : c === -2 ? '✓' : cardText(c)}
            </button>
          ))}
        </div>
        {v.phase === 'reveal' && (
          <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
            確認して次へ
          </button>
        )}
      </section>
    )
  if (v.game === 'boxes') {
    const n = Number(v.rules.size),
      off = n * (n + 1)
    return (
      <div className="boxes-board" style={{ gridTemplateColumns: `repeat(${n}, 12px 1fr) 12px` }}>
        {Array.from({ length: (2 * n + 1) ** 2 }, (_, i) => {
          const x = i % (2 * n + 1),
            y = Math.floor(i / (2 * n + 1))
          if (x % 2 === 0 && y % 2 === 0)
            return (
              <span key={i} className="box-dot">
                •
              </span>
            )
          if (x % 2 === 1 && y % 2 === 1) {
            const owner = v.board[off * 2 + Math.floor(y / 2) * n + Math.floor(x / 2)]
            return (
              <span key={i} className="box-owner">
                {owner >= 0 ? owner + 1 : ''}
              </span>
            )
          }
          const edge =
            y % 2 === 0
              ? (y / 2) * n + Math.floor(x / 2)
              : off + Math.floor(y / 2) * (n + 1) + x / 2
          return (
            <button
              key={i}
              className={`box-edge ${y % 2 ? 'vertical' : ''} ${v.board[edge] >= 0 ? 'taken' : ''}`}
              disabled={!enabled || v.board[edge] >= 0}
              aria-label={`辺${edge + 1}`}
              onClick={() => act({ type: 'edge', index: edge })}
            >
              <span />
            </button>
          )
        })}
      </div>
    )
  }
  if (v.game === 'pig')
    return (
      <section className="panel dice-panel">
        <div className="dice-face" aria-label={`出目 ${v.roll}`}>
          {['—', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v.roll]}
        </div>
        <p>
          今回の手番 <strong>{v.bank} 点</strong>
        </p>
        <div className="button-row">
          <button className="primary" disabled={!enabled} onClick={() => act({ type: 'roll' })}>
            サイコロを振る
          </button>
          <button
            className="secondary"
            disabled={!enabled || !v.bank}
            onClick={() => act({ type: 'hold' })}
          >
            得点を確定
          </button>
        </div>
      </section>
    )
  if (v.phase === 'round-end')
    return (
      <section className="panel">
        <h2>ラウンド終了</h2>
        <p>合計失点が少ない人が有利です。</p>
        <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
          次のラウンドへ
        </button>
      </section>
    )
  return (
    <>
      {v.game === 'sevens' ? (
        <div className="sevens-board">
          {suits.map((mark, k) => (
            <div key={k}>
              <strong>{mark}</strong>
              <div className="sevens-row">
                {Array.from({ length: 13 }, (_, r) => (
                  <span key={r} className={v.board.includes(k * 13 + r) ? 'laid' : ''}>
                    {rankText(r + 1)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <section className="table-cards panel" aria-label="場のカード">
          <span className="eyebrow">TABLE</span>
          <div className="card-row">{v.table.map((c, i) => card(c, i))}</div>
          {v.game === 'doubt' && (
            <p>
              宣言：{rankText(v.claim)} ／ 場に{v.pendingCount}枚（裏向き）
            </p>
          )}
          {v.game === 'daifugo' && (
            <p>
              {v.reversed ? '革命中' : '通常の強さ'}
              {v.jBack ? '・11バック中' : ''}
              {v.lock.length ? `・${v.lock.map((n) => suits[n]).join('')}縛り` : ''}
              {!v.table.length ? '・自由に出せます' : ''}
            </p>
          )}
          {v.game === 'crazy-eights' && (
            <p>
              次のマーク：{suits[v.activeSuit]} ／ 山札{v.stockCount}枚
            </p>
          )}
        </section>
      )}
      {v.phase === 'challenge' && (
        <div className="button-row">
          <button className="primary" disabled={!enabled} onClick={() => act({ type: 'doubt' })}>
            ダウト！
          </button>
          <button
            className="secondary"
            disabled={!enabled}
            onClick={() => act({ type: 'believe' })}
          >
            信じる
          </button>
        </div>
      )}
      {v.game === 'hearts' && v.phase === 'reveal' && (
        <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
          確認して次へ
        </button>
      )}
      <section className="hand-area">
        <h2>
          {v.names[v.seat]}の手札 <small>{v.hand.length}枚</small>
        </h2>
        <div className="card-row">
          {[...v.hand]
            .sort((a, b) => rank(a) - rank(b) || a - b)
            .map((c) =>
              card(
                c,
                c,
                () =>
                  setSelected((old) =>
                    old.includes(c)
                      ? old.filter((x) => x !== c)
                      : ['daifugo', 'doubt'].includes(v.game)
                        ? [...old, c]
                        : [c],
                  ),
                selected.includes(c),
              ),
            )}
        </div>
      </section>
      {v.phase === 'play' && (
        <div className="party-controls">
          {['old-maid', 'jiji'].includes(v.game) ? (
            <>
              <p>次の人の裏向きの札を1枚選んでください。</p>
              <div className="card-row">
                {Array.from(
                  {
                    length: (() => {
                      for (let i = 1; i < v.names.length; i++) {
                        const p = (v.turn + i) % v.names.length
                        if (v.counts[p]) return v.counts[p]
                      }
                      return 0
                    })(),
                  },
                  (_, i) => (
                    <button
                      key={i}
                      className="playing-card card-back"
                      aria-label={`相手のカード${i + 1}を引く`}
                      disabled={!enabled}
                      onClick={() => act({ type: 'draw', index: i })}
                    >
                      ?
                    </button>
                  ),
                )}
              </div>
            </>
          ) : v.game === 'go-fish' ? (
            <>
              <label>
                質問する相手
                <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                  {v.names.map((name, i) =>
                    i !== v.seat && v.counts[i] > 0 ? (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
              <button
                className="primary"
                disabled={!enabled || !selected.length}
                onClick={() => act({ type: 'ask', rank: rank(selected[0]), target })}
              >
                {selected.length ? rankText(rank(selected[0])) : '数字'}を持っていますか？
              </button>
            </>
          ) : (
            <>
              {v.game === 'crazy-eights' && selected.some((c) => rank(c) === 8) && (
                <label>
                  8で指定するマーク
                  <select
                    value={chosenSuit}
                    onChange={(e) => setChosenSuit(Number(e.target.value))}
                  >
                    {suits.map((mark, i) => (
                      <option key={i} value={i}>
                        {mark}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="primary"
                disabled={!enabled || !selected.length}
                onClick={() =>
                  act({
                    type: 'play',
                    cards: selected,
                    ...(v.game === 'crazy-eights' ? { suit: chosenSuit } : {}),
                  })
                }
              >
                選んだ{selected.length || ''}枚を出す
              </button>
              {['daifugo', 'sevens', 'crazy-eights'].includes(v.game) && (
                <button
                  className="secondary"
                  disabled={!enabled}
                  onClick={() => act({ type: 'pass' })}
                >
                  パス
                </button>
              )}
              {v.game === 'crazy-eights' && (
                <button
                  className="secondary"
                  disabled={!enabled}
                  onClick={() => act({ type: 'draw' })}
                >
                  山札から1枚引く
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
