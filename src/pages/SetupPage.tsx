import { useState } from 'react'
import { engines, gameInfo } from '../games'
import { isPartyId, partyCatalog, type PartyRules, type PlayableId } from '../party/catalog'
import { timeLabel, type TimeControl } from '../games/core/clock'
import { loadSetup, saveSetup, type GameSetup } from '../storage/setup'
export type { GameSetup } from '../storage/setup'
export function SetupPage({
  game,
  onHome,
  onStart,
}: {
  game: PlayableId
  onHome(): void
  onStart(mode: 'local' | 'nearby', setup: GameSetup): void
}) {
  const party = isPartyId(game) ? partyCatalog[game] : null
  const [saved] = useState(() => loadSetup(game))
  const [time, setTime] = useState<TimeControl>(saved.time),
    [players, setPlayers] = useState(saved.names.length),
    [names, setNames] = useState(
      Array.from({ length: 7 }, (_, i) => saved.names[i] ?? `プレイヤー${i + 1}`),
    ),
    [rules, setRules] = useState<PartyRules>(saved.rules)
  const start = (mode: 'local' | 'nearby') => {
    const setup = { time, names: names.slice(0, players), rules }
    saveSetup(game, setup)
    onStart(mode, setup)
  }
  return (
    <main className="mode-page">
      <button className="text-button" onClick={onHome}>
        ← ゲーム一覧
      </button>
      <div className={`mode-art art-${game}`} aria-hidden="true">
        {party ? party.mark : gameInfo[game as keyof typeof gameInfo].mark}
      </div>
      <p className="eyebrow">YOUR TABLE, YOUR RULES</p>
      <h1>{party ? party.name : engines[game as keyof typeof engines].name}</h1>
      <section className="panel settings-form setup-form">
        <h2>遊ぶ前にルールを選ぼう</h2>
        {party ? (
          <>
            <label>
              プレイヤー人数
              <select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
                {Array.from({ length: party.max - party.min + 1 }, (_, i) => i + party.min).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}人
                    </option>
                  ),
                )}
              </select>
            </label>
            <details>
              <summary>名前をつける</summary>
              {names.slice(0, players).map((name, i) => (
                <label key={i}>
                  席{i + 1}
                  <input
                    value={name}
                    maxLength={20}
                    onChange={(e) =>
                      setNames((old) => old.map((v, p) => (p === i ? e.target.value : v)))
                    }
                  />
                </label>
              ))}
            </details>
            {party.options.map((o) =>
              o.values ? (
                <label key={o.key}>
                  {o.label}
                  <select
                    value={Number(rules[o.key])}
                    onChange={(e) => setRules({ ...rules, [o.key]: Number(e.target.value) })}
                  >
                    {o.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <small>{o.detail}</small>
                </label>
              ) : (
                <label className="switch-row" key={o.key}>
                  <span>
                    {o.label}
                    <small>{o.detail}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!rules[o.key]}
                    onChange={(e) => setRules({ ...rules, [o.key]: e.target.checked })}
                  />
                </label>
              ),
            )}
            <details>
              <summary>このゲームの遊び方</summary>
              <p>{party.help}</p>
            </details>
          </>
        ) : (
          <>
            <label>
              1人の持ち時間
              <select
                value={time.minutes}
                onChange={(e) =>
                  setTime({ minutes: Number(e.target.value), increment: 0, byoyomi: 0 })
                }
              >
                {[0, 1, 3, 5, 10, 15, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}分` : 'なし（ゆっくり遊ぶ）'}
                  </option>
                ))}
              </select>
            </label>
            {time.minutes > 0 && (
              <>
                <label>
                  1手ごとの加算
                  <select
                    value={time.increment}
                    onChange={(e) =>
                      setTime({ ...time, increment: Number(e.target.value), byoyomi: 0 })
                    }
                  >
                    {[0, 2, 3, 5, 10, 30].map((n) => (
                      <option key={n} value={n}>
                        {n ? `${n}秒` : 'なし'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  使い切った後の秒読み
                  <select
                    value={time.byoyomi}
                    onChange={(e) =>
                      setTime({ ...time, byoyomi: Number(e.target.value), increment: 0 })
                    }
                  >
                    {[0, 10, 20, 30, 60].map((n) => (
                      <option key={n} value={n}>
                        {n ? `1手${n}秒` : 'なし（切れ負け）'}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small muted">
                  {timeLabel(time)}
                  。指し手の確定で自動交代。通信対局は全員が接続した時点で開始し、切断を検出すると一時停止します。友人同士で遊ぶための時計で、大会用の裁定ではありません。
                </p>
              </>
            )}
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => setTime({ minutes: 10, increment: 0, byoyomi: 0 })}
              >
                10分切れ負け
              </button>
              <button
                className="secondary"
                onClick={() => setTime({ minutes: 5, increment: 3, byoyomi: 0 })}
              >
                5分＋3秒
              </button>
              {game === 'shogi' && (
                <button
                  className="secondary"
                  onClick={() => setTime({ minutes: 10, increment: 0, byoyomi: 30 })}
                >
                  10分＋秒読み30秒
                </button>
              )}
            </div>
          </>
        )}
      </section>
      <div className="mode-options">
        <button onClick={() => start('local')}>
          <span className="mode-icon" aria-hidden="true">
            ▣
          </span>
          <div>
            <strong>この端末で{party ? players : 2}人</strong>
            <p>
              {party
                ? '1台を交互に操作。手札は受け渡し画面で隠します。'
                : '1台を囲んで、交互に一手。'}
            </p>
          </div>
          <span>→</span>
        </button>
        <button onClick={() => start('nearby')}>
          <span className="mode-icon" aria-hidden="true">
            ⌁
          </span>
          <div>
            <strong>近くの端末と対戦</strong>
            <p>同じWi-FiにつないでQRを交換。人数・ルールはホストが決めます。</p>
          </div>
          <span>→</span>
        </button>
      </div>
    </main>
  )
}
