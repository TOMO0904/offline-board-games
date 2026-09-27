import { useState } from 'react'
import type { PartyAction, PartyView } from '../party/types'
import { rpsNames } from '../party/casual'
import { gestureWords, wolfWord } from '../party/words'

export function SocialBoard({
  v,
  enabled,
  act,
}: {
  v: PartyView
  enabled: boolean
  act(a: PartyAction): void
}) {
  const [choice, setChoice] = useState(-1),
    [showPrompt, setShowPrompt] = useState(false)
  const done = v.phase === 'finished'
  const next = (label = '確認して次へ') => (
    <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
      {label}
    </button>
  )
  let content
  switch (v.game) {
    case 'rps':
      content = (
        <section className="panel casual-panel">
          <p>
            {Math.min(v.round + 1, Number(v.rules.rounds))} / {String(v.rules.rounds)} ラウンド
          </p>
          {v.phase === 'play' ? (
            <>
              <p>全員が決めるまで、ほかの人には見えません。</p>
              {enabled ? (
                <>
                  <div className="casual-buttons">
                    {rpsNames.map((name, i) => (
                      <button
                        key={i}
                        className={choice === i ? 'selected' : ''}
                        aria-pressed={choice === i}
                        onClick={() => setChoice(i)}
                      >
                        {['✊', '✌', '✋'][i]} {name}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={choice < 0}
                    onClick={() => act({ type: 'choose', index: choice })}
                  >
                    この手に決める
                  </button>
                </>
              ) : (
                <p>
                  {v.hand.length
                    ? `あなたは${rpsNames[v.hand[0]]}。全員の決定を待っています。`
                    : '自分の番を待っています。'}
                </p>
              )}
            </>
          ) : (
            <>
              <ul className="result-list">
                {v.table.map((c, p) => (
                  <li key={p}>
                    {v.names[p]}：{rpsNames[c]}（+{v.roundScores[p]}点）
                  </li>
                ))}
              </ul>
              {!done && next()}
            </>
          )}
        </section>
      )
      break
    case 'word-wolf':
      content = (
        <section className="panel casual-panel">
          {v.phase === 'play' ? (
            <>
              <p>自分のお題を覚えたら隠して、次の人へ。</p>
              {enabled ? (
                <>
                  <div className="secret-prompt">{wolfWord(v.hand[0])}</div>
                  {next('お題を覚えた')}
                </>
              ) : (
                <p>自分の番を待っています。</p>
              )}
            </>
          ) : v.phase === 'challenge' ? (
            <>
              <h2>みんなで話そう</h2>
              <p>お題の特徴を話しながら、1人だけ違うお題の人を探します。</p>
              {next('相談を終えて投票へ')}
            </>
          ) : v.phase === 'reveal' ? (
            <>
              <h2>秘密投票</h2>
              <p>自分以外の1人を選ぼう。結果は全員が投票してから。</p>
              <div className="casual-buttons">
                {v.names.map((name, p) => (
                  <button
                    key={p}
                    className={choice === p ? 'selected' : ''}
                    disabled={!enabled || p === v.seat}
                    aria-pressed={choice === p}
                    onClick={() => setChoice(p)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <button
                className="primary"
                disabled={!enabled || choice < 0 || choice === v.seat}
                onClick={() => act({ type: 'vote', target: choice })}
              >
                この人に投票する
              </button>
            </>
          ) : (
            <>
              <h2>答え合わせ</h2>
              <p>少数派：{v.names[v.table[0]]}</p>
              <p>
                多数派「{wolfWord(v.table[1])}」／少数派「{wolfWord(v.table[2])}」
              </p>
              <ul className="result-list">
                {v.board.map((target, p) => (
                  <li key={p}>
                    {v.names[p]} → {v.names[target]}
                  </li>
                ))}
              </ul>
              {!done &&
                next(v.round + 1 >= Number(v.rules.rounds) ? '最終結果を見る' : '次のお題へ')}
            </>
          )}
        </section>
      )
      break
    case 'charades':
      content = !done && (
        <section className="panel casual-panel">
          {enabled && v.hand.length ? (
            <>
              <h2>あなたが演じるお題</h2>
              <div className="secret-prompt">
                {showPrompt ? gestureWords[v.hand[0]] : 'お題は隠れています'}
              </div>
              <button className="secondary" onClick={() => setShowPrompt(!showPrompt)}>
                {showPrompt ? 'お題を隠す' : 'お題を見る'}
              </button>
              <p>声を出さずに動きで伝えよう。正解したかはみんなで確認。</p>
              <div className="button-row">
                <button className="primary" onClick={() => act({ type: 'score' })}>
                  当ててもらえた
                </button>
                <button onClick={() => act({ type: 'pass' })}>パスして交代</button>
              </div>
            </>
          ) : (
            <>
              <h2>{v.names[v.turn]}のジェスチャーを見よう</h2>
              <p>分かったら声で答えてください。答えは演じる人だけに表示します。</p>
            </>
          )}
        </section>
      )
      break
  }
  return content
}
