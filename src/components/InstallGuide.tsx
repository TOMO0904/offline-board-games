import { useEffect, useState } from 'react'
interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: string }>
}
export function InstallGuide({ dismissed, onDismiss }: { dismissed: boolean; onDismiss(): void }) {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [expanded, setExpanded] = useState(!dismissed)
  const [standalone, setStandalone] = useState(
    matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  )
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  useEffect(() => {
    const before = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const installed = () => {
      setStandalone(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', before)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', before)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  if (standalone) return null
  const install = async () => {
    if (!event) {
      setExpanded(true)
      return
    }
    try {
      await event.prompt()
      await event.userChoice
      setEvent(null)
    } catch {
      setExpanded(true)
    }
  }
  return (
    <section className="install-card">
      <div className="install-head">
        <span className="app-mini" aria-hidden="true">
          ◐
        </span>
        <div>
          <strong>旅のおともを、ホーム画面に。</strong>
          <p>無料・アカウント登録なし</p>
        </div>
      </div>
      <button className="secondary full" onClick={() => void install()}>
        Offline Gamesをインストール <span aria-hidden="true">↗</span>
      </button>
      {expanded && (
        <div className="install-instructions">
          <p>{ios ? 'iPhone / iPadのインストール方法' : 'Android / Chromeのインストール方法'}</p>
          <ol>
            {(ios
              ? [
                  'Safariでこのページを開く',
                  '共有ボタン（□↑）をタップ',
                  '「ホーム画面に追加」を選ぶ',
                  '「追加」をタップ',
                ]
              : [
                  'Chromeでこのページを開く',
                  'メニュー（⋮）をタップ',
                  '「ホーム画面に追加」または「アプリをインストール」を選ぶ',
                  'インストール後、一度起動する',
                ]
            ).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <button
            className="text-button"
            onClick={() => {
              setExpanded(false)
              onDismiss()
            }}
          >
            案内を閉じる
          </button>
        </div>
      )}
    </section>
  )
}
