import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './styles.css'
import './casual.css'
import './economy.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="panel">
        <h1>画面を開けませんでした</h1>
        <p>保存容量やブラウザを確認して、もう一度起動してください。</p>
        <button onClick={() => location.reload()}>再起動</button>
      </main>
    ) : (
      this.props.children
    )
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
