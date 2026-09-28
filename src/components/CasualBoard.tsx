import { useState } from 'react'
import { type PartyAction, type PartyView } from '../party/types'
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
  const [guess, setGuess] = useState<number[]>([])
  const done = v.phase === 'finished'
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
    case 'word-wolf':
      content = <SocialBoard v={v} enabled={enabled} act={act} />
      break
  }
  return (
    <div className="casual-board">
      {result}
      {content}
    </div>
  )
}
