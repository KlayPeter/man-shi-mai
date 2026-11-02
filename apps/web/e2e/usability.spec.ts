import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const id = '507f1f77bcf86cd799439012'
const user = { _id: '507f1f77bcf86cd799439011', username: '可用性回归', resumeRemainingCount: 1 }
const jd = '负责 React 与 TypeScript 订单后台，完成组件设计、接口联调、性能分析、单元测试与可访问性改进，并与产品、后端和测试共同验收。'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(user => { localStorage.setItem('token', 'synthetic-regression-only'); localStorage.setItem('userInfo', JSON.stringify(user)) }, user)
  await page.route('**/dev-api/**', route => route.fulfill({ json: { code: 200, data: route.request().url().includes('/user/info') ? user : [] } }))
})

test('原始 PDF 实际绘制、提取文字切换，以及文件加载失败后重试', async ({ page }) => {
  const bytes = await readFile(resolve(process.cwd(), '../server/test/interview/fixtures/resume.pdf'))
  await page.route('**/dev-api/resume/detail/*', route => route.fulfill({ json: { code: 200, data: { _id: id, resumeName: '合成简历.pdf', sourceType: 'upload', localFileKey: 'synthetic.pdf', plainTextSnapshot: '合成前端经历，固定条件下首屏 1.8 秒降至 0.9 秒。' } } }))
  let attempts = 0
  await page.route('**/dev-api/resume/file/*', route => ++attempts === 1 ? route.fulfill({ status: 503, json: { message: 'unavailable' } }) : route.fulfill({ contentType: 'application/pdf', body: bytes }))
  await page.goto('/resume/' + id)
  await expect(page.getByRole('alert').filter({ hasText: '原文件暂时无法加载' })).toContainText('原文件暂时无法加载')
  await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(page.getByText('第 1 / 1 页', { exact: true })).toBeVisible()
  await expect(page.getByText('正在显示 PDF…', { exact: true })).toBeHidden()
  expect(await page.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return pixels.some((value, index) => index % 4 !== 3 && value < 200)
  })).toBe(true)
  await page.getByRole('button', { name: '面试使用的内容', exact: true }).click()
  await expect(page.getByRole('region', { name: '简历提取内容' })).toContainText('0.9 秒')
  expect(attempts).toBe(2)
})

test('薪资可留空，填写错误时显示就地提示并聚焦字段', async ({ page }) => {
  await page.addInitScript(jd => localStorage.setItem('interview-storage', JSON.stringify({ state: { selectedService: 'resume', resumeText: '合成前端简历：负责订单后台、性能分析与接口联调。', selectedPosition: { positionId: 'frontend', positionName: '前端工程师', jd } }, version: 0 })), jd)
  await page.goto('/interview?serviceType=resume&step=input')
  await expect(page.locator('#target-position')).toHaveValue('前端工程师')
  await expect(page.locator('#target-jd')).toHaveValue(jd)
  await page.locator('#salary-min').fill('30')
  await page.getByRole('button', { name: '立即押题', exact: true }).click()
  await expect(page.locator('#salary-helper')).toContainText('同时填写')
  await expect(page.locator('#salary-min')).toBeFocused()
  await page.locator('#salary-min').clear()
  await page.locator('#target-jd').fill('太短')
  await page.getByRole('button', { name: '立即押题', exact: true }).click()
  await expect(page.locator('#jd-helper')).toContainText('50 至 2000')
  await expect(page.locator('#target-jd')).toBeFocused()
  await page.locator('#target-jd').fill(jd)
  await page.getByRole('button', { name: '立即押题', exact: true }).click()
  await expect(page.getByRole('button', { name: '开始押题', exact: true })).toBeVisible()
})

test('简历详情失败结束加载，可重试恢复', async ({ page }) => {
  let attempts = 0
  await page.route('**/dev-api/resume/detail/*', route => ++attempts === 1 ? route.fulfill({ status: 404, json: { message: 'not found' } }) : route.fulfill({ json: { code: 200, data: { _id: id, resumeName: '恢复后的简历', sourceType: 'upload', plainTextSnapshot: '合成经历' } } }))
  await page.goto('/resume/' + id)
  await expect(page.getByRole('heading', { name: '无法打开这份简历' })).toBeVisible()
  await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(page.getByRole('heading', { name: '恢复后的简历' })).toBeVisible()
})

test('手机面试室始终可回答，并定位到最新问题', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('interview-storage', JSON.stringify({ state: {
    selectedService: 'special', interviewStatus: 'in_progress', answerMode: 'text', interviewerName: '麦麦',
    messages: [{ role: 'interviewer', content: '开场问题。'.repeat(120) }, { role: 'candidate', content: '合成回答。' }, { role: 'interviewer', content: '最新问题：怎样验证键盘焦点没有丢失？' }],
  }, version: 0 })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/interview?serviceType=special&step=interview')
  await expect(page.getByLabel('你的回答', { exact: true })).toBeInViewport()
  await expect(page.getByText('最新问题：怎样验证键盘焦点没有丢失？', { exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await page.getByLabel('你的回答', { exact: true }).fill('回答草稿')
  await expect(page.getByLabel('你的回答', { exact: true })).toHaveValue('回答草稿')
})

test('DOCX 明确提供下载与提取内容，不伪装为 PDF 排版', async ({ page }) => {
  await page.route('**/dev-api/resume/detail/*', route => route.fulfill({ json: { code: 200, data: { _id: id, resumeName: '中文简历', sourceType: 'upload', localFileKey: 'synthetic.docx', plainTextSnapshot: '合成项目经历' } } }))
  await page.route('**/dev-api/resume/file/*', route => route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: 'synthetic-download-only' }))
  await page.goto('/resume/' + id)
  await expect(page.getByRole('heading', { name: 'DOCX 已上传并解析' })).toBeVisible()
  await expect(page.getByRole('link', { name: '下载简历' })).toHaveAttribute('download', '中文简历.docx')
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.getByRole('button', { name: '面试使用的内容', exact: true }).click()
  await expect(page.getByRole('region', { name: '简历提取内容' })).toContainText('合成项目经历')
})
