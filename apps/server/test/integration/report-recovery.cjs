/* Real standalone MongoDB + deterministic AI stub. No external model calls. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { AIInterviewResultSchema } = require('../../dist/src/interview/schemas/ai-interview-result.schema');
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') throw new Error('Dedicated local msm_phase1 database required.');
const output = { overallScore: 60, overallLevel: '练习中', overallComment: '合成测试报告', radarData: [], strengths: [], weaknesses: [], improvements: [], fluencyScore: null, logicScore: null, professionalScore: null, evidence: [{ questionNumber: 1, quote: '缓存', kind: 'improvement', feedback: '本次回答未说明收益', practice: '补充对比测量结果' }] };
(async () => {
  await mongoose.connect(uri);
  const results = mongoose.model('AIInterviewResult', AIInterviewResultSchema);
  await results.init();
  const owner = new mongoose.Types.ObjectId();
  const userId = String(owner);
  const ids = [];
  async function record(extra = {}) {
    const resultId = randomUUID(); ids.push(resultId);
    return results.create({ resultId, user: owner, userId, interviewType: 'special', status: 'completed', qaList: [{ question: '如何优化？', answer: '我做了缓存。' }], ...extra });
  }
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const service = new InterviewReportService(results, { generateInterviewAssessmentReport: async () => { calls++; return gate; } });
  try {
    const first = await record();
    assert.equal((await service.read(userId, first.resultId)).status, 'pending');
    assert.equal(calls, 0);
    await assert.rejects(() => service.read(String(new mongoose.Types.ObjectId()), first.resultId), error => error.getStatus() === 404);
    await Promise.all(Array.from({ length: 8 }, () => service.requestGeneration(userId, first.resultId)));
    assert.equal(calls, 1, 'concurrent starts should claim one model call');
    assert.equal((await results.findOne({ resultId: first.resultId })).reportAttempts, 1);
    // Simulate a dead worker's lease expiring; a new instance generates a replacement.
    await results.updateOne({ resultId: first.resultId }, { $set: { reportLeaseExpiresAt: new Date(0) } });
    assert.equal((await service.read(userId, first.resultId)).status, 'failed');
    const replacement = new InterviewReportService(results, { generateInterviewAssessmentReport: async () => ({ ...output, overallScore: 80 }) });
    await replacement.requestGeneration(userId, first.resultId);
    async function waitStatus(id, expected) {
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await results.findOne({ resultId: id })).reportStatus === expected) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`report did not become ${expected}`);
    }
    await waitStatus(first.resultId, 'completed');
    release(output);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal((await results.findOne({ resultId: first.resultId })).overallScore, 80, 'late worker must not overwrite new lease');
    const review = await replacement.read(userId, first.resultId);
    assert.equal(review.report.rubricVersion, 'interview-evidence-v1');
    assert.equal(review.report.evidence[0].quote, '缓存');
    assert.equal(review.sessionState, undefined);
    const failing = new InterviewReportService(results, { generateInterviewAssessmentReport: async () => ({ ...output, evidence: [{ ...output.evidence[0], quote: '不存在' }] }) });
    const bad = await record();
    for (let attempt = 0; attempt < 3; attempt++) {
      await failing.requestGeneration(userId, bad.resultId);
      await waitStatus(bad.resultId, 'failed');
    }
    const failed = await failing.read(userId, bad.resultId);
    assert.equal(failed.canGenerate, false);
    assert.equal(failed.questions[0].answer, '我做了缓存。');
    assert.equal(failed.report, null);
    await assert.rejects(() => failing.requestGeneration(userId, bad.resultId), /重试上限/);
    const empty = await record({ qaList: [], overallScore: 30, reportStatus: 'completed' });
    const insufficient = await failing.requestGeneration(userId, empty.resultId);
    assert.equal(insufficient.status, 'insufficient_data');
    assert.equal(insufficient.report, null);
    console.log('PASS: real MongoDB report claim concurrency, expired-lease recovery, late-write fencing, bounded failure retries, evidence checks, ownership and no fabricated empty-answer scores. AI stub only.');
  } finally {
    release(output);
    await results.deleteMany({ resultId: { $in: ids } });
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
