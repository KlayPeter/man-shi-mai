import { ValidationPipe } from '@nestjs/common';
import { InterviewHistoryQueryDto } from '../../src/interview/dto/interview-history.dto';

describe('history pagination validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (value: unknown) =>
    pipe.transform(value, {
      type: 'query',
      metatype: InterviewHistoryQueryDto,
    });
  it('uses bounded defaults and converts query strings', async () => {
    await expect(parse({})).resolves.toEqual({ page: 1, limit: 10 });
    await expect(
      parse({ page: '2', limit: '50', userId: 'other' }),
    ).resolves.toEqual({ page: 2, limit: 50 });
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.2' },
    { page: 'NaN' },
    { page: '100001' },
    { limit: '0' },
    { limit: '51' },
    { limit: ['1', '2'] },
  ])('rejects invalid query %j', async (value) => {
    await expect(parse(value)).rejects.toMatchObject({ status: 400 });
  });
});
