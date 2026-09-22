import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated Mongo/HTTP fixture')
const fixture = () => JSON.parse(readFileSync(process.env.START_FIXTURE_PATH || '/tmp/msm-phase1-local/preparation-fixture.json', 'utf8')) as { token: string; userId: string }

test('窄屏候场选择强度并刷新保留，未正式开始不扣次', async ({ page }) => {
  const { token, userId } = fixture()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '流程测试', specialRemainingCount: 1 }))
  }, { token, userId })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '流程测试', specialRemainingCount: 1 } } }))
  await page.route('**/dev-api/resume/getInterviewResumeList', route => route.fulfill({ json: { code: 200, data: [] } }))
  let started = false
  page.on('request', request => { if (request.url().includes('/api/sse-proxy') && request.url().includes('start')) started = true })
  await page.goto('/interview/start')
  await page.getByLabel('搜索目标岗位').fill('前端')
  await page.locator('button[aria-pressed]').filter({ hasText: '前端开发工程师' }).first().click()
  await page.getByRole('button', { name: '准备好了，去候场' }).click()
  await page.getByRole('button', { name: /^挑战 · 45 分钟/ }).click()
  await expect(page.getByRole('button', { name: /^挑战 · 45 分钟/ })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: /^挑战 · 45 分钟/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(started).toBe(false)
})

for (const denyMicrophone of [false, true]) test(`准备到复盘完整链路（${denyMicrophone ? '拒绝麦克风' : '试音后文字'}）`, async ({ page }) => {
  const { token, userId } = fixture()
  await page.addInitScript(({ token, userId, denyMicrophone }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '流程测试', specialRemainingCount: 3 }))
    if (denyMicrophone) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) })
  }, { token, userId, denyMicrophone })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '流程测试', specialRemainingCount: 3 } } }))
  let resumeUnavailable = true
  await page.route('**/dev-api/resume/getInterviewResumeList', route => {
    if (resumeUnavailable) { return route.fulfill({ status: 503, json: { code: 503, message: 'synthetic' } }) }
    return route.fulfill({ json: { code: 200, data: [] } })
  })
  const starts: string[] = []
  const answers: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/sse-proxy')) {
      if (request.url().includes('mock%2Fstart') || request.url().includes('mock/start')) starts.push(request.postData() || '')
      else if (request.url().includes('answer')) answers.push(request.postData() || '')
    }
  })
  await page.goto('/interview/start')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('button', { name: '准备好了，去候场' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '重试加载简历' })).toBeVisible()
  resumeUnavailable = false
  await page.getByRole('button', { name: '重试加载简历' }).click()
  await expect(page.getByText('还没有简历？也可以直接练习')).toBeVisible()
  await page.getByLabel('搜索目标岗位').fill('前端')
  const position = page.locator('button[aria-pressed]').filter({ hasText: '前端开发工程师' }).first()
  await position.focus(); await page.keyboard.press('Enter')
  await page.getByText('补充目标公司 / 岗位要求（可选）', { exact: true }).click()
  await page.getByLabel('目标公司', { exact: true }).fill('合成测试公司')
  await page.getByLabel('岗位要求（JD）', { exact: true }).fill('开发与性能优化')
  await page.getByRole('button', { name: '准备好了，去候场' }).click()
  const intensity = denyMicrophone ? '挑战' : '热身'
  const duration = denyMicrophone ? 45 : 15
  const intensityValue = denyMicrophone ? 'challenge' : 'warmup'
  await page.getByRole('button', { name: new RegExp(`^${intensity} · ${duration} 分钟`) }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${intensity} · ${duration} 分钟`) })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: '深呼吸，准备开口。' })).toBeVisible()
  expect(starts).toHaveLength(0)
  await page.getByRole('link', { name: '返回准备' }).click()
  await expect(page.getByLabel('目标公司', { exact: true })).toHaveValue('合成测试公司')
  await expect(position).toHaveAttribute('aria-pressed', 'true')
  if (process.env.PREPARATION_SCREENSHOT && !denyMicrophone) await page.screenshot({ path: process.env.PREPARATION_SCREENSHOT, fullPage: true })
  await page.getByRole('button', { name: '准备好了，去候场' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${intensity} · ${duration} 分钟`) })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '试一下麦克风' }).click()
  if (denyMicrophone) await expect(page.getByRole('alert').filter({ hasText: '麦克风未获授权' })).toBeVisible()
  else {
    await expect(page.getByRole('button', { name: '停止并回听' })).toBeVisible()
    await page.waitForTimeout(1100)
    await page.getByRole('button', { name: '停止并回听' }).click()
    await expect(page.getByLabel('试音回放')).toBeVisible()
  }
  await page.getByRole('button', { name: '文字面试', exact: true }).click()
  expect(starts).toHaveLength(0)
  if (process.env.LOBBY_SCREENSHOT && !denyMicrophone) await page.screenshot({ path: process.env.LOBBY_SCREENSHOT, fullPage: true })
  await page.getByRole('button', { name: '正式开始面试', exact: true }).click()
  await expect(page.getByText('请介绍一次你主导的项目。', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(`${intensity} · ${duration} 分钟上限`, { exact: false })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '文字回答', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('你的回答').fill('我为查询加了缓存，并记录 P95 延迟。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('如何验证改进效果？', { exact: true })).toBeVisible()
  await page.getByLabel('你的回答').fill('暂停前保留的草稿')
  await page.getByRole('button', { name: '暂停面试', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已暂停' })).toBeVisible()
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByLabel('你的回答')).toHaveValue('暂停前保留的草稿')
  await page.reload()
  await page.getByRole('dialog').getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByLabel('你的回答')).toHaveValue('暂停前保留的草稿')
  await page.getByLabel('你的回答').fill('我用相同流量的压测对比 P95 延迟。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('如果流量继续增加，你会如何调整？', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '结束面试', exact: true }).click()
  await page.getByRole('button', { name: '查看报告', exact: true }).click()
  await expect(page.getByRole('button', { name: '生成本场复盘' })).toBeVisible()
  await page.getByRole('button', { name: '生成本场复盘' }).click()
  await expect(page.getByText('补充你如何验证改进。', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  expect(starts).toHaveLength(1)
  expect(answers).toHaveLength(2)
  const start = JSON.parse(starts[0])
  expect(start.positionName).toBe('前端开发工程师')
  expect(start.company).toBe('合成测试公司')
  expect(start.jd).toBe('开发与性能优化')
  expect(start.resumeId).toBeUndefined()
  expect(start.practiceIntensity).toBe(intensityValue)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
