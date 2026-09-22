import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'

// Run only against dedicated local test services; virtual grants do not call a gateway.
test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires explicit local integration opt-in')
test.beforeEach(async ({ baseURL }) => {
  for (const origin of [baseURL, process.env.TEST_DISABLED_ORIGIN].filter(Boolean)) {
    expect(['localhost', '127.0.0.1']).toContain(new URL(origin!).hostname)
  }
})
async function login(page: Page, request: APIRequestContext, origin = '') {
  const id = randomUUID().slice(0, 8)
  const account = { username: `pay-${id}`, email: `pay-${id}@example.test`, password: 'Local-only-123!' }
  expect((await (await request.post(`${origin}/dev-api/user/register`, { data: account })).json()).code).toBe(200)
  const result = (await (await request.post(`${origin}/dev-api/user/login`, { data: { email: account.email, password: account.password } })).json()).data
  await page.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('userInfo', JSON.stringify(user)) }, result)
  return result as { token: string; user: { _id: string } }
}

test('套餐来自后端，失败保留订单，刷新后继续确认且只发一次', async ({ page, request }) => {
  const account = await login(page, request)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profile')
  const opener = page.getByRole('button', { name: /充值$/ })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('测试环境：模拟发放不产生真实交易，每个账户限一次')).toBeVisible()
  await expect(dialog.getByText('1 次专项面试').first()).toBeVisible()
  await expect(dialog.getByText('无限包', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: '/tmp/msm-phase1-local/payment-mobile.png', fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()
  await opener.click()
  // Create a real order, then deliberately lose the confirmation response. The server
  // completes the first grant; reload must reuse that same order without granting twice.
  await page.route('**/dev-api/payment/mock-success', async route => {
    await route.fetch()
    await route.abort('connectionfailed')
  }, { times: 1 })
  await dialog.getByRole('button', { name: '确认模拟发放（不扣款）' }).click()
  await expect(dialog.getByRole('button', { name: '继续确认' })).toBeVisible()
  const orderId = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`msm-virtual-order:${id}`) || '{}').orderId, account.user._id)
  expect(orderId).toBeTruthy()
  await page.reload()
  await page.getByRole('button', { name: /充值$/ }).click()
  await expect(dialog.getByRole('button', { name: '继续确认' })).toBeEnabled()
  await dialog.getByRole('button', { name: '继续确认' }).click()
  await expect(dialog.getByText('模拟权益已更新，可返回账户查看。未产生真实交易。')).toBeVisible()
  const headers = { Authorization: `Bearer ${account.token}` }
  const info = (await (await request.get('/dev-api/user/info', { headers })).json()).data
  expect(info.specialRemainingCount).toBe(1)
  expect(info.resumeRemainingCount).toBe(1)
  expect(info.behaviorRemainingCount).toBe(1)
  expect(info.maiCoinBalance).toBe(0)
  expect(info).not.toHaveProperty('password')
  expect(info).not.toHaveProperty('virtualPaymentOrderId')
  const query = (await (await request.post('/dev-api/payment/order/status', { headers, data: { orderId, channel: 'virtual' } })).json()).data
  expect(query.success).toBe(true)
})

test('关闭支付的真实服务返回不可用，前端无模拟入口', async ({ page, request }) => {
  const origin = process.env.TEST_DISABLED_ORIGIN
  test.skip(!origin, 'Requires a second local service with PAYMENT_MODE=disabled')
  const account = await login(page, request, origin)
  await page.goto(`${origin}/profile`)
  await page.getByRole('button', { name: /充值$/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '充值暂未开放' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /模拟发放/ })).toHaveCount(0)
  const response = await request.post(`${origin}/dev-api/payment/mock-success`, { headers: { Authorization: `Bearer ${account.token}` }, data: { orderId: randomUUID() } })
  expect(response.status()).toBe(503)
  expect((await request.get(`${origin}/dev-api/payment/capabilities`)).status()).toBe(401)
})
