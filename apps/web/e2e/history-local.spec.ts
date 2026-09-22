import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
interface Fixture { token: string; user: { _id: string }; cases: Record<string, { first: string; completed: string }> }
const fixturePath = process.env.HISTORY_UI_FIXTURE
const fixture: Fixture | null = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) : null
test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1' || !fixture, 'Requires explicit local test fixture')
test.beforeEach(async ({ page, baseURL }) => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  await page.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('userInfo', JSON.stringify(user)) }, fixture!)
})

test('真实分页、图形状态与复盘入口；手机和桌面布局', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/history')
  await expect(page.getByText('23 场记录')).toBeVisible()
  await expect(page.getByRole('link', { name: '查看押题' })).toHaveCount(10)
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByRole('heading', { name: '押题 · 合成测试 13', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByRole('link', { name: '查看押题' })).toHaveCount(3)
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled()
  await page.getByRole('button', { name: '专项面试', exact: true }).click()
  await expect(page.getByRole('heading', { name: '前端开发 · 合成测试 23', exact: true })).toBeVisible()
  await expect(page.getByText('已暂停', { exact: true })).toBeVisible()
  await expect(page.getByText('进行中', { exact: true })).toBeVisible()
  await expect(page.getByText('已中止', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '查看问答', exact: true })).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/msm-phase1-local/history-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: '/tmp/msm-phase1-local/history-desktop.png', fullPage: false })
  const reviewLink = page.locator(`a[href*="${fixture!.cases.special.completed}"]`)
  await reviewLink.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/interview/report\\?serviceType=special&resultId=${fixture!.cases.special.completed}`))
  await expect(page.getByRole('heading', { name: '本场练习复盘' })).toBeVisible()
})

test('网络失败可重试，切换类型取消慢请求，不让旧记录覆盖', async ({ page }) => {
  let fail = true
  await page.route('**/dev-api/interview/resume/quiz/history*', async route => {
    if (fail) await route.fulfill({ status: 503, json: { message: 'Local deliberate outage' } })
    else await route.continue()
  })
  await page.goto('/history')
  await expect(page.getByRole('alert').filter({ hasText: '记录暂时没有加载成功' })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: '重新加载' }).click()
  await expect(page.getByText('23 场记录')).toBeVisible()
  let release: (() => void) | undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/dev-api/interview/special/history*', async route => { await gate; await route.continue().catch(() => undefined) })
  const slowRequest = page.waitForRequest('**/dev-api/interview/special/history*')
  await page.getByRole('button', { name: '专项面试', exact: true }).click()
  await slowRequest
  await page.getByRole('button', { name: '行测 + HR', exact: true }).click()
  await expect(page.getByRole('heading', { name: '行为面试 · 合成测试 23', exact: true })).toBeVisible()
  release!()
  await expect(page.getByRole('heading', { name: /前端开发 · 合成测试/ })).toHaveCount(0)
})
