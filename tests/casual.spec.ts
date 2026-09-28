import { test, expect, type Page } from '@playwright/test'
const url = 'http://127.0.0.1:4173/offline-board-games/'
async function start(p: Page, name: string, n: number, nearby = false) {
  await p.getByRole('button', { name: `${name}を選ぶ`, exact: true }).click()
  await p.getByLabel('プレイヤー人数').selectOption(String(n))
  await p
    .getByRole('button', { name: new RegExp(nearby ? '^近くの端末と対戦' : `^この端末で${n}人`) })
    .click()
}
async function uncover(p: Page) {
  const button = p.getByRole('button', { name: '自分の画面を表示', exact: true })
  if (await button.count()) await button.click()
}
async function paste(p: Page, signal: string) {
  const details = p
    .locator('details')
    .filter({ has: p.getByText('テキストで接続する', { exact: true }) })
  if (await details.evaluate((e) => !(e as HTMLDetailsElement).open))
    await details.locator('summary').click()
  await p.getByLabel('相手の接続テキストを貼り付け').fill(signal)
  await p.getByRole('button', { name: '接続情報を読み込む', exact: true }).click()
}
test('麻雀・推理ゲームを320pxでオフライン操作し、会話と秘密投票を1台で完了', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(url)
  await expect(page.getByText('25 / 25 GAMES', { exact: true })).toBeVisible()
  await expect(page.getByText('オフライン利用可能', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  for (const name of ['かんたん麻雀', 'ヒット＆ブロー', 'ワードウルフ']) {
    await start(page, name, name === 'かんたん麻雀' ? 4 : 3)
    await uncover(page)
    if (name === 'かんたん麻雀') {
      await expect(page.locator('.hand-area .mahjong-tile')).toHaveCount(14)
      await page.screenshot({ path: 'test-results/casual-mahjong-hand-320.png', fullPage: true })
      await page.locator('.hand-area .mahjong-tile').first().click()
      await page.getByRole('button', { name: /を捨てる$/ }).click()
      await expect(page.locator('.privacy-cover')).toBeVisible()
    }
    if (name === 'ヒット＆ブロー') {
      for (const n of ['1', '2', '3'])
        await page.getByRole('button', { name: n, exact: true }).click()
      await page.getByRole('button', { name: 'この並びで予想する', exact: true }).click()
      await expect(page.locator('.guess-history li')).toHaveCount(1)
    }
    if (name === 'ワードウルフ') {
      for (let i = 0; i < 3; i++) {
        await uncover(page)
        await expect(page.locator('.secret-prompt')).toBeVisible()
        await page.getByRole('button', { name: 'お題を覚えた', exact: true }).click()
      }
      await expect(page.getByRole('heading', { name: 'みんなで話そう', exact: true })).toBeVisible()
      await expect(page.locator('.secret-prompt')).toHaveCount(0)
      await page.getByRole('button', { name: '相談を終えて投票へ', exact: true }).click()
      await expect(page.locator('.privacy-cover')).toBeVisible()
      for (const target of [2, 3, 1]) {
        await uncover(page)
        await page.getByRole('button', { name: `プレイヤー${target}`, exact: true }).click()
        await page.getByRole('button', { name: 'この人に投票する', exact: true }).click()
      }
      await expect(page.locator('.result-list li')).toHaveCount(3)
      await page.getByRole('button', { name: '最終結果を見る', exact: true }).click()
      await expect(page.locator('.turn-panel')).toContainText('ゲーム終了')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/casual-${name}-320.png`, fullPage: true })
    await page.getByRole('button', { name: '← ホーム', exact: true }).click()
    await page.getByRole('button', { name: 'はい', exact: true }).click()
  }
  expect(errors).toEqual([])
})

for (const [name, n] of [
  ['かんたん麻雀', 4],
  ['ワードウルフ', 3],
] as const) {
  test(`${name}を外部HTTP遮断の${n}ブラウザで対戦し秘密情報を確認`, async ({ browser }) => {
    test.setTimeout(120000)
    const contexts = await Promise.all(
      Array.from({ length: n }, () =>
        browser.newContext({ viewport: { width: 390, height: 844 } }),
      ),
    )
    const pages = await Promise.all(contexts.map((c) => c.newPage())),
      errors: string[] = []
    try {
      for (const p of pages) {
        p.on('pageerror', (e) => errors.push(e.message))
        await p.goto(url)
        await expect(p.getByText('オフライン利用可能', { exact: true })).toBeVisible()
        await start(p, name, n, true)
      }
      for (const c of contexts)
        await c.route(/^https?:\/\//, (route) => route.abort('internetdisconnected'))
      const host = pages[0]
      await host.getByRole('button', { name: '対戦を作成', exact: true }).click()
      for (let i = 1; i < n; i++) {
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
      if (name === 'かんたん麻雀') {
        for (let i = 0; i < n; i++) {
          await expect(
            pages[i].getByRole('heading', { name: `プレイヤー${i + 1}の手牌`, exact: true }),
          ).toBeVisible()
          await expect(pages[i].locator('.hand-area .mahjong-tile')).toHaveCount(i ? 13 : 14)
          await expect(pages[i].locator('.drawn-tile')).toHaveCount(i ? 0 : 1)
        }
        for (let i = 0; i < 2; i++) {
          await pages[i].locator('.hand-area .mahjong-tile').first().click()
          await pages[i].getByRole('button', { name: /を捨てる$/ }).click()
          for (const p of pages)
            await expect(p.locator('.mahjong-river .mahjong-tile')).toHaveCount(i + 1)
        }
        await host.screenshot({ path: 'test-results/casual-mahjong-network.png', fullPage: true })
      } else {
        for (let i = 0; i < n; i++) {
          await expect(pages[i].locator('.secret-prompt')).toBeVisible()
          for (let j = 0; j < n; j++)
            if (j !== i) await expect(pages[j].locator('.secret-prompt')).toHaveCount(0)
          await pages[i].getByRole('button', { name: 'お題を覚えた', exact: true }).click()
        }
        await host.getByRole('button', { name: '相談を終えて投票へ', exact: true }).click()
        for (let i = 0; i < n; i++) {
          await pages[i]
            .getByRole('button', { name: `プレイヤー${((i + 1) % n) + 1}`, exact: true })
            .click()
          await pages[i].getByRole('button', { name: 'この人に投票する', exact: true }).click()
          if (i < n - 1)
            for (const p of pages) await expect(p.locator('.result-list')).toHaveCount(0)
        }
        for (const p of pages) await expect(p.locator('.result-list li')).toHaveCount(n)
        await pages[2].getByRole('button', { name: '最終結果を見る', exact: true }).click()
        for (const p of pages) await expect(p.locator('.turn-panel')).toContainText('ゲーム終了')
      }
      expect(errors).toEqual([])
    } finally {
      for (const c of contexts) await c.close()
    }
  })
}
