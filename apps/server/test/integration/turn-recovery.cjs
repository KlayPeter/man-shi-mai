/* Dedicated Mongo + actual Controller/JWT/DTO/SSE. Deterministic model only. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { lastValueFrom, toArray } = require('rxjs');
const mongoose = require('mongoose');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { InterviewController } = require('../../dist/src/interview/interview.controller');
const { InterviewService } = require('../../dist/src/interview/services/interview.service');
const { InterviewTurnService } = require('../../dist/src/interview/services/interview-turn.service');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { InterviewSpeechService } = require('../../dist/src/interview/services/interview-speech.service');
const { AIInterviewResultSchema } = require('../../dist/src/interview/schemas/ai-interview-result.schema');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') throw new Error('Dedicated local msm_phase1 database required');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await mongoose.connect(uri);
  const results = mongoose.model('AIInterviewResult', AIInterviewResultSchema);
  await results.init();
  const owner = new mongoose.Types.ObjectId(), userId = String(owner), ids = [];
  async function seed() {
    const resultId = randomUUID(), sessionId = randomUUID(); ids.push(resultId);
    await results.create({ user: owner, userId, resultId, interviewType: 'special', status: 'in_progress',
      qaList: [{ question: '介绍一次你主导的项目改进。', answer: ' ', score: 50, highlights: ['合成历史标注'] }],
      sessionState: { userId, resultId, sessionId, interviewType: 'special', interviewerName: '面试官', company: '', resumeContent: '合成履历',
        questionCount: 0, startTime: new Date(), targetDuration: 30, isActive: true,
        conversationHistory: [{ role: 'interviewer', content: '介绍一次你主导的项目改进。', timestamp: new Date() }],
      },
    });
    // Mongoose required-string excludes empty creation; runtime opening uses an atomic push.
    await results.updateOne({ resultId }, { $set: { 'qaList.0.answer': '' } });
    return { resultId, sessionId };
  }
  let calls = 0;
  const agent = { async *generateInterviewQuestionStream() { calls++; yield '如何'; await sleep(80); yield '验证改进效果？'; return { question: '如何验证改进效果？', shouldEnd: false }; } };
  let service = new InterviewTurnService(results, agent);
  const facade = {
    answerMockInterviewWithStream: (uid, sid, answer, requestId, expectedVersion) => service.answer(uid, { sessionId: sid, answer, requestId, expectedVersion }),
    resumeMockInterview: (uid, rid) => service.resume(uid, rid),
    endMockInterview: (uid, rid) => service.end(uid, rid),
    pauseMockInterview: (uid, rid) => service.pause(uid, rid),
  };
  const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [InterviewController], providers: [JwtStrategy, JwtAuthGuard,
    { provide: InterviewService, useValue: facade }, { provide: InterviewReportService, useValue: {} }, { provide: InterviewSpeechService, useValue: {} },
    { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'turn-local-test-secret' }) },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = Number(process.env.TEST_TURN_PORT || 3007);
  await app.listen(port, '127.0.0.1');
  const jwt = new JwtService({ secret: 'turn-local-test-secret' });
  const token = jwt.sign({ userId });
  const base = `http://127.0.0.1:${port}/interview/mock`;
  const body = fixture => ({ sessionId: fixture.sessionId, answer: '我做了缓存优化并比较延迟。', requestId: randomUUID(), expectedVersion: 0 });
  async function http(path, data = {}, bearer = token) {
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    return { status: response.status, text, events: text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))) };
  }
  const run = (instance, request) => lastValueFrom(instance.answer(userId, request).pipe(toArray()));
  try {
    const first = await seed(), request = body(first);
    assert.equal((await http('answer', request, null)).status, 401);
    assert.equal((await http('answer', { ...request, requestId: undefined })).status, 400);
    assert.equal((await http('answer', { ...request, expectedVersion: 0.5 })).status, 400);
    const wrong = jwt.sign({ userId: String(new mongoose.Types.ObjectId()) });
    assert.equal((await http('answer', request, wrong)).events.at(-1).type, 'error');
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => http('answer', request)));
    assert.equal(calls, 1);
    assert(concurrent.some(result => result.events.at(-1).type === 'waiting'));
    let record = await results.findOne({ resultId: first.resultId });
    assert.equal(record.turnVersion, 1); assert.equal(record.qaList[0].score, 50); assert.deepEqual([...record.qaList[0].highlights], ['合成历史标注']); assert.equal(record.qaList.length, 2); assert.equal(record.qaList[0].answer, request.answer);
    // A new service instance has no in-memory sessions. Retry replays from Mongo.
    service = new InterviewTurnService(results, agent);
    assert.equal((await http('answer', request)).events.at(-1).type, 'waiting'); assert.equal(calls, 1);
    assert.equal((await http('answer', { ...request, answer: 'changed' })).events.at(-1).type, 'error');
    assert.equal((await http('answer', { ...request, requestId: randomUUID() })).events.at(-1).type, 'error');
    const resumeResponse = await http(`resume/${first.resultId}`);
    assert.equal(resumeResponse.status, 201, resumeResponse.text);
    const resume = JSON.parse(resumeResponse.text).data;
    assert.equal(resume.questionVersion, 1); assert.equal(resume.conversationHistory.length, 3); assert(!('sessionState' in resume));
    const second = { ...request, requestId: randomUUID(), expectedVersion: 1, answer: '用压测工具比较 P95 延迟。' };
    assert.equal((await http('answer', second)).events.at(-1).type, 'waiting');
    await http(`pause/${first.resultId}`);
    assert.equal((await http('answer', { ...second, requestId: randomUUID(), expectedVersion: 2 })).events.at(-1).type, 'error');
    await http(`resume/${first.resultId}`);
    await http(`end/${first.resultId}`); await http(`end/${first.resultId}`);
    assert.equal((await results.findOne({ resultId: first.resultId })).status, 'completed');
    assert.equal((await http('answer', second)).events.at(-1).type, 'end');
    // Dead worker lease expires; its late output must never overwrite a replacement.
    const dead = await seed(), deadRequest = body(dead);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const slow = new InterviewTurnService(results, { async *generateInterviewQuestionStream() { yield '旧任务'; await gate; return { question: '旧任务的问题', shouldEnd: false }; } });
    const oldRun = run(slow, deadRequest);
    for (let n = 0; n < 100; n++) { if ((await results.findOne({ resultId: dead.resultId })).turnLeaseToken) break; await sleep(5); }
    await assert.rejects(() => service.end(userId, dead.resultId), /正在处理/);
    await assert.rejects(() => service.pause(userId, dead.resultId), /正在处理/);
    await results.updateOne({ resultId: dead.resultId }, { $set: { turnLeaseExpiresAt: new Date(0) } });
    assert.equal((await run(service, deadRequest)).at(-1).type, 'waiting');
    release(); assert.equal((await oldRun).at(-1).type, 'error');
    record = await results.findOne({ resultId: dead.resultId });
    assert.equal(record.qaList[1].question, '如何验证改进效果？'); assert.equal(record.turnVersion, 1);
    // Model failure leaves the original question/answer intact; retry advances exactly once.
    const failed = await seed(), failedRequest = body(failed);
    const failing = new InterviewTurnService(results, { async *generateInterviewQuestionStream() { yield '片段'; throw new Error('synthetic'); } });
    assert.equal((await run(failing, failedRequest)).at(-1).type, 'error');
    record = await results.findOne({ resultId: failed.resultId });
    assert.equal(record.qaList.length, 1); assert.equal(record.qaList[0].answer, ''); assert(!record.turnLeaseToken);
    assert.equal((await run(service, failedRequest)).at(-1).type, 'waiting');
    // Final answer remains in the review source when duration expires.
    const timed = await seed(), timedRequest = body(timed);
    await results.updateOne({ resultId: timed.resultId }, { $set: { 'sessionState.startTime': new Date(Date.now() - 31 * 60000) } });
    assert.equal((await run(service, timedRequest)).at(-1).type, 'end');
    record = await results.findOne({ resultId: timed.resultId }); assert.equal(record.qaList[0].answer, timedRequest.answer);
    console.log('PASS: real Mongo/JWT/DTO/SSE, concurrent claim, retry replay, restart, pause/resume/end, ownership, stale requests, expired lease fencing, model failure recovery, final-answer preservation. Model stub only.');
    if (process.env.KEEP_TURN_SERVER === '1') {
      const fixtures = await Promise.all([seed(), seed(), seed()]);
      await writeFile('/tmp/msm-phase1-local/turn-ui-fixture.json', JSON.stringify({ token, userId, fixtures }), { mode: 0o600 });
      console.log(`Browser fixture server ready on ${port}`);
      await new Promise(resolve => process.once('SIGTERM', resolve));
    }
  } finally { await app.close(); await results.deleteMany({ resultId: { $in: ids } }); await mongoose.disconnect(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
