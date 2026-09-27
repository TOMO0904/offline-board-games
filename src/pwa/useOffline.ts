import { useEffect, useState, useCallback } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function useOffline() {
  const [ready, setReady] = useState(false)
  const [detail, setDetail] = useState('準備状況を確認中…')
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const verify = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setReady(false)
      setDetail('このブラウザでは保存に対応していません。Safari / Chromeで開いてください。')
      return
    }
    const controller = navigator.serviceWorker.controller
    if (!controller) {
      setReady(false)
      setDetail(
        import.meta.env.DEV
          ? '開発モードです。オフライン検証はビルド後のプレビューで行います。'
          : '準備未完了：初回の保存中です。通信できる状態で少しお待ちください。',
      )
      return
    }
    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      setReady(false)
      setDetail('準備状況を確認できません。もう一度確認してください。')
      channel.port1.close()
    }, 5000)
    channel.port1.onmessage = (e) => {
      clearTimeout(timer)
      channel.port1.close()
      const ok = e.data?.ready === true
      setReady(ok)
      setDetail(
        ok
          ? `必要な${e.data.assets}個のファイルを端末に保存しました。`
          : '準備未完了：保存できていないファイルがあります。ネット接続後にアプリを再読み込みしてください。',
      )
    }
    controller.postMessage({ type: 'VERIFY_CACHE' }, [channel.port2])
  }, [])
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const updater = registerSW({
      immediate: true,
      onOfflineReady: () => {
        void verify()
      },
      onNeedRefresh: () => setUpdate(() => () => updater(true)),
      onRegisterError: () => {
        setReady(false)
        setDetail('オフライン保存に失敗しました。通信と空き容量を確認してください。')
      },
    })
    const changed = () => {
      void verify()
    }
    const network = () => setOnline(navigator.onLine)
    const visible = () => {
      if (document.visibilityState === 'visible') void verify()
    }
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    document.addEventListener('visibilitychange', visible)
    void verify()
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [verify])
  return { ready, detail, online, update, verify }
}
