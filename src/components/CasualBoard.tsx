import { useState } from 'react'
import { cardText, type PartyAction, type PartyView } from '../party/types'
import { MahjongBoard } from './MahjongBoard'
import { SocialBoard } from './SocialBoard'

export function CasualBoard({
  view: v,
  enabled,
  onAction: act,
}: {
  view: PartyView
  enabled: boolean
  onAction(a: PartyAction): void
}) {
  const [guess, setGuess] = useState<number[]>([]),
    [number, setNumber] = useState('')
  const done = v.phase === 'finished'
  const next = (label = '確認して次へ') => (
    <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
      {label}
    </button>
  )
  const result = done && (
    <section className="panel" role="status">
      <h2>
        {v.game === 'hit-blow'
          ? v.winners.length
            ? 'みんなでクリア！'
            : '今回はクリアできず'
          : v.winners.length
            ? `${v.winners.map((p) => v.names[p]).join('・')} の勝ち`
            : '引き分け'}
      </h2>
      <p>{v.info}</p>
    </section>
  )
  let content
  switch (v.game) {
    case 'mini-mahjong':
      content = <MahjongBoard v={v} enabled={enabled && !done} act={act} />
      break
    case 'hit-blow': {
      const digits = Number(v.rules.digits),
        width = digits + 3,
        attempts = v.board.length / width
      content = (
        <section className="panel casual-panel">
          <p>みんなで協力 ／ 残り {Number(v.rules.attempts) - attempts}回</p>
          {!done && (
            <>
              <p>1〜6を重複なしで{digits}個、順に選んでください。</p>
              <div className="code-slots" aria-label="今回の予想">
                {Array.from({ length: digits }, (_, i) => (
                  <span key={i}>{guess[i] ?? '？'}</span>
                ))}
              </div>
              <div className="casual-buttons">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    disabled={!enabled || guess.includes(n) || guess.length === digits}
                    onClick={() => setGuess([...guess, n])}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button
                  disabled={!enabled || !guess.length}
                  onClick={() => setGuess(guess.slice(0, -1))}
                >
                  1つ戻す
                </button>
                <button
                  className="primary"
                  disabled={!enabled || guess.length !== digits}
                  onClick={() => act({ type: 'guess', cards: guess })}
                >
                  この並びで予想する
                </button>
              </div>
            </>
          )}
          {done && <p className="big-number">答え：{v.table.join(' ')}</p>}
          <p className="small">H＝数字も位置も正解 ／ B＝数字は正解、位置が違う</p>
          <ol className="guess-history">
            {Array.from({ length: attempts }, (_, i) => {
              const row = v.board.slice(i * width, (i + 1) * width)
              return (
                <li key={i}>
                  <span>
                    {v.names[row[0]]}：<strong>{row.slice(1, 1 + digits).join(' ')}</strong>
                  </span>
                  <span>
                    {row[digits + 1]}H・{row[digits + 2]}B
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )
      break
    }
    case 'high-low':
      content = (
        <section className="panel casual-panel">
          <p>
            {Math.min(v.round + 1, Number(v.rules.rounds))} / {String(v.rules.rounds)} ラウンド
          </p>
          <div className="card-row">
            {v.table.map((c, i) => (
              <span key={i} className="playing-card">
                {cardText(c)}
              </span>
            ))}
          </div>
          <p>A＝1 ／ J＝11 ／ Q＝12 ／ K＝13</p>
          {!done &&
            (v.phase === 'reveal' ? (
              next()
            ) : (
              <div className="casual-buttons">
                <button disabled={!enabled} onClick={() => act({ type: 'guess', index: 1 })}>
                  ↑ 大きい
                </button>
                <button disabled={!enabled} onClick={() => act({ type: 'guess', index: 0 })}>
                  ↓ 小さい
                </button>
              </div>
            ))}
        </section>
      )
      break
    case 'number-mine': {
      const low = v.board[0] + 1,
        high = v.board[1] - 1,
        parsed = Number(number)
      content = (
        <section className="panel casual-panel">
          {done ? (
            <p className="big-number">地雷は {v.table[0]}</p>
          ) : (
            <>
              <p>この間に地雷が1つ</p>
              <div className="big-number">
                {low} 〜 {high}
              </div>
              <label htmlFor="mine-number">選ぶ数字</label>
              <input
                id="mine-number"
                type="number"
                inputMode="numeric"
                min={low}
                max={high}
                value={number}
                disabled={!enabled}
                onChange={(e) => setNumber(e.target.value)}
              />
              <button
                className="primary"
                disabled={
                  !enabled || !number || !Number.isInteger(parsed) || parsed < low || parsed > high
                }
                onClick={() => act({ type: 'guess', index: parsed })}
              >
                この数字にする
              </button>
            </>
          )}
        </section>
      )
      break
    }
    case 'rps':
    case 'word-wolf':
    case 'charades':
      content = <SocialBoard v={v} enabled={enabled} act={act} />
      break
    case 'count-21':
      content = (
        <section className="panel casual-panel">
          <p>{String(v.rules.goal)}を言うと負け！</p>
          <div className="big-number">今は {v.bank}</div>
          {!done && (
            <div className="casual-buttons">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  disabled={!enabled || v.bank + n > Number(v.rules.goal)}
                  onClick={() => act({ type: 'take', index: n })}
                >
                  {Array.from({ length: n }, (_, i) => v.bank + i + 1).join('・')}
                </button>
              ))}
            </div>
          )}
        </section>
      )
      break
    case 'tic-tac-toe':
      content = (
        <section className="panel">
          <p>席1が○ ／ 席2が×</p>
          <div className="tic-grid">
            {v.board.map((p, i) => (
              <button
                key={i}
                disabled={!enabled || done || p !== -1}
                aria-label={`${Math.floor(i / 3) + 1}行${(i % 3) + 1}列 ${p === -1 ? '空き' : p === 0 ? '○' : '×'}`}
                onClick={() => act({ type: 'place', index: i })}
              >
                {p === -1 ? '' : p === 0 ? '○' : '×'}
              </button>
            ))}
          </div>
        </section>
      )
      break
  }
  return (
    <div className="casual-board">
      {result}
      {content}
    </div>
  )
}
