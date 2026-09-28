import type { EconomyProps } from './EconomyBoard'
import { stat, resourceNames, buildings, contracts } from '../party/economy'
import { canBuild, canDeliver, marketEvents } from '../party/market'
export function MarketBoard({ v, enabled, act }: EconomyProps) {
  const p = v.turn,
    done = v.phase === 'finished',
    icons = ['♧', '◆', '✿']
  return (
    <>
      <section className="journey-banner market-banner">
        <span>ISLAND TRADING COMPANY</span>
        <h2>
          {v.round} / {String(v.rules.rounds)} ラウンド
        </h2>
        <div className="economy-metrics">
          <div>
            <small>{v.names[p]}の現金</small>
            <b>{v.scores[p]}</b>
          </div>
          <div>
            <small>残りアクション</small>
            <b>{done ? 0 : v.bank} / 2</b>
          </div>
          <div>
            <small>納品した契約</small>
            <b>{stat(v, p, 7)}</b>
          </div>
        </div>
        <p>{marketEvents[v.board[6]]}</p>
      </section>
      <section className="panel">
        <h2>港の市場</h2>
        <p className="small">価格は全員の手番が終わるごとに更新。1回に1個を売買します。</p>
        <div className="market-resources">
          {resourceNames.map((name, i) => (
            <article key={i}>
              <span className="resource-icon" aria-hidden="true">
                {icons[i]}
              </span>
              <h3>{name}</h3>
              <b>
                {v.board[i]} <small>コイン</small>
              </b>
              <p>在庫 {stat(v, p, i)}個</p>
              <button
                disabled={!enabled || v.scores[p] < v.board[i]}
                aria-label={`${name}を買う`}
                onClick={() => act({ type: 'buy', index: i })}
              >
                買う
              </button>
              <button
                disabled={!enabled || !stat(v, p, i)}
                aria-label={`${name}を売る`}
                onClick={() => act({ type: 'sell', index: i })}
              >
                売る
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>施設を育てる</h2>
        <p className="small">全員の手番終了時に自動生産。同じ施設は5棟まで。</p>
        <div className="economy-choices">
          {buildings.map((b, i) => (
            <button
              key={i}
              disabled={!enabled || !canBuild(v, p, i)}
              onClick={() => act({ type: 'build', index: i })}
            >
              <strong>
                {b.name} <span>{stat(v, p, i + 3)}棟</span>
              </strong>
              <small>
                建設：{b.cash}コイン
                {b.costs.map((c, r) => (c ? `・${resourceNames[r]}${c}` : '')).join('')}
              </small>
              <small>
                毎ラウンド {b.produces} ／ 最終評価{b.value}
              </small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>島からの契約</h2>
        <p className="small">全員共通。誰かが納品すると、別の契約へ入れ替わります。</p>
        <div className="economy-choices">
          {v.board.slice(3, 6).map((id, i) => {
            const c = contracts[id]
            return c ? (
              <button
                key={i}
                disabled={!enabled || !canDeliver(v, p, i)}
                onClick={() => act({ type: 'deliver', index: i })}
              >
                <strong>
                  {c.name} <span>報酬 {c.pay}</span>
                </strong>
                <small>
                  {c.need
                    .map((qty, r) => (qty ? `${resourceNames[r]}${qty}個` : ''))
                    .filter(Boolean)
                    .join('・')}{' '}
                  を納品
                </small>
              </button>
            ) : (
              <p key={i}>この窓口の契約は終了しました。</p>
            )
          })}
        </div>
      </section>
      {!done && (
        <button className="secondary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
          残りの行動を終える
        </button>
      )}
    </>
  )
}
