import { Test, TestingModule } from '@nestjs/testing';

const mockChain = {
  pipe: jest.fn().mockImplementation(function (this: any) {
    return this;
  }),
  invoke: jest.fn(),
};

jest.mock('@langchain/core/prompts', () => {
  return {
    PromptTemplate: {
      fromTemplate: jest.fn().mockReturnValue(mockChain),
    },
  };
});

jest.mock('@langchain/core/output_parsers', () => {
  return {
    JsonOutputParser: jest.fn().mockImplementation(() => ({
      pipe: jest.fn().mockImplementation(function (this: any) {
        return this;
      }),
    })),
  };
});

jest.mock('src/ai/services/ai-model.factory', () => {
  return {
    AIModelFactory: jest.fn().mockImplementation(() => ({
      createDefaultModel: jest.fn(),
    })),
  };
});

import { ResumeAnalysisService } from '../../src/interview/services/resume-analysis.service';
import { AIModelFactory } from 'src/ai/services/ai-model.factory';

describe('ResumeAnalysisService', () => {
  let service: ResumeAnalysisService;
  let aiModelFactory: any;

  beforeEach(async () => {
    const mockAIModelFactory = new AIModelFactory() as any;
    mockAIModelFactory.createDefaultModel.mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeAnalysisService,
        {
          provide: AIModelFactory,
          useValue: mockAIModelFactory,
        },
      ],
    }).compile();

    service = module.get<ResumeAnalysisService>(ResumeAnalysisService);
    aiModelFactory = module.get(AIModelFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    it('should invoke chain and return resume analysis result', async () => {
      mockChain.invoke.mockResolvedValue({
        suitability: 'High',
        strengths: ['NestJS', 'TypeScript'],
        weaknesses: ['Vue'],
      });

      const result = await service.analyze('Resume Content', 'Job Description');

      expect(aiModelFactory.createDefaultModel).toHaveBeenCalled();
      expect(result).toEqual({
        suitability: 'High',
        strengths: ['NestJS', 'TypeScript'],
        weaknesses: ['Vue'],
      });
    });

    it('should log and throw error if chain invocation fails', async () => {
      mockChain.invoke.mockRejectedValueOnce(new Error('AI Model Error'));

      await expect(
        service.analyze('Resume Content', 'Job Description'),
      ).rejects.toThrow('AI Model Error');
    });
  });
});
