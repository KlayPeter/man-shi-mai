import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
interface Fixture { token: string; user: { _id: string }; cases: Record<string, string> }
const fixturePath = process.env.REPORT_UI_FIXTURE
const fixture: Fixture | null = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) : null
test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1' || !fixture, 'Requires explicit local test fixture')
test.beforeEach(async ({ page, baseURL }) => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  await page.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('userInfo', JSON.stringify(user)) }, fixture!)
})
const route = (id: string) => `/interview/report?serviceType=special&resultId=${id}`

test('复盘引用能回到回答原文，手机无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(route(fixture!.cases.completed))
  await expect(page.getByRole('heading', { name: '你的下一步' })).toBeVisible()
  await expect(page.getByText('用具体数据说明优化结果。').first()).toBeVisible()
  await page.screenshot({ path: '/tmp/msm-phase1-local/report-mobile-top.png', fullPage: true })
  await page.getByRole('link', { name: '回看完整回答' }).first().click()
  await expect(page).toHaveURL(/#answer-1$/)
  await expect(page.locator('#answer-1')).toBeInViewport()
  await expect(page.getByRole('meter', { name: '表达结构' })).toHaveAttribute('aria-valuenow', '72')
  const secondQuestion = page.getByRole('link', { name: /第 2 题.*点击回看/ })
  await secondQuestion.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#answer-2 details')).toHaveAttribute('open', '')
  await expect(page.getByText('上线后观察了监控，但还没有比较相同流量下的数据。')).toBeVisible()
  await expect(page.locator('#answer-1 details')).not.toHaveAttribute('open', '')
  await page.getByText('完整分析 · 72 分 · 继续练习').click()
  await expect(page.getByText('评价标准：interview-evidence-v1', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/msm-phase1-local/report-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto(route(fixture!.cases.completed))
  await expect(page.getByRole('heading', { name: '本场路线' })).toBeVisible()
  await page.screenshot({ path: '/tmp/msm-phase1-local/report-visual-desktop.png', fullPage: true })
})

test('失败、未生成和无回答分别展示，原问答仍能阅读', async ({ page }) => {
  await page.goto(route(fixture!.cases.failed))
  await expect(page.getByRole('heading', { name: '报告尚未生成成功' })).toBeVisible()
  await expect(page.getByText('我通过增加缓存，把接口 P95 延迟从 800 毫秒降到 180 毫秒。')).toBeVisible()
  await expect(page.getByRole('button', { name: '重新生成复盘' })).toHaveCount(0)
  await page.goto(route(fixture!.cases.pending))
  await expect(page.getByRole('button', { name: '生成本场复盘' })).toBeVisible()
  await page.goto(route(fixture!.cases.empty))
  await expect(page.getByRole('heading', { name: '信息不足，暂不评分' })).toBeVisible()
  await expect(page.getByText('完整分析', { exact: false })).toHaveCount(0)
})

test('未知报告只请求一次，生成轮询在离开页面时停止', async ({ page }) => {
  let missingCalls = 0
  const missing = randomUUID()
  page.on('request', request => { if (request.url().endsWith(`/interview/mock/review/${missing}`)) missingCalls++ })
  await page.goto(route(missing))
  await expect(page.getByRole('alert').filter({ hasText: '没有找到这场面试' })).toBeVisible()
  await page.waitForTimeout(3300)
  expect(missingCalls).toBe(1)
  let generatingCalls = 0
  page.on('request', request => { if (request.url().endsWith(`/interview/mock/review/${fixture!.cases.generating}`)) generatingCalls++ })
  await page.goto(route(fixture!.cases.generating))
  await expect(page.getByRole('heading', { name: '正在分析本场回答' })).toBeVisible()
  await page.getByRole('link', { name: '练习记录', exact: true }).last().click()
  const stoppedAt = generatingCalls
  await page.waitForTimeout(3300)
  expect(generatingCalls).toBe(stoppedAt)
})
