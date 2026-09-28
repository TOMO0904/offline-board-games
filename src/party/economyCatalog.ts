import type { PartyInfo } from './catalog'
export const economyIds = ['life-journey', 'island-market'] as const
export type EconomyId = (typeof economyIds)[number]
export const isEconomyId = (id: string): id is EconomyId => economyIds.includes(id as EconomyId)
export const economyCatalog: Record<EconomyId, PartyInfo> = {
  'life-journey': {
    name: 'ライフジャーニー',
    mark: '✦',
    min: 2,
    max: 7,
    description: '仕事も住まいも、選んだ道で変わる。',
    help: 'オリジナルの人生すごろく。就職か進学を選び、サイコロで36マスを進みます。6マスごとに給料と借入利息（借金の10%切上げ）。12・24マスは必ず停止して安定か挑戦の道を選びます。止まったマスで転職・住宅・投資・保険・生活イベントを選択。支払い不足は自動借入、給料日に余裕資金から最大10万を返済。全員ゴール後、現金＋住宅評価額＋経験1個につき3万−借金で勝負。先着ボーナスはありません。金額の単位はゲーム内の万。',
    options: [
      {
        key: 'risk',
        label: '波乱のイベント',
        detail: 'イベントの収支を2倍にします。',
        default: false,
      },
    ],
  },
  'island-market': {
    name: 'アイランド商会',
    mark: '⚓',
    min: 2,
    max: 7,
    description: '相場を読み、工場を育て、島一番の商会へ。',
    help: 'オリジナルの経営ゲーム。各自20コインと木材・鉱石・食料2個から開始。1手番に2アクション。資源1個の売買、施設の建設、共通の契約の納品から選びます。全員の手番が終わると生産・島のイベント・相場更新。最後のラウンドも生産します。最終評価は現金＋在庫の最終相場額＋施設評価額。契約は早い者勝ちで、同時入力ではなく手番順。借金はなく、買えなければ売却か手番終了を選べます。',
    options: [
      {
        key: 'rounds',
        label: '遊ぶラウンド数',
        detail: '全員が同じ回数行動します。',
        values: [6, 9, 12],
        default: 9,
      },
    ],
  },
}
