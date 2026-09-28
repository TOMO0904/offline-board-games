import { useState } from 'react'
import type { EconomyProps } from './EconomyBoard'
import { L, stat, jobs, homes } from '../party/economy'
import { lifeTiles } from '../party/life'
const tileName = (i: number) =>
  i === 0 ? '出発' : i === 36 ? 'ゴール' : i === 12 || i === 24 ? '分岐' : lifeTiles[i % 6]
const tileIcons = ['￥', '▣', '⌂', '✦', '↗', '♡']
export function LifeBoard({ v, enabled, act }: EconomyProps) {
  const [inspected, setInspected] = useState<number | null>(null)
  const p = v.turn,
    val = (f: number) => stat(v, p, f),
    done = v.phase === 'finished'
  const choices: { title: string; detail: string; index: number; disabled?: boolean }[] =
    v.board[0] === 0
      ? [
          { title: 'すぐに就職', detail: '費用なし。配達スタッフ：給料6万。', index: 0 },
          {
            title: '進学して専門職へ',
            detail: '学費20万。エンジニア：給料11万。専門職への転職も可能。',
            index: 1,
          },
        ]
      : v.board[0] === 1
        ? [
            ...jobs.map((j, index) => ({
              title: j.name,
              detail: `給料${j.salary}万${index === 1 ? '＋毎回0〜12万の売上' : ''}${j.study ? ' ／ 要進学' : ''}。転職すると昇進は0に。`,
              index,
              disabled: j.study && !val(L.education),
            })),
            {
              title: '研修で昇進',
              detail: '8万。以後の給料＋3万（最大3回）。',
              index: 4,
              disabled: val(L.level) >= 3,
            },
          ]
        : v.board[0] === 2
          ? homes.map((h, index) => ({
              title: h.name,
              detail:
                index === 0
                  ? '持ち家を評価額で売却。'
                  : `購入${h.cost}万・評価額${h.value}万。今の家は評価額で下取り。`,
              index,
            }))
          : v.board[0] === 3
            ? [
                { title: '堅実に積み立て', detail: '確実に＋3万。', index: 0 },
                {
                  title: '小さな事業へ投資',
                  detail: `8万。成功で24万、失敗で0。成功率${val(L.route) ? 60 : 45}%。`,
                  index: 1,
                },
                {
                  title: '大きな事業へ投資',
                  detail: `16万。成功で48万、失敗で0。成功率${val(L.route) ? 60 : 45}%。`,
                  index: 2,
                },
              ]
            : v.board[0] === 4
              ? [
                  {
                    title: '旅に出る',
                    detail: '6万で経験＋3。経験は最後に1つ3万の評価。',
                    index: 0,
                  },
                  {
                    title: '保険に入る',
                    detail: '8万。以後の出来事の出費が半額。',
                    index: 1,
                    disabled: !!val(L.insured),
                  },
                  { title: '休日に副業', detail: '現金＋4万。', index: 2 },
                ]
              : [
                  {
                    title: '安定の道',
                    detail: '支援金＋6万。出来事は通常、投資成功率45%。',
                    index: 0,
                  },
                  {
                    title: '挑戦の道',
                    detail: '経験＋2。次の分岐まで出来事の収支2倍、投資成功率60%。',
                    index: 1,
                  },
                ]
  return (
    <>
      <section className="journey-banner">
        <span>YOUR NEXT CHAPTER</span>
        <h2>{done ? 'それぞれの人生、到着。' : `${v.names[p]}の人生の旅`}</h2>
        <div className="economy-metrics">
          <div>
            <small>現在地</small>
            <b>{val(L.position)} / 36</b>
          </div>
          <div>
            <small>現金</small>
            <b>{v.scores[p]}万</b>
          </div>
          <div>
            <small>借金</small>
            <b>{val(L.debt)}万</b>
          </div>
        </div>
        <p>
          {jobs[val(L.job)]?.name ?? 'これから進路を選びます'} ／ {homes[val(L.home)].name} ／ 経験{' '}
          {val(L.joy)}
        </p>
      </section>
      {!done && (
        <section className="panel economy-actions">
          <h2>
            {v.phase === 'challenge'
              ? v.board[0] === 0
                ? '最初の大きな選択'
                : `${tileName(val(L.position))}：どうする？`
              : v.phase === 'reveal'
                ? '今回の結果'
                : '次の一歩へ'}
          </h2>
          {v.phase === 'challenge' ? (
            <>
              <p className="small">支払いが不足すると自動で借入。給料日の利息に注意。</p>
              <div className="economy-choices">
                {choices.map((c) => (
                  <button
                    key={c.index}
                    disabled={!enabled || c.disabled}
                    onClick={() => act({ type: 'choose', index: c.index })}
                  >
                    <strong>{c.title}</strong>
                    <small>{c.detail}</small>
                  </button>
                ))}
              </div>
            </>
          ) : v.phase === 'play' ? (
            <button
              className="primary economy-roll"
              disabled={!enabled}
              onClick={() => act({ type: 'roll' })}
            >
              ⚄ サイコロを振る
            </button>
          ) : (
            <>
              <p role="status">{v.info}</p>
              <button className="primary" disabled={!enabled} onClick={() => act({ type: 'next' })}>
                確認して次の人へ
              </button>
            </>
          )}
          {!enabled && <p className="small">手番の人の選択を待っています。</p>}
        </section>
      )}
      <section className="panel journey-map-panel">
        <div className="journey-map" aria-label="人生の道 0から36マス">
          {Array.from({ length: 37 }, (_, i) => (
            <button
              key={i}
              className={`journey-tile ${i % 12 === 0 ? 'milestone' : ''} ${i === val(L.position) ? 'here' : ''}`}
              aria-label={`${i}マス ${tileName(i)}`}
              onClick={() => setInspected(i)}
            >
              <small>{i}</small>
              <span aria-hidden="true">
                {i === 36 ? '⚑' : i % 12 === 0 ? '◇' : tileIcons[i % 6]}
              </span>
              <em>{tileName(i)}</em>
              <div className="journey-pawns">
                {v.names.map((_, seat) =>
                  stat(v, seat, L.position) === i ? (
                    <b key={seat} className={`pawn seat-${seat}`} aria-label={v.names[seat]}>
                      {seat + 1}
                    </b>
                  ) : null,
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="small">
          数字順に進みます。12・24では必ず止まり、道を選択。番号付きの丸が各プレイヤーです。
        </p>
        {inspected !== null && (
          <p role="status">
            {inspected}マス：{tileName(inspected)}。
            {inspected % 6 === 0 && inspected > 0
              ? '通過時に給料・利息・返済を自動精算。'
              : '止まったときにイベントが発生。'}
          </p>
        )}
      </section>
    </>
  )
}
