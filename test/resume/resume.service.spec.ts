import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResumeService } from '../../src/resume/resume.service';
import { Resume } from '../../src/resume/schemas/resume.schema';

describe('ResumeService', () => {
  let service: ResumeService;
  let model: any;

  beforeEach(async () => {
    const mockModel = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findOneAndDelete: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        {
          provide: getModelToken(Resume.name),
          useValue: mockModel,
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
});
