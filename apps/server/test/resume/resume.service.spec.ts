import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResumeService } from '../../src/resume/resume.service';
import { Resume } from '../../src/resume/schemas/resume.schema';
import { DocumentParserService } from '../../src/interview/services/document-parser.service';
import { StsService } from '../../src/sts/sts.service';

describe('ResumeService', () => {
  let service: ResumeService;
  let model: any;
  let parser: jest.Mocked<
    Pick<
      DocumentParserService,
      'parseDocumentFromUrl' | 'cleanText' | 'validateResumeContent'
    >
  >;

  class MockResumeModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(this);
    static find = jest.fn().mockReturnThis();
    static sort = jest.fn().mockReturnThis();
    static lean = jest.fn().mockResolvedValue([]);
    static findOne = jest.fn().mockReturnThis();
    static findOneAndDelete = jest.fn();
    static findOneAndUpdate = jest.fn();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    parser = {
      parseDocumentFromUrl: jest.fn().mockResolvedValue('合成简历正文'),
      cleanText: jest.fn().mockReturnValue('清理后的合成简历正文'),
      validateResumeContent: jest.fn().mockReturnValue({ isValid: true }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: DocumentParserService, useValue: parser },
        {
          provide: StsService,
          useValue: new StsService(
            new ConfigService({
              OSS_BUCKET: 'test-bucket',
              OSS_REGION: 'oss-cn-beijing',
            }),
          ),
        },
        {
          provide: getModelToken(Resume.name),
          useValue: MockResumeModel,
        },
      ],
    }).compile();

    service = module.get<ResumeService>(ResumeService);
    model = module.get(getModelToken(Resume.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('saves only the authenticated owner and an unsigned HTTPS file URL', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const path = `test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.pdf`;
    const saved = await service.uploadResume(userId, {
      url: `http://${path}?secret=temporary#fragment`,
      resumeName: '合成简历',
      uploadTime: '2026-11-02T00:00:00.000Z',
    });
    expect(saved.userId).toBe(userId);
    expect(saved.url).toBe(`https://${path}`);
    expect(parser.parseDocumentFromUrl).toHaveBeenCalledWith(
      `https://${path}`,
      userId,
      5 * 1024 * 1024,
    );
    expect(saved.plainTextSnapshot).toBe('清理后的合成简历正文');
    expect(saved.status).toBe('ready');
    expect(saved.sourceType).toBe('upload');
  });

  it('rejects unreadable or invalid OSS documents instead of saving an empty resume', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const dto = {
      url: `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.pdf`,
      resumeName: '合成简历',
      uploadTime: '2026-11-02T00:00:00.000Z',
    };
    parser.parseDocumentFromUrl.mockRejectedValueOnce(new Error('文件不存在'));
    await expect(service.uploadResume(userId, dto)).rejects.toThrow(
      '文件不存在',
    );
    expect(parser.cleanText).not.toHaveBeenCalled();
    parser.validateResumeContent.mockReturnValueOnce({
      isValid: false,
      reason: '正文过短',
    });
    await expect(service.uploadResume(userId, dto)).rejects.toThrow('正文过短');
  });

  it.each(['another-user/resume.pdf', '507f1f77bcf86cd799439011/resume.doc'])(
    'rejects cross-user files and unsupported extensions before saving',
    async (path) => {
      await expect(
        service.uploadResume('507f1f77bcf86cd799439011', {
          url: `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${path}`,
          resumeName: '合成简历',
          uploadTime: '2026-11-02T00:00:00.000Z',
        }),
      ).rejects.toThrow();
    },
  );

  describe('getInterviewResumeList', () => {
    it('should query resumes by userId and sort them', async () => {
      const result = await service.getInterviewResumeList('user-123');
      expect(model.find).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(result).toEqual([]);
    });
  });

  describe('getResumeDetail', () => {
    it('should query resume by id and user id', async () => {
      model.lean.mockResolvedValueOnce({ _id: 'res-1', userId: 'user-123' });
      const result = await service.getResumeDetail('user-123', 'res-1');
      expect(model.findOne).toHaveBeenCalledWith({
        _id: 'res-1',
        userId: 'user-123',
      });
      expect(result._id).toBe('res-1');
    });
  });

  describe('createEmptyResume', () => {
    it('should instantiate and save a new empty resume', async () => {
      const dto = { resumeName: 'My Resume' };
      const result = await service.createEmptyResume('user-123', dto);
      expect(result.userId).toBe('user-123');
      expect(result.resumeName).toBe('My Resume');
      expect(result.sourceType).toBe('editor');
    });
  });

  describe('updateResumeContent', () => {
    it('should update editorData and snapshot', async () => {
      const dto = { editorData: { a: 1 }, plainTextSnapshot: 'text' };
      model.findOneAndUpdate.mockResolvedValueOnce({ _id: 'res-1', ...dto });
      const result = await service.updateResumeContent(
        'user-123',
        'res-1',
        dto,
      );
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'res-1', userId: 'user-123' },
        {
          editorData: dto.editorData,
          plainTextSnapshot: dto.plainTextSnapshot,
          status: 'ready',
        },
        { new: true },
      );
      expect(result._id).toBe('res-1');
    });
  });
});
