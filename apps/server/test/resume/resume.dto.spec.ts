import { ValidationPipe } from '@nestjs/common';
import {
  DeleteResumeDto,
  UpdateResumeNameDto,
  UpdateResumeContentDto,
} from '../../src/resume/dto/resume.dto';
import { UpdateUserDto } from '../../src/user/dto/update-user.dto';

describe('HTTP input validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const resumeId = '507f1f77bcf86cd799439011';

  it('retains resume identifiers and names through the real whitelist pipe', async () => {
    expect(
      await pipe.transform(
        { resumeId },
        { type: 'body', metatype: DeleteResumeDto },
      ),
    ).toEqual({ resumeId });
    expect(
      await pipe.transform(
        { resumeId, resumeName: ' 新名称 ', userId: 'other' },
        { type: 'body', metatype: UpdateResumeNameDto },
      ),
    ).toEqual({ resumeId, resumeName: '新名称' });
  });

  it.each([
    { resumeId: 'invalid', resumeName: '名称' },
    { resumeId, resumeName: '   ' },
    { resumeId },
  ])('rejects invalid rename input %j', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: UpdateResumeNameDto }),
    ).rejects.toThrow();
  });

  it('rejects non-object editor content', async () => {
    await expect(
      pipe.transform(
        { editorData: 'invalid', plainTextSnapshot: '经历' },
        { type: 'body', metatype: UpdateResumeContentDto },
      ),
    ).rejects.toThrow();
  });

  it('accepts username while stripping protected account fields', async () => {
    expect(
      await pipe.transform(
        { username: ' 新名字 ', maiCoinBalance: 100, roles: ['admin'] },
        { type: 'body', metatype: UpdateUserDto },
      ),
    ).toEqual({ username: '新名字' });
  });
});
