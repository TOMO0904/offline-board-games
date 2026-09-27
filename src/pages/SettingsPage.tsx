import { engines, playerName } from '../games'
import { getStorageError, loadHistory, type Settings } from '../storage/storage'
import { loadPartyHistory } from '../party/storage'
import { partyCatalog } from '../party/catalog'
export function SettingsPage({
  settings,
  onChange,
  onHome,
}: {
  settings: Settings
  onChange(settings: Settings): void
  onHome(): void
}) {
  const history = loadHistory()
  const partyHistory = loadPartyHistory()
  return (
    <main className="settings-page">
      <button className="text-button" onClick={onHome}>
        ← ホーム
      </button>
      <p className="eyebrow">MAKE YOURSELF AT HOME</p>
      <h1>設定と対局履歴</h1>
      <section className="panel settings-form">
        <h2>自分好みに</h2>
        <label>
          画面のテーマ
          <select
            value={settings.theme}
            onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">端末の設定に合わせる</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </label>
        <label className="switch-row">
          <span>
            駒を置く音<small>外部の音声ファイルは使いません</small>
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => onChange({ ...settings, sound: e.target.checked })}
          />
        </label>
        <label className="switch-row">
          <span>
            接続Debugを表示<small>接続候補・状態・通信量を確認</small>
          </span>
          <input
            type="checkbox"
            checked={settings.debug}
            onChange={(e) => onChange({ ...settings, debug: e.target.checked })}
          />
        </label>
        <button
          className="secondary"
          onClick={() => onChange({ ...settings, installDismissed: false })}
        >
          インストール案内を再表示
        </button>
      </section>
      <section className="panel">
        <p className="eyebrow">YOUR PLAYBOOK</p>
        <h2>対局の思い出</h2>
        {history.length ? (
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <div>
                  <strong>{engines[h.game].name}</strong>
                  <small>
                    {new Date(h.at).toLocaleString('ja-JP')} ·{' '}
                    {h.mode === 'local' ? 'この端末' : '近くの端末'}
                  </small>
                </div>
                <div>
                  <strong>
                    {h.winner === 'draw'
                      ? '引き分け'
                      : `${playerName(h.game, h.winner as 0 | 1)}の勝ち`}
                  </strong>
                  <small>{h.moves} 手</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">◷</span>
            <p>最初の一局が、ここに残ります。</p>
            <small>終了した対局を、この端末に100件保存します。</small>
          </div>
        )}
      </section>
      {partyHistory.length > 0 && (
        <section className="panel">
          <h2>みんなで遊んだ記録</h2>
          <ul className="history-list">
            {partyHistory.map((h) => (
              <li key={h.id}>
                <div>
                  <strong>
                    {partyCatalog[h.game].name} · {h.names.length}人
                  </strong>
                  <small>
                    {new Date(h.at).toLocaleString('ja-JP')} · {h.moves}手
                  </small>
                </div>
                <div>
                  <strong>
                    {h.winners.length
                      ? h.winners.map((i) => h.names[i]).join('・') + ' の勝ち'
                      : '引き分け'}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel">
        <h2>船旅の前に</h2>
        <ol>
          <li>両端末にインストールして一度起動</li>
          <li>ホームの「オフライン利用可能」を確認</li>
          <li>機内モードで起動し、遊びたいゲームを確認</li>
          <li>Wi-FiをONに戻し、実際に使うテザリングで接続テスト</li>
        </ol>
        <p>
          端末のストレージ整理で保存内容が消えることがあります。画面のロックやアプリ切り替えで通信が切れた場合は、同じ対局画面でQRを交換し直してください。
        </p>
        <p className="muted">
          外部サーバー・アカウント・広告・解析はありません。接続先はQRを交換した端末のみです。
        </p>
      </section>
      {getStorageError() && <p className="error">{getStorageError()}</p>}
    </main>
  )
}
