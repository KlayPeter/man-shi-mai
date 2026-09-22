import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated Mongo exchange fixture')

test('兑换响应丢失后刷新仍沿同一请求恢复', async ({ page }) => {
  const { token, userId } = JSON.parse(readFileSync(process.env.EXCHANGE_FIXTURE_PATH || '/tmp/msm-phase1-local/exchange-fixture.json', 'utf8')) as { token: string; userId: string }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '兑换测试', maiCoinBalance: 20, specialRemainingCount: 0 }))
  }, { token, userId })
  await page.route('**/dev-api/resume/getInterviewResumeList', route => route.fulfill({ json: { code: 200, data: [] } }))
  const requests: { requestId: string; packageType: string }[] = []
  let loseFirstResponse = true
  await page.route('**/dev-api/interview/exchange-package', async route => {
    requests.push(route.request().postDataJSON())
    if (loseFirstResponse) {
      loseFirstResponse = false
      const committed = await route.fetch()
      expect(committed.status()).toBe(201)
      await route.abort('failed')
    } else await route.continue()
  })

  await page.goto('/profile')
  await page.getByRole('button', { name: '小麦币兑换' }).click()
  await page.getByRole('button', { name: '兑换专项面试模拟' }).click()
  await page.getByRole('button', { name: '确认兑换' }).click()
  await expect(page.getByRole('status').filter({ hasText: '上次兑换尚未确认' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '小麦币兑换' }).click()
  await expect(page.getByRole('button', { name: '兑换专项面试模拟' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '兑换面试押题' })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('button', { name: '重试本次兑换' }).click()
  await expect(page.getByRole('heading', { name: '小麦币兑换服务' })).toHaveCount(0)
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  expect(requests[0].packageType).toBe('special')

  const account = await page.request.get('/dev-api/user/info', { headers: { Authorization: `Bearer ${token}` } })
  const accountData = (await account.json()).data
  expect(accountData.maiCoinBalance).toBe(0)
  expect(accountData.specialRemainingCount).toBe(1)
  const history = await page.request.get('/dev-api/user/transactions', { headers: { Authorization: `Bearer ${token}` } })
  const historyData = (await history.json()).data
  expect(historyData).toHaveLength(1)
  expect(historyData[0].source).toBe('MAI_exchange')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
