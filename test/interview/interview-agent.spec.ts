import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { AIModelFactory } from '../../src/ai/services/ai-model.factory';

// Mock @langchain/langgraph using a self-contained factory function to avoid Jest hoisting ReferenceErrors
jest.mock('@langchain/langgraph', () => {
  const mockAnnotation = jest.fn().mockImplementation(() => ({
    reducer: jest.fn(),
    default: jest.fn(),
  }));
  (mockAnnotation as any).Root = jest.fn().mockReturnValue({});

  return {
    StateGraph: jest.fn().mockImplementation(() => {
      return {
        addNode: jest.fn(),
        addEdge: jest.fn(),
        addConditionalEdges: jest.fn(),
        compile: jest.fn()
      };
    }),
    START: '__start__',
    END: '__end__',
    Annotation: mockAnnotation
  };
});

describe('InterviewAgentService', () => {
  let service: InterviewAgentService;
  let mockAIModelFactory: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-api-key'),
    };

    const mockModel = {
      stream: async (input: any) => {
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { content: '这是大模型流式提问。' };
          }
        };
      },
      pipe: () => {
        return {
          invoke: async () => {
            return {
              analysis: '回答很好',
              isQuestionAnswered: true,
              discoveredSkills: ['JavaScript'],
              suggestTransition: false,
              reason: '继续下一问'
            };
          }
        };
      }
    };

    mockAIModelFactory = {
      createDefaultModel: jest.fn().mockReturnValue(mockModel),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewAgentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AIModelFactory,
          useValue: mockAIModelFactory,
        },
      ],
    }).compile();

    service = module.get<InterviewAgentService>(InterviewAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateInterviewQuestionStream', () => {
    it('should generate first question stream for introduction phase', async () => {
      // 模拟图编译的私有函数，触发 onChunkToken 回调输出开场白
      jest.spyOn(service as any, 'compileInterviewGraph').mockImplementation((onChunkToken: any) => {
        return {
          invoke: async (stateInput: any) => {
            const text = '你好，我是你今天的面试官。很高兴能与你进行这次面试。我看到你申请的是全栈工程师岗位。首先，请你简单介绍一下自己。';
            onChunkToken(text);
            return {
              messages: [],
              currentPhase: 'resume_digging',
              questionsAskedCount: 1,
              extractedSkills: ['JavaScript'],
              interviewEnded: false
            };
          }
        };
      });

      const generator = service.generateInterviewQuestionStream({
        interviewType: 'special',
        resumeContent: '简历内容',
        positionName: '全栈工程师',
        conversationHistory: [],
        elapsedMinutes: 0,
        targetDuration: 45
      });

      const chunks: string[] = [];
      let result = await generator.next();
      while (!result.done) {
        chunks.push(result.value);
        result = await generator.next();
      }

      // 验证是否包含引言
      expect(chunks.join('')).toContain('你好，我是你今天的面试官');
      expect(result.value).toBeDefined();
      expect(result.value.metadata.currentPhase).toBe('resume_digging');
    });
  });
});
