/* Local HTTP + real MongoDB pagination; no model, speech, or payment calls. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const mongoose = require('mongoose');
const base = process.env.TEST_API_BASE;
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1' || !base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Dedicated local integration configuration required.');
async function api(path, token, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
  return { status: response.status, ...(await response.json()) };
}
(async () => {
  await mongoose.connect(uri);
  const suffix = randomUUID().slice(0, 8);
  const input = { username: `history-${suffix}`, email: `history-${suffix}@example.test`, password: 'Local-only-123!' };
  assert.equal((await api('/user/register', undefined, input)).code, 200);
  const login = (await api('/user/login', undefined, { email: input.email, password: input.password })).data;
  const user = new mongoose.Types.ObjectId(login.user._id);
  const foreignUser = new mongoose.Types.ObjectId();
  const mocks = mongoose.connection.collection('aiinterviewresults');
  const quizzes = mongoose.connection.collection('resumequizresults');
  const cases = {};
  try {
    for (const type of ['resume', 'special', 'behavior']) {
      const records = Array.from({ length: 23 }, (_, index) => ({
        _id: new mongoose.Types.ObjectId(), resultId: randomUUID(), user, userId: String(user), interviewType: type,
        position: `${type === 'resume' ? '押题' : type === 'special' ? '前端开发' : '行为面试'} · 合成测试 ${String(index + 1).padStart(2, '0')}`,
        company: '', createdAt: new Date('2026-09-22T00:00:00Z'), status: 'completed', reportStatus: 'pending',
        qaList: [{ question: '介绍一次项目改进。', answer: '我优化了缓存命中率。' }],
        sessionState: { resumeContent: 'private fixture content' }, reportLeaseToken: 'internal-lease', jobDescription: 'private job context'
      }));
      // Equal creation times exercise stable _id ordering across pages.
      records[22].status = 'paused'; records[21].status = 'in_progress'; records[20].status = 'abandoned';
      records[19].reportStatus = 'failed'; records[18].reportStatus = 'completed';
      records[17].reportStatus = 'generating'; records[17].reportLeaseExpiresAt = new Date(Date.now() - 1000);
      records[16].qaList = []; records[16].reportStatus = 'completed';
      const collection = type === 'resume' ? quizzes : mocks;
      await collection.insertMany(records);
      await collection.insertOne({ ...records[0], _id: new mongoose.Types.ObjectId(), resultId: randomUUID(), user: foreignUser, userId: String(foreignUser) });
      cases[type] = { first: records[22].resultId, completed: records[18].resultId };
      const path = `/interview/${type === 'resume' ? 'resume/quiz' : type}/history`;
      assert.equal((await api(path)).status, 401);
      const seen = [];
      for (let page = 1; page <= 3; page++) {
        const response = await api(`${path}?page=${page}&limit=10`, login.token);
        assert.equal(response.code, 200); assert.equal(response.data.total, 23);
        assert.equal(response.data.page, page); assert.equal(response.data.limit, 10);
        assert.equal(response.data.list.length, page === 3 ? 3 : 10);
        seen.push(...response.data.list.map(item => item.resultId));
        for (const item of response.data.list) {
          assert.deepEqual(Object.keys(item).sort(), (type === 'resume' ? ['resultId', 'company', 'position', 'createdAt', 'status'] : ['resultId', 'company', 'position', 'createdAt', 'status', 'reportStatus']).sort());
          if (type === 'resume') assert.equal(item.status, 'completed');
        }
        if (page === 1 && type !== 'resume') {
          assert.deepEqual(response.data.list.slice(0, 3).map(item => item.status), ['paused', 'in_progress', 'abandoned']);
          assert.equal(response.data.list[5].reportStatus, 'failed');
          assert.equal(response.data.list[6].reportStatus, 'insufficient_data');
        }
      }
      assert.deepEqual(seen, records.map(item => item.resultId).reverse());
      assert.equal(new Set(seen).size, 23);
      const empty = await api(`${path}?page=4`, login.token);
      assert.equal(empty.data.total, 23); assert.deepEqual(empty.data.list, []);
      assert.equal((await api(path, login.token)).data.list.length, 10);
      for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=x', 'limit=51', 'limit=0', 'page=100001']) assert.equal((await api(`${path}?${query}`, login.token)).status, 400);
      const injected = await api(`${path}?userId=${foreignUser}`, login.token);
      assert.equal(injected.data.total, 23); assert.equal(injected.data.list[0].resultId, records[22].resultId);
    }
    if (process.env.WRITE_UI_FIXTURE === '1') writeFileSync('/tmp/msm-phase1-local/history-ui-fixture.json', JSON.stringify({ ...login, cases }));
    console.log('PASS: 3 real paginated APIs, stable tied-date order, totals, owner isolation, status normalization, field whitelist, and invalid queries. Synthetic fixtures only.');
  } finally {
    const ids = process.env.WRITE_UI_FIXTURE === '1' ? [String(foreignUser)] : [String(user), String(foreignUser)];
    await mocks.deleteMany({ userId: { $in: ids } }); await quizzes.deleteMany({ userId: { $in: ids } });
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
