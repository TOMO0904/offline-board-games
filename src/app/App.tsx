import { useEffect, useState } from 'react'
import { engines } from '../games'
import { useOffline } from '../pwa/useOffline'
import { loadSettings, saveSettings, type Settings } from '../storage/storage'
import { HomePage } from '../pages/HomePage'
import { GamePage } from '../pages/GamePage'
import { SettingsPage } from '../pages/SettingsPage'
import { SetupPage, type GameSetup } from '../pages/SetupPage'
import { PartyPage } from '../pages/PartyPage'
import { isPartyId, partyCatalog, partyIds, type PlayableId } from '../party/catalog'

type Page =
  | { name: 'home' | 'settings' }
  | { name: 'mode'; game: PlayableId }
  | { name: 'game'; game: PlayableId; mode: 'local' | 'nearby'; setup: GameSetup }
export default function App() {
  const [page, setPage] = useState<Page>({ name: 'home' }),
    [settings, setSettings] = useState(loadSettings)
  const offline = useOffline()
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    saveSettings(settings)
  }, [settings])
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.title =
      page.name === 'game' || page.name === 'mode'
        ? `${isPartyId(page.game) ? partyCatalog[page.game].name : engines[page.game].name} | Offline Games`
        : 'Offline Board Games'
  }, [page])
  const home = () => setPage({ name: 'home' })
  const select = (game: PlayableId) => {
    setSettings({ ...settings, lastGame: game })
    setPage({ name: 'mode', game })
  }
  const updateSettings = (s: Settings) => setSettings(s)
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          aria-label="Offline Games ホーム"
          onClick={home}
          disabled={page.name === 'game'}
        >
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width="36" height="36" alt="" />
          <span>
            Offline<span>Board Games</span>
          </span>
        </button>
        <nav aria-label="メインナビゲーション">
          <span className="network-label">
            <i className={offline.ready ? 'ready' : ''} />
            {offline.ready ? 'OFFLINE READY' : offline.online ? 'ONLINE' : 'OFFLINE'}
          </span>
          {page.name !== 'game' && (
            <button
              className={`settings-button ${page.name === 'settings' ? 'active' : ''}`}
              aria-label="設定と対局履歴"
              onClick={() => setPage({ name: 'settings' })}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 17h16" />
                <circle cx="9" cy="7" r="3" />
                <circle cx="15" cy="17" r="3" />
              </svg>
            </button>
          )}
        </nav>
      </header>
      {page.name === 'home' && (
        <HomePage
          onSelect={select}
          settings={settings}
          offline={offline}
          onDismiss={() => setSettings({ ...settings, installDismissed: true })}
        />
      )}
      {page.name === 'settings' && (
        <SettingsPage settings={settings} onChange={updateSettings} onHome={home} />
      )}
      {page.name === 'mode' && (
        <SetupPage
          key={page.game}
          game={page.game}
          onHome={home}
          onStart={(mode, setup) => setPage({ name: 'game', game: page.game, mode, setup })}
        />
      )}
      {page.name === 'game' &&
        (isPartyId(page.game) ? (
          <PartyPage
            key={`${page.game}:${page.mode}`}
            game={page.game}
            mode={page.mode}
            setup={page.setup}
            settings={settings}
            onHome={home}
          />
        ) : (
          <GamePage
            key={`${page.game}:${page.mode}`}
            game={page.game}
            mode={page.mode}
            time={page.setup.time}
            settings={settings}
            onHome={home}
          />
        ))}
      <footer className="app-footer">
        <span>OFFLINE GAMES</span>
        <p>いい時間に、電波はいらない。</p>
        <small>{5 + partyIds.length} games · 2–7 players · 0 accounts</small>
      </footer>
    </div>
  )
}
