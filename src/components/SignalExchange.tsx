import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { MAX_SIGNAL, SignalCollector, splitSignal } from '../networking/signaling'
import { Scanner } from './Scanner'

export function SignalExchange({
  outgoing,
  busy,
  onReceive,
  role,
}: {
  outgoing: string
  busy: boolean
  role: 'host' | 'guest' | null
  onReceive(text: string): Promise<void>
}) {
  const [index, setIndex] = useState(0),
    [qr, setQr] = useState(''),
    [input, setInput] = useState('')
  const [scanning, setScanning] = useState(false),
    [message, setMessage] = useState(''),
    [progress, setProgress] = useState('')
  const collector = useRef(new SignalCollector()),
    receiving = useRef(false)
  const parts = outgoing ? splitSignal(outgoing) : []
  const current = parts[index % (parts.length || 1)]
  useEffect(() => {
    let live = true
    if (current)
      void QRCode.toDataURL(current, { errorCorrectionLevel: 'M', width: 560, margin: 4 })
        .then((url) => {
          if (live) setQr(url)
        })
        .catch(() => {
          if (live) setMessage('QRを生成できません。テキストで接続してください。')
        })
    else setQr('')
    return () => {
      live = false
    }
  }, [current])
  async function receive(text: string) {
    if (busy || receiving.current) return
    receiving.current = true
    try {
      await onReceive(text)
      setMessage('接続情報を受け取りました。')
      setScanning(false)
      collector.current.reset()
      setProgress('')
      setInput('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '接続情報を処理できませんでした。')
    } finally {
      receiving.current = false
    }
  }
  function scan(text: string) {
    try {
      const result = collector.current.add(text)
      setProgress(`${result.received} / ${result.total} 枚を読み取り済み`)
      if (result.text) void receive(result.text)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'QRを読み取れませんでした。')
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(outgoing)
      setMessage('接続テキストをコピーしました。')
    } catch {
      setMessage('コピーできません。接続テキストを長押しして全文をコピーしてください。')
    }
  }
  async function paste() {
    try {
      setInput(await navigator.clipboard.readText())
    } catch {
      setMessage('入力欄を長押しして「ペースト」を選んでください。')
    }
  }
  return (
    <div className="signal-exchange">
      {outgoing && (
        <section className="signal-out">
          <h3>{role === 'host' ? '① 相手にQRを見せる' : '② ホストに返信QRを見せる'}</h3>
          {qr && (
            <img
              className="qr"
              src={qr}
              width="280"
              height="280"
              alt={`接続QR ${(index % parts.length) + 1} / ${parts.length}`}
            />
          )}
          {parts.length > 1 && (
            <div className="qr-controls">
              <button
                className="secondary"
                onClick={() => setIndex((index + parts.length - 1) % parts.length)}
                aria-label="前のQR"
              >
                ←
              </button>
              <strong>
                {(index % parts.length) + 1} / {parts.length} 枚
              </strong>
              <button
                className="secondary"
                onClick={() => setIndex((index + 1) % parts.length)}
                aria-label="次のQR"
              >
                →
              </button>
            </div>
          )}
          <p className="muted">
            {parts.length > 1
              ? '矢印で切り替え、相手にすべてのQRを読み取ってもらってください。'
              : '相手の端末で「QRを読み取る」を押してください。'}
          </p>
          <details>
            <summary>接続テキストを表示・コピー</summary>
            <textarea
              value={outgoing}
              readOnly
              aria-label="送信用接続テキスト"
              onFocus={(e) => e.target.select()}
            />
            <button className="secondary" onClick={() => void copy()}>
              コピー
            </button>
          </details>
        </section>
      )}
      <section>
        <h3>{role === 'host' ? '② 相手の返信を読み取る' : '① ホストのQRを読み取る'}</h3>
        {!scanning && (
          <button
            className="primary full"
            disabled={busy}
            onClick={() => {
              setScanning(true)
              setMessage('')
            }}
          >
            ▣ QRを読み取る
          </button>
        )}
        {scanning && <Scanner onRead={scan} onClose={() => setScanning(false)} />}
        {progress && (
          <p role="status">
            {progress}{' '}
            <button
              className="text-button"
              onClick={() => {
                collector.current.reset()
                setProgress('')
              }}
            >
              読み取りをリセット
            </button>
          </p>
        )}
        <details>
          <summary>テキストで接続する</summary>
          <label htmlFor="signal-input">相手の接続テキストを貼り付け</label>
          <textarea
            id="signal-input"
            maxLength={MAX_SIGNAL}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            placeholder="OBG1.…"
          />
          <div className="button-row">
            <button className="secondary" onClick={() => void paste()}>
              貼り付け
            </button>
            <button
              className="primary"
              disabled={busy || !input.trim()}
              onClick={() => void receive(input)}
            >
              接続情報を読み込む
            </button>
          </div>
        </details>
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
