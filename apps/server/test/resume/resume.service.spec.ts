import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResumeService } from '../../src/resume/resume.service';
import { Resume } from '../../src/resume/schemas/resume.schema';
import { StsService } from '../../src/sts/sts.service';

describe('ResumeService', () => {
  let service: ResumeService;
  let model: any;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        { provide: StsService, useValue: { assertOwnedResumeUrl: jest.fn() } },
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
