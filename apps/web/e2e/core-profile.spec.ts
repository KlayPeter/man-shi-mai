import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('资料修改以服务器返回值为准，刷新后仍然保留', async ({ page, request }) => {
  const suffix = randomUUID().slice(0, 8)
  const account = { username: `ui-${suffix}`, email: `ui-${suffix}@example.test`, password: 'Local-only-123!' }
  const registered = await request.post('/dev-api/user/register', { data: account })
  expect((await registered.json()).code).toBe(200)
  const response = await request.post('/dev-api/user/login', { data: { email: account.email, password: account.password } })
  const login = (await response.json()).data
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify(user))
  }, login)
  await page.goto('/profile')
  await page.getByRole('button', { name: '编辑资料' }).click()
  const updatedName = `已保存-${suffix}`
  await page.getByPlaceholder('请输入用户名（2-20个字符）').fill(updatedName)
  const saved = page.waitForResponse(r => r.url().endsWith('/dev-api/user/update') && r.request().method() === 'POST')
  await page.getByRole('button', { name: '保存更改' }).click()
  const body = await (await saved).json()
  expect(body.code).toBe(200)
  expect(body.data.username).toBe(updatedName)
  expect(body.data).not.toHaveProperty('password')
  await expect(page.getByText('编辑个人信息', { exact: true })).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: '编辑资料' }).click()
  await expect(page.getByPlaceholder('请输入用户名（2-20个字符）')).toHaveValue(updatedName)
})
