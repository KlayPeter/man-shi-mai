import { test, expect, type Page } from '@playwright/test'

// Real Chromium MediaRecorder with synthetic microphone; ASR and interview APIs are mocked.
async function openRoom(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'voice-ui-only')
    localStorage.setItem('userInfo', JSON.stringify({ _id: 'voice-user', username: '语音测试' }))
    localStorage.setItem('interview-storage', JSON.stringify({ state: { sessionId: 'voice-session', resultId: 'voice-result', interviewStatus: 'in_progress', selectedService: 'special', selectedPosition: { positionName: '前端开发工程师' }, messages: [{ role: 'interviewer', content: '介绍一次你主导的项目改进。' }] }, version: 0 }))
    const streams: MediaStream[] = []
    Object.assign(window, { voiceTestStreams: streams })
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); streams.push(stream); return stream }
  })
  await page.route('**/dev-api/**', async route => {
    const url = route.request().url()
    const data = url.includes('/mock/resume/') ? { resultId: 'voice-result', sessionId: 'voice-session', interviewerName: '面试官', status: 'in_progress', questionVersion: 0, busyUntil: null, committedRequestId: null, conversationHistory: [{ role: 'interviewer', content: '介绍一次你主导的项目改进。', timestamp: new Date().toISOString() }] } : { _id: 'voice-user', username: '语音测试' }
    await route.fulfill({ json: { code: 200, data } })
  })
  await page.goto('/interview?serviceType=special&step=interview&resultId=voice-result')
  await page.getByRole('button', { name: '继续面试', exact: true }).click()
  await expect(page.getByRole('button', { name: '开始录音', exact: true })).toBeEnabled()
}
const liveTracks = (page: Page) => page.evaluate(() => (window as unknown as { voiceTestStreams: MediaStream[] }).voiceTestStreams.flatMap(stream => stream.getTracks()).filter(track => track.readyState === 'live').length)

test('页内录音失败可重试，校对后才发送；切换文字释放麦克风', async ({ page, context }) => {
  await context.grantPermissions(['microphone'])
  await page.setViewportSize({ width: 390, height: 844 })
  await openRoom(page)
  let calls = 0
  const audios: string[] = []
  await page.route('**/dev-api/interview/speech-to-text', async route => {
    audios.push(route.request().postDataJSON().audio as string)
    await route.fulfill({ status: ++calls === 1 ? 503 : 200, json: calls === 1 ? { message: 'Deliberate failure' } : { code: 200, data: { text: '我通过缓存优化，把请求耗时降低了。' } } })
  })
  let submitted = ''
  await page.route('**/api/sse-proxy*', async route => {
    submitted = route.request().postDataJSON().answer as string
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"question","content":"你如何验证优化结果？"}\n\ndata: {"type":"waiting","questionVersion":1}\n\n' })
  })
  const answer = page.getByLabel('回答文字 · 可编辑')
  await answer.fill('原有草稿。')
  await page.getByRole('button', { name: '补充一段', exact: true }).click()
  await expect(page.getByText('正在听你回答', { exact: true })).toBeVisible()
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: '我说完了' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '录音已保留' })).toBeVisible()
  expect(await liveTracks(page)).toBe(0)
  await expect(answer).toHaveValue('原有草稿。')
  await page.getByRole('button', { name: '重试转写' }).click()
  await expect(answer).toHaveValue('原有草稿。\n我通过缓存优化，把请求耗时降低了。')
  expect(audios[0]).toBe(audios[1]); expect(audios[0].length).toBeGreaterThan(100)
  expect(submitted).toBe('')
  await answer.fill('我把 P95 延迟从 800 毫秒降到 180 毫秒。')
  await page.getByRole('button', { name: '发送回答' }).click()
  await expect(page.getByText('你如何验证优化结果？', { exact: true })).toBeVisible()
  expect(submitted).toBe('我把 P95 延迟从 800 毫秒降到 180 毫秒。')
  await page.getByRole('button', { name: '开始录音', exact: true }).click()
  await expect(page.getByText('正在听你回答', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '文字回答', exact: true }).click()
  await expect.poll(() => liveTracks(page)).toBe(0)
  expect(calls).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '语音回答', exact: true }).click()
  await page.screenshot({ path: '/tmp/msm-phase1-local/voice-mobile.png', fullPage: true })
})

test('拒绝麦克风仍能输入；结束面试卸载录音组件并释放设备', async ({ page, context }) => {
  await context.grantPermissions(['microphone'])
  await openRoom(page)
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia
    Object.assign(window, { savedGetUserMedia: original })
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await page.getByRole('button', { name: '开始录音', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '麦克风未获授权' })).toBeVisible()
  await page.getByRole('button', { name: '文字回答', exact: true }).click()
  await page.getByLabel('你的回答').fill('使用文字回答仍然可用。')
  await expect(page.getByRole('button', { name: '发送回答' })).toBeEnabled()
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = (window as unknown as { savedGetUserMedia: typeof navigator.mediaDevices.getUserMedia }).savedGetUserMedia })
  await page.getByRole('button', { name: '语音回答', exact: true }).click()
  await page.getByRole('button', { name: '补充一段', exact: true }).click()
  await expect(page.getByText('正在听你回答', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '结束面试', exact: true }).click()
  await expect(page.getByRole('region', { name: '本题回答' })).toHaveCount(0)
  await expect.poll(() => liveTracks(page)).toBe(0)
})
