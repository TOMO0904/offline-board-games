import { test, expect, type Page } from '@playwright/test'
async function start(page: Page, name: string, n = 2, nearby = false) {
  await page.getByRole('button', { name: `${name}を選ぶ`, exact: true }).click()
  await page.getByLabel('プレイヤー人数').selectOption(String(n))
  await page
    .getByRole('button', { name: new RegExp(nearby ? '^近くの端末と対戦' : `^この端末で${n}人`) })
    .click()
}
async function paste(page: Page, signal: string) {
  const details = page
    .locator('details')
    .filter({ has: page.getByText('テキストで接続する', { exact: true }) })
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator('summary').click()
  await page.getByLabel('相手の接続テキストを貼り付け').fill(signal)
  await page.getByRole('button', { name: '接続情報を読み込む', exact: true }).click()
}
test('25ゲームへの整理と320pxで経営2ゲームをオフライン終局まで操作', async ({ page, context }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('./')
  await expect(page.getByText('25 / 25 GAMES', { exact: true })).toBeVisible()
  for (const name of [
    'ハイ＆ロー',
    'ひみつじゃんけん',
    '21カウント',
    'ジェスチャー',
    '数字の地雷',
    '三目並べ',
  ])
    await expect(page.getByRole('button', { name: `${name}を選ぶ`, exact: true })).toHaveCount(0)
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  for (const name of ['ライフジャーニー', 'アイランド商会']) {
    await start(page, name)
    await expect(page.locator('.economy-board')).toBeVisible()
    await page.screenshot({ path: `test-results/economy-${name}-320.png`, fullPage: true })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.screenshot({ path: `test-results/economy-${name}-dark.png`, fullPage: true })
    await page.emulateMedia({ colorScheme: 'light' })
    for (let step = 0; step < 250 && !(await page.locator('.economy-finish').count()); step++) {
      const choices = page.locator('.economy-choices button:enabled')
      if (name === 'ライフジャーニー') {
        const roll = page.getByRole('button', { name: '⚄ サイコロを振る', exact: true })
        if (await choices.count()) await choices.first().click()
        else if (await roll.count()) await roll.click()
        else await page.getByRole('button', { name: '確認して次の人へ', exact: true }).click()
      } else {
        if (step === 0) await page.getByRole('button', { name: /^農園 / }).click()
        else await page.getByRole('button', { name: '残りの行動を終える', exact: true }).click()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await expect(page.locator('.economy-finish')).toBeVisible()
    await page.screenshot({ path: `test-results/economy-${name}-result.png`, fullPage: true })
    await page.getByRole('button', { name: '← ホーム', exact: true }).click()
    await page.getByRole('button', { name: 'はい', exact: true }).click()
  }
  expect(errors).toEqual([])
})
for (const name of ['ライフジャーニー', 'アイランド商会'])
  test(`${name}を3端末でHTTP遮断後に対戦・資産同期・全員再戦`, async ({ browser }) => {
    test.setTimeout(120000)
    const contexts = await Promise.all(
      Array.from({ length: 3 }, () =>
        browser.newContext({ viewport: { width: 390, height: 844 } }),
      ),
    )
    const pages = await Promise.all(contexts.map((c) => c.newPage())),
      errors: string[] = []
    try {
      for (const page of pages) {
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto('./')
        await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
        await start(page, name, 3, true)
      }
      for (const c of contexts)
        await c.route(/^https?:\/\//, (r) => r.abort('internetdisconnected'))
      const host = pages[0]
      await host.getByRole('button', { name: '対戦を作成', exact: true }).click()
      for (let i = 1; i < 3; i++) {
        await host.getByLabel('接続する相手の席').selectOption(String(i))
        await host.getByRole('button', { name: 'この席の接続情報を作る', exact: true }).click()
        await expect(host.getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
        await pages[i].getByRole('button', { name: '対戦に参加', exact: true }).click()
        await paste(pages[i], await host.getByLabel('送信用接続テキスト').inputValue())
        await expect(pages[i].getByLabel('送信用接続テキスト')).toHaveValue(/^OBG1\./)
        await paste(host, await pages[i].getByLabel('送信用接続テキスト').inputValue())
        await expect(host.locator('.seat-list li').nth(i)).toContainText('接続済み')
      }
      await host.getByRole('button', { name: '全員でゲーム開始', exact: true }).click()
      for (const p of pages) await expect(p.locator('.economy-board')).toBeVisible()
      if (name === 'ライフジャーニー') {
        await host.getByRole('button', { name: /^進学して専門職へ/ }).click()
        for (const p of pages)
          await expect(p.locator('.journey-banner')).toContainText('エンジニア')
        await expect(
          pages[1].getByRole('button', { name: '⚄ サイコロを振る', exact: true }),
        ).toBeDisabled()
        await host.getByRole('button', { name: '⚄ サイコロを振る', exact: true }).click()
        const choices = host.locator('.economy-choices button:enabled')
        if (await choices.count()) await choices.first().click()
        await host.getByRole('button', { name: '確認して次の人へ', exact: true }).click()
        await pages[1].getByRole('button', { name: /^すぐに就職/ }).click()
      } else {
        await host.getByRole('button', { name: /^農園 / }).click()
        for (const p of pages)
          await expect(p.getByRole('button', { name: /^農園 / })).toContainText('1棟')
        await host.getByRole('button', { name: '残りの行動を終える', exact: true }).click()
        await pages[1].getByRole('button', { name: '木材を売る', exact: true }).click()
      }
      const expected = await host.locator('.party-scores').innerText()
      for (const p of pages.slice(1))
        await expect
          .poll(async () =>
            (await p.locator('.party-scores').innerText()).replaceAll('（あなた）', ''),
          )
          .toBe(expected.replaceAll('（あなた）', ''))
      await Promise.all(
        pages.map(async (p) => {
          await p.getByRole('button', { name: '再戦・リセット', exact: true }).click()
          await p.getByRole('button', { name: 'はい', exact: true }).click()
        }),
      )
      for (const p of pages) await expect(p.locator('.game-title')).toContainText('0 手')
      expect(errors).toEqual([])
    } finally {
      for (const c of contexts) await c.close()
    }
  })
