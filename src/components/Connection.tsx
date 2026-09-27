import type { useMultiplayer } from '../hooks/useMultiplayer'
import { SignalExchange } from './SignalExchange'
export function Connection({
  network,
  debug,
}: {
  network: ReturnType<typeof useMultiplayer>
  debug: boolean
}) {
  const { link, match, role, busy, outgoing, error, host, receive, join } = network
  const connected = link.open && match?.ready
  return (
    <section className="connection panel">
      <div className="section-heading">
        <h2>近くの端末と対戦</h2>
        <span className={`status-pill ${connected ? 'good' : ''}`}>
          {connected ? '● 接続完了' : busy ? '作成中…' : '○ 接続待ち'}
        </span>
      </div>
      {connected ? (
        <>
          <p>あなたは{role === 'host' ? 'ホスト・先に指す側' : '参加側・後に指す側'}です。</p>
          <p className="muted">
            相手の応答：
            {match.lastSeen ? new Date(match.lastSeen).toLocaleTimeString('ja-JP') : '確認中'}
          </p>
          <button
            className="text-button"
            onClick={() => {
              try {
                match.sync()
              } catch {
                /* Peer status is already displayed. */
              }
            }}
          >
            盤面を再同期
          </button>
        </>
      ) : (
        <>
          <p>
            同じWi-Fi / テザリングにつなぎ、QRを往復で交換します。インターネット接続は不要です。
          </p>
          <div className="button-row">
            <button className="primary" onClick={() => void host()} disabled={busy}>
              {role === 'host' ? '接続情報を作り直す' : '対戦を作成'}
            </button>
            <button className="secondary" onClick={join} disabled={busy}>
              対戦に参加
            </button>
          </div>
          {busy && <p role="status">接続情報を作成中。最大20秒ほどかかります…</p>}
          {(role || outgoing) && (
            <SignalExchange outgoing={outgoing} busy={busy} onReceive={receive} role={role} />
          )}
          <details>
            <summary>うまく接続できないとき</summary>
            <ul>
              <li>両端末のWi-FiがONで、同じネットワークか確認</li>
              <li>ローカルネットワークへのアクセスを許可</li>
              <li>両方の画面を開いたまま、ホストが接続情報を作り直す</li>
              <li>ゲストWi-Fiの端末間通信制限を確認</li>
              <li>
                iPhoneのテザリングで難しい場合は通常Wi-Fi、Androidのテザリング、または1台で2人対戦を使用
              </li>
            </ul>
          </details>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {debug && (
        <details className="debug" open>
          <summary>接続Debug</summary>
          <dl>
            {Object.entries({
              ...link.debug,
              lastSequence: match?.sequence || 0,
              matchId: match?.matchId || '—',
              stateHash: match?.hash || '—',
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{Array.isArray(value) ? value.join('\n') || '(none)' : String(value)}</dd>
              </div>
            ))}
          </dl>
          <p>候補IP等の情報はこの画面のみで表示されます。</p>
        </details>
      )}
    </section>
  )
}
