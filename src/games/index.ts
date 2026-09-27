import { othello } from './othello/engine'
import { chess } from './chess/engine'
import { shogi } from './shogi/engine'
import { gomoku } from './gomoku/engine'
import { connectFour } from './connect-four/engine'
import type { GameEngine, GameId, Player } from './core/types'
export const engines: Record<GameId, GameEngine> = {
  othello,
  chess,
  shogi,
  gomoku,
  'connect-four': connectFour,
}
export const playerName = (game: GameId, p: Player) =>
  game === 'chess'
    ? p === 0
      ? '白'
      : '黒'
    : game === 'shogi'
      ? p === 0
        ? '先手'
        : '後手'
      : game === 'connect-four'
        ? p === 0
          ? 'コーラル'
          : 'イエロー'
        : p === 0
          ? '黒'
          : '白'
export const gameInfo: Record<
  GameId,
  { en: string; description: string; time: string; mark: string }
> = {
  othello: { en: 'OTHELLO', description: 'ひと手で、景色が変わる。', time: '10–20分', mark: '◐' },
  chess: { en: 'CHESS', description: '64マスの、小さな冒険。', time: '20–40分', mark: '♞' },
  shogi: { en: 'SHOGI', description: 'じっくり読む、その先の一手。', time: '30–60分', mark: '王' },
  gomoku: { en: 'GOMOKU', description: 'あとひとつ、を見逃さない。', time: '5–15分', mark: '⁙' },
  'connect-four': {
    en: 'CONNECT FOUR',
    description: '落として、つなげて、4つ。',
    time: '5–10分',
    mark: '⠿',
  },
}
