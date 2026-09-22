/* Dedicated local DB only. Synthetic cached result; no paid model requests. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const base = process.env.TEST_API_BASE;
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || !base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !/^mongodb:\/\/127\.0\.0\.1:27028\/msm_phase1$/.test(uri || '')) {
  throw new Error('This test requires the isolated local msm_phase1 database and a local API endpoint.');
}
async function json(path, token, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, ...await response.json() };
}
async function stream(path, token, body) {
  const url = base.endsWith('/dev-api') ? `${base.slice(0, -8)}/api/sse-proxy?path=${encodeURIComponent(path)}` : `${base}${path}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  return (await response.text()).split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
}
(async () => {
  await mongoose.connect(uri);
  const suffix = randomUUID().slice(0, 8);
  const email = `stream-${suffix}@example.test`, password = 'Local-only-123!';
  assert.equal((await json('/user/register', null, { username: `s-${suffix}`, email, password })).code, 200);
  const login = (await json('/user/login', null, { email, password })).data;
  const token = login.token, userId = login.user._id, objectId = new mongoose.Types.ObjectId(userId);
  assert.equal((await json('/interview/continue-conversation', null, { sessionId: randomUUID(), question: '测试' })).status, 401);
  assert.equal((await json('/interview/continue-conversation', token, { sessionId: randomUUID(), question: '测试' })).status, 404);
  const quizInput = { positionName: '前端工程师', jd: '这是合成岗位描述，仅用于独立本地数据库的接口测试，不会发送给外部模型。负责组件开发、测试、可访问性、错误处理以及团队协作。', resumeContent: '合成测试经历' };
  for (const type of ['special', 'behavior']) {
    const events = await stream('/interview/mock/start', token, { interviewType: type, positionName: '前端', resumeContent: '合成经历' });
    assert.equal(events.filter(e => e.type === 'error').length, 1);
  }
  assert.equal((await stream('/interview/resume/quiz/stream', token, quizInput)).filter(e => e.type === 'error').length, 1);
  const before = (await json('/user/info', token)).data;
  for (const field of ['resumeRemainingCount', 'specialRemainingCount', 'behaviorRemainingCount']) assert.equal(before[field], 0);

  const resultId = randomUUID(), requestId = randomUUID(), recordId = randomUUID();
  await mongoose.connection.collection('resumequizresults').insertOne({ resultId, userId, user: objectId, company: '测试', position: '前端', questions: [], summary: '已完成的合成结果' });
  await mongoose.connection.collection('consumptionrecords').insertOne({ recordId, userId, user: objectId, type: 'resume_quiz', status: 'success', resultId, consumedCount: 1, metadata: { requestId } });
  const cached = await stream('/interview/resume/quiz/stream', token, { ...quizInput, requestId });
  assert.equal(cached.filter(e => e.type === 'yati-complete').length, 1);
  assert.equal(cached.find(e => e.type === 'yati-complete').data.resultId, resultId);
  assert.equal(cached.filter(e => e.type === 'complete').length, 1);
  assert.equal((await json('/user/info', token)).data.resumeRemainingCount, 0);

  await mongoose.connection.collection('users').updateOne({ _id: objectId }, { $set: { maiCoinBalance: 20 } });
  const exchanges = await Promise.all(Array.from({ length: 8 }, () => json('/interview/exchange-package', token, { packageType: 'resume' })));
  assert.equal(exchanges.filter(r => r.code === 200).length, 1);
  const after = (await json('/user/info', token)).data;
  assert.equal(after.maiCoinBalance, 0);
  assert.equal(after.resumeRemainingCount, 1);
  console.log('PASS: real SSE closes on cache/error, zero-quota remains zero, 8 concurrent exchanges grant exactly one credit; continuation requires authentication.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
