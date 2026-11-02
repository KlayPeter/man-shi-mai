import { test, expect } from '@playwright/test'

// Local synthetic WAV and mocked provider responses; no external API or database.
const wave = Buffer.alloc(44 + 32000)
wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8)
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
wave.writeUInt32LE(16000, 24); wave.writeUInt32LE(32000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34)
wave.write('data', 36); wave.writeUInt32LE(32000, 40)

for (const width of [390, 1440]) test(`候场云端朗读可播放并显示失败状态 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-ui-token')
    localStorage.setItem('userInfo', JSON.stringify({ _id: 'ui-user', username: '语音测试', specialRemainingCount: 1 }))
    localStorage.setItem('interview-storage', JSON.stringify({ state: { selectedPosition: { positionName: '前端工程师' }, answerMode: 'voice', selectedService: 'special' }, version: 0 }))
    Reflect.set(window, '__speechPlayed', 0)
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener('playing', () => Reflect.set(window, '__speechPlayed', Reflect.get(window, '__speechPlayed') + 1), { once: true })
      return play.call(this)
    }
  })
  let failed = false, calls = 0
  await page.route('**/dev-api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/speech/status')) return route.fulfill({ json: { code: 200, data: { available: true, synthesisAvailable: true } } })
    if (path.endsWith('/speech/synthesize')) {
      calls++
      if (failed) return route.fulfill({ status: 503, json: { code: 503, message: 'quota unavailable' } })
      return route.fulfill({ contentType: 'audio/wav', body: wave })
    }
    return route.fulfill({ json: { code: 200, data: path.includes('/user/') ? { _id: 'ui-user', username: '语音测试', specialRemainingCount: 1 } : [] } })
  })
  await page.goto('/interview?serviceType=special&step=input')
  await expect(page.getByRole('button', { name: '语音面试', exact: true })).toBeEnabled({ timeout: 15000 })
  await expect(page.getByText('面试官使用云端音色朗读', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '试听面试官' }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__speechPlayed'))).toBeGreaterThan(0)
  expect(calls).toBe(1)
  failed = true
  await page.getByRole('button', { name: '试听面试官' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '朗读未完成' })).toBeVisible()
  expect(calls).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
