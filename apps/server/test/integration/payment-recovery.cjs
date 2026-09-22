/* Dedicated standalone MongoDB only. Compiled service, real atomic updates, no payment gateway. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { ConfigService } = require('@nestjs/config');
const { PaymentService } = require('../../dist/src/payment/payment.service');
const { PaymentRecordSchema } = require('../../dist/src/payment/payment-record.schema');
const { UserSchema } = require('../../dist/src/user/schemas/user.schema');
const { UserTransactionSchema } = require('../../dist/src/user/schemas/user-transaction.schema');
const uri = process.env.TEST_MONGODB_URI;
if (process.env.RUN_LOCAL_INTEGRATION !== '1' || uri !== 'mongodb://127.0.0.1:27028/msm_phase1') throw new Error('Requires dedicated local msm_phase1 MongoDB on port 27028.');
(async () => {
  await mongoose.connect(uri);
  const records = mongoose.model('PaymentRecord', PaymentRecordSchema);
  const users = mongoose.model('User', UserSchema);
  const ledger = mongoose.model('UserTransaction', UserTransactionSchema);
  await Promise.all([records.init(), users.init(), ledger.init()]);
  const service = new PaymentService(records, users, ledger, new ConfigService({ NODE_ENV: 'test', PAYMENT_MODE: 'virtual' }));
  const dto = { planId: 'single', amount: 18.8, planName: 'test', description: 'Synthetic test', source: 'web', channel: 'virtual' };
  const ids = [];
  async function account() {
    const suffix = randomUUID();
    const user = await users.create({ username: `p-${suffix.slice(0, 8)}`, email: `${suffix}@example.test`, password: 'synthetic-hash-no-login', specialRemainingCount: 0 });
    ids.push(user._id);
    return { userId: String(user._id) };
  }
  try {
    const owner = await account();
    const order = await service.initiatePayment(dto, owner);
    await service.queryAlipayPaymentStatus(order.orderId, owner);
    assert.equal((await users.findById(owner.userId)).specialRemainingCount, 0, 'query must not grant');
    let failOnce = true;
    const failingLedger = new Proxy(ledger, { get(target, name) {
      if (name === 'findOneAndUpdate') return (...args) => {
        if (failOnce) { failOnce = false; return { exec: async () => { throw new Error('injected ledger failure'); } }; }
        return target.findOneAndUpdate(...args);
      };
      return Reflect.get(target, name);
    } });
    const interrupted = new PaymentService(records, users, failingLedger, new ConfigService({ NODE_ENV: 'test', PAYMENT_MODE: 'virtual' }));
    await assert.rejects(() => interrupted.mockPaymentSuccess(order.orderId, owner), /injected ledger failure/);
    assert.equal((await users.findById(owner.userId)).specialRemainingCount, 1);
    assert.equal((await records.findOne({ orderId: order.orderId })).status, 'pending');
    assert.equal(await ledger.countDocuments({ relatedOrderId: order.orderId }), 0);
    const recovered = await service.mockPaymentSuccess(order.orderId, owner);
    assert.equal(recovered.success, true);
    assert.equal(recovered.user.specialRemainingCount, 1);
    assert.equal(recovered.user.password, undefined);
    assert.equal(recovered.user.virtualPaymentOrderId, undefined);
    await Promise.all(Array.from({ length: 8 }, () => service.mockPaymentSuccess(order.orderId, owner)));
    assert.equal((await users.findById(owner.userId)).specialRemainingCount, 1);
    assert.equal(await ledger.countDocuments({ relatedOrderId: order.orderId }), 1);

    const racer = await account();
    const orders = await Promise.all(Array.from({ length: 8 }, () => service.initiatePayment(dto, racer)));
    const results = await Promise.allSettled(orders.map(item => service.mockPaymentSuccess(item.orderId, racer)));
    assert.equal(results.filter(item => item.status === 'fulfilled' && item.value.success).length, 1);
    assert.equal((await users.findById(racer.userId)).specialRemainingCount, 1);
    assert.equal(await ledger.countDocuments({ userIdentifier: racer.userId }), 1);

    const expiredOwner = await account();
    const expired = await service.initiatePayment(dto, expiredOwner);
    await records.updateOne({ orderId: expired.orderId }, { $set: { status: 'processing', processingToken: randomUUID(), processingExpiresAt: new Date(0) } });
    assert.equal((await service.mockPaymentSuccess(expired.orderId, expiredOwner)).success, true);
    assert.equal((await users.findById(expiredOwner.userId)).specialRemainingCount, 1);
    const production = new PaymentService(records, users, ledger, new ConfigService({ NODE_ENV: 'production', PAYMENT_MODE: 'virtual' }));
    await assert.rejects(() => production.mockPaymentSuccess(order.orderId, owner), error => error.getStatus() === 503);
    console.log('PASS: real MongoDB query read-only, failure/retry and expired lease recovery, same/different-order concurrency, safe response and production rejection. No gateway calls.');
  } finally {
    await ledger.deleteMany({ userIdentifier: { $in: ids.map(String) } });
    await records.deleteMany({ userId: { $in: ids.map(String) } });
    await users.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
