import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const fixturePath = process.env.SPEECH_HTTP_FIXTURE
const fixture: { token: string; audio: string } | null = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) : null
test.skip(process.env.RUN_LOCAL_INTEGRATION !== '1' || !fixture, 'Requires opt-in and a local speech-http.cjs fixture server')

test('浏览器原生录音经过真实代理、JWT、DTO 和转码，只有识别供应商替换为 Stub', async ({ page, context, baseURL }) => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  await context.grantPermissions(['microphone'])
  await page.addInitScript(token => {
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify({ _id: 'speech-local-owner', username: '本地语音联调' }))
    localStorage.setItem('interview-storage', JSON.stringify({ state: { sessionId: 'speech-session', resultId: 'speech-result', interviewStatus: 'in_progress', selectedService: 'special', selectedPosition: { positionName: '前端开发' }, messages: [{ role: 'interviewer', content: '介绍一次项目改进。' }] }, version: 0 }))
  }, fixture!.token)
  await page.route('**/dev-api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/speech-to-text')) { await route.continue(); return }
    await route.fulfill({ json: { code: 200, data: path.includes('/mock/resume/') ? { resultId: 'speech-result', sessionId: 'speech-session', interviewerName: '本地测试面试官', status: 'in_progress', questionVersion: 0, busyUntil: null, committedRequestId: null, conversationHistory: [{ role: 'interviewer', content: '请介绍一次项目改进。', timestamp: new Date().toISOString() }] } : { _id: 'speech-local-owner', username: '本地语音联调' } } })
  })
  await page.goto('/interview?serviceType=special&step=interview&resultId=speech-result')
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await page.getByRole('button', { name: '开始录音', exact: true }).click()
  await expect(page.getByText('正在听你回答', { exact: true })).toBeVisible()
  await page.waitForTimeout(1200)
  const responsePromise = page.waitForResponse('**/dev-api/interview/speech-to-text')
  await page.getByRole('button', { name: '我说完了' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  await expect(page.getByLabel('回答文字 · 可编辑')).toHaveValue('合成音频已经完成本地转码')
  await expect(page.getByRole('button', { name: '发送回答' })).toBeEnabled()
  const invalid = await page.request.post('/dev-api/interview/speech-to-text', { headers: { Authorization: `Bearer ${fixture!.token}` }, data: { audio: 'invalid-base64' } })
  expect(invalid.status()).toBe(400)
  expect((await page.request.post('/dev-api/interview/speech-to-text', { data: { audio: fixture!.audio } })).status()).toBe(401)
})
