import { useEffect, useState } from 'react'
import { engines, gameInfo, playerName } from '../games'
import { other, type GameId, type Move, type Winner } from '../games/core/types'
import { scores } from '../games/othello/engine'
import { Board } from '../components/Board'
import { Connection } from '../components/Connection'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { playMoveSound } from '../hooks/sound'
import { newId } from '../utils/id'
import { GameClock, noClock, type TimeControl } from '../games/core/clock'
import { ClockPanel } from '../components/ClockPanel'
import {
  getStorageError,
  loadGame,
  recordHistory,
  saveGame,
  type Settings,
} from '../storage/storage'

export function GamePage({
  game,
  mode,
  settings,
  time = noClock,
  onHome,
}: {
  game: GameId
  mode: 'local' | 'nearby'
  settings: Settings
  time?: TimeControl
  onHome(): void
}) {
  const engine = engines[game]
  const [saved] = useState(() => (mode === 'local' && !time.minutes ? loadGame(game) : null))
  const [localClock] = useState(() => new GameClock(time))
  const [, clockRender] = useState(0)
  const [local, setLocal] = useState(saved?.state || engine.createInitialState()),
    [localWinner, setLocalWinner] = useState<Winner>(saved?.winner ?? null)
  const [id, setId] = useState(saved?.id || newId()),
    [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'restart' | 'resign' | 'home' | null>(null)
  const network = useMultiplayer(game, mode === 'nearby', undefined, time)
  const match = mode === 'nearby' ? network.match : null
  const state = match?.state || local,
    winner = match
      ? match.winner
      : localClock.expired !== null
        ? other(localClock.expired)
        : (localWinner ?? state.winner)
  const clock = match?.clock ?? localClock
  const connected = !!match?.ready && network.link.open
  const canPlay =
    mode === 'local'
      ? winner === null && (!localClock.enabled || localClock.running)
      : !!match?.canMove
  const historyId = match ? `${match.matchId}:${match.round}` : id
  useEffect(() => {
    if (mode !== 'local' || !localClock.enabled) return
    const timer = setInterval(() => {
      localClock.check()
      clockRender((n) => n + 1)
    }, 250)
    return () => clearInterval(timer)
  }, [mode, localClock])
  useEffect(() => {
    if (mode === 'local' && !time.minutes) saveGame(state, winner, historyId)
    if (winner !== null)
      recordHistory({
        id: historyId,
        game,
        at: new Date().toISOString(),
        winner,
        moves: state.ply,
        mode,
      })
  }, [state, winner, historyId, game, mode, time.minutes])
  function move(m: Move) {
    try {
      if (mode === 'nearby') match?.move(m)
      else {
        if (localClock.check() !== null) throw new Error('持ち時間がなくなりました。')
        const next = engine.applyMove(local, m)
        if (!localClock.move(next.turn)) throw new Error('持ち時間がなくなりました。')
        if (next.winner !== null) localClock.pause()
        setLocal(next)
        setLocalWinner(next.winner)
      }
      if (settings.sound) playMoveSound()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '手を指せませんでした。')
    }
  }
  function action() {
    try {
      if (confirm === 'home') onHome()
      else if (confirm === 'restart') {
        if (mode === 'nearby') match?.requestRestart()
        else {
          setLocal(engine.createInitialState())
          setLocalWinner(null)
          setId(newId())
          localClock.reset()
        }
      } else if (confirm === 'resign') {
        if (mode === 'nearby') match?.resign()
        else {
          setLocalWinner(other(state.turn))
          localClock.pause()
        }
      }
    } catch (e) {
      setError(String(e))
    }
    setConfirm(null)
  }
  const score = game === 'othello' ? scores(state) : null
  return (
    <main className="game-page">
      <div className="game-topbar">
        <button
          className="text-button"
          onClick={() => (mode === 'nearby' || time.minutes ? setConfirm('home') : onHome())}
        >
          ← ホーム
        </button>
        <span>{mode === 'local' ? 'この端末で2人' : '近くの端末と対戦'}</span>
      </div>
      <div className="game-title">
        <div>
          <p className="eyebrow">{gameInfo[game].en}</p>
          <h1>{engine.name}</h1>
        </div>
        <span className="move-counter">{state.ply} 手</span>
      </div>
      <ClockPanel clock={clock} game={game} />
      {mode === 'local' && localClock.enabled && !localClock.running && winner === null && (
        <div className="panel">
          <p>
            時計付き対局はこの画面を開いて遊んでください。画面を閉じる・更新すると途中の対局は失われます。画面ロック中も経過時間を数えます。
          </p>
          <button
            className="primary"
            onClick={() => {
              localClock.start(state.turn)
              clockRender((n) => n + 1)
            }}
          >
            時計を開始して対局
          </button>
        </div>
      )}
      <section className={`turn-panel ${winner !== null ? 'finished' : ''}`} aria-live="polite">
        <span
          className={`turn-disc owner-${winner === 0 || winner === 1 ? winner : state.turn} ${game}`}
          aria-hidden="true"
        />
        <div>
          <strong>
            {winner === 'draw'
              ? '引き分け'
              : winner !== null
                ? `${playerName(game, winner)}の勝ち`
                : `${playerName(game, state.turn)}の手番`}
          </strong>
          <p>
            {winner !== null
              ? state.reason || '対局ありがとうございました'
              : mode === 'nearby'
                ? !connected
                  ? '相手との接続を待っています'
                  : canPlay
                    ? 'あなたの番です'
                    : '相手が考えています'
                : '端末を交互に操作して遊びましょう'}
          </p>
        </div>
        {score && (
          <div className="score">
            <span>● {score[0]}</span>
            <span>○ {score[1]}</span>
          </div>
        )}
      </section>
      {state.check && winner === null && (
        <p className="check-notice" role="status">
          {game === 'chess' ? 'チェック' : '王手'} — 王を守る手を指してください
        </p>
      )}
      {state.passed !== undefined && winner === null && (
        <p className="notice">
          {playerName(game, state.passed)}は置ける場所がないためパスしました。
        </p>
      )}
      <Board
        key={historyId}
        state={state}
        onMove={move}
        interactive={canPlay}
        player={mode === 'nearby' ? match?.player : undefined}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {match?.notice && (
        <p className="notice" role="status">
          {match.notice}
        </p>
      )}
      {match?.pendingRestart && (
        <div className="panel">
          <p>相手が新しい対局を希望しています。</p>
          <button className="primary" onClick={() => match.acceptRestart()}>
            再戦を承認
          </button>
        </div>
      )}
      <div className="game-actions">
        <button
          className="secondary"
          disabled={mode === 'nearby' && !connected}
          onClick={() => setConfirm('restart')}
        >
          ↻ {winner === null ? 'リセット' : '再戦する'}
        </button>
        <button
          className="text-button"
          disabled={winner !== null || (mode === 'nearby' && !connected)}
          onClick={() => setConfirm('resign')}
        >
          投了する
        </button>
      </div>
      {confirm && (
        <div className="confirm panel" role="group" aria-label="操作の確認">
          <strong>
            {confirm === 'restart'
              ? mode === 'nearby'
                ? '相手に再戦を申し込みますか？'
                : '新しい対局を始めますか？'
              : confirm === 'resign'
                ? `${playerName(game, mode === 'nearby' ? (match?.player ?? 0) : state.turn)}が投了しますか？`
                : '接続を終了してホームに戻りますか？'}
          </strong>
          <p>
            {confirm === 'home'
              ? '時計付き・通信対局の途中の盤面は、ホームに戻ると破棄されます。切断から復旧するときはこの画面で再接続してください。'
              : confirm === 'restart'
                ? '現在の盤面はリセットされます。'
                : 'この対局を終了します。'}
          </p>
          <div className="button-row">
            <button className="primary" onClick={action}>
              はい
            </button>
            <button className="secondary" onClick={() => setConfirm(null)}>
              キャンセル
            </button>
          </div>
        </div>
      )}
      {mode === 'nearby' && <Connection network={network} debug={settings.debug} />}
      <details className="rules">
        <summary>遊び方・ルール</summary>
        <p>
          {game === 'othello'
            ? '相手の石を縦・横・斜めに挟んで反転します。合法手がないと自動でパス。両者とも置けなくなった時点で石の多い側が勝ちです。'
            : game === 'chess'
              ? '自分の駒を選び、光っている移動先をタップ。昇格時は駒を選びます。キャスリング・アンパッサンに対応。ステイルメイト、戦力不足、同一局面3回、50手ルールは自動で引き分けになります。'
              : game === 'shogi'
                ? '駒を選んで移動。持ち駒を選ぶと打てます。成れるときは成り・不成を選びます。二歩、打ち歩詰め、王手放置、行き所のない駒は指せません。千日手は引き分け、連続王手の千日手は王手側の負けです。入玉宣言・持将棋の点数裁定は未対応です。'
                : game === 'gomoku'
                  ? '交互に石を置き、縦・横・斜めに5個以上つなげると勝ち。禁手はありません。場所を選んだあと「置く」で確定します。拡大表示やキーボードの矢印も使えます。'
                  : '好きな列をタップすると、一番下の空いているマスに駒が落ちます。縦・横・斜めに4つつなげると勝ち。'}
        </p>
        <p>盤面は矢印キーで移動、Enter / Spaceで選択できます。</p>
      </details>
      {getStorageError() && <p className="error">{getStorageError()}</p>}
    </main>
  )
}
