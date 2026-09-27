import { test, expect, type Page } from '@playwright/test'
const url = 'http://127.0.0.1:4173/offline-board-games/'
async function paste(page: Page, signal: string) {
  const details = page
    .locator('details')
    .filter({ has: page.getByText('テキストで接続する', { exact: true }) })
  if (!(await details.getAttribute('open'))) {
    if (await details.evaluate((e) => !(e as HTMLDetailsElement).open))
      await details.locator('summary').click()
  }
  await page.getByLabel('相手の接続テキストを貼り付け').fill(signal)
  await page.getByRole('button', { name: '接続情報を読み込む', exact: true }).click()
}
async function select(page: Page, name: string, nearby = false, n = 3) {
  await page.getByRole('button', { name: `${name}を選ぶ`, exact: true }).click()
  await page.getByLabel('プレイヤー人数').selectOption(String(n))
  await page
    .getByRole('button', { name: new RegExp(nearby ? '^近くの端末と対戦' : `^この端末で${n}人`) })
    .click()
}
test('人数と名前でゲームを探し、前回の人数・ローカルルールを引き継ぐ', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(url)
  await page.getByRole('combobox', { name: '遊ぶ人数', exact: true }).selectOption('7')
  await expect(page.getByRole('button', { name: 'オセロを選ぶ', exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'マンカラ（カラハ）を選ぶ', exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('ゲームを探す', { exact: true }).fill('大富豪')
  await expect(page.locator('.game-card')).toHaveCount(1)
  await page.getByRole('button', { name: '大富豪を選ぶ', exact: true }).click()
  await page.getByLabel('プレイヤー人数').selectOption('7')
  await page.getByRole('checkbox', { name: /11バック/ }).uncheck()
  await page.getByRole('button', { name: /^この端末で7人/ }).click()
  await page.getByRole('button', { name: '← ホーム', exact: true }).click()
  await page.getByRole('button', { name: 'はい', exact: true }).click()
  await page.getByRole('button', { name: '大富豪を選ぶ', exact: true }).click()
  await expect(page.getByLabel('プレイヤー人数')).toHaveValue('7')
  await expect(page.getByRole('checkbox', { name: /11バック/ })).not.toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('全15追加ゲームを320pxでオフライン起動し、手札を安全に受け渡す', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(url)
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  for (const name of [
    '大富豪',
    '七並べ',
    'ババ抜き',
    'ジジ抜き',
    'ダウト',
    'クレイジーエイト',
    'ゴーフィッシュ',
    '神経衰弱',
    'ハーツ',
    'ピッグ・ダイス',
    'ドット＆ボックス',
    'マンカラ（カラハ）',
    '石取り（ニム）',
    'ドミノ',
    'ヨット・ダイス',
  ]) {
    await select(page, name, false, name === 'マンカラ（カラハ）' ? 2 : 3)
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    if (await page.getByRole('button', { name: '自分の手札を表示' }).count()) {
      await expect(page.locator('.hand-area')).toHaveCount(0)
      await page.getByRole('button', { name: '自分の手札を表示' }).click()
      await expect(page.locator('.hand-area')).toBeVisible()
      if (name === '七並べ') {
        await page.getByRole('button', { name: 'パス', exact: true }).click()
        await expect(page.locator('.privacy-cover')).toBeVisible()
        await expect(page.locator('.hand-area')).toHaveCount(0)
      }
      if (name === '大富豪') {
        await page.locator('.hand-area .playing-card').first().click()
        await page.getByRole('button', { name: /選んだ1枚を出す/ }).click()
        await expect(page.locator('.game-title')).toContainText('1 手')
      }
    }
    if (name === '神経衰弱') {
      await page.getByRole('button', { name: 'カード1をめくる', exact: true }).click()
      await page.getByRole('button', { name: 'カード2をめくる', exact: true }).click()
      await page.getByRole('button', { name: '確認して次へ' }).click()
    }
    if (name === 'ピッグ・ダイス')
      await page.getByRole('button', { name: 'サイコロを振る' }).click()
    if (name === 'ドット＆ボックス')
      await page.getByRole('button', { name: '辺1', exact: true }).click()
    if (name === 'マンカラ（カラハ）')
      await page.getByRole('button', { name: 'プレイヤー1の穴3 石4個', exact: true }).click()
    if (name === '石取り（ニム）') {
      await page.getByRole('button', { name: /山1・1個/ }).click()
      await page.getByRole('button', { name: 'この山から取る', exact: true }).click()
    }
    if (name === 'ドミノ') {
      await page.locator('.hand-area .domino-tile').first().click()
      await page.getByRole('button', { name: 'タイルを置く', exact: true }).click()
    }
    if (name === 'ヨット・ダイス') {
      await page.getByRole('button', { name: '5個のサイコロを振る', exact: true }).click()
      await page.getByRole('button', { name: /サイコロ1 .*を残す/ }).click()
      await page
        .getByRole('button', { name: '選んでいないサイコロを振り直す', exact: true })
        .click()
      await page.getByRole('button', { name: /チョイス.*点/ }).click()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/party-${name}-320.png`, fullPage: true })
    await page.getByRole('button', { name: '← ホーム', exact: true }).click()
    await page.getByRole('button', { name: 'はい', exact: true }).click()
  }
  expect(errors).toEqual([])
})
test('持ち時間の選択、加算、秒読み、時計開始と交代', async ({ page }) => {
  await page.goto(url)
  await page.getByRole('button', { name: '将棋を選ぶ', exact: true }).click()
  await page.getByRole('button', { name: '10分＋秒読み30秒', exact: true }).click()
  await expect(page.getByLabel('使い切った後の秒読み')).toHaveValue('30')
  await page.getByRole('button', { name: '5分＋3秒', exact: true }).click()
  await page.getByRole('button', { name: /^この端末で2人/ }).click()
  await expect(page.getByRole('button', { name: '1列7行 先手の歩', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '時計を開始して対局' }).click()
  await page.getByRole('button', { name: '1列7行 先手の歩', exact: true }).click()
  await page.getByRole('button', { name: '1列6行 空き 合法手', exact: true }).click()
  await expect(page.locator('.clock.active')).toContainText('後手')
  await expect(page.locator('.move-counter')).toHaveText('1 手')
  await page.screenshot({ path: 'test-results/shogi-clock.png', fullPage: true })
})
test('通信対局の時計はホストで進み、時刻の異なる参加側も手番・期限を同期', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]),
    [host, guest] = await Promise.all(contexts.map((c) => c.newPage()))
  try {
    for (const p of [host, guest]) {
      await p.goto(url)
      await p.getByRole('button', { name: 'オセロを選ぶ', exact: true }).click()
      if (p === host) await p.getByLabel('1人の持ち時間').selectOption('1')
      await p.getByRole('button', { name: /^近くの端末と対戦/ }).click()
    }
    await host.clock.install({ time: new Date('2026-09-27T00:00:00Z') })
    await guest.clock.install({ time: new Date('2026-09-27T02:00:00Z') })
    await host.getByRole('button', { name: '対戦を作成', exact: true }).click()
    await expect(host.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
    await guest.getByRole('button', { name: '対戦に参加', exact: true }).click()
    await paste(guest, await host.getByLabel('送信用接続テキスト').inputValue())
    await expect(guest.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
    await paste(host, await guest.getByLabel('送信用接続テキスト').inputValue())
    await expect(host.getByText('● 接続完了', { exact: true })).toBeVisible()
    await expect(guest.locator('.clock.active')).toContainText('黒')
    await host.clock.fastForward(10000)
    await expect(host.getByLabel('黒 残り時間')).toHaveText(/0:(?:[0-4]\d|50)/)
    await host.getByRole('button', { name: '4列3行 空き 合法手', exact: true }).click()
    await expect(guest.locator('.clock.active')).toContainText('白')
    await host.clock.fastForward(61000)
    await expect(host.getByText('黒の勝ち', { exact: true })).toBeVisible()
    await expect(guest.getByText('黒の勝ち', { exact: true })).toBeVisible()
  } finally {
    for (const c of contexts) await c.close()
  }
})
test('7実ブラウザを外部HTTP遮断で接続、各自の手札、差分、席ごとの再接続、全員再戦', async ({
  browser,
}) => {
  test.setTimeout(180000)
  const contexts = await Promise.all(
      Array.from({ length: 7 }, () =>
        browser.newContext({ viewport: { width: 390, height: 844 } }),
      ),
    ),
    pages = await Promise.all(contexts.map((c) => c.newPage())),
    errors: string[] = []
  try {
    for (const p of pages) {
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto(url)
      await expect(p.getByText('オフライン利用可能', { exact: true })).toBeVisible()
      await select(p, '七並べ', true, 7)
    }
    for (const c of contexts) await c.route(/^https?:\/\//, (r) => r.abort('internetdisconnected'))
    const host = pages[0]
    await host.getByRole('button', { name: '対戦を作成', exact: true }).click()
    for (let i = 1; i < 7; i++) {
      await host.getByLabel('接続する相手の席').selectOption(String(i))
      await host.getByRole('button', { name: 'この席の接続情報を作る', exact: true }).click()
      await expect(host.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
      await pages[i].getByRole('button', { name: '対戦に参加', exact: true }).click()
      await paste(pages[i], await host.getByLabel('送信用接続テキスト').inputValue())
      await expect(pages[i].getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
      await paste(host, await pages[i].getByLabel('送信用接続テキスト').inputValue())
      await expect(host.locator('.seat-list li').nth(i)).toContainText('接続済み')
    }
    await host.getByRole('button', { name: '全員でゲーム開始' }).click()
    for (let i = 0; i < 7; i++)
      await expect(
        pages[i].getByRole('heading', { name: new RegExp(`^プレイヤー${i + 1}の手札`) }),
      ).toBeVisible()
    const hands = await Promise.all(
      pages.map((p) => p.locator('.hand-area .playing-card').allTextContents()),
    )
    expect(new Set(hands.flat()).size).toBe(hands.flat().length)
    await host.getByRole('button', { name: 'パス', exact: true }).click()
    await expect(pages[1].locator('.game-title')).toContainText('1 手')
    await pages[1].getByRole('button', { name: 'パス', exact: true }).click()
    for (const p of pages) await expect(p.locator('.game-title')).toContainText('2 手')
    await pages[2].reload()
    await select(pages[2], '七並べ', true, 7)
    await host.getByLabel('接続する相手の席').selectOption('2')
    await host.getByRole('button', { name: /この席の接続(情報を作る|を作り直す)/ }).click()
    await expect(host.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
    await pages[2].getByRole('button', { name: '対戦に参加', exact: true }).click()
    await paste(pages[2], await host.getByLabel('送信用接続テキスト').inputValue())
    await expect(pages[2].getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
    await paste(host, await pages[2].getByLabel('送信用接続テキスト').inputValue())
    await expect(pages[2].locator('.game-title')).toContainText('2 手')
    expect(await pages[2].locator('.hand-area .playing-card').allTextContents()).toEqual(hands[2])
    await pages[2].getByRole('button', { name: '盤面を再同期', exact: true }).click()
    for (const p of pages) {
      await p.getByRole('button', { name: '再戦・リセット', exact: true }).click()
      await p.getByRole('button', { name: 'はい', exact: true }).click()
    }
    for (const p of pages) await expect(p.locator('.game-title')).toContainText('0 手')
    expect(errors).toEqual([])
  } finally {
    for (const c of contexts) await c.close()
  }
})
