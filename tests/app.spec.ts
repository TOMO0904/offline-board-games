import { expect, test, type Page } from '@playwright/test'

async function choose(page: Page, game = 'オセロ', mode = 'この端末で2人') {
  await page.getByRole('button', { name: `${game}を選ぶ`, exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${mode}`) }).click()
}
async function pasteSignal(page: Page, text: string) {
  await page.locator('summary').filter({ hasText: 'テキストで接続する' }).click()
  await page.getByLabel('相手の接続テキストを貼り付け').fill(text)
  await page.getByRole('button', { name: '接続情報を読み込む', exact: true }).click()
}
test('precache, subpath manifest, offline reload, all games and no external requests', async ({
  page,
  context,
}) => {
  const external: string[] = [],
    errors: string[] = []
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4173/'))
      external.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('./')
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href
    return (await fetch(href)).json()
  })
  expect(manifest.start_url).toBe('/offline-board-games/')
  expect(manifest.scope).toBe('/offline-board-games/')
  expect(manifest.display).toBe('standalone')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  for (const game of ['オセロ', 'チェス', '将棋', '五目並べ', 'Connect Four']) {
    await choose(page, game)
    await expect(page.getByRole('group', { name: `${game}の盤面`, exact: true })).toBeVisible()
    if (game === 'オセロ')
      await page.getByRole('button', { name: '4列3行 空き 合法手', exact: true }).click()
    if (game === 'チェス') {
      await page.getByRole('button', { name: '5列7行 白のポーン', exact: true }).click()
      await page.getByRole('button', { name: '5列5行 空き 合法手', exact: true }).click()
    }
    if (game === '将棋') {
      await page.getByRole('button', { name: '1列7行 先手の歩', exact: true }).click()
      await page.getByRole('button', { name: '1列6行 空き 合法手', exact: true }).click()
    }
    if (game === '五目並べ') {
      await page.getByRole('button', { name: '8列8行 空き 合法手', exact: true }).click()
      await page.getByRole('button', { name: '8列 8行に置く', exact: true }).click()
    }
    if (game === 'Connect Four')
      await page.getByRole('button', { name: '4列6行 空き 合法手', exact: true }).click()
    await expect(page.locator('.move-counter')).toHaveText('1 手')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/game-${game}-320.png`, fullPage: true })
    await page.getByRole('button', { name: '← ホーム', exact: true }).click()
  }
  expect(external).toEqual([])
  expect(errors).toEqual([])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
})
test('readiness detects a missing cached asset', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const r of await cache.keys()) if (r.url.includes('icon-192.png')) await cache.delete(r)
    }
  })
  await page.getByRole('button', { name: '↻ 再確認', exact: true }).click()
  await expect(page.getByText('準備未完了', { exact: true })).toBeVisible()
})
test('320px layout, dark theme, keyboard board and result persistence', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./')
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/home-320-dark.png', fullPage: true })
  await page.getByRole('button', { name: '設定と対局履歴', exact: true }).click()
  await page.getByLabel('画面のテーマ').selectOption('light')
  await page.getByRole('button', { name: '← ホーム', exact: true }).click()
  await choose(page)
  const first = page.locator('.board button').first()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.board button').nth(1)).toBeFocused()
  await page.getByRole('button', { name: '4列3行 空き 合法手', exact: true }).click()
  await page.getByRole('button', { name: '投了する', exact: true }).click()
  await page.getByRole('button', { name: 'はい', exact: true }).click()
  await expect(page.getByText('黒の勝ち', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/othello-320-light.png', fullPage: true })
  await page.getByRole('button', { name: '← ホーム', exact: true }).click()
  await page.getByRole('button', { name: '設定と対局履歴', exact: true }).click()
  await expect(page.locator('.history-list')).toContainText('黒の勝ち')
  await page.reload()
  expect(await page.locator('html').getAttribute('data-theme')).toBe('light')
  await choose(page)
  await expect(page.getByText('黒の勝ち', { exact: true })).toBeVisible()
})
test('two real WebRTC peers exchange compressed signals, moves, resync, restart and resignation', async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext(),
    host = await a.newPage(),
    guest = await b.newPage()
  try {
    for (const page of [host, guest]) {
      await page.goto('http://127.0.0.1:4173/offline-board-games/')
      await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
      await choose(page, 'オセロ', '近くの端末と対戦')
    }
    // Chromium's global offline emulation also blocks P2P handshakes.
    // Block HTTP(S), including SW fetches, while leaving local UDP available.
    for (const context of [a, b])
      await context.route(/^https?:\/\//, (route) => route.abort('internetdisconnected'))
    expect(
      await host.evaluate(() =>
        fetch('./uncached-network-probe').then(
          () => false,
          () => true,
        ),
      ),
    ).toBe(true)
    await host.getByRole('button', { name: '対戦を作成', exact: true }).click()
    const output = host.getByLabel('送信用接続テキスト')
    await expect(output).toHaveValue(/^OBG1\./, { timeout: 30000 })
    const offer = await output.inputValue()
    await guest.getByRole('button', { name: '対戦に参加', exact: true }).click()
    await pasteSignal(guest, offer)
    await expect(guest.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./, { timeout: 30000 })
    await pasteSignal(host, await guest.getByLabel('送信用接続テキスト').inputValue())
    await expect(host.getByText('● 接続完了', { exact: true })).toBeVisible({ timeout: 30000 })
    await expect(guest.getByText('● 接続完了', { exact: true })).toBeVisible()
    await host.getByRole('button', { name: '4列3行 空き 合法手', exact: true }).click()
    await expect(guest.locator('.move-counter')).toHaveText('1 手')
    await guest.getByRole('button', { name: '3列3行 空き 合法手', exact: true }).click()
    await expect(host.locator('.move-counter')).toHaveText('2 手')
    // Reconnect from a fresh guest page while HTTP is still offline.
    await guest.reload()
    await expect(guest.getByText('オフライン利用可能', { exact: true })).toBeVisible()
    await choose(guest, 'オセロ', '近くの端末と対戦')
    await host.getByRole('button', { name: '接続情報を作り直す', exact: true }).click()
    await expect(output).toHaveValue(/^OBG1\./, { timeout: 30000 })
    await guest.getByRole('button', { name: '対戦に参加', exact: true }).click()
    await pasteSignal(guest, await output.inputValue())
    await expect(guest.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./, { timeout: 30000 })
    await pasteSignal(host, await guest.getByLabel('送信用接続テキスト').inputValue())
    await expect(host.getByText('● 接続完了', { exact: true })).toBeVisible({ timeout: 30000 })
    await expect(guest.locator('.move-counter')).toHaveText('2 手')
    await guest.getByRole('button', { name: '盤面を再同期', exact: true }).click()
    await expect(guest.getByText('盤面を再同期しました。', { exact: true })).toBeVisible()
    await host.getByRole('button', { name: '↻ リセット', exact: true }).click()
    await host.getByRole('button', { name: 'はい', exact: true }).click()
    await guest.getByRole('button', { name: '再戦を承認', exact: true }).click()
    await expect(host.locator('.move-counter')).toHaveText('0 手')
    await guest.getByRole('button', { name: '投了する', exact: true }).click()
    await guest.getByRole('button', { name: 'はい', exact: true }).click()
    await expect(host.getByText('黒の勝ち', { exact: true })).toBeVisible()
  } finally {
    await a.close()
    await b.close()
  }
})
test('broken local storage and invalid signaling remain recoverable', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.setItem('obg:settings', '{bad')
    localStorage.setItem('obg:game:shogi', '{bad')
    localStorage.setItem('obg:history', '{"bad":true}')
  })
  await page.reload()
  await choose(page, '将棋')
  await expect(page.getByRole('group', { name: '将棋の盤面', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '← ホーム', exact: true }).click()
  await choose(page, 'オセロ', '近くの端末と対戦')
  await page.getByRole('button', { name: '対戦に参加', exact: true }).click()
  await pasteSignal(page, 'not-a-signal')
  await expect(page.getByText(/接続テキストの形式または長さ/)).toBeVisible()
})

