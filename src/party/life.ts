import { requireRule, type PartyState, type PartyAction, type Random } from './types'
import { L, jobs, homes, stat, setStat, addStat, finishEconomy } from './economy'
export const lifeEvents = [
  { title: '地域の仕事を手伝った', money: 8, joy: 1 },
  { title: '旅先で新しい友人ができた', money: -4, joy: 3 },
  { title: '家電が故障した', money: -12, joy: 0 },
  { title: '趣味の作品が売れた', money: 12, joy: 1 },
  { title: '家族で思い出の旅行へ', money: -8, joy: 4 },
  { title: '水漏れの修理が必要に', money: -16, joy: 0 },
  { title: '仕事のアイデアが採用された', money: 15, joy: 1 },
  { title: '資格試験に挑戦した', money: -6, joy: 2 },
  { title: '健康のために休暇を取った', money: -7, joy: 3 },
  { title: '臨時ボーナスを受け取った', money: 10, joy: 0 },
  { title: '大切な道具を買い替えた', money: -10, joy: 1 },
  { title: '仲間とお店を開いた', money: 6, joy: 2 },
]
export const lifeTiles = ['給料', '仕事', '住まい', '出来事', '投資', '暮らし']
// board[0]: choice kind (0 career, 1 job, 2 home, 3 investment, 4 lifestyle, 5 route).
export function payLife(s: PartyState, p: number, cost: number) {
  const paid = Math.min(s.scores[p], cost)
  s.scores[p] -= paid
  addStat(s, p, L.debt, cost - paid)
}
export function initLife(s: PartyState) {
  s.scores.fill(30)
  s.names.forEach((_, p) => setStat(s, p, L.job, -1))
  s.board = [0]
  s.phase = 'challenge'
  s.info = 'まずは進路を選ぼう。就職で収入、進学で専門職への道。'
}
function nextLife(s: PartyState) {
  if (s.names.every((_, p) => stat(s, p, L.finished))) {
    finishEconomy(s)
    return
  }
  do {
    s.turn = (s.turn + 1) % s.names.length
  } while (stat(s, s.turn, L.finished))
  s.phase = stat(s, s.turn, L.job) < 0 ? 'challenge' : 'play'
  s.board = [0]
  s.roll = 0
}
function salary(s: PartyState, p: number, rng: Random) {
  const job = stat(s, p, L.job),
    income = jobs[job].salary + stat(s, p, L.level) * 3 + (job === 1 ? Math.floor(rng() * 13) : 0)
  s.scores[p] += income
  const interest = Math.ceil(stat(s, p, L.debt) / 10)
  payLife(s, p, interest)
  const repay = Math.min(10, stat(s, p, L.debt), Math.max(0, s.scores[p] - 10))
  s.scores[p] -= repay
  addStat(s, p, L.debt, -repay)
  s.info += ` 給料${income}万・利息${interest}万・返済${repay}万。`
}
export function playLife(s: PartyState, a: PartyAction, rng: Random) {
  const p = s.turn
  if (s.phase === 'reveal') {
    requireRule(a.type === 'next')
    nextLife(s)
    return
  }
  if (s.phase === 'challenge') {
    requireRule(a.type === 'choose' && a.index !== undefined)
    const choice = a.index,
      kind = s.board[0]
    if (kind === 0) {
      requireRule(choice <= 1)
      if (choice === 1) {
        payLife(s, p, 20)
        setStat(s, p, L.education, 1)
        setStat(s, p, L.job, 2)
        s.info = '20万で進学し、エンジニアに就職。'
      } else {
        setStat(s, p, L.job, 0)
        s.info = '配達スタッフとして社会へ。'
      }
      s.phase = 'play'
      return
    }
    if (kind === 1) {
      requireRule(choice <= 4)
      if (choice === 4) {
        requireRule(stat(s, p, L.level) < 3, '昇進は3段階までです。')
        payLife(s, p, 8)
        addStat(s, p, L.level, 1)
        s.info = '8万で研修。給料が3万上がった。'
      } else {
        requireRule(!jobs[choice].study || !!stat(s, p, L.education), '専門職は進学が必要です。')
        setStat(s, p, L.job, choice)
        setStat(s, p, L.level, 0)
        s.info = `${jobs[choice].name}へ転職。`
      }
    } else if (kind === 2) {
      requireRule(choice <= 3)
      const old = stat(s, p, L.home)
      if (choice !== old) {
        s.scores[p] += homes[old].value
        payLife(s, p, homes[choice].cost)
        setStat(s, p, L.home, choice)
      }
      s.info = `住まいは${homes[choice].name}。売却と購入の精算完了。`
    } else if (kind === 3) {
      requireRule(choice <= 2)
      if (choice === 0) {
        s.scores[p] += 3
        s.info = '堅実な積立で3万増えた。'
      } else {
        const cost = choice === 1 ? 8 : 16
        payLife(s, p, cost)
        const success = rng() < (stat(s, p, L.route) === 1 ? 0.6 : 0.45)
        const gain = success ? cost * 3 : 0
        s.scores[p] += gain
        s.info = `新事業に${cost}万投資。${success ? `${gain}万の収入！` : '今回は収入なし。'}`
      }
    } else if (kind === 4) {
      requireRule(choice <= 2)
      if (choice === 0) {
        payLife(s, p, 6)
        addStat(s, p, L.joy, 3)
        s.info = '6万の旅で経験を3つ獲得。'
      }
      if (choice === 1) {
        requireRule(!stat(s, p, L.insured), 'すでに加入しています。')
        payLife(s, p, 8)
        setStat(s, p, L.insured, 1)
        s.info = '8万で保険へ加入。出来事の出費を半額に。'
      }
      if (choice === 2) {
        s.scores[p] += 4
        s.info = '休日の副業で4万獲得。'
      }
    } else {
      requireRule(kind === 5 && choice <= 1)
      setStat(s, p, L.route, choice)
      if (choice === 0) {
        s.scores[p] += 6
        s.info = '安定の道へ。支援金6万。'
      } else {
        addStat(s, p, L.joy, 2)
        s.info = '挑戦の道へ。経験＋2。次の分岐まで投資成功率60%、出来事の収支は2倍。'
      }
    }
    s.phase = 'reveal'
    return
  }
  requireRule(s.phase === 'play' && a.type === 'roll')
  s.roll = 1 + Math.floor(rng() * 6)
  const before = stat(s, p, L.position),
    gate = before < 12 ? 12 : before < 24 ? 24 : 36,
    position = Math.min(gate, before + s.roll)
  setStat(s, p, L.position, position)
  s.info = `${s.roll}が出て${position}マスへ。`
  if (Math.floor(position / 6) > Math.floor(before / 6)) salary(s, p, rng)
  if (position === 36) {
    setStat(s, p, L.finished, 1)
    s.info += ' ゴール！ ほかの人の到着を待ちます。'
    s.phase = 'reveal'
    return
  }
  if (position === 12 || position === 24) {
    s.board = [5]
    s.phase = 'challenge'
    s.info += ' 次の人生の道を選ぼう。'
    return
  }
  const tile = position % 6
  if (tile === 3) {
    const id = Math.floor(rng() * lifeEvents.length),
      event = lifeEvents[id]
    const scale = (s.rules.risk ? 2 : 1) * (stat(s, p, L.route) ? 2 : 1)
    const money = event.money * scale
    if (money < 0) payLife(s, p, Math.ceil(-money / (stat(s, p, L.insured) ? 2 : 1)))
    else s.scores[p] += money
    addStat(s, p, L.joy, event.joy)
    s.table = [id]
    s.info += ` ${event.title}。${money < 0 ? '支出' : '収入'}${money < 0 ? Math.ceil(-money / (stat(s, p, L.insured) ? 2 : 1)) : money}万・経験＋${event.joy}。`
    s.phase = 'reveal'
  } else if (tile === 0) {
    s.phase = 'reveal'
  } else {
    s.board = [tile === 1 ? 1 : tile === 2 ? 2 : tile === 4 ? 3 : 4]
    s.phase = 'challenge'
  }
}
