import type { PartyInfo } from './catalog'

export const casualIds = [
  'mini-mahjong',
  'hit-blow',
  'high-low',
  'number-mine',
  'rps',
  'word-wolf',
  'charades',
  'count-21',
  'tic-tac-toe',
] as const
export type CasualId = (typeof casualIds)[number]
export const isCasualId = (id: string): id is CasualId => casualIds.includes(id as CasualId)
const rounds = (value = 3) => ({
  key: 'rounds',
  label: 'ラウンド数',
  detail: '全員が同じ回数遊び、合計得点で比べます。',
  values: [1, 3, 5],
  default: value,
})
export const casualCatalog: Record<CasualId, PartyInfo> = {
  'mini-mahjong': {
    name: 'かんたん麻雀',
    mark: '中',
    min: 2,
    max: 4,
    description: '引いて、捨てて、3枚の組を作ろう。',
    help: '初心者向けの独自ルールです。13枚を配り、自分の番に1枚自動で引き、1枚を選んで捨てます。同じ牌3枚か同じ種類の連続数字3枚を4組＋同じ牌2枚でアガリ。七対子・国士無双の形も認めます。完成時は自動ツモ・ロン、同時ロンは捨てた人の次に近い人が優先。自分の捨て牌に現在の待ち牌が1種類でもあるとロン不可（ツモは可）。1回アガると1点、山が尽きたら流局。局ごとに開始席を交代します。役・符・点棒・鳴き・リーチ・ドラ・王牌はありません。2〜3人でも同じ牌セットを使い、通常の三麻とは異なります。',
    options: [
      {
        ...rounds(1),
        label: '遊ぶ局数',
        detail: '連荘なし。最多アガリの人が勝ち。',
        values: [1, 4, 8],
      },
      {
        key: 'honors',
        label: '字牌を使う',
        detail: '東南西北・白發中を追加。OFFなら数牌108枚だけ。',
        default: true,
      },
    ],
  },
  'hit-blow': {
    name: 'ヒット＆ブロー',
    mark: '123',
    min: 2,
    max: 7,
    description: 'ヒントをつないで、秘密の数字を解こう。',
    help: '協力ゲームです。1〜6の重複しない数字が並んだ共通の答えを、順番に予想します。数字と位置が同じならヒット、数字だけ合えばブロー。全桁ヒットで全員の勝ち。回数を使い切ると全員失敗です。全員で相談してもOK。答えはホストだけが保持します。',
    options: [
      {
        key: 'digits',
        label: '桁数',
        detail: '同じ数字は1回しか使いません。',
        values: [3, 4],
        default: 3,
      },
      {
        key: 'attempts',
        label: '全員合わせた予想回数',
        detail: '回数以内に協力して解こう。',
        values: [8, 12, 16],
        default: 12,
      },
    ],
  },
  'high-low': {
    name: 'ハイ＆ロー',
    mark: '↑↓',
    min: 2,
    max: 7,
    description: '次のカードは、大きい？ 小さい？',
    help: '見えている札より次の札の数字が大きいか小さいかを予想します。Aは1、Jは11、Qは12、Kは13。正解は1点、同じ数字は0点。結果を確認して次の人へ。全員が指定回数予想し、最多得点が勝ち。山札が切れたら現在の札以外を混ぜ直します。',
    options: [rounds(3)],
  },
  'number-mine': {
    name: '数字の地雷',
    mark: '?!',
    min: 2,
    max: 7,
    description: '範囲が狭まる。その数字は安全？',
    help: '1〜上限のどこかに秘密の地雷が1つあります。順番に範囲内の数字を選び、外れたらその数字を境に範囲が狭まります。地雷を選んだ人だけが負け、ほかの人が勝ち。最後の1個でも選んで確定してください。',
    options: [
      {
        key: 'limit',
        label: '数字の上限',
        detail: '少ないほど短いゲームに。',
        values: [30, 50, 100],
        default: 100,
      },
    ],
  },
  rps: {
    name: 'ひみつじゃんけん',
    mark: '✊',
    min: 2,
    max: 7,
    description: 'みんなが決めるまで、手はひみつ。',
    help: '順番にグー・チョキ・パーを秘密に選び、全員の入力後に同時公開します。2種類だけなら勝つ手を出した全員に1点。全員同じか3種類ならあいこで0点。指定ラウンドの合計点で勝負。通信速度は勝敗に影響しません。',
    options: [rounds(3)],
  },
  'word-wolf': {
    name: 'ワードウルフ',
    mark: '◐',
    min: 3,
    max: 7,
    description: '1人だけ違うお題。会話で見つけよう。',
    help: '自分のお題だけを確認して端末を渡します。1人だけ似た別のお題ですが、自分の役は知らされません。全員が確認したら声で会話し、相談が終わったら順番に秘密投票（自分には投票不可）。単独最多票の人が少数派なら多数派全員に1点。それ以外や同票は少数派に1点。全投票後にお題・役・票を公開します。時間制限と逆転回答はありません。1台共有でも、全員で話す間はお題を隠します。',
    options: [rounds(1)],
  },
  charades: {
    name: 'ジェスチャー',
    mark: '♪',
    min: 2,
    max: 7,
    description: '声を出さずに伝えて、みんなで当てよう。',
    help: '手番の人だけがお題を見て、声や文字を使わずに動きで伝えます。ほかの人は声で答え、当たったら演じた人が「当ててもらえた」を押して1点。難しければパスして0点で交代。全員が指定回数演じます。正解の判定はその場のみんなで行います。画像・音声・動画を送る機能はありません。',
    options: [rounds(3)],
  },
  'count-21': {
    name: '21カウント',
    mark: '21',
    min: 2,
    max: 7,
    description: '1、2、3。最後を言ったら負け！',
    help: '0から始め、順番に1〜3個の続きの数字を言って、その個数のボタンを押します。目標の数字を言った人が負け、ほかの人が勝ち。目標を越える個数は選べません。声に出しても画面だけでも遊べます。',
    options: [
      {
        key: 'goal',
        label: '言うと負けになる数字',
        detail: '21が基本です。',
        values: [21, 31, 51],
        default: 21,
      },
    ],
  },
  'tic-tac-toe': {
    name: '三目並べ',
    mark: '○×',
    min: 2,
    max: 2,
    description: '○と×、3つ並べたら勝ち。',
    help: '3×3の空いたマスへ交互に○・×を置きます。縦・横・斜めに自分の印を3つ並べた人が勝ち。9マス埋まっても並ばなければ引き分けです。席1が○で先手。',
    options: [],
  },
}
