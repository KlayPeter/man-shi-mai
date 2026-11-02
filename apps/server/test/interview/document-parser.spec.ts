import axios from 'axios';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each(['pdf', 'docx'])(
    'extracts actual %s bytes without mocking the parser',
    async (extension) => {
      jest
        .spyOn(storage, 'getResumeReadUrl')
        .mockResolvedValue('https://signed.example.test/resume');
      jest.mocked(axios.get).mockResolvedValue({
        data: readFileSync(join(__dirname, 'fixtures', `resume.${extension}`)),
      });
      const text = parser.cleanText(
        await parser.parseDocumentFromUrl(
          `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.${extension}`,
          userId,
        ),
      );
      expect(text).toContain('Frontend engineer');
      expect(text).toContain('1.8 seconds to 0.9 seconds');
      expect(parser.validateResumeContent(text).isValid).toBe(true);
    },
  );

  it.each(['pdf', 'docx'])('rejects damaged %s content', async (extension) => {
    jest
      .spyOn(storage, 'getResumeReadUrl')
      .mockResolvedValue('https://signed.example.test/resume');
    jest
      .mocked(axios.get)
      .mockResolvedValue({ data: Buffer.from('not a document') });
    await expect(
      parser.parseDocumentFromUrl(
        `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/bad.${extension}`,
        userId,
      ),
    ).rejects.toThrow('解析失败');
  });

  it('rejects another user file before downloading', async () => {
    jest.mocked(axios.get).mockClear();
    await expect(
      parser.parseDocumentFromUrl(
        'https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/another-user/resume.pdf',
        userId,
      ),
    ).rejects.toThrow('只能使用本人');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { status: 403 } }, '无法访问简历文件'],
    [{ response: { status: 404 } }, '文件不存在'],
    [{ code: 'ECONNABORTED' }, '文件下载超时'],
  ])('reports download failures safely', async (error, message) => {
    jest
      .spyOn(storage, 'getResumeReadUrl')
      .mockResolvedValue('https://signed.example.test/resume');
    jest.mocked(axios.get).mockRejectedValue(error);
    await expect(
      parser.parseDocumentFromUrl(
        `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.pdf`,
        userId,
      ),
    ).rejects.toThrow(message);
  });

  it.each([
    [Buffer.alloc(0), '文件为空'],
    [Buffer.alloc(10 * 1024 * 1024 + 1), '文件过大'],
  ])('rejects invalid download sizes before parsing', async (data, message) => {
    jest
      .spyOn(storage, 'getResumeReadUrl')
      .mockResolvedValue('https://signed.example.test/resume');
    jest.mocked(axios.get).mockResolvedValue({ data });
    await expect(
      parser.parseDocumentFromUrl(
        `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.pdf`,
        userId,
      ),
    ).rejects.toThrow(message);
  });

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
