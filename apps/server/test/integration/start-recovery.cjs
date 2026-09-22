/* Dedicated Mongo, actual JWT/DTO/HTTP/SSE; synthetic users, no paid providers. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const mongoose = require('mongoose');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { lastValueFrom, toArray } = require('rxjs');
const { InterviewController } = require('../../dist/src/interview/interview.controller');
const { InterviewService } = require('../../dist/src/interview/services/interview.service');
const { InterviewStartService } = require('../../dist/src/interview/services/interview-start.service');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { InterviewSpeechService } = require('../../dist/src/interview/services/interview-speech.service');
const { QuotaLedgerService } = require('../../dist/src/user/quota-ledger.service');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') throw new Error('Dedicated local msm_phase1 database required');
(async () => {
  await mongoose.connect(uri);
  const model = (name, file) => mongoose.model(name, require(`../../dist/src/${file}`)[`${name}Schema`]);
  const users = model('User', 'user/schemas/user.schema');
  const operations = model('QuotaOperation', 'user/schemas/quota-operation.schema');
  const results = model('AIInterviewResult', 'interview/schemas/ai-interview-result.schema');
  const consumption = model('ConsumptionRecord', 'interview/schemas/consumption-record.schema');
  await Promise.all([users, operations, results, consumption].map(m => m.init()));
  const userId = String(new mongoose.Types.ObjectId());
  await users.create({ _id: userId, username: `start-test-${randomUUID()}`, specialRemainingCount: 5, behaviorRemainingCount: 0 });
  const ai = { generateOpeningStatement: () => '请介绍一次你主导的项目。' };
  let ledger = new QuotaLedgerService(users, operations);
  let service = new InterviewStartService(results, consumption, ledger, ai);
  const facade = {
    startMockInterviewWithStream: (uid, dto) => service.start(uid, dto, async () => ''),
    cancelMockInterviewStart: (uid, dto) => service.cancel(uid, dto),
  };
  const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [InterviewController], providers: [JwtStrategy, JwtAuthGuard,
    { provide: InterviewService, useValue: facade }, { provide: InterviewReportService, useValue: {} }, { provide: InterviewSpeechService, useValue: {} },
    { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'start-local-test-secret' }) },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3010, '127.0.0.1');
  const token = new JwtService({ secret: 'start-local-test-secret' }).sign({ userId });
  const dto = () => ({ requestId: randomUUID(), interviewType: 'special', positionName: '前端工程师' });
  const balance = async () => (await users.findById(userId)).specialRemainingCount;
  const run = (s, d, resolver = async () => '') => lastValueFrom(s.start(userId, d, resolver).pipe(toArray()));
  const proxy = (target, method, intercept) => new Proxy(target, { get(t, key) { if (key === method) return intercept; const v = Reflect.get(t, key); return typeof v === 'function' ? v.bind(t) : v; } });
  async function http(path, body, auth = true) {
    const response = await fetch(`http://127.0.0.1:3010/interview/mock/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    return { status: response.status, text, events: text.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6))) };
  }
  try {
    const first = dto();
    assert.equal((await http('start', first, false)).status, 401);
    assert.equal((await http('start', { ...first, requestId: undefined })).status, 400);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => http('start', first)));
    assert(concurrent.some(r => r.events.at(-1)?.type === 'waiting'), JSON.stringify(concurrent));
    assert.equal(await balance(), 4);
    ledger = new QuotaLedgerService(users, operations);
    service = new InterviewStartService(results, consumption, ledger, ai);
    assert.equal((await http('start', first)).events.at(-1).type, 'waiting');
    assert.equal(await balance(), 4);
    assert.equal(await results.countDocuments({ userId }), 1);
    assert.equal(await consumption.countDocuments({ userId }), 1);
    assert.equal((await http('start', { ...first, positionName: '不同岗位' })).events.at(-1).type, 'error');
    const zero = { ...dto(), interviewType: 'behavior' };
    assert.equal((await http('start', zero)).events.at(-1).type, 'error');
    assert.equal((await http(`start/${zero.requestId}/cancel`, zero)).status, 201);
    assert.equal((await users.findById(userId)).behaviorRemainingCount, 0);
    const early = dto();
    assert.equal((await http(`start/${early.requestId}/cancel`, early)).status, 201);
    assert.equal((await http('start', early)).events.at(-1).startStatus, 'cancelled');
    assert.equal(await balance(), 4);
    const badResume = dto();
    assert.equal((await run(service, badResume, async () => { throw new Error('parse failure'); })).at(-1).type, 'error');
    assert.equal(await balance(), 4);
    // Simulate process failure after balance CAS but before journal archival.
    let failArchive = true;
    const brokenOps = proxy(operations, 'findOneAndUpdate', (...args) => { if (failArchive) { failArchive = false; throw new Error('archive unavailable'); } return operations.findOneAndUpdate(...args); });
    const archiveRequest = dto();
    const broken = new InterviewStartService(results, consumption, new QuotaLedgerService(users, brokenOps), ai);
    assert.equal((await run(broken, archiveRequest)).at(-1).type, 'error');
    assert.equal(await balance(), 3);
    assert.equal((await run(service, archiveRequest)).at(-1).type, 'waiting');
    assert.equal(await balance(), 3);
    // Balance committed but ready snapshot fails: cancellation refunds exactly once.
    const brokenResults = proxy(results, 'findOneAndUpdate', (filter, update, options) => { if (update.$set?.startStatus === 'ready') throw new Error('ready unavailable'); return results.findOneAndUpdate(filter, update, options); });
    const refund = dto();
    assert.equal((await run(new InterviewStartService(brokenResults, consumption, ledger, ai), refund)).at(-1).type, 'error');
    assert.equal(await balance(), 2);
    await Promise.allSettled(Array.from({ length: 6 }, () => service.cancel(userId, refund)));
    assert.equal((await service.cancel(userId, refund)).status, 'cancelled');
    assert.equal(await balance(), 3);
    assert.equal((await run(service, refund)).at(-1).startStatus, 'cancelled');
    // A stale debit that read pending before cancellation cannot cross the barrier.
    let release, entered;
    const gate = new Promise(r => { release = r; });
    const waiting = new Promise(r => { entered = r; });
    const slowUsers = proxy(users, 'findOneAndUpdate', async (...args) => { entered(); await gate; return users.findOneAndUpdate(...args); });
    const raceId = randomUUID();
    const old = new QuotaLedgerService(slowUsers, operations).apply(userId, 'race-test', raceId, { specialRemainingCount: -1 }).then(() => null, error => error);
    await waiting;
    await ledger.reverse(userId, 'race-test', raceId, { specialRemainingCount: -1 });
    release(); assert(await old instanceof Error);
    assert.equal(await balance(), 3);
    const publicUser = (await users.findById(userId)).toObject();
    assert(!('quotaReceipt' in publicUser)); assert(!('quotaRevision' in publicUser));
    console.log('PASS: JWT/DTO/HTTP/SSE; 8 concurrent starts deduct once; restart replay; payload conflict; zero-quota cancellation; cancellation before delayed start; resume failure; receipt recovery; exactly-once refund; stale debit fencing; hidden account metadata. No paid providers.');
    if (process.env.KEEP_START_SERVER === '1') {
      await writeFile('/tmp/msm-phase1-local/start-ui-fixture.json', JSON.stringify({ token, userId }), { mode: 0o600 });
      console.log('Browser fixture ready on 3010');
      await new Promise(resolve => process.once('SIGTERM', resolve));
    }
  } finally {
    await app.close();
    await Promise.all([users.deleteOne({ _id: userId }), operations.deleteMany({ userId }), results.deleteMany({ userId }), consumption.deleteMany({ userId })]);
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
