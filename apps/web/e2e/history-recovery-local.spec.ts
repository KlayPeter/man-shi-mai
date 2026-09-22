import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated history recovery fixture')
test('无本地草稿仍能取消未完成开场，处理中明确失败并允许重试', async ({ page }) => {
  const { token, userId, pendingIds } = JSON.parse(readFileSync('/tmp/msm-phase1-local/history-recovery-fixture.json', 'utf8')) as { token: string; userId: string; pendingIds: string[] }
  await page.addInitScript(({ token, userId }) => {
    localStorage.clear()
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '恢复测试' }))
  }, { token, userId })
  await page.route('**/dev-api/interview/resume/quiz/history*', route => route.fulfill({ json: { code: 200, data: { list: [], total: 0 } } }))
  await page.goto('/history')
  await page.getByRole('button', { name: '专项面试', exact: true }).click()
  for (let index = 0; index < 2; index++) {
    const card = page.locator('li.group').filter({ has: page.getByRole('heading', { name: `未确认开场 ${index + 1}`, exact: true }) })
    await expect(card).toContainText('开场未确认')
    if (index === 0) {
      await page.route(`**/dev-api/interview/mock/start-result/${pendingIds[index]}/cancel`, route => route.fulfill({ status: 409, json: { code: 409, message: '开场仍在处理中，请稍后再取消' } }))
      await card.getByRole('button', { name: '取消未完成开场' }).click()
      await expect(card.getByRole('alert')).toContainText('开场仍在处理中')
      await page.unroute(`**/dev-api/interview/mock/start-result/${pendingIds[index]}/cancel`)
    }
    const response = page.waitForResponse(resp => resp.url().includes(`/start-result/${pendingIds[index]}/cancel`) && resp.status() === 201)
    await card.getByRole('button', { name: '取消未完成开场' }).click()
    await response
    await expect(page.locator('li.group').filter({ has: page.getByRole('heading', { name: `未确认开场 ${index + 1}`, exact: true }) })).toContainText('开场已取消')
  }
  const result = await page.request.post(`/dev-api/interview/mock/start-result/${pendingIds[0]}/cancel`, { headers: { Authorization: `Bearer ${token}` }, data: {} })
  expect(result.status()).toBe(201)
  expect((await result.json()).data.status).toBe('cancelled')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
