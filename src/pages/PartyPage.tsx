import { useEffect, useState } from 'react'
import { partyCatalog, type PartyId } from '../party/catalog'
import { applyParty, createParty, partyView } from '../party/engine'
import type { PartyAction } from '../party/types'
import { recordPartyHistory } from '../party/storage'
import type { Settings } from '../storage/storage'
import { newId } from '../utils/id'
import { usePartyRoom } from '../hooks/usePartyRoom'
import { PartyBoard } from '../components/PartyBoard'
import { PartyConnection } from '../components/PartyConnection'
import { playMoveSound } from '../hooks/sound'
import type { GameSetup } from './SetupPage'
import { isEconomyId } from '../party/economyCatalog'
import { assetValue } from '../party/economy'
import { isCasualId } from '../party/casualCatalog'
export function PartyPage({
  game,
  mode,
  setup,
  settings,
  onHome,
}: {
  game: PartyId
  mode: 'local' | 'nearby'
  setup: GameSetup
  settings: Settings
  onHome(): void
}) {
  const [local, setLocal] = useState(() => createParty(game, setup.names, setup.rules)),
    [id, setId] = useState(newId),
    [unlocked, setUnlocked] = useState(-1),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<'home' | 'restart' | null>(null)
  const network = usePartyRoom(game, setup.names, setup.rules),
    room = network.host ?? network.guest
  const view = mode === 'local' ? partyView(local, local.turn) : room?.view
  const started = mode === 'local' || !!room?.started,
    connected =
      mode === 'local' ||
      !!(room?.online.every(Boolean) && (network.role === 'host' || network.guestLink?.open))
  const privateGame = ![
      'memory',
      'pig',
      'boxes',
      'mancala',
      'nim',
      'yacht',
      'hit-blow',
      'life-journey',
      'island-market',
    ].includes(game),
    covered =
      mode === 'local' &&
      privateGame &&
      view?.phase !== 'finished' &&
      !(game === 'word-wolf' && (view?.phase === 'challenge' || view?.phase === 'round-end')) &&
      unlocked !== view?.turn
  const historyId =
    mode === 'local'
      ? id
      : `${room?.room}:${network.host?.roundId ?? network.guest?.generation ?? 0}`
  useEffect(() => {
    if (view?.phase === 'finished') {
      const message = recordPartyHistory({
        id: historyId,
        game,
        at: new Date().toISOString(),
        names: view.names,
        winners: view.winners,
        moves: view.step,
        mode,
      })
      if (message) setError(message)
    }
  }, [view?.phase, historyId, game, view?.names, view?.winners, view?.step, mode])
  function act(a: PartyAction) {
    try {
      if (mode === 'local') {
        const next = applyParty(local, local.turn, a)
        setLocal(next)
        if (
          next.turn !== local.turn ||
          (game === 'word-wolf' && next.phase !== local.phase) ||
          next.round !== local.round
        )
          setUnlocked(-1)
      } else if (network.host) network.host.act(0, a)
      else network.guest?.act(a)
      setError('')
      if (settings.sound) playMoveSound()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作できませんでした。')
    }
  }
  function restart() {
    if (mode === 'local') {
      setLocal(createParty(game, setup.names, setup.rules))
      setId(newId())
      setUnlocked(-1)
    } else if (network.host) network.host.vote(0)
    else network.guest?.vote()
    setConfirm(null)
  }
  return (
    <main className="game-page party-page">
      <div className="game-topbar">
        <button className="text-button" onClick={() => setConfirm('home')}>
          ← ホーム
        </button>
        <span>{mode === 'local' ? `${setup.names.length}人・この端末` : '近くの端末と対戦'}</span>
      </div>
      <div className="game-title">
        <h1>{partyCatalog[game].name}</h1>
        <span>{view ? view.step : 0} 手</span>
      </div>
      {started && view && (
        <>
          <section className="turn-panel" aria-live="polite">
            <div>
              <strong>
                {view.phase === 'finished' ? 'ゲーム終了' : `${view.names[view.turn]}の番`}
              </strong>
              <p>
                {!connected
                  ? '切断した人を待っています。ホストから同じ席へ再接続してください。'
                  : view.info}
              </p>
            </div>
          </section>
          <ol className="party-scores">
            {view.names.map((name, i) => (
              <li key={i} className={i === view.turn ? 'current' : ''}>
                <strong>
                  {i + 1}. {name}
                  {mode === 'nearby' && i === view.seat ? '（あなた）' : ''}
                </strong>
                <small>
                  {isEconomyId(game)
                    ? `総資産 ${assetValue(view, i)}${game === 'life-journey' ? '万' : 'コイン'}`
                    : isCasualId(game)
                      ? game === 'mini-mahjong'
                        ? `アガリ ${view.scores[i]}回`
                        : game === 'hit-blow'
                          ? `席${i + 1}`
                          : `${view.scores[i]}点`
                      : ['pig', 'memory', 'boxes', 'go-fish', 'mancala', 'yacht'].includes(game)
                        ? `${view.scores[i]}点`
                        : game === 'hearts'
                          ? `失点 ${view.scores[i]}（今 ${view.roundScores[i]}）`
                          : game === 'nim'
                            ? '順番に石を取ろう'
                            : `手札 ${view.counts[i]}枚`}
                  {view.ranking.includes(i) ? '・上がり' : ''}
                  {view.losers.includes(i) ? '・脱落' : ''}
                  {game === 'sevens' ? `・パス ${view.passed[i]}回` : ''}
                </small>
              </li>
            ))}
          </ol>
          {covered ? (
            <section className="privacy-cover panel">
              <span aria-hidden="true">▣</span>
              <h2>{view.names[view.turn]}さんに渡してください</h2>
              <p>ほかの人に手札やお題・選択が見えない向きで操作してください。</p>
              <button className="primary" onClick={() => setUnlocked(view.turn)}>
                {isCasualId(game) ? '自分の画面を表示' : '自分の手札を表示'}
              </button>
            </section>
          ) : (
            <PartyBoard
              key={`${historyId}:${view.step}:${view.seat}`}
              view={view}
              enabled={connected && view.turn === view.seat}
              onAction={act}
            />
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="game-actions">
            <button
              className="secondary"
              disabled={!connected}
              onClick={() => setConfirm('restart')}
            >
              再戦・リセット
            </button>
            {mode === 'local' && privateGame && !covered && view.phase !== 'finished' && (
              <button className="text-button" onClick={() => setUnlocked(-1)}>
                手札を隠す
              </button>
            )}
          </div>
          {room && room.votes.length > 0 && (
            <p className="notice">
              再戦の賛成：{room.votes.map((i) => view.names[i]).join('・')}
              。全員の「再戦・リセット」承認で新しいゲームを始めます。
            </p>
          )}
        </>
      )}
      {confirm && (
        <section className="panel confirm">
          <strong>
            {confirm === 'home' ? 'ゲームを終了してホームに戻りますか？' : '新しく配り直しますか？'}
          </strong>
          <p>
            {confirm === 'home'
              ? '途中の手札やゲームは保存されません。ホストが終了すると全員の対戦が終わります。'
              : mode === 'nearby'
                ? '全員が承認すると配り直します。'
                : 'この端末で新しいゲームを始めます。'}
          </p>
          <div className="button-row">
            <button className="primary" onClick={() => (confirm === 'home' ? onHome() : restart())}>
              はい
            </button>
            <button className="secondary" onClick={() => setConfirm(null)}>
              キャンセル
            </button>
          </div>
        </section>
      )}
      {mode === 'nearby' && <PartyConnection network={network} debug={settings.debug} />}
      <details className="rules">
        <summary>遊び方・今回のルール</summary>
        <p>{partyCatalog[game].help}</p>
        <ul>
          {partyCatalog[game].options.map((o) => (
            <li key={o.key}>
              {o.label}：
              {String((view?.rules ?? setup.rules)[o.key]) === 'true'
                ? 'ON'
                : String((view?.rules ?? setup.rules)[o.key]) === 'false'
                  ? 'OFF'
                  : String((view?.rules ?? setup.rules)[o.key])}{' '}
              — {o.detail}
            </li>
          ))}
        </ul>
        <p>
          手札ゲームではホストが山札を管理します。参加者には自分の手札と公開情報だけが送られます。信頼できる友人をホストにしてください。
        </p>
      </details>
    </main>
  )
}
