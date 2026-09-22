import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1', 'Requires dedicated quiz-local fixture and isolated Next build')

test('押题响应丢失后刷新仍以原请求恢复，不重复扣次', async ({ page }) => {
  const { token, userId } = JSON.parse(readFileSync('/tmp/msm-phase1-local/quiz-fixture.json', 'utf8')) as { token: string; userId: string }
  const request = {
    requestId: randomUUID(), resumeId: null, resumeContent: '合成简历：负责项目性能优化，使用数据验证。',
    company: '合成公司', positionName: '前端工程师', minSalary: 0, maxSalary: 0,
    jd: '合成岗位描述。负责前端工程、组件设计、测试、可访问性、性能优化以及跨团队协作。需要清晰解释项目中的技术选择和权衡。'
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ token, userId, request }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: userId, username: '押题测试', resumeRemainingCount: 2 }))
    if (!localStorage.getItem('active-interview')) {
      localStorage.setItem('active-interview', JSON.stringify({
        sessionId: `resume-quiz-${request.requestId}`, resultId: 'resume-quiz', serviceType: 'resume',
        timestamp: Date.now(), quizOwnerId: userId, quizRequest: request,
      }))
    }
  }, { token, userId, request })
  const requests: typeof request[] = []
  let loseFirstResponse = true
  await page.route('**/api/sse-proxy*', async route => {
    requests.push(route.request().postDataJSON())
    if (loseFirstResponse) {
      loseFirstResponse = false
      const committed = await route.fetch()
      expect(committed.status()).toBe(200)
      await route.abort('failed')
    } else await route.continue()
  })
  await page.goto('/interview?serviceType=resume&step=progress')
  await expect(page.getByRole('heading', { name: '处理失败' })).toBeVisible()
  await expect(page.getByRole('button', { name: '继续确认原请求' })).toBeVisible()
  await page.reload()
  await expect(page.getByText(/押题完成，共生成 3 道预测题/)).toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  expect(requests[0].requestId).toBe(request.requestId)
  expect(await page.evaluate(() => localStorage.getItem('active-interview'))).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
