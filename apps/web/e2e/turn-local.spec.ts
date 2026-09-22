import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated turn-recovery.cjs fixture server')
const fixturePath = process.env.TURN_HTTP_FIXTURE || '/tmp/msm-phase1-local/turn-ui-fixture.json'
const fixture = () => JSON.parse(readFileSync(fixturePath, 'utf8')) as { token: string; userId: string; fixtures: { resultId: string; sessionId: string }[] }

async function openRoom(page: Page, index: number) {
  const { token, userId, fixtures } = fixture(), interview = fixtures[index]
  await page.addInitScript(({ token, userId, interview }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '恢复测试' }))
    if (!localStorage.getItem('interview-storage')) localStorage.setItem('interview-storage', JSON.stringify({ state: {
      sessionId: interview.sessionId, resultId: interview.resultId, interviewStatus: 'in_progress',
      selectedService: 'special', selectedPosition: { positionName: '前端开发工程师' }, messages: [],
    }, version: 0 }))
  }, { token, userId, interview })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '恢复测试' } } }))
  await page.goto(`/interview?serviceType=special&step=interview&resultId=${interview.resultId}`)
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByText('介绍一次你主导的项目改进。', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '文字回答', exact: true }).click()
  return interview
}

test('真实 SSE 已保存但响应丢失：同一请求重试只显示一轮，刷新可继续', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openRoom(page, 0)
  const sent: { requestId: string; expectedVersion: number }[] = []
  let loseResponse = true
  await page.route('**/api/sse-proxy*', async route => {
    sent.push(route.request().postDataJSON())
    if (loseResponse) { loseResponse = false; await route.fetch(); await route.abort('failed') }
    else await route.continue()
  })
  const input = page.getByLabel('你的回答')
  await input.fill('我给查询添加缓存，并记录 P95 延迟。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('回答尚未确认', { exact: true })).toBeVisible()
  await expect(input).toHaveValue('我给查询添加缓存，并记录 P95 延迟。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('如何验证改进效果？', { exact: true })).toHaveCount(1)
  await expect(input).toHaveValue('')
  expect(sent[0].requestId).toBe(sent[1].requestId)
  expect(sent[0].expectedVersion).toBe(0)
  await expect(page.getByText('我给查询添加缓存，并记录 P95 延迟。', { exact: true })).toHaveCount(1)
  await input.fill('刷新前尚未发送的草稿。')
  await page.reload()
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await page.getByRole('button', { name: '文字回答', exact: true }).click()
  await expect(page.getByLabel('你的回答')).toHaveValue('刷新前尚未发送的草稿。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByLabel('你的回答')).toHaveValue('')
  expect(sent[2].expectedVersion).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('无确认事件的流保留草稿与原问题，恢复后可重试', async ({ page }) => {
  await openRoom(page, 1)
  await page.route('**/api/sse-proxy*', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"question","content":"未保存的半截问题","isStreaming":true}\n\n' }))
  await page.getByLabel('你的回答').fill('网络异常时仍然保留的回答。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('回答尚未确认', { exact: true })).toBeVisible()
  await expect(page.getByText('未保存的半截问题', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('你的回答')).toHaveValue('网络异常时仍然保留的回答。')
  await page.getByRole('button', { name: '同步进度', exact: true }).click()
  await expect(page.getByText('已恢复面试', { exact: true })).toBeVisible()
  await page.unroute('**/api/sse-proxy*')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('如何验证改进效果？', { exact: true })).toBeVisible()
  await expect(page.getByLabel('你的回答')).toHaveValue('')
})

test('显式场次链接优先于旧会话，恢复弹窗支持键盘', async ({ page }) => {
  const { token, userId, fixtures } = fixture()
  const target = fixtures[2]
  await page.addInitScript(({ token, userId, old }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '恢复测试' }))
    localStorage.setItem('active-interview', JSON.stringify({ ...old, serviceType: 'special' }))
    localStorage.setItem('interview-storage', JSON.stringify({ state: { ...old, interviewStatus: 'in_progress', answerDraft: '另一场的草稿', selectedService: 'special', messages: [] }, version: 0 }))
  }, { token, userId, old: fixtures[0] })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '恢复测试' } } }))
  await page.goto(`/interview?serviceType=special&step=interview&restore=true&resultId=${target.resultId}`)
  const dialog = page.getByRole('dialog', { name: '回到这场面试' })
  await expect(dialog).toBeVisible()
  if (process.env.SESSION_SCREENSHOT) await page.screenshot({ path: process.env.SESSION_SCREENSHOT, fullPage: true })
  const resume = dialog.getByRole('button', { name: '继续面试' })
  await resume.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('介绍一次你主导的项目改进。', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(target.resultId))
  await page.getByRole('button', { name: '文字回答' }).click()
  await expect(page.getByLabel('你的回答')).toHaveValue('')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('interview-storage') || '{}').state.resultId)).toBe(target.resultId)
})
