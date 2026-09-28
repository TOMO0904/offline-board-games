import type { PartyAction, PartyView } from '../party/types'
import { assetValue, stat, L, homes, jobs, buildings, resourceNames } from '../party/economy'
import { LifeBoard } from './LifeBoard'
import { MarketBoard } from './MarketBoard'
export interface EconomyProps {
  v: PartyView
  enabled: boolean
  act(a: PartyAction): void
}
export function EconomyBoard({ v, enabled, act }: EconomyProps) {
  const life = v.game === 'life-journey',
    done = v.phase === 'finished'
  return (
    <div className="economy-board">
      {done && (
        <section className="panel economy-finish" role="status">
          <span>FINAL RESULTS</span>
          <h2>{v.winners.map((p) => v.names[p]).join('・')} の勝ち</h2>
          <p>現金だけでは決まりません。積み上げた資産をすべて集計。</p>
          <ol>
            {v.names
              .map((_, p) => p)
              .sort((a, b) => assetValue(v, b) - assetValue(v, a))
              .map((p) => (
                <li key={p}>
                  <strong>{v.names[p]}</strong>
                  <b>
                    {assetValue(v, p)}
                    {life ? '万' : 'コイン'}
                  </b>
                </li>
              ))}
          </ol>
        </section>
      )}
      {life ? (
        <LifeBoard v={v} enabled={enabled && !done} act={act} />
      ) : (
        <MarketBoard v={v} enabled={enabled && !done} act={act} />
      )}
      <details className="panel economy-ledger" open={done}>
        <summary>全員の資産・内訳</summary>
        {v.names.map((name, p) => (
          <section key={p}>
            <h3>
              {name}{' '}
              <small>
                総資産 {assetValue(v, p)}
                {life ? '万' : 'コイン'}
              </small>
            </h3>
            {life ? (
              <p>
                現金 {v.scores[p]}万 ＋ {homes[stat(v, p, L.home)].name}{' '}
                {homes[stat(v, p, L.home)].value}万 ＋ 経験 {stat(v, p, L.joy)}×3万 − 借金{' '}
                {stat(v, p, L.debt)}万<br />
                {jobs[stat(v, p, L.job)]?.name ?? '進路選択前'}・昇進{stat(v, p, L.level)}回・保険
                {stat(v, p, L.insured) ? 'あり' : 'なし'}
              </p>
            ) : (
              <>
                <p>
                  現金 {v.scores[p]} ／{' '}
                  {resourceNames.map((r, i) => `${r} ${stat(v, p, i)}個`).join('・')}
                </p>
                <p>{buildings.map((b, i) => `${b.name} ${stat(v, p, i + 3)}棟`).join('・')}</p>
              </>
            )}
          </section>
        ))}
      </details>
    </div>
  )
}