test('iPhone install instructions, standalone suppression and camera-denied fallback', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  try {
    await page.goto('http://127.0.0.1:4173/offline-board-games/')
    await expect(page.getByText('iPhone / iPadのインストール方法', { exact: true })).toBeVisible()
    await expect(page.getByText('共有ボタン（□↑）をタップ', { exact: true })).toBeVisible()
    await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/home-390-light.png', fullPage: true })
    await choose(page, '将棋')
    await page.screenshot({ path: 'test-results/shogi-390.png', fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: '← ホーム', exact: true }).click()
    await choose(page, 'オセロ', '近くの端末と対戦')
    await page.getByRole('button', { name: '対戦に参加', exact: true }).click()
    await page.getByRole('button', { name: '▣ QRを読み取る', exact: true }).click()
    await expect(page.getByText(/カメラを開始できません/)).toBeVisible()
    await page.getByRole('button', { name: 'カメラを閉じる', exact: true }).click()
    await pasteSignal(page, 'invalid')
    await expect(page.getByText(/接続テキストの形式または長さ/)).toBeVisible()
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'standalone', { get: () => true }),
    )
    await page.reload()
    await expect(page.getByRole('button', { name: /Offline Gamesをインストール/ })).toHaveCount(0)
  } finally {
    await context.close()
  }
})
