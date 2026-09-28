import type { PartyInfo } from './catalog'

export const casualIds = ['mini-mahjong', 'hit-blow', 'word-wolf'] as const
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
  'word-wolf': {
    name: 'ワードウルフ',
    mark: '◐',
    min: 3,
    max: 7,
    description: '1人だけ違うお題。会話で見つけよう。',
    help: '自分のお題だけを確認して端末を渡します。1人だけ似た別のお題ですが、自分の役は知らされません。全員が確認したら声で会話し、相談が終わったら順番に秘密投票（自分には投票不可）。単独最多票の人が少数派なら多数派全員に1点。それ以外や同票は少数派に1点。全投票後にお題・役・票を公開します。時間制限と逆転回答はありません。1台共有でも、全員で話す間はお題を隠します。',
    options: [rounds(1)],
  },
}
