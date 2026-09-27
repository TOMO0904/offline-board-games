import { isGameId, type GameId } from '../games/core/types'

export const partyIds = [
  'daifugo',
  'sevens',
  'old-maid',
  'jiji',
  'doubt',
  'crazy-eights',
  'go-fish',
  'memory',
  'hearts',
  'pig',
  'boxes',
  'mancala',
  'nim',
  'dominoes',
  'yacht',
] as const
export type PartyId = (typeof partyIds)[number]
export type PlayableId = GameId | PartyId
export const isPartyId = (v: unknown): v is PartyId => partyIds.includes(v as PartyId)
export const isPlayableId = (v: unknown): v is PlayableId => isGameId(v) || isPartyId(v)
export interface RuleOption {
  key: string
  label: string
  detail: string
  values?: number[]
  default: number | boolean
}
export interface PartyInfo {
  name: string
  mark: string
  min: number
  max: number
  description: string
  help: string
  options: RuleOption[]
}
export const partyCatalog: Record<PartyId, PartyInfo> = {
  mancala: {
    name: 'マンカラ（カラハ）',
    mark: '•••',
    min: 2,
    max: 2,
    description: '石をまいて、まとめて取ろう。',
    help: '自分側の穴を選び、石を全部取って反時計回りに1個ずつまきます。自分のゴールにも入れ、相手のゴールは飛ばします。自分のゴールで終わるともう一回。自分側の空の穴で終わり、向かいに石があれば、最後の1個と向かいの石を獲得。片側の6穴が空になると終局し、残った石はその側のゴールへ。獲得数の多い人が勝ちです。',
    options: [
      {
        key: 'seeds',
        label: '1穴の最初の石数',
        detail: '4個が基本。少なくすると短い対局になります。',
        values: [3, 4, 6],
        default: 4,
      },
      {
        key: 'capture',
        label: '向かいの石を捕獲',
        detail: '最後の石が自分の空き穴に入ったときに捕獲します。',
        default: true,
      },
      {
        key: 'extraTurn',
        label: 'ゴールで終わったらもう一回',
        detail: 'OFFなら必ず交代。',
        default: true,
      },
    ],
  },
  nim: {
    name: '石取り（ニム）',
    mark: '●',
    min: 2,
    max: 7,
    description: '最後の石を取る？ 残す？',
    help: '1つの山を選び、1個以上の石を取ります。同じ手番で複数の山からは取れません。最後の石を取った人が勝ち。「最後を取ると負け」ではその人だけが負け、残りの人が勝ちです。初期の山は1・3・5個から、山数に応じて7・9個まで増えます。',
    options: [
      {
        key: 'piles',
        label: '山の数',
        detail: '奇数個の石を並べます。',
        values: [3, 4, 5],
        default: 3,
      },
      {
        key: 'maxTake',
        label: '1回に取れる上限',
        detail: '0は上限なし。同じ山の範囲で取れます。',
        values: [0, 1, 2, 3],
        default: 3,
      },
      {
        key: 'misere',
        label: '最後を取ると負け',
        detail: 'OFFなら最後を取った人が勝ち。',
        default: false,
      },
    ],
  },
  dominoes: {
    name: 'ドミノ',
    mark: '⚁',
    min: 2,
    max: 7,
    description: '同じ数字をつないで、手札をなくそう。',
    help: '0〜6の28枚。端と同じ数字のタイルを左か右につなぎます。最初は好きなタイルで開始。2人は7枚、3〜4人は5枚、5〜7人は4枚を配ります。出せなければ山札を引くかパス。誰かが使い切ると勝ち。全員が詰まったら手札の点の合計が最も小さい人の勝ち。チームなし・1ラウンドです。',
    options: [
      {
        key: 'draw',
        label: '出せないときに山札を引く',
        detail: 'ONはドロー式。OFFは引かずにパスするブロック式。',
        default: true,
      },
    ],
  },
  yacht: {
    name: 'ヨット・ダイス',
    mark: '⚅',
    min: 2,
    max: 7,
    description: '5個のサイコロで、狙った役を作ろう。',
    help: '5個のサイコロを振り、残したい出目をタップして振り直します。最後に未使用の役へ記録。1〜6の目、チョイス、フォーダイス、フルハウス、小・大ストレート、ヨットの12枠を全員が埋めたら最多得点の勝ち。役がなくても0点で記録できます。',
    options: [
      {
        key: 'rolls',
        label: '1手番の最大ロール数',
        detail: '3回が基本。残す出目の選択は端末内で処理し、振るときだけ送信。',
        values: [1, 2, 3],
        default: 3,
      },
      {
        key: 'bonus',
        label: '上段63点で35点ボーナス',
        detail: '1〜6の目の合計が63点以上になると35点加算。',
        default: true,
      },
    ],
  },
  daifugo: {
    name: '大富豪',
    mark: '♛',
    min: 2,
    max: 7,
    description: '革命？ 8切り？ いつものルールで。',
    help: '3が最弱、2が最強（ジョーカーはさらに上）。同じ枚数・形の強い札を出すかパス。一度パスすると場が流れるまで休み。最後に出した人以外が全員パスすると流れます。53枚を全員に配り、♦3を持つ人が先手。全順位が決まるまで遊びます。これは選択式のハウスルールです。',
    options: [
      {
        key: 'revolution',
        label: '革命',
        detail: '同数4枚以上、または同じマークの階段5枚以上で強弱を反転。',
        default: true,
      },
      {
        key: 'eightCut',
        label: '8切り',
        detail: '実物の8を含む組札で場を流す。階段の8にも適用。',
        default: true,
      },
      {
        key: 'jBack',
        label: '11バック（Jバック）',
        detail: '実物のJを含む手で、その場だけ強弱を反転。革命とは別に反転し、再度Jが出ると戻る。',
        default: true,
      },
      {
        key: 'lock',
        label: 'マーク縛り',
        detail:
          '同じマーク構成が2回続くと固定。ジョーカー入りでは発生せず、縛り中のジョーカー単体は出せない。',
        default: true,
      },
      {
        key: 'spadeThree',
        label: 'スペ3返し',
        detail: '単体ジョーカーに♠3を出して場を流せる。縛りに優先。',
        default: true,
      },
      {
        key: 'stairs',
        label: '階段',
        detail: '同じマークの連続3枚以上。3〜K〜A〜2の順。ジョーカーの階段代用は採用しない。',
        default: true,
      },
      {
        key: 'forbiddenFinish',
        label: '禁止札上がり',
        detail: 'ジョーカー・最強数字・8切りの8を含む最後の手は反則負け（順位の最下位側へ）。',
        default: false,
      },
    ],
  },
  sevens: {
    name: '七並べ',
    mark: '7',
    min: 2,
    max: 7,
    description: '止めるか、つなぐか。数字の駆け引き。',
    help: '最初に4枚の7を場に置き、同じマークの隣の数字をつなぎます。AとKはつながりません。パス上限を超えると脱落し、残りの札を公開して場に置きます。上がった順に順位を決めます。',
    options: [
      {
        key: 'passes',
        label: 'パスできる回数',
        detail: '使い切った次のパスで脱落。0はパス不可。',
        values: [0, 3, 5, 10],
        default: 3,
      },
    ],
  },
  'old-maid': {
    name: 'ババ抜き',
    mark: 'JK',
    min: 2,
    max: 7,
    description: '最後の1枚を、持たないように。',
    help: 'ジョーカー1枚入りの53枚。同じ数字のペアは自動で捨てます。次の人の裏向きの手札から1枚選んで引きます。ジョーカーが最後に残った人の負け。相手の並びは毎回シャッフルされます。',
    options: [],
  },
  jiji: {
    name: 'ジジ抜き',
    mark: '?',
    min: 2,
    max: 7,
    description: 'どの数字が残るか、誰も知らない。',
    help: '52枚から1枚を伏せて除外。残り51枚でババ抜きと同様に遊びます。最後に残る数字は最初は秘密。相手の並びは毎回シャッフルされます。',
    options: [],
  },
  doubt: {
    name: 'ダウト',
    mark: '!?',
    min: 3,
    max: 7,
    description: 'その宣言、本当？ 嘘を見抜こう。',
    help: 'A→2→…→K→Aの順に宣言して1〜4枚を裏向きに出します。出した後は他の全員が順番に「信じる」か「ダウト」。嘘なら出した人、本当なら疑った人が場の全札を引き取ります。確認が終わってから手札0枚で勝利。反射速度に依存しない順番制です。',
    options: [
      {
        key: 'maxPlay',
        label: '一度に出せる枚数',
        detail: '宣言する数字は全員共通で順に進みます。',
        values: [1, 3, 4],
        default: 4,
      },
    ],
  },
  'crazy-eights': {
    name: 'クレイジーエイト',
    mark: '8',
    min: 2,
    max: 7,
    description: '色と数字をつないで、8で逆転。',
    help: '同じ数字かマークを出し、8はいつでも出して次のマークを指定。最初は5枚、先に使い切ると勝ち。山札が尽きたら一番上以外の捨て札を混ぜて再利用。全員が動けなくなったら手札の罰点が少ない人の勝ち（8=50、絵札=10、A=1）。',
    options: [
      {
        key: 'drawOne',
        label: '引くのは1枚まで',
        detail: 'OFFでは出せる札を引くまで続けます。ONでは1枚引いても出せなければパス。',
        default: true,
      },
    ],
  },
  'go-fish': {
    name: 'ゴーフィッシュ',
    mark: '4',
    min: 2,
    max: 7,
    description: '「その数字、持ってる？」4枚集めよう。',
    help: '自分が持つ数字を相手に尋ねます。相手はその数字を全部渡します。なければ山札から1枚。成功したら続けて質問できます。4枚そろうと1点、13組が完成したとき最多得点で勝ち。2〜3人は7枚、4〜7人は5枚から始めます。',
    options: [],
  },
  memory: {
    name: '神経衰弱',
    mark: '◆',
    min: 2,
    max: 7,
    description: 'めくった場所を、覚えておこう。',
    help: '2枚めくり、同じ数字なら1点。違ったら「確認して次へ」で伏せます。全てのペアが取られたら最多得点で勝ち。数字ごとに2枚ずつ使います。',
    options: [
      {
        key: 'pairs',
        label: 'ペア数',
        detail: '小さな画面では8ペアがおすすめ。',
        values: [8, 10, 13],
        default: 8,
      },
      {
        key: 'extraTurn',
        label: '正解したらもう一回',
        detail: 'OFFでは正解しても交代。',
        default: true,
      },
    ],
  },
  hearts: {
    name: 'ハーツ',
    mark: '♥',
    min: 3,
    max: 7,
    description: 'ハートを取らない、知的な札取り。',
    help: '親と同じマークがあれば必ず出します。そのマークの最大札（Aが最大）を出した人が札を取り、次の親に。♥は1点、♠Qは13点の失点です。♥が捨てられるまでは♥から始められません（全て♥なら可）。初回は失点札を避けます。交換なし。人数で割り切れない分は低い♣・♦を除外し、最小♣から開始。',
    options: [
      {
        key: 'target',
        label: '終了する失点',
        detail: '誰かが到達したラウンド終了時に最少失点で勝ち。0は1ラウンドのみ。',
        values: [0, 50, 100],
        default: 50,
      },
      {
        key: 'moon',
        label: 'シュート・ザ・ムーン',
        detail: '1人が26点全て取ると、その人は0、他全員に26失点。',
        default: true,
      },
    ],
  },
  pig: {
    name: 'ピッグ・ダイス',
    mark: '⚄',
    min: 2,
    max: 7,
    description: '振る？ 止める？ 欲張りすぎに注意。',
    help: 'サイコロを振って出目を加算。「得点を確定」で貯金できますが、1が出ると今の手番の点が全部0になって交代。確定得点が目標に達した人の勝ち。',
    options: [
      {
        key: 'target',
        label: '目標点',
        detail: '50点なら短時間、100点が基本。',
        values: [50, 100, 150],
        default: 100,
      },
    ],
  },
  boxes: {
    name: 'ドット＆ボックス',
    mark: '□',
    min: 2,
    max: 7,
    description: '最後の辺を引いて、マスをもらおう。',
    help: '点同士の辺を1本ずつ選びます。4辺目を完成させた人がそのマスを獲得し、続けて引けます。全マスが埋まったら最多得点の勝ち。多人数でも同じルールを順番に適用します。',
    options: [
      {
        key: 'size',
        label: 'マスの数（縦・横）',
        detail: '3なら3×3の9マス。',
        values: [3, 4, 5],
        default: 4,
      },
    ],
  },
}
export type PartyRules = Record<string, number | boolean>
export function normalizeRules(game: PartyId, value: unknown): PartyRules {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(
    partyCatalog[game].options.map((o) => [
      o.key,
      o.values
        ? o.values.includes(source[o.key] as number)
          ? source[o.key]
          : o.default
        : typeof source[o.key] === 'boolean'
          ? source[o.key]
          : o.default,
    ]),
  ) as PartyRules
}
