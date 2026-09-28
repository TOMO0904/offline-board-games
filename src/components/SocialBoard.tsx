import { useState } from 'react'
import type { PartyAction, PartyView } from '../party/types'
import { wolfWord } from '../party/words'

export function SocialBoard({
  v,
  enabled,
  act,
}: {
  v: PartyView
  enabled: boolean
  act(a: PartyAction): void
}) {
  const [choice, setChoice] = useState(-1)
  const done = v.phase === 'finished'
  const next = (label = '確認して次へ') => (
    <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
      {label}
    </button>
  )
  let content
  switch (v.game) {
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
  }
  return content
}
