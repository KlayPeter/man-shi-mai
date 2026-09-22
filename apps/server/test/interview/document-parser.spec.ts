import axios from 'axios';
import { StsService } from '../../src/sts/sts.service';
import { ConfigService } from '@nestjs/config';
import { DocumentParserService } from '../../src/interview/services/document-parser.service';

jest.mock('axios');

describe('document download boundaries', () => {
  const storage = new StsService(
    new ConfigService({
      OSS_BUCKET: 'test-bucket',
      OSS_REGION: 'oss-cn-beijing',
    }),
  );
  const parser = new DocumentParserService(storage);
  const userId = '507f1f77bcf86cd799439011';
  afterEach(() => jest.restoreAllMocks());

  it('preserves English word boundaries and resume sections', () => {
    expect(
      parser.cleanText(
        '  Frontend   engineer\r\n\r\n项目经历\n  React development  ',
      ),
    ).toBe('Frontend engineer\n\n项目经历\nReact development');
  });

  it('rejects a misleading extension in the query before authorization or downloading', async () => {
    await expect(
      parser.parseDocumentFromUrl(
        'https://example.test/private?name=.pdf',
        userId,
      ),
    ).rejects.toThrow('不支持的文件格式');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('does not follow a storage redirect and never exposes the signed query in errors', async () => {
    jest
      .spyOn(storage, 'getResumeReadUrl')
      .mockResolvedValue(
        'https://test-bucket.oss-cn-beijing.aliyuncs.com/a.pdf?secret=do-not-expose',
      );
    jest.mocked(axios.get).mockRejectedValue({
      response: { status: 302 },
      message: 'secret=do-not-expose',
    });
    await expect(
      parser.parseDocumentFromUrl(
        'https://test-bucket.oss-cn-beijing.aliyuncs.com/a.pdf',
        userId,
      ),
    ).rejects.toThrow('文件下载失败，请检查上传是否完成后重试');
    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        maxRedirects: 0,
        proxy: false,
        maxContentLength: 10 * 1024 * 1024,
      }),
    );
  });
});
