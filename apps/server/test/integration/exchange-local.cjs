/* Dedicated Mongo and synthetic accounts only; real JWT/DTO/HTTP/ledger, no paid providers. */
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
const { InterviewController } = require('../../dist/src/interview/interview.controller');
const { InterviewService } = require('../../dist/src/interview/services/interview.service');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { InterviewSpeechService } = require('../../dist/src/interview/services/interview-speech.service');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');
const { QuotaLedgerService } = require('../../dist/src/user/quota-ledger.service');
const { UserController } = require('../../dist/src/user/user.controller');
const { UserService } = require('../../dist/src/user/user.service');

const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') {
  throw new Error('Dedicated local msm_phase1 database required');
}

(async () => {
  await mongoose.connect(uri);
  const users = mongoose.model('User', require('../../dist/src/user/schemas/user.schema').UserSchema);
  const operations = mongoose.model('QuotaOperation', require('../../dist/src/user/schemas/quota-operation.schema').QuotaOperationSchema);
  const transactions = mongoose.model('UserTransaction', require('../../dist/src/user/schemas/user-transaction.schema').UserTransactionSchema);
  await Promise.all([users, operations, transactions].map(model => model.init()));
  const ids = [String(new mongoose.Types.ObjectId()), String(new mongoose.Types.ObjectId())];
  let browserUserId;
  let app;
  try {
    await users.create(ids.map((_id) => ({ _id, username: `exchange-test-${randomUUID()}`, maiCoinBalance: 20, resumeRemainingCount: 0, specialRemainingCount: 0 })));
    const quota = new QuotaLedgerService(users, operations);
    const makeExchange = (txModel) => Object.assign(Object.create(InterviewService.prototype), {
      quota, userModel: users, userTransactionModel: txModel, logger: { log() {} },
    });
    let exchange = makeExchange(transactions);
    const facade = { exchangePackage: (userId, type, requestId) => exchange.exchangePackage(userId, type, requestId) };
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [InterviewController, UserController],
      providers: [JwtStrategy, JwtAuthGuard,
        { provide: InterviewService, useValue: facade },
        { provide: InterviewReportService, useValue: {} },
        { provide: InterviewSpeechService, useValue: {} },
        { provide: UserService, useValue: {
          getUserInfo: (userId) => users.findById(userId).lean(),
          getUserTransactions: (userId) => transactions.find({ userIdentifier: userId }).lean(),
        } },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'exchange-local-test-secret' }) },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    const port = Number(process.env.TEST_EXCHANGE_PORT || 3015);
    await app.listen(port, '127.0.0.1');
    const jwt = new JwtService({ secret: 'exchange-local-test-secret' });
    const tokens = ids.map(userId => jwt.sign({ userId }));
    const post = async (body, token = tokens[0]) => {
      const response = await fetch(`http://127.0.0.1:${port}/interview/exchange-package`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      });
      return { status: response.status, body: await response.json() };
    };

    const first = { requestId: randomUUID(), packageType: 'resume' };
    assert.equal((await post(first, '')).status, 401);
    assert.equal((await post({ packageType: 'resume' })).status, 400);
    assert.equal((await post({ requestId: 'bad', packageType: 'resume' })).status, 400);
    assert.equal((await post({ requestId: randomUUID(), packageType: 'unknown' })).status, 400);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => post(first)));
    assert(concurrent.some(response => response.status === 201));
    assert.equal((await post(first)).body.data.requestId, first.requestId);
    assert.equal((await post({ ...first, packageType: 'special' })).status, 409);
    const firstAccount = await users.findById(ids[0]);
    assert.equal(firstAccount.maiCoinBalance, 0);
    assert.equal(firstAccount.resumeRemainingCount, 1);
    assert.equal(firstAccount.specialRemainingCount, 0);
    assert.equal(await transactions.countDocuments({ userIdentifier: ids[0], source: 'MAI_exchange' }), 1);
    assert.equal((await post({ requestId: randomUUID(), packageType: 'resume' })).status, 400);

    let failOnce = true;
    const failingTransactions = new Proxy(transactions, { get(target, property) {
      if (property === 'updateOne') return (...args) => {
        if (failOnce) { failOnce = false; throw new Error('synthetic transaction write failure'); }
        return transactions.updateOne(...args);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    exchange = makeExchange(failingTransactions);
    const second = { requestId: randomUUID(), packageType: 'special' };
    assert.equal((await post(second, tokens[1])).status, 500);
    const afterFault = await users.findById(ids[1]);
    assert.equal(afterFault.maiCoinBalance, 0);
    assert.equal(afterFault.specialRemainingCount, 1);
    assert.equal(await transactions.countDocuments({ userIdentifier: ids[1], source: 'MAI_exchange' }), 0);
    exchange = makeExchange(transactions);
    assert.equal((await post(second, tokens[1])).status, 201);
    assert.equal((await post(second, tokens[1])).status, 201);
    assert.equal(await transactions.countDocuments({ userIdentifier: ids[1], source: 'MAI_exchange' }), 1);
    const repaired = await users.findById(ids[1]);
    assert.equal(repaired.maiCoinBalance, 0);
    assert.equal(repaired.specialRemainingCount, 1);
    console.log('PASS: authenticated exchange DTO, concurrent same-ID debit/credit once, replay, payload conflict, insufficient balance, transaction write failure repair. Synthetic accounts only.');
    if (process.env.KEEP_EXCHANGE_SERVER === '1') {
      browserUserId = String(new mongoose.Types.ObjectId());
      await users.create({ _id: browserUserId, username: `exchange-test-${randomUUID()}`, maiCoinBalance: 20, resumeRemainingCount: 0, specialRemainingCount: 0 });
      const token = jwt.sign({ userId: browserUserId });
      await writeFile(process.env.EXCHANGE_FIXTURE_PATH || '/tmp/msm-phase1-local/exchange-fixture.json', JSON.stringify({ token, userId: browserUserId }), { mode: 0o600 });
      console.log(`Browser fixture ready on ${port}`);
      await new Promise(resolve => process.once('SIGTERM', resolve));
    }
  } finally {
    if (app) await app.close();
    await Promise.all([
      users.deleteMany({ _id: { $in: [...ids, browserUserId].filter(Boolean) } }),
      operations.deleteMany({ userId: { $in: [...ids, browserUserId].filter(Boolean) } }),
      transactions.deleteMany({ userIdentifier: { $in: [...ids, browserUserId].filter(Boolean) }, source: 'MAI_exchange' }),
    ]);
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
