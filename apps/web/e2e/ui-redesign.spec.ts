import { test, expect, type Page } from '@playwright/test'

const resume = { _id: 'ui-resume', resumeName: '前端开发简历', sourceType: 'editor', createdAt: '2026-01-01' }
const user = { _id: 'ui-user', username: '练习者', maiCoinBalance: 80 }

async function mockApi(page: Page, authenticated = true) {
  if (authenticated) await page.addInitScript(({ user }) => {
    localStorage.setItem('token', 'ui-test-only')
    localStorage.setItem('userInfo', JSON.stringify(user))
  }, { user })
  await page.route('**/dev-api/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/getInterviewResumeList') ? [resume] : path.endsWith('/user/info') ? user : []
    return route.fulfill({ json: { code: 200, data } })
  })
}

for (const width of [375, 768, 1024, 1440]) {
  test(`页面在 ${width}px 下无横向溢出`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/login', '/interview/start', '/interview?serviceType=special&step=input', '/resume', '/history', '/profile']) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true)
    }
  })
}

test('首页示例切换、反馈和移动导航可操作', async ({ page }) => {
  await mockApi(page, false)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: '产品经理', exact: true }).click()
  await expect(page.getByText('当用户需求和业务目标发生冲突时', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '看看这段回答的反馈' }).click()
  await expect(page.getByRole('status')).toContainText('有清楚的判断框架')
  await page.getByRole('button', { name: '运营岗位' }).click()
  await expect(page.getByRole('button', { name: '看看这段回答的反馈' })).toBeVisible()
  await page.getByRole('button', { name: '打开导航' }).click()
  await expect(page.getByRole('navigation', { name: '移动端导航' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '打开导航' })).toBeFocused()
})

test('简历入口保留预选，岗位键盘选择及练习弹窗支持 Escape', async ({ page }) => {
  await mockApi(page)
  await page.goto('/resume')
  await page.getByRole('button', { name: '发起面试' }).click()
  await expect(page).toHaveURL(/interview\/start\?resumeId=ui-resume/)
  await expect(page.getByRole('button', { name: '前端开发简历' })).toHaveAttribute('aria-pressed', 'true')
  const next = page.getByRole('button', { name: '下一步，选择练习方式' })
  await expect(next).toBeDisabled()
  await page.getByRole('textbox', { name: '搜索目标岗位' }).fill('前端')
  const position = page.locator('button[aria-pressed]').filter({ hasText: '前端' }).first()
  await position.focus()
  await page.keyboard.press('Enter')
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.getByRole('dialog', { name: '选择这次的练习方式' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(next).toBeFocused()
  await page.getByRole('textbox', { name: '简历文本内容' }).fill('   ')
  // A selected resume remains valid until actual replacement text is entered.
  await page.getByRole('textbox', { name: '简历文本内容' }).fill('三年前端开发经验')
  await expect(page.getByRole('button', { name: '前端开发简历' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('textbox', { name: '简历文本内容' }).fill('   ')
  await expect(next).toBeDisabled()
  await page.getByRole('textbox', { name: '简历文本内容' }).fill('三年前端开发经验')
  await next.click()
  await page.getByRole('button', { name: /专项面试模拟/ }).click()
  await expect(page).toHaveURL(/serviceType=special&step=input/)
  await expect(page.getByLabel('岗位名称')).toHaveValue('前端开发工程师')
  await expect(page.getByRole('heading', { name: '完善这次练习的目标' })).toBeVisible()
})

test('登录显示错误，成功后回到指定站内页面', async ({ page }) => {
  await mockApi(page, false)
  let attempts = 0
  await page.route('**/dev-api/user/login', route => route.fulfill({ json: ++attempts === 1
    ? { code: 400, message: '邮箱或密码错误' }
    : { code: 200, data: { user, token: 'ui-test-only' } } }))
  await page.goto('/login?redirect=%2Fresume')
  await page.getByLabel('邮箱地址').fill('ui@example.com')
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.locator('form [role="alert"]')).toHaveText('邮箱或密码错误')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/resume$/)
  await expect(page.getByRole('heading', { name: '我的简历' })).toBeVisible()
})

test('历史加载失败不伪装为空记录，并可重试', async ({ page }) => {
  await mockApi(page)
  let fail = true
  await page.route('**/dev-api/interview/resume/quiz/history*', route => route.fulfill({
    status: fail ? 500 : 200,
    json: fail ? { message: 'test error' } : { code: 200, data: { list: [], total: 0 } },
  }))
  await page.goto('/history')
  await expect(page.locator('main [role="alert"]')).toContainText('记录暂时没有加载成功')
  await expect(page.getByText('暂无相关记录')).toBeHidden()
  fail = false
  await page.getByRole('button', { name: '重新加载' }).click()
  await expect(page.getByText('暂无相关记录')).toBeVisible()
})


test('手机端可取消或确认退出账号', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: '打开导航' }).click()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '退出当前账号？' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click()
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('ui-test-only')
  await page.getByRole('button', { name: '打开导航' }).click()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await dialog.getByRole('button', { name: '确定退出' }).click()
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  await expect(dialog).toBeHidden()
})

test('招聘季自动选择、手动切换与跨页持久化，支持减少动态效果', async ({ page }) => {
  await mockApi(page, false)
  await page.clock.setFixedTime(new Date('2027-03-01T00:00:00Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-season', 'spring')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('这个春天')
  await expect(page.locator('.art-sticker')).toHaveCSS('animation-name', 'none')
  const theme = page.getByLabel('切换招聘季主题')
  await theme.selectOption('autumn')
  await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('这个秋天')
  await page.reload()
  await expect(theme).toHaveValue('autumn')
  await page.getByRole('link', { name: '登录', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn')
  await page.goto('/')
  await theme.selectOption('auto')
  await expect(page.locator('html')).toHaveAttribute('data-season', 'spring')
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 812 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
