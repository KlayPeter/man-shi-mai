import { Model } from 'mongoose';
import { lastValueFrom, toArray } from 'rxjs';
import { InterviewStartService } from '../../src/interview/services/interview-start.service';
import { InterviewAIService } from '../../src/interview/services/interview-ai.service';
import { QuotaLedgerService } from '../../src/user/quota-ledger.service';
import { AIInterviewResultDocument } from '../../src/interview/schemas/ai-interview-result.schema';
import { ConsumptionRecordDocument } from '../../src/interview/schemas/consumption-record.schema';
import { MockInterviewType } from '../../src/interview/dto/mock-interview.dto';

it('rejects an empty target before preparing a resume or debiting quota', async () => {
  const results = { updateOne: jest.fn() };
  const quota = { apply: jest.fn() };
  const resolveResume = jest.fn();
  const service = new InterviewStartService(
    results as unknown as Model<AIInterviewResultDocument>,
    {} as Model<ConsumptionRecordDocument>,
    quota as unknown as QuotaLedgerService,
    {} as InterviewAIService,
  );
  const events = await lastValueFrom(
    service
      .start(
        '507f1f77bcf86cd799439011',
        {
          requestId: '4f387521-e4c9-46da-ab7f-da395e70254f',
          interviewType: MockInterviewType.SPECIAL,
          positionName: ' ',
        },
        resolveResume,
      )
      .pipe(toArray()),
  );
  expect(events).toEqual([
    expect.objectContaining({ type: 'error', error: '请选择目标岗位' }),
  ]);
  expect(results.updateOne).not.toHaveBeenCalled();
  expect(quota.apply).not.toHaveBeenCalled();
  expect(resolveResume).not.toHaveBeenCalled();
});
