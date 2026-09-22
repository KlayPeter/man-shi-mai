import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated start-recovery.cjs fixture server')
const fixture = () => JSON.parse(readFileSync('/tmp/msm-phase1-local/start-ui-fixture.json', 'utf8')) as { token: string; userId: string }

test('开场响应丢失后刷新：保留同一请求，恢复开场且不重复创建', async ({ page }) => {
  const { token, userId } = fixture()
  const requestId = randomUUID()
  await page.addInitScript(({ token, userId, requestId }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '开场测试' }))
    if (!localStorage.getItem('interview-storage')) localStorage.setItem('interview-storage', JSON.stringify({ state: {
      selectedService: 'special', selectedPosition: { positionName: '前端工程师' }, messages: [], interviewStatus: 'starting',
      pendingStart: { requestId, interviewType: 'special', positionName: '前端工程师', company: '', jd: '' },
    }, version: 0 }))
  }, { token, userId, requestId })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '开场测试' } } }))
  const requests: string[] = []
  let lose = true
  await page.route('**/api/sse-proxy*', async route => {
    requests.push(route.request().postDataJSON().requestId)
    if (lose) { lose = false; await route.fetch(); await route.abort('failed') }
    else await route.continue()
  })
  await page.goto('/interview?serviceType=special&step=interview')
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByRole('button', { name: '重试开始', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByText('请介绍一次你主导的项目。', { exact: true })).toHaveCount(1)
  expect(requests).toEqual([requestId, requestId])
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('interview-storage') || '{}').state.pendingStart)).toBe(null)
  await page.getByRole('button', { name: '文字回答', exact: true }).click()
  await expect(page.getByLabel('你的回答')).toBeEnabled()
})

test('零次数开始明确失败，取消后回准备页', async ({ page }) => {
  const { token, userId } = fixture()
  await page.addInitScript(({ token, userId, requestId }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '开场测试' }))
    localStorage.setItem('interview-storage', JSON.stringify({ state: {
      selectedService: 'behavior', selectedPosition: { positionName: '前端工程师' }, messages: [], interviewStatus: 'starting',
      pendingStart: { requestId, interviewType: 'behavior', positionName: '前端工程师', company: '', jd: '' },
    }, version: 0 }))
  }, { token, userId, requestId: randomUUID() })
  await page.route('**/dev-api/user/**', route => route.fulfill({ json: { code: 200, data: { _id: userId, username: '开场测试' } } }))
  await page.goto('/interview?serviceType=behavior&step=interview')
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByText('权益或小麦币余额不足，本次未扣减', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '取消开始', exact: true }).click()
  await expect(page).toHaveURL(/\/interview\/start/)
})
