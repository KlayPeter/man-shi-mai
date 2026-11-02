import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { AIModelFactory } from '../../src/ai/services/ai-model.factory';
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from '@langchain/core/messages';

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
        compile: jest.fn(),
      };
    }),
    START: '__start__',
    END: '__end__',
    Annotation: mockAnnotation,
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
          },
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
              reason: '继续下一问',
            };
          },
        };
      },
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

  it('judges the answer against its own preceding question, excluding later messages', async () => {
    const invoke = jest.fn().mockResolvedValue({ isQuestionAnswered: false });
    mockAIModelFactory.createDefaultModel.mockReturnValue({
      pipe: () => ({ invoke }),
    });
    await service['evaluatePhaseTransition']({
      currentPhase: 'tech_assessment',
      jd: 'React',
      resumeContent: '合成简历',
      messages: [
        new AIMessage('旧问题'),
        new HumanMessage('旧回答'),
        new AIMessage('如何计算虚拟列表的渲染范围？'),
        new HumanMessage('我和产品一起按清单验收。'),
        new AIMessage('后续问题，不应参与上一轮判定'),
      ],
    });
    const prompt: string = invoke.mock.calls[0][0];
    expect(prompt).toContain('本轮面试官提问: 如何计算虚拟列表的渲染范围？');
    expect(prompt).toContain('我和产品一起按清单验收。');
    expect(prompt).not.toContain('旧问题');
    expect(prompt).not.toContain('后续问题');
  });

  const techState = (answer: string) => ({
    questionsAskedCount: 0,
    maxQuestionsPerPhase: 2,
    messages: [new HumanMessage(answer)],
    extractedSkills: [],
    positionName: '前端开发工程师',
    jd: 'React',
    resumeContent: '',
    practiceIntensity: 'standard',
  });

  it('publishes the first technical token before the model finishes and retains the complete question', async () => {
    let release!: () => void;
    let firstChunk!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = new Promise<void>((resolve) => {
      firstChunk = resolve;
    });
    const stream = jest.fn(async function* () {
      yield new AIMessageChunk('你如何验证');
      await gate;
      yield new AIMessageChunk('这个优化的收益？');
    });
    mockAIModelFactory.createDefaultModel.mockReturnValue({ stream });
    const chunks: string[] = [];
    let finished = false;
    const running = service['handleTechAssessment'](
      techState('我做过列表优化。'),
      (token) => {
        chunks.push(token);
        firstChunk();
      },
    ).then((result) => {
      finished = true;
      return result;
    });
    await first;
    expect(chunks).toEqual(['你如何验证']);
    expect(finished).toBe(false);
    release();
    const result = await running;
    expect(chunks.join('')).toBe('你如何验证这个优化的收益？');
    expect(result.messages[0].content).toBe(chunks.join(''));
    expect(result.questionsAskedCount).toBe(1);
  });

  it('analyzes code as text without binding or running execution tools', async () => {
    const bindTools = jest.fn();
    const stream = jest.fn(async function* (
      _messages: import('@langchain/core/messages').BaseMessage[],
    ) {
      yield new AIMessageChunk('这个实现如何处理空数组？');
    });
    mockAIModelFactory.createDefaultModel.mockReturnValue({
      stream,
      bindTools,
    });
    const result = await service['handleTechAssessment'](
      techState('```js\nconst result = [1, 2].map(x => x * 2);\n```'),
      () => undefined,
    );
    expect(bindTools).not.toHaveBeenCalled();
    expect(stream.mock.calls[0][0][0].content).toContain('不得运行候选人代码');
    expect(result.messages[0].content).toContain('空数组');
  });

  it('passes cancellation to the technical stream and does not finish a cancelled question', async () => {
    const controller = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const stream = jest.fn(async function* (
      _messages: unknown,
      options: { signal?: AbortSignal },
    ) {
      started();
      await new Promise<void>((_resolve, reject) =>
        options.signal?.addEventListener(
          'abort',
          () =>
            reject(
              options.signal?.reason instanceof Error
                ? options.signal.reason
                : new Error('stream cancelled'),
            ),
          { once: true },
        ),
      );
      yield new AIMessageChunk('不应出现');
    });
    mockAIModelFactory.createDefaultModel.mockReturnValue({ stream });
    const onChunk = jest.fn();
    const running = service['handleTechAssessment'](
      techState('我做过列表优化。'),
      onChunk,
      controller.signal,
    );
    await ready;
    controller.abort(new Error('synthetic cancellation'));
    await expect(running).rejects.toThrow('synthetic cancellation');
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('does not swallow cancellation as a successful phase judgement', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancel judgement'));
    mockAIModelFactory.createDefaultModel.mockReturnValue({
      pipe: () => ({
        invoke: jest.fn().mockRejectedValue(controller.signal.reason),
      }),
    });
    await expect(
      service['evaluatePhaseTransition'](
        {
          currentPhase: 'tech_assessment',
          jd: '',
          resumeContent: '',
          messages: [new AIMessage('问题'), new HumanMessage('回答')],
        },
        controller.signal,
      ),
    ).rejects.toThrow('cancel judgement');
  });

  describe('generateInterviewQuestionStream', () => {
    it('passes the chosen phase limit into the graph', async () => {
      const seen: {
        practiceIntensity: string;
        maxQuestionsPerPhase: number;
        currentPhase: string;
      }[] = [];
      Object.defineProperty(service, 'compileInterviewGraph', {
        value: () => ({
          invoke: async (stateInput: {
            practiceIntensity: string;
            maxQuestionsPerPhase: number;
            currentPhase: string;
          }) => {
            seen.push(stateInput);
            return {
              messages: [],
              currentPhase: stateInput.currentPhase,
              interviewEnded: false,
            };
          },
        }),
      });
      for (const practiceIntensity of [
        'warmup',
        'standard',
        'challenge',
      ] as const) {
        const generator = service.generateInterviewQuestionStream({
          interviewType: 'special',
          resumeContent: '',
          conversationHistory: [],
          elapsedMinutes: 0,
          targetDuration: 30,
          currentPhase: 'resume_digging',
          practiceIntensity,
        });
        while (!(await generator.next()).done) {
          /* no chunks from this synthetic graph */
        }
      }
      expect(
        seen.map((state) => [
          state.practiceIntensity,
          state.maxQuestionsPerPhase,
          state.currentPhase,
        ]),
      ).toEqual([
        ['warmup', 1, 'resume_digging'],
        ['standard', 2, 'resume_digging'],
        ['challenge', 3, 'resume_digging'],
      ]);
    });
    it('discards already buffered tokens when the request is cancelled', async () => {
      Object.defineProperty(service, 'compileInterviewGraph', {
        value: (onChunk: (text: string) => void) => ({
          invoke: async () => {
            onChunk('第一段');
            onChunk('不应再发送的第二段');
            return { currentPhase: 'tech_assessment' };
          },
        }),
      });
      const controller = new AbortController();
      const generator = service.generateInterviewQuestionStream({
        interviewType: 'special',
        resumeContent: '',
        conversationHistory: [],
        elapsedMinutes: 0,
        targetDuration: 30,
        signal: controller.signal,
      });
      expect((await generator.next()).value).toBe('第一段');
      controller.abort(new Error('cancel buffered output'));
      await expect(generator.next()).rejects.toThrow('cancel buffered output');
    });

    it('propagates graph errors after partial output instead of returning a successful turn', async () => {
      Object.defineProperty(service, 'compileInterviewGraph', {
        value: (onChunk: (text: string) => void) => ({
          invoke: async () => {
            onChunk('未完成的问题');
            throw new Error('synthetic graph failure');
          },
        }),
      });
      const generator = service.generateInterviewQuestionStream({
        interviewType: 'special',
        resumeContent: '',
        conversationHistory: [],
        elapsedMinutes: 0,
        targetDuration: 30,
      });
      expect((await generator.next()).value).toBe('未完成的问题');
      await expect(generator.next()).rejects.toThrow('synthetic graph failure');
    });

    it('should generate first question stream for introduction phase', async () => {
      // 模拟图编译的私有函数，触发 onChunkToken 回调输出开场白
      jest
        .spyOn(service as any, 'compileInterviewGraph')
        .mockImplementation((onChunkToken: any) => {
          return {
            invoke: async (stateInput: any) => {
              const text =
                '你好，我是你今天的面试官。很高兴能与你进行这次面试。我看到你申请的是全栈工程师岗位。首先，请你简单介绍一下自己。';
              onChunkToken(text);
              return {
                messages: [],
                currentPhase: 'resume_digging',
                questionsAskedCount: 1,
                extractedSkills: ['JavaScript'],
                interviewEnded: false,
              };
            },
          };
        });

      const generator = service.generateInterviewQuestionStream({
        interviewType: 'special',
        resumeContent: '简历内容',
        positionName: '全栈工程师',
        conversationHistory: [],
        elapsedMinutes: 0,
        targetDuration: 45,
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
