import type { usePartyRoom } from '../hooks/usePartyRoom'
import { SignalExchange } from './SignalExchange'
export function PartyConnection({
  network,
  debug,
}: {
  network: ReturnType<typeof usePartyRoom>
  debug: boolean
}) {
  const { role, host, guest, seat, setSeat, outgoing, busy, error, create, invite, receive, join } =
    network
  return (
    <section className="connection panel">
      <h2>みんなの接続</h2>
      <p>全員を同じWi-Fi / テザリングに接続。ホストと参加者が1人ずつQRを往復で交換します。</p>
      {!role && (
        <div className="button-row">
          <button className="primary" onClick={create}>
            対戦を作成
          </button>
          <button className="secondary" onClick={join}>
            対戦に参加
          </button>
        </div>
      )}
      {role === 'host' && host && (
        <>
          <ul className="seat-list">
            {host.state.names.map((name, i) => (
              <li key={i}>
                <span>
                  {i + 1}. {name}
                  {i === 0 ? '（ホスト）' : ''}
                </span>
                <strong>{host.online[i] ? '接続済み' : '未接続'}</strong>
              </li>
            ))}
          </ul>
          <label>
            接続する相手の席
            <select value={seat} disabled={busy} onChange={(e) => setSeat(Number(e.target.value))}>
              {host.state.names.slice(1).map((name, i) => (
                <option key={i} value={i + 1}>
                  {i + 2}. {name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" disabled={busy} onClick={() => void invite()}>
            {host.online[seat] ? 'この席の接続を作り直す' : 'この席の接続情報を作る'}
          </button>
          {!host.started && (
            <button className="primary" disabled={!host.allOnline} onClick={() => host.start()}>
              全員でゲーム開始
            </button>
          )}
        </>
      )}
      {role === 'guest' && (
        <p>
          {guest?.view
            ? `あなたは ${guest.view.names[guest.seat]}（席${guest.seat + 1}）です。${guest.started ? '' : 'ホストの開始を待っています。'}`
            : 'ホストからあなたの席の接続情報を受け取ってください。人数・ルールはホストの設定にそろいます。'}
        </p>
      )}
      {role && <SignalExchange outgoing={outgoing} busy={busy} onReceive={receive} role={role} />}
      {guest?.view && (
        <button className="text-button" onClick={() => guest.sync()}>
          盤面を再同期
        </button>
      )}
      {(error || host?.notice || guest?.notice) && (
        <p className="error" role="alert">
          {error || host?.notice || guest?.notice}
        </p>
      )}
      <details>
        <summary>接続できない・途中で切れたとき</summary>
        <p>
          Wi-FiがONで同じネットワークか確認してください。ホストは切れた人の席を選び直してQRを交換します。全員が再接続すると続きから遊べます。ホスト画面の再読み込み・終了では部屋が失われます。iPhoneテザリングやゲストWi-Fiでは端末同士の通信が制限される場合があります。
        </p>
      </details>
      {debug && (
        <details className="debug" open>
          <summary>接続Debug・通信量</summary>
          <p>sequence: {host?.sequence ?? guest?.sequence ?? 0}</p>
          {[
            ...network.links.entries(),
            ...(network.guestLink ? [[0, network.guestLink] as const] : []),
          ].map(([i, l]) => (
            <div key={i}>
              <strong>接続先：席{i + 1}</strong>
              <dl>
                {Object.entries(l.debug).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{Array.isArray(v) ? v.join('\n') : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
