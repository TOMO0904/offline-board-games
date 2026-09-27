import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export function Scanner({ onRead, onClose }: { onRead(text: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null)
  const handler = useRef(onRead)
  const [error, setError] = useState('')
  useEffect(() => {
    handler.current = onRead
  }, [onRead])
  useEffect(() => {
    let stopped = false,
      stream: MediaStream | null = null,
      timer: ReturnType<typeof setTimeout> | undefined
    const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d', { willReadFrequently: true })
    let last = '',
      lastAt = 0
    const scan = () => {
      if (stopped) return
      const v = video.current
      if (v && v.readyState >= 2 && ctx) {
        const ratio = Math.min(1, 800 / v.videoWidth)
        canvas.width = Math.round(v.videoWidth * ratio)
        canvas.height = Math.round(v.videoHeight * ratio)
        if (canvas.width && canvas.height) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: 'dontInvert',
          })
          if (code && (code.data !== last || Date.now() - lastAt > 2500)) {
            last = code.data
            lastAt = Date.now()
            handler.current(code.data)
          }
        }
      }
      timer = setTimeout(scan, 180)
    }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('カメラを利用できません。HTTPSで開くか、テキストで接続してください。')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play()
          scan()
        }
      } catch {
        if (!stopped)
          setError(
            'カメラを開始できません。カメラの使用を許可するか、下のテキスト入力で接続できます。',
          )
      }
    }
    void start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  return (
    <div className="scanner">
      <video ref={video} muted playsInline aria-label="QR読み取りカメラ" />
      {error && <p role="alert">{error}</p>}
      <p>相手のQRを枠内に映してください。複数ある場合はすべて読み取ります。</p>
      <button className="secondary" onClick={onClose}>
        カメラを閉じる
      </button>
    </div>
  )
}
