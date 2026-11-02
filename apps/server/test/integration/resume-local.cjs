/* Local-only acceptance: real JWT, multipart/HTTP, Mongo, parsers and filesystem. No paid providers. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.MONGODB_URI !== 'mongodb://127.0.0.1:27028/msm_resume_acceptance') throw Error('Dedicated local test database required');
const base = process.env.TEST_WEB_BASE ? `${process.env.TEST_WEB_BASE}/dev-api` : 'http://127.0.0.1:3017';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { getConnectionToken } = require('@nestjs/mongoose');
let app, directory;
async function request(route, token, body, expected = 200, stream = false) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, expected, `${route} status`);
  if (expected >= 400) return response;
  if (stream) return (await response.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  const result = await response.json();
  assert.equal(result.code, 200, `${route} envelope`);
  return result.data;
}
const fixture = extension => path.join(__dirname, '..', 'interview', 'fixtures', `resume.${extension}`);
const form = (bytes, name) => { const data = new FormData(); data.append('file', new Blob([bytes]), name); return data; };
async function account() {
  const suffix = randomUUID().slice(0, 8);
  const credentials = { username: `local-${suffix}`, email: `local-${suffix}@example.test`, password: `Synthetic-${randomUUID()}` };
  await request('/user/register', null, credentials, 201);
  return request('/user/login', null, { email: credentials.email, password: credentials.password }, 201);
}
(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'msm-resume-upload-'));
  process.env.RESUME_STORAGE_DRIVER = 'local';
  process.env.RESUME_LOCAL_DIR = directory;
  const { AppModule } = require('../../dist/src/app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3017, '127.0.0.1');
  const owner = await account();
  const other = await account();
  await request('/resume/upload-config', null, undefined, 401);
  assert.equal((await request('/resume/upload-config', owner.token)).provider, 'local');
  const saved = [];
  for (const extension of ['pdf', 'docx']) {
    const bytes = await fs.readFile(fixture(extension));
    const resume = await request('/resume/upload-file', owner.token, form(bytes, `合成简历.${extension}`), 201);
    assert(resume.plainTextSnapshot.includes('1.8 seconds to 0.9 seconds'));
    assert.equal(resume.resumeName, `合成简历.${extension}`);
    assert(!resume.url);
    assert.deepEqual(await fs.readFile(path.join(directory, resume.localFileKey)), bytes);
    assert.equal((await fs.stat(path.join(directory, resume.localFileKey))).mode & 0o777, 0o600);
    saved.push(resume);
  }
  await request('/resume/upload-file', owner.token, form(Buffer.from('bad'), 'bad.pdf'), 400);
  await request('/resume/upload-file', owner.token, form(Buffer.alloc(5 * 1024 * 1024 + 1), 'large.pdf'), 413);
  await request('/resume/upload-file', owner.token, new FormData(), 400);
  await request(`/resume/detail/${saved[0]._id}`, other.token, undefined, 404);
  await request('/resume/deleteResume', other.token, { resumeId: saved[0]._id }, 404);
  const badStart = await request('/interview/mock/start', other.token, { requestId: randomUUID(), interviewType: 'special', positionName: '前端', resumeId: saved[0]._id }, 200, true);
  assert(badStart.some(event => event.type === 'error'));
  const accountAfter = await request('/user/info', other.token);
  assert.equal(accountAfter.specialRemainingCount, 1);
  const opening = await request('/interview/mock/start', owner.token, { requestId: randomUUID(), interviewType: 'special', positionName: '前端', practiceIntensity: 'warmup', resumeId: saved[0]._id }, 200, true);
  assert(!opening.some(event => event.type === 'error'));
  const resultId = opening.find(event => event.resultId)?.resultId;
  assert(resultId);
  const db = app.get(getConnectionToken()).db;
  const result = await db.collection('aiinterviewresults').findOne({ resultId });
  assert(result.sessionState.resumeContent.includes('1.8 seconds to 0.9 seconds'));
  // The provider is stubbed only here; score calculation, persistence and read routes are real.
  const { InterviewAIService } = require('../../dist/src/interview/services/interview-ai.service');
  const { scoreAssessment } = require('../../dist/src/interview/schemas/assessment-output');
  await db.collection('aiinterviewresults').updateOne({ resultId }, { $set: { status: 'completed', reportStatus: 'pending', qaList: [
    { question: '固定行高虚拟列表如何计算范围？', answer: '先算起止索引，再钳制边界并添加缓冲行。' },
    { question: '你还有什么想了解的？', answer: '我想了解代码评审的方式。' },
  ] } });
  let reportCalls = 0;
  app.get(InterviewAIService).generateInterviewAssessmentReport = async context => {
    reportCalls++;
    return scoreAssessment({ overallComment: '本场回答结构清晰，下一步可以练习动态高度场景。', questionAssessments: context.qaList.map((qa, index) => ({ questionNumber: index + 1, excludedReason: index ? 'candidate_questions' : null, ratings: index ? { relevance: null, correctness: null, depth: null, structure: null } : { relevance: 5, correctness: 5, depth: 5, structure: 5 }, quote: qa.answer, feedback: index ? '候选人反问，不计分。' : '正确说明了索引、边界和缓冲行。', practice: '下一次说明动态高度时如何测量和定位。' })) }, context);
  };
  await request(`/interview/mock/review/${resultId}/generate`, owner.token, {}, 201);
  let review;
  for (let count = 0; count < 30; count++) {
    review = await request(`/interview/mock/review/${resultId}`, owner.token);
    if (review.status === 'completed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(review.status, 'completed');
  assert.equal(review.report.overallScore, 100);
  assert.equal(review.report.overallLevel, '优秀');
  assert.equal(review.report.scoring.scoredQuestions, 1);
  assert.equal(review.questions[0].score, 100);
  assert.equal(review.questions[0].dimensions.length, 4);
  assert.equal(review.questions[1].score, null);
  assert.equal(review.questions[1].excludedReason, 'candidate_questions');
  await request(`/interview/mock/review/${resultId}/generate`, owner.token, {}, 201);
  assert.equal(reportCalls, 1);
  if (process.env.TEST_WEB_BASE) {
    const { chromium } = require('../../../web/node_modules/@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('userInfo', JSON.stringify(user)); }, { token: owner.token, user: owner.user });
      await page.goto(`${process.env.TEST_WEB_BASE}/resume`);
      await page.getByRole('button', { name: '上传文件', exact: true }).first().click();
      await page.locator('input[type=file]').setInputFiles(fixture('pdf'));
      await page.getByRole('button', { name: '上传', exact: true }).click();
      await page.waitForURL(/\/resume\/[a-f0-9]{24}$/, { timeout: 90000 });
      await page.getByText('这些内容将用于面试提问', { exact: false }).waitFor();
      assert((await page.getByRole('region', { name: '简历提取内容' }).innerText()).includes('Frontend engineer'));
      await page.screenshot({ path: '/tmp/msm-resume-upload-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: '/tmp/msm-resume-upload-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${process.env.TEST_WEB_BASE}/interview/report?serviceType=special&resultId=${resultId}`);
      await page.getByRole('heading', { name: '优秀', exact: true }).waitFor();
      await page.getByText('分数是怎么算的？', { exact: true }).click();
      await page.getByText('计分题平均', { exact: true }).waitFor();
      await page.screenshot({ path: '/tmp/msm-review-score-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: '/tmp/msm-review-score-mobile.png', fullPage: true });
    } finally { await browser.close(); }
  }
  await request('/resume/deleteResume', owner.token, { resumeId: saved[0]._id }, 201);
  await assert.rejects(fs.access(path.join(directory, saved[0].localFileKey)));
  assert((await db.collection('aiinterviewresults').findOne({ resultId })).sessionState.resumeContent.includes('Frontend engineer'));
  console.log('PASS: actual PDF/DOCX multipart upload; private local files; saved text; own-user access; bad/missing/oversized files; opening snapshot; rubric aggregation/persistence; per-question scores; excluded questions; idempotent report request; deletion; snapshot survives deletion' + (process.env.TEST_WEB_BASE ? '; Next proxy and desktop/mobile browser upload' : '') + '. No paid provider calls.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (app) { await app.get(getConnectionToken()).dropDatabase(); await app.close(); }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});
