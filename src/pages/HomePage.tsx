import { useState } from 'react'
import { gameIds } from '../games/core/types'
import { partyIds, partyCatalog, type PlayableId } from '../party/catalog'
import { engines, gameInfo } from '../games'
import { InstallGuide } from '../components/InstallGuide'
import type { useOffline } from '../pwa/useOffline'
import type { Settings } from '../storage/storage'

export function HomePage({
  onSelect,
  offline,
  settings,
  onDismiss,
}: {
  onSelect(game: PlayableId): void
  offline: ReturnType<typeof useOffline>
  settings: Settings
  onDismiss(): void
}) {
  const [persistent, setPersistent] = useState('')
  const [players, setPlayers] = useState(0),
    [query, setQuery] = useState('')
  const boardGames = gameIds.filter(
    (id) =>
      (!players || players === 2) &&
      engines[id].name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const partyGames = partyIds.filter(
    (id) =>
      (!players || (players >= partyCatalog[id].min && players <= partyCatalog[id].max)) &&
      partyCatalog[id].name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  async function persist() {
    try {
      const ok = await navigator.storage?.persist?.()
      setPersistent(
        ok
          ? '保存領域が保護されました。乗船前には再確認してください。'
          : '保存領域の保護はブラウザが判断します。乗船前にオフライン起動を確認してください。',
      )
    } catch {
      setPersistent('保存領域を保護できませんでした。乗船前にオフライン起動を確認してください。')
    }
  }
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-line" /> A TABLE FOR EVERYONE
          </p>
          <h1>
            圏外でも、
            <br />
            みんなで遊ぼう<span className="accent">。</span>
          </h1>
          <p>
            電波を離れて、向かい合う。
            <br />
            いつものゲームを、旅の時間に。
          </p>
          <span className="hero-tag">
            NO INTERNET NEEDED <span>·</span> 2–7 PLAYERS
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-board">
            {Array.from({ length: 36 }, (_, i) => (
              <span key={i}>
                {[7, 14, 20, 21, 27].includes(i) ? (
                  <i className="art-black" />
                ) : [8, 13, 15, 19, 26].includes(i) ? (
                  <i className="art-white" />
                ) : null}
              </span>
            ))}
          </div>
          <span className="art-caption">LESS SCROLL. MORE PLAY.</span>
          <span className="art-star">✳</span>
        </div>
      </section>
      <div className="home-layout">
        <div className="games-column">
          <section aria-labelledby="games-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE COLLECTION</p>
                <h2 id="games-title">今日は、何して遊ぶ？</h2>
              </div>
              <span className="muted small">
                {boardGames.length + partyGames.length} / {5 + partyIds.length} GAMES
              </span>
            </div>
            <div className="game-filters">
              <label>
                ゲームを探す
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="大富豪、ダイス…"
                />
              </label>
              <label>
                遊ぶ人数
                <select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
                  <option value={0}>すべて</option>
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}人
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {boardGames.length + partyGames.length === 0 && (
              <p className="panel">
                その条件に合うゲームはありません。人数や名前を変えてみてください。
              </p>
            )}
            <div className="game-cards">
              {boardGames.map((id, i) => (
                <button
                  className={`game-card card-${id}`}
                  key={id}
                  onClick={() => onSelect(id)}
                  aria-label={`${engines[id].name}を選ぶ`}
                >
                  <div className={`game-art art-${id}`} aria-hidden="true">
                    {id === 'othello' ? (
                      <>
                        <i />
                        <i />
                      </>
                    ) : id === 'gomoku' ? (
                      <div className="mini-gomoku">
                        {Array.from({ length: 5 }, (_, n) => (
                          <i key={n} />
                        ))}
                      </div>
                    ) : id === 'connect-four' ? (
                      <div className="mini-connect">
                        {Array.from({ length: 12 }, (_, n) => (
                          <i key={n} />
                        ))}
                      </div>
                    ) : (
                      <span>{gameInfo[id].mark}</span>
                    )}
                  </div>
                  <div className="game-card-body">
                    <div className="game-card-meta">
                      <span>
                        0{i + 1} / {gameInfo[id].en}
                      </span>
                      <span>{gameInfo[id].time}</span>
                    </div>
                    <h3>{engines[id].name}</h3>
                    <p>{gameInfo[id].description}</p>
                    <div className="card-bottom">
                      <span>2人で遊ぶ</span>
                      <span className="round-arrow">↗</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="party-collection" aria-labelledby="party-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BRING EVERYONE</p>
                <h2 id="party-title">みんなで囲む、もう一局。</h2>
              </div>
            </div>
            <div className="game-cards">
              {partyGames.map((id) => (
                <button
                  key={id}
                  className="game-card party-card"
                  aria-label={`${partyCatalog[id].name}を選ぶ`}
                  onClick={() => onSelect(id)}
                >
                  <div className="game-art party-art" aria-hidden="true">
                    {partyCatalog[id].mark}
                  </div>
                  <div className="game-card-body">
                    <div className="game-card-meta">
                      <span>
                        {partyCatalog[id].min}–{partyCatalog[id].max} PLAYERS
                      </span>
                      <span>ルールを選べる</span>
                    </div>
                    <h3>{partyCatalog[id].name}</h3>
                    <p>{partyCatalog[id].description}</p>
                    <div className="card-bottom">
                      <span>みんなで遊ぶ</span>
                      <span className="round-arrow">↗</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="travel-note">
            <span aria-hidden="true">≈</span>
            <div>
              <h3>船の上でも、山の上でも。</h3>
              <p>
                旅の前にインストールして、準備完了を確認。
                <br />
                あとは、友だちと少しの時間があれば。
              </p>
            </div>
          </section>
        </div>
        <aside className="home-aside">
          <section className={`offline-card ${offline.ready ? 'is-ready' : ''}`}>
            <div className="section-heading">
              <h2>オフライン準備</h2>
              <span aria-hidden="true">{offline.ready ? '✓' : '◌'}</span>
            </div>
            <p className="muted">出発前に、ここをチェック。</p>
            <ul>
              {[
                'アプリ本体',
                'オセロ',
                'チェス',
                '将棋',
                '五目並べ',
                'Connect Four',
                `トランプ・ダイス・追加ゲーム${partyIds.length}種類`,
                '通信機能',
              ].map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <span className="cache-check">{offline.ready ? '✓ 保存済み' : '○ 確認中'}</span>
                </li>
              ))}
            </ul>
            <div className="offline-result" role="status">
              <span className="status-light" />
              <strong>{offline.ready ? 'オフライン利用可能' : '準備未完了'}</strong>
            </div>
            <p className="small muted">{offline.detail}</p>
            <div className="button-row">
              <button className="text-button" onClick={() => void offline.verify()}>
                ↻ 再確認
              </button>
              <button className="text-button" onClick={() => void persist()}>
                保存領域を保護
              </button>
            </div>
            {persistent && (
              <p className="small" role="status">
                {persistent}
              </p>
            )}
          </section>
          {offline.update && (
            <section className="panel">
              <strong>新しいバージョンがあります</strong>
              <p>対局を終えてから更新してください。</p>
              <button className="primary" onClick={() => void offline.update?.()}>
                更新して再起動
              </button>
            </section>
          )}
          <InstallGuide dismissed={settings.installDismissed} onDismiss={onDismiss} />
          <section className="connection-note">
            <span aria-hidden="true">⌁</span>
            <div>
              <h3>それぞれの端末で、囲むテーブル。</h3>
              <p>
                同じWi-FiにつないでQRを交換。
                <br />
                それぞれの盤面で対戦できます。
              </p>
              <p className="small muted">
                ネット環境によって接続できない場合は、1台を囲んで遊べます。
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
