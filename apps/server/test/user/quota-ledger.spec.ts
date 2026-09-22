import { Model } from 'mongoose';
import { QuotaLedgerService } from '../../src/user/quota-ledger.service';
import { UserDocument } from '../../src/user/schemas/user.schema';
import { QuotaOperationDocument } from '../../src/user/schemas/quota-operation.schema';

describe('QuotaLedgerService boundary', () => {
  const users = { findById: jest.fn(), findOneAndUpdate: jest.fn() };
  const operations = { updateOne: jest.fn(), findById: jest.fn() };
  const service = new QuotaLedgerService(
    users as unknown as Model<UserDocument>,
    operations as unknown as Model<QuotaOperationDocument>,
  );
  beforeEach(() => jest.resetAllMocks());

  it.each([{}, { specialRemainingCount: 0 }, { specialRemainingCount: 0.5 }])(
    'rejects invalid changes before touching the database: %j',
    async (changes) => {
      await expect(
        service.apply('owner', 'start', 'id', changes),
      ).rejects.toThrow('权益变更参数无效');
      expect(operations.updateOne).not.toHaveBeenCalled();
      expect(users.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );
  it('rejects reusing an operation ID for a different debit', async () => {
    operations.updateOne.mockResolvedValue({});
    operations.findById.mockResolvedValue({
      userId: 'owner',
      payloadHash: 'different',
    });
    await expect(
      service.apply('owner', 'start', 'id', { specialRemainingCount: -1 }),
    ).rejects.toThrow('同一请求不能更换权益操作');
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
