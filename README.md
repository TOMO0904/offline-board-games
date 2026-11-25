# Offline Board Games

[English](README.md) | [日本語](README.ja.md)

**Live app: <https://offline-board-games.vercel.app/>** — open it on a phone, add it to the home screen, and wait for the "available offline" indicator.

An offline-first progressive web app (PWA) with 25 board and card games for playing with friends where there is no internet, such as on a ferry or while travelling. No accounts, ads, analytics or backend database. After the first load it runs entirely offline. The UI is in Japanese.

> Pass-and-play on one device (2–7 players) needs no network. Multi-device play needs devices that can talk to each other on the same local network or hotspot. Behaviour depends on the device, OS and hotspot settings, so test with your actual devices beforehand.

## Features

- 25 games: 5 two-player classics plus 20 additional games for 2–7 players, playable on one shared device or on each player's own phone
- Chess clocks (time per player, increment, byoyomi) for the two-player games and configurable house rules
- Serverless peer-to-peer play over WebRTC DataChannel; the connection is set up by exchanging compressed QR codes or text, with no signalling server and no STUN/TURN
- Private hands are sent only to their owner; only state diffs are synced; reconnect and host-driven resync; rematch by consensus
- Precache of the app shell and all game engines, with an "offline ready" check that verifies the cache contents
- Legal-move highlighting, promotion choice, resign, rematch, board flip, game history, themes, sound
- Responsive down to 320 px, dark mode, keyboard support

## Games

Two-player classics: Othello, Chess, Shogi, Gomoku, Connect Four. Additional games for 2–7 players include Mancala, Nim, Dominoes, Yacht, Daifugo, Sevens, Old Maid, Go Fish, Concentration, Hearts, Doubt, Dots and Boxes, Hit and Blow, Word Wolf, and two original party games (a life-path board game and a trading game). See [docs/RULES.md](docs/RULES.md) for the exact list, rules, options and sources (in Japanese).

*Othello and Connect Four are trademarks of their respective owners. This is an unofficial, non-commercial implementation of traditional game rules.*

## Tech stack

React, TypeScript (strict), Vite, vite-plugin-pwa, Workbox, Service Worker, WebRTC RTCDataChannel, Vitest, ESLint, Playwright. Libraries: `chess.js`, `qrcode`, `jsQR`, `fflate`. There are no runtime CDN, font, analytics or external API dependencies.

## Development

Requires Node.js 22.12 or later.

```bash
npm install
npm run dev        # dev server (Service Worker disabled)
npm run build      # production build into dist/
npm run preview    # serve the build at http://localhost:4173/
npm run typecheck && npm run lint && npm test
npx playwright install chromium && npm run test:e2e
```

Camera and Service Worker features require HTTPS or localhost. Verify PWA behaviour with a production build.

## Testing

- Vitest: game rules, state serialisation, invalid input, QR compression and splitting, resync, reconnect, rematch.
- Playwright: production build, manifest, Service Worker, offline reload of all games, no external HTTP requests, 320 px layout, and real WebRTC connections between 2 and 7 independent browser contexts.

Automated browser tests do not guarantee connectivity on real iPhone/Android hotspots. See [docs/VERIFICATION.md](docs/VERIFICATION.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Limitations

- Hotspot, Wi-Fi and device combinations must be tested on real devices. Client isolation, blocked mDNS/UDP or OS local-network permissions can prevent peers from connecting.
- State digests detect desync; they are not signatures. The host holds all hidden state, so play with people you trust.
- No computer opponent, remote internet play or spectating.

The full documentation (Japanese) is in [README.ja.md](README.ja.md).
