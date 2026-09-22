/* Real Mongo, JWT, DTO and SSE; synthetic model output on a dedicated local DB. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const mongoose = require('mongoose');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { InterviewController } = require('../../dist/src/interview/interview.controller');
const { InterviewService } = require('../../dist/src/interview/services/interview.service');
const { InterviewQuizService } = require('../../dist/src/interview/services/interview-quiz.service');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { InterviewSpeechService } = require('../../dist/src/interview/services/interview-speech.service');
const { QuotaLedgerService, quotaOperationId } = require('../../dist/src/user/quota-ledger.service');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') throw new Error('Dedicated local msm_phase1 database required');

(async () => {
  await mongoose.connect(uri);
  const model = (name, file) => mongoose.model(name, require(`../../dist/src/${file}`)[`${name}Schema`]);
  const users = model('User', 'user/schemas/user.schema');
  const operations = model('QuotaOperation', 'user/schemas/quota-operation.schema');
  const consumption = model('ConsumptionRecord', 'interview/schemas/consumption-record.schema');
  const results = model('ResumeQuizResult', 'interview/schemas/interview-quiz-result.schema');
  await Promise.all([users, operations, consumption, results].map(m => m.init()));
  const userId = String(new mongoose.Types.ObjectId());
  const user = await users.create({ _id: userId, username: `quiz-local-${randomUUID()}`, resumeRemainingCount: 5 });
  const config = new ConfigService({ JWT_SECRET: 'quiz-local-test-secret' });
  let questionCalls = 0;
  let analysisCalls = 0;
  let rejectModel = false;
  const ai = {
    async generateResumeQuizQuestionsOnly() {
      questionCalls++;
      await new Promise(resolve => setTimeout(resolve, 50));
      if (rejectModel) throw new Error('synthetic model failure');
      return { questions: [0, 1, 2].map(i => ({ question: `合成问题${i}`, answer: '合成回答', category: 'project', difficulty: 'medium' })), summary: '合成复盘' };
    },
    async generateResumeQuizAnalysisOnly() {
      analysisCalls++;
      return { matchScore: 72, matchLevel: '待验证', matchedSkills: [], missingSkills: [], knowledgeGaps: [], learningPriorities: [], radarData: [], strengths: [], weaknesses: [], interviewTips: [] };
    },
  };
  const quota = new QuotaLedgerService(users, operations);
  const quiz = new InterviewQuizService(consumption, results, quota, ai, config);
  const facade = { generateResumeQuizWithProgress: (uid, dto) => quiz.start(uid, dto, async () => dto.resumeContent || '') };
  const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [InterviewController], providers: [JwtStrategy, JwtAuthGuard,
    { provide: InterviewService, useValue: facade },
    { provide: InterviewReportService, useValue: {} },
    { provide: InterviewSpeechService, useValue: {} },
    { provide: ConfigService, useValue: config },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = Number(process.env.TEST_QUIZ_PORT || 3017);
  await app.listen(port, '127.0.0.1');
  const token = new JwtService({ secret: 'quiz-local-test-secret' }).sign({ userId });
  const input = () => ({ requestId: randomUUID(), positionName: '前端工程师', company: '合成公司', jd: '合成岗位描述。负责前端工程、组件设计、测试、可访问性、性能优化以及跨团队协作。需要清晰解释项目中的技术选择和权衡。', resumeContent: '合成简历：负责项目性能优化，使用数据验证。' });
  const balance = async () => (await users.findById(userId)).resumeRemainingCount;
  async function stream(dto, bearer = token) {
    const response = await fetch(`http://127.0.0.1:${port}/interview/resume/quiz/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(dto), signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    return { status: response.status, events: body.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6))) };
  }
  const done = response => response.events.find(e => e.type === 'yati-complete');
  try {
    const original = input();
    assert.equal((await stream(original, null)).status, 401);
    assert.equal((await stream({ ...original, requestId: undefined })).status, 400);
    assert.equal((await stream({ ...original, requestId: 'bad' })).status, 400);
    const parallel = await Promise.all(Array.from({ length: 8 }, () => stream(original)));
    assert(parallel.some(done), JSON.stringify(parallel));
    assert.equal(await balance(), 4);
    assert.equal(questionCalls, 1);
    assert.equal(analysisCalls, 1);
    assert.equal(await consumption.countDocuments({ userId }), 1);
    assert.equal(await results.countDocuments({ userId }), 1);
    const replay = await stream(original);
    assert.equal(done(replay).data.isFromCache, true);
    assert.equal(await balance(), 4);
    assert.equal((await stream({ ...original, positionName: '另一个岗位' })).events[0].type, 'error');
    assert.equal(await balance(), 4);

    rejectModel = true;
    const failed = input();
    const failure = await stream(failed);
    assert.equal(failure.events.find(e => e.type === 'error').terminal, true);
    assert.equal(await balance(), 4);
    assert.equal((await consumption.findOne({ userId, requestId: failed.requestId })).status, 'failed');
    assert.equal((await stream(failed)).events.find(e => e.type === 'error').terminal, true);
    assert.equal(await balance(), 4);
    rejectModel = false;

    const projected = input();
    const originalUpdate = results.updateOne.bind(results);
    results.updateOne = function (...args) { if (args[0]?.resultId === quotaOperationId(userId, 'resume-quiz', projected.requestId)) throw new Error('synthetic projection fault'); return originalUpdate(...args); };
    const projectionFailure = await stream(projected);
    assert.equal(projectionFailure.events.find(e => e.type === 'error').type, 'error');
    assert.equal(await balance(), 3);
    assert.equal((await consumption.findOne({ userId, requestId: projected.requestId })).status, 'success');
    results.updateOne = originalUpdate;
    assert(done(await stream(projected)));
    assert.equal(await balance(), 3);
    assert.equal(questionCalls, 3);

    const uncertainSave = input();
    const uncertainId = quotaOperationId(userId, 'resume-quiz', uncertainSave.requestId);
    const originalSave = consumption.findOneAndUpdate.bind(consumption);
    let failSaveOnce = true;
    consumption.findOneAndUpdate = function (...args) {
      if (failSaveOnce && args[0]?.recordId === uncertainId && args[1]?.$set?.status === 'success') {
        failSaveOnce = false;
        throw new Error('synthetic uncertain record write');
      }
      return originalSave(...args);
    };
    assert.equal((await stream(uncertainSave)).events.find(e => e.type === 'error').type, 'error');
    assert.equal((await consumption.findOne({ userId, requestId: uncertainSave.requestId })).status, 'pending');
    assert.equal(await balance(), 2);
    consumption.findOneAndUpdate = originalSave;
    assert(done(await stream(uncertainSave)));
    assert.equal(await balance(), 2);
    assert.equal(questionCalls, 5);

    const legacyRequest = input();
    const legacyId = randomUUID();
    await results.create({ resultId: legacyId, user: user._id, userId, company: '旧记录', position: '前端', questions: [], summary: '旧模型总结' });
    await consumption.create({ recordId: randomUUID(), resultId: legacyId, user: user._id, userId, type: 'resume_quiz', status: 'success', consumedCount: 1, metadata: { requestId: legacyRequest.requestId } });
    assert.equal(done(await stream(legacyRequest)).data.resultId, legacyId);
    assert.equal(await balance(), 2);
    console.log('PASS: JWT/DTO/SSE, concurrent same-ID debit once, replay/conflict, model failure refund once, uncertain write recovery, projection repair, legacy replay.');
    if (process.env.KEEP_QUIZ_SERVER === '1') {
      await mkdir('/tmp/msm-phase1-local', { recursive: true });
      await writeFile('/tmp/msm-phase1-local/quiz-fixture.json', JSON.stringify({ token, userId }));
      console.log(`QUIZ_FIXTURE_READY:${port}`);
      await new Promise(resolve => process.once('SIGTERM', resolve));
      assert.equal(await balance(), 1);
      assert.equal(await consumption.countDocuments({ userId }), 6);
      assert.equal(questionCalls, 6);
      console.log('PASS: browser response loss and refresh produced one debit, one new record and one model run.');
    }
  } finally {
    await app.close();
    await Promise.all([results.deleteMany({ userId }), consumption.deleteMany({ userId }), operations.deleteMany({ userId }), users.deleteOne({ _id: user._id })]);
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
