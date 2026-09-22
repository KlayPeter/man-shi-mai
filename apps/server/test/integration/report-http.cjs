/* Real HTTP + dedicated MongoDB fixtures. These cases never call a model. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const mongoose = require('mongoose');
const base = process.env.TEST_API_BASE;
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1' || !base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Dedicated local integration configuration required.');
async function api(path, token, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
  return { status: response.status, ...(await response.json()) };
}
(async () => {
  await mongoose.connect(uri);
  const suffix = randomUUID().slice(0, 8);
  const input = { username: `review-${suffix}`, email: `review-${suffix}@example.test`, password: 'Local-only-123!' };
  assert.equal((await api('/user/register', undefined, input)).code, 200);
  const login = (await api('/user/login', undefined, { email: input.email, password: input.password })).data;
  const user = new mongoose.Types.ObjectId(login.user._id);
  const records = mongoose.connection.collection('aiinterviewresults');
  const cases = {};
  const questions = [{ question: '介绍一次接口性能优化。', answer: '我通过增加缓存，把接口 P95 延迟从 800 毫秒降到 180 毫秒。', aiComment: '给出了对比指标。' }, { question: '如何验证优化效果？', answer: '上线后观察了监控，但还没有比较相同流量下的数据。' }];
  for (const name of ['completed', 'failed', 'pending', 'generating', 'empty', 'in_progress']) {
    const resultId = randomUUID(); cases[name] = resultId;
    await records.insertOne({ resultId, user, userId: String(user), interviewType: 'special', position: '后端开发工程师 · 合成测试', company: '', status: name === 'in_progress' ? 'in_progress' : 'completed', reportStatus: name === 'empty' ? 'completed' : name === 'in_progress' ? 'pending' : name,
      reportAttempts: name === 'failed' ? 3 : name === 'generating' ? 1 : 0,
      reportLeaseExpiresAt: name === 'generating' ? new Date(Date.now() + 600_000) : undefined,
      qaList: name === 'empty' ? [] : questions, overallScore: name === 'empty' ? 30 : 72, overallLevel: '继续练习', overallComment: '本次已说明行动和结果，建议下一次补充验证方法。',
      radarData: [{ dimension: '表达结构', score: 72, description: '给出了行动与结果' }],
      strengths: [], weaknesses: [], improvements: [], reportRubricVersion: 'interview-evidence-v1',
      reportEvidence: name === 'completed' ? [
        { questionNumber: 1, quote: 'P95 延迟从 800 毫秒降到 180 毫秒', kind: 'strength', feedback: '用具体数据说明优化结果。', practice: '下次保留优化前后的对比。' },
        { questionNumber: 2, quote: '还没有比较相同流量下的数据', kind: 'improvement', feedback: '本次尚未说明如何控制对比条件。', practice: '用相同流量和样本量重新比较。' },
      ] : [], sessionState: { resumeContent: '不可泄露的合成简历', internalOnly: true } });
  }
  try {
    assert.equal((await api(`/interview/mock/review/${cases.completed}`)).status, 401);
    assert.equal((await api(`/interview/mock/review/${randomUUID()}`, login.token)).status, 404);
    for (const [name, id] of Object.entries(cases)) {
      const response = await api(`/interview/mock/review/${id}`, login.token);
      assert.equal(response.code, 200);
      assert.equal(response.data.status, name === 'empty' ? 'insufficient_data' : name === 'in_progress' ? 'not_ready' : name);
      assert.equal(response.data.sessionState, undefined);
      assert.equal(response.data.reportLeaseToken, undefined);
      if (name === 'completed') assert.equal(response.data.report.evidence.length, 2);
      if (name === 'empty') assert.equal(response.data.report, null);
    }
    assert.equal((await api(`/interview/mock/review/${cases.failed}/generate`, login.token, {})).status, 400);
    assert.equal((await api(`/interview/mock/review/${cases.in_progress}/generate`, login.token, {})).status, 400);
    assert.equal((await api(`/interview/mock/review/${cases.empty}/generate`, login.token, {})).data.status, 'insufficient_data');
    assert.equal((await api(`/interview/mock/review/${cases.generating}/generate`, login.token, {})).data.status, 'generating');
    const legacy = await api(`/interview/analysis/report/${cases.completed}`, login.token);
    assert.equal(legacy.data.matchScore, 72);
    assert.equal(legacy.data.sessionState, undefined);
    if (process.env.WRITE_UI_FIXTURE === '1') writeFileSync('/tmp/msm-phase1-local/report-ui-fixture.json', JSON.stringify({ ...login, cases }));
    else await records.deleteMany({ userId: String(user) });
    console.log('PASS: real report HTTP status/ownership, empty-answer response, preserved Q&A and legacy read adapter. Synthetic stored reports; no model calls.');
  } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
