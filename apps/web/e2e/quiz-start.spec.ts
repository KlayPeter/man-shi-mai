import { test, expect } from '@playwright/test'

test('从输入页首次确认押题：切换布局后只建立一条流，不误报处理中冲突', async ({ page }) => {
  const user = { _id: '507f1f77bcf86cd799439011', username: '押题回归', resumeRemainingCount: 1 }
  await page.addInitScript(user => {
    localStorage.setItem('token', 'synthetic-regression-only')
    localStorage.setItem('userInfo', JSON.stringify(user))
    localStorage.setItem('interview-storage', JSON.stringify({ state: {
      selectedService: 'resume', resumeText: '合成简历：负责前端订单管理系统、性能分析与接口联调。',
      selectedPosition: { positionId: 'frontend', positionName: '前端工程师', company: '合成团队',
        jd: '负责 React 与 TypeScript 订单后台，完成组件设计、接口联调、性能分析、单元测试与可访问性改进，并与产品、后端和测试共同验收。' },
    }, version: 0 }))
  }, user)
  await page.route('**/dev-api/**', route => route.fulfill({ json: { code: 200, data: route.request().url().includes('/user/info') ? user : [] } }))
  let requests = 0
  await page.route('**/api/sse-proxy*', async route => {
    requests++
    if (requests > 1) return route.fulfill({ status: 409, body: '本次押题正在处理，请稍后重试同一请求' })
    await new Promise(resolve => setTimeout(resolve, 700))
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ type: 'yati-complete', data: {
      resultId: 'synthetic-quiz-result', questions: [{ question: '如何验证优化收益？', answer: '固定条件对比。', category: 'project', difficulty: 'medium' }], summary: '合成押题结果',
    } }) + '\n\ndata: {"type":"complete"}\n\n' }).catch(() => undefined)
  })
  await page.goto('/interview?serviceType=resume&step=input')
  await page.getByRole('button', { name: '立即押题', exact: true }).click()
  await page.getByRole('button', { name: '开始押题', exact: true }).click()
  await expect(page.getByText('押题完成，共生成 1 道预测题', { exact: true })).toBeVisible()
  expect(requests).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('active-interview'))).toBeNull()
})
