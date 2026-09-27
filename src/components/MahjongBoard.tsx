import { useState } from 'react'
import type { PartyAction, PartyView } from '../party/types'
import { mahjongText, mahjongWaits } from '../party/mahjong'

export function MahjongBoard({
  v,
  enabled,
  act,
}: {
  v: PartyView
  enabled: boolean
  act(a: PartyAction): void
}) {
  const [tile, setTile] = useState(-1)
  const handForHint = v.hand.length === 14 ? v.hand.filter((c) => c !== tile) : v.hand
  const waits = mahjongWaits(handForHint, !!v.rules.honors)
  return (
    <>
      <p className="notice">入門ルール：役・符・鳴き・リーチなし。完成すると自動アガリ。</p>
      <p>
        {v.round + 1}局目 ／ 残り {v.stockCount}牌
      </p>
      {v.table.length > 0 && (
        <section className="panel">
          <h2>アガリの手牌</h2>
          <div className="mahjong-tiles">
            {v.table.map((c) => (
              <span className="mahjong-tile" key={c}>
                {mahjongText(c)}
              </span>
            ))}
          </div>
        </section>
      )}
      {v.phase === 'play' && (
        <section className="panel hand-area">
          <h2>{v.names[v.seat]}の手牌</h2>
          <div className="mahjong-tiles">
            {v.hand.map((c) => (
              <button
                key={c}
                className={`mahjong-tile ${c === tile ? 'selected' : ''} ${v.selected.includes(c) ? 'drawn-tile' : ''}`}
                disabled={!enabled}
                aria-label={`${mahjongText(c)}${v.selected.includes(c) ? ' ツモ牌' : ''}`}
                aria-pressed={c === tile}
                onClick={() => setTile(c)}
              >
                {mahjongText(c)}
              </button>
            ))}
          </div>
          <p className="small">緑の枠は今引いた牌。1枚選んでから捨てます。</p>
          <button
            className="primary"
            disabled={!enabled || tile < 0}
            onClick={() => act({ type: 'discard', index: tile })}
          >
            {tile < 0 ? '捨てる牌を選ぶ' : `${mahjongText(tile)}を捨てる`}
          </button>
          {handForHint.length === 13 && (
            <p className="small" role="status">
              {waits.length
                ? `${tile >= 0 ? 'これを捨てると' : ''}待ち：${waits.map((t) => mahjongText(t * 4)).join('・')}（自分の捨て牌に待ちがあるとロン不可）`
                : 'まだテンパイしていません。3枚の組と2枚の組を作ろう。'}
            </p>
          )}
        </section>
      )}
      <section className="panel">
        <h2>みんなの捨て牌</h2>
        {v.names.map((name, p) => (
          <div className="mahjong-river" key={p}>
            <strong>{name}</strong>
            <div className="mahjong-tiles">
              {v.board.flatMap((c, i) =>
                v.trickPlayers[i] === p
                  ? [
                      <span className="mahjong-tile small-tile" key={i}>
                        {mahjongText(c)}
                      </span>,
                    ]
                  : [],
              )}
            </div>
          </div>
        ))}
      </section>
      {v.phase === 'round-end' && (
        <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
          次の局へ
        </button>
      )}
    </>
  )
}
