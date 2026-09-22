import { interviewPolicy, PracticeIntensity } from './interview-policy';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import {
  AIMessage,
  HumanMessage,
  BaseMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { AIModelFactory } from '../../ai/services/ai-model.factory';
import {
  PhaseTransitionSchema,
  PhaseTransition,
} from '../dto/transition.schema';
import { createCodeSandboxTool } from '../tools/code-sandbox.tool';

/**
 * 定义 LangGraph 的状态 Annotation
 */
const InterviewStateAnnotation = Annotation.Root({
  practiceIntensity: Annotation<PracticeIntensity>({
    reducer: (x, y) => y ?? x,
    default: () => PracticeIntensity.STANDARD,
  }),
  company: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  // 1. 聊天历史消息记录
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 2. 当前所处的面试阶段
  currentPhase: Annotation<
    | 'introduction'
    | 'resume_digging'
    | 'tech_assessment'
    | 'behavioral_test'
    | 'candidate_qa'
    | 'closing'
  >({
    reducer: (x, y) => y ?? x,
    default: () => 'introduction',
  }),

  // 3. 候选人上下文
  candidateName: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '候选人',
  }),
  positionName: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '全栈工程师',
  }),
  resumeContent: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  jd: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // 4. 控制与评估指标
  questionsAskedCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  maxQuestionsPerPhase: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 3,
  }),
  extractedSkills: Annotation<string[]>({
    reducer: (x, y) => Array.from(new Set(x.concat(y ?? []))),
    default: () => [],
  }),

  // 5. 阶段退出与流程控制标志
  shouldTransition: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  interviewEnded: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
});

/**
 * 异步队列用于将回调式数据流转换为异步生成器 (AsyncGenerator)
 */
class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: IteratorResult<T>) => void)[] = [];
  private done = false;

  push(value: T) {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      if (resolve) {
        resolve({ value, done: false });
      }
    } else {
      this.queue.push(value);
    }
  }

  close() {
    this.done = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      if (resolve) {
        resolve({ value: undefined as any, done: true });
      }
    }
  }

  async *generator(): AsyncGenerator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.done) {
        break;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
        if (result.done) break;
        yield result.value;
      }
    }
  }
}

/**
 * 阶段一：基于 LangGraph 的 AI 面试官 Agent 服务
 */
@Injectable()
export class InterviewAgentService {
  private readonly logger = new Logger(InterviewAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiModelFactory: AIModelFactory,
  ) {}

  /**
   * 构建并编译 LangGraph 状态图
   * @param onChunkToken 外部传入的流式回调
   */
  private compileInterviewGraph(onChunkToken: (token: string) => void) {
    // 强制声明为 any 彻底关掉 LangGraph 的类型推导校验
    const workflow: any = new StateGraph(InterviewStateAnnotation as any);

    // 1. 注册核心面试节点
    workflow.addNode('introduction', (state: any) =>
      this.handleIntroduction(state, onChunkToken),
    );
    workflow.addNode('resume_digging', (state: any) =>
      this.handleResumeDigging(state, onChunkToken),
    );
    workflow.addNode('tech_assessment', (state: any) =>
      this.handleTechAssessment(state, onChunkToken),
    );
    workflow.addNode('behavioral_test', (state: any) =>
      this.handleBehavioralTest(state, onChunkToken),
    );
    workflow.addNode('candidate_qa', (state: any) =>
      this.handleCandidateQA(state, onChunkToken),
    );
    workflow.addNode('closing', (state: any) =>
      this.handleClosing(state, onChunkToken),
    );
    workflow.addNode('execute_tool', (state: any) =>
      this.handleExecuteTool(state, onChunkToken),
    );

    // 2. 设置入口和动态阶段路由
    workflow.addConditionalEdges(START, (state: any) => {
      return state.currentPhase || 'introduction';
    });

    workflow.addEdge('introduction', END);

    // 3. 配置条件转移边逻辑：如果需要跳转则流转到下一阶段，否则进入 END 挂起等待下一轮对话
    workflow.addConditionalEdges('resume_digging', (state: any) => {
      return state.shouldTransition ? 'tech_assessment' : END;
    });

    workflow.addConditionalEdges('tech_assessment', (state: any) => {
      const lastMsg = state.messages[state.messages.length - 1];
      if (
        lastMsg instanceof AIMessage &&
        lastMsg.tool_calls &&
        lastMsg.tool_calls.length > 0
      ) {
        return 'execute_tool';
      }
      return state.shouldTransition ? 'behavioral_test' : END;
    });

    workflow.addConditionalEdges('execute_tool', (state: any) => {
      return state.currentPhase || 'tech_assessment';
    });

    workflow.addConditionalEdges('behavioral_test', (state: any) => {
      return state.shouldTransition ? 'candidate_qa' : END;
    });

    workflow.addConditionalEdges('candidate_qa', (state: any) => {
      return state.shouldTransition ? 'closing' : END;
    });

    workflow.addEdge('closing', END);

    return workflow.compile();
  }

  // ========================================================
  // 各个面试节点的具体实现 (流式输出通过 onChunkToken 回传)
  // ========================================================

  private async handleIntroduction(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const text = `你好，我是今天的面试官麦麦。很高兴能与你进行这次面试。我看到你申请的是 ${state.positionName} 岗位。首先，请你简单介绍一下自己。`;

    // 模拟打字机流式回传开场白
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunkToken(text.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, 20));
    }

    return {
      messages: [new AIMessage(text)],
      currentPhase: 'resume_digging',
      shouldTransition: false,
    };
  }

  private async handleResumeDigging(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const reachedLimit =
      state.questionsAskedCount >= state.maxQuestionsPerPhase;
    // 如果还没提问过，不要进行转移判断
    const transitionData =
      state.questionsAskedCount > 0
        ? await this.evaluatePhaseTransition(state)
        : {
            suggestTransition: false,
            discoveredSkills: [] as string[],
            reason: '刚进入阶段',
          };

    if (transitionData.suggestTransition || reachedLimit) {
      this.logger.log(
        `[resume_digging] -> 跳转。原因: ${transitionData.reason || '已达到最大提问次数'}`,
      );
      return {
        shouldTransition: true,
        questionsAskedCount: 0, // 重置计数器给下一阶段使用
        extractedSkills: transitionData.discoveredSkills,
      };
    }

    // 生成下一个深挖问题
    const systemPrompt = `你是面试麦的专业面试官麦麦，当前是经历深挖阶段。
目标岗位：${state.positionName}
岗位要求：${state.jd}
候选人提供的经历：${state.resumeContent || '未提供简历，请以已回答内容为依据；无经历时可问岗位情景题'}
根据上一条回答，选择一个与目标岗位相关的贡献、决策或结果进行追问。问题要具体，不能假设候选人做过未提及的项目；已经做过自我介绍时不要重复要求。
不得在所有岗位套用技术架构或编程问题。不要把没有提到的内容直接当成能力不足。`;

    const promptTemplate = PromptTemplate.fromTemplate(
      `{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成下一个追问：`,
    );
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt: `${systemPrompt}\n${interviewPolicy(state.practiceIntensity).guidance}`,
      history: historyText || '（暂无对话历史，请直接抛出第一个追问）',
    });

    const model = this.aiModelFactory.createDefaultModel();
    const stream = await model.stream(formattedPrompt);
    let fullText = '';

    for await (const chunk of stream) {
      const content = chunk.content?.toString() || '';
      if (content) {
        fullText += content;
        onChunkToken(content);
      }
    }

    return {
      messages: [new AIMessage(fullText)],
      questionsAskedCount: state.questionsAskedCount + 1,
      shouldTransition: false,
      extractedSkills: transitionData.discoveredSkills,
      currentPhase: 'resume_digging',
    };
  }

  private async handleTechAssessment(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const reachedLimit =
      state.questionsAskedCount >= state.maxQuestionsPerPhase;

    // 检查候选人最新回答中是否包含代码
    const lastHumanMsg =
      [...state.messages]
        .reverse()
        .find((m) => m._getType() === 'human')
        ?.content?.toString() || '';
    const hasCode =
      lastHumanMsg.includes('```') ||
      /function\b/.test(lastHumanMsg) ||
      /\bconst\b/.test(lastHumanMsg) ||
      /\blet\b/.test(lastHumanMsg) ||
      /\bclass\b/.test(lastHumanMsg);

    // 如果有代码，或者还没提问过，不要进行转移判断，确保沙箱执行及追问能够进行
    const transitionData =
      state.questionsAskedCount > 0 && !hasCode
        ? await this.evaluatePhaseTransition(state)
        : {
            suggestTransition: false,
            discoveredSkills: [] as string[],
            reason: '刚进入阶段或有代码待运行验证',
          };

    if (transitionData.suggestTransition || reachedLimit) {
      this.logger.log(
        `[tech_assessment] -> 跳转。原因: ${transitionData.reason || '已达到最大提问次数'}`,
      );
      return {
        shouldTransition: true,
        questionsAskedCount: 0,
      };
    }

    const systemPrompt = `你是面试麦的专业面试官麦麦，当前考察岗位专业能力。
目标岗位：${state.positionName}
岗位要求：${state.jd}
候选人经历：${state.resumeContent || '未提供'}
已经识别的技能：${state.extractedSkills.join(', ')}
根据目标岗位与已回答内容，提出一个实际工作情景、方法或取舍问题，不重复已问内容。
产品、设计、运营等岗位不得强制编程；技术岗位也不必固定使用 JavaScript。优先允许口头解释；只有相关软件岗位且候选人愿意写代码时才提出适合其语言的代码题。
run_javascript_code 仅用于候选人实际提供的 JavaScript；其他语言不假装已执行。执行结果不等于能力结论，后续可追问边界和验证方法。`;

    const messages = [
      new SystemMessage(
        `${systemPrompt}\n${interviewPolicy(state.practiceIntensity).guidance}`,
      ),
      ...state.messages,
    ];
    const model = this.aiModelFactory.createDefaultModel();
    const sandboxTool = createCodeSandboxTool();
    const modelWithTools = model.bindTools([sandboxTool]);

    this.logger.log(`🤖 调用大模型评估技术考核，消息数: ${messages.length}`);
    const response = await modelWithTools.invoke(messages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      return {
        messages: [response],
        shouldTransition: false,
        currentPhase: 'tech_assessment',
      };
    }

    const fullText = response.content?.toString() || '';
    const chunkSize = 5;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      onChunkToken(fullText.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, 20));
    }

    return {
      messages: [response],
      questionsAskedCount: state.questionsAskedCount + 1,
      shouldTransition: false,
      currentPhase: 'tech_assessment',
    };
  }

  private async handleBehavioralTest(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const reachedLimit =
      state.questionsAskedCount >= state.maxQuestionsPerPhase;
    // 如果还没提问过，不要进行转移判断
    const transitionData =
      state.questionsAskedCount > 0
        ? await this.evaluatePhaseTransition(state)
        : {
            suggestTransition: false,
            discoveredSkills: [] as string[],
            reason: '刚进入阶段',
          };

    if (transitionData.suggestTransition || reachedLimit) {
      return {
        shouldTransition: true,
        questionsAskedCount: 0,
      };
    }

    const systemPrompt = `你是面试麦的 HR / 行为面试官麦麦。
目标岗位：${state.positionName}；岗位要求：${state.jd}。
依据已回答的经历，每次选一个协作、冲突处理、优先级、动机或情景判断问题。可追问个人行动与结果，但不能编造此前进行过技术面试，也不要再次要求自我介绍。
不得推断未提供的经历，不即时评分，不询问与岗位无关的隐私。`;

    const promptTemplate = PromptTemplate.fromTemplate(
      `{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成下一个问题：`,
    );
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt: `${systemPrompt}\n${interviewPolicy(state.practiceIntensity).guidance}`,
      history: historyText,
    });

    const model = this.aiModelFactory.createDefaultModel();
    const stream = await model.stream(formattedPrompt);
    let fullText = '';

    for await (const chunk of stream) {
      const content = chunk.content?.toString() || '';
      if (content) {
        fullText += content;
        onChunkToken(content);
      }
    }

    return {
      messages: [new AIMessage(fullText)],
      questionsAskedCount: state.questionsAskedCount + 1,
      shouldTransition: false,
      currentPhase: 'behavioral_test',
    };
  }

  private async handleCandidateQA(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    // 如果候选人已经没有问题，准备结束
    const lastUserMessage =
      [...state.messages]
        .reverse()
        .find((m) => m._getType() === 'human')
        ?.content?.toString() || '';

    // 如果候选人明确表示没有问题，或者提问次数达到限制，则准备结束
    const wantsToEnd =
      state.questionsAskedCount > 0 &&
      (lastUserMessage.includes('没有问题') ||
        lastUserMessage.includes('没了') ||
        lastUserMessage.includes('没有其他') ||
        (lastUserMessage.includes('谢谢') &&
          !lastUserMessage.includes('？') &&
          !lastUserMessage.includes('吗')) ||
        state.questionsAskedCount >= 2);

    if (wantsToEnd) {
      return {
        shouldTransition: true,
        questionsAskedCount: 0,
      };
    }

    if (state.questionsAskedCount === 0) {
      const text = `主要问题先聊到这里。关于目标岗位或这次练习，你还有什么想了解的吗？具体公司的薪酬与招聘安排我无法代为确认。`;
      const chunkSize = 5;
      for (let i = 0; i < text.length; i += chunkSize) {
        onChunkToken(text.slice(i, i + chunkSize));
        await new Promise((r) => setTimeout(r, 20));
      }

      return {
        messages: [new AIMessage(text)],
        questionsAskedCount: 1,
        shouldTransition: false,
        currentPhase: 'candidate_qa',
      };
    }

    // 动态生成回答
    const systemPrompt = `你是面试麦的面试官麦麦。当前是候选人提问阶段。
求职岗位: ${state.positionName}
公司: ${state.company || '未指定，通用模拟场景'}
岗位描述(JD): ${state.jd}
候选人简历内容: ${state.resumeContent}

这是模拟练习，不代表招聘公司。仅依据已提供的岗位信息回答；未知的薪酬、团队政策和招聘安排明确说明无法确认，不得编造。解答完毕后，询问候选人是否还有其他想了解的问题。`;

    const promptTemplate = PromptTemplate.fromTemplate(
      `{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成对候选人提问的回答：`,
    );
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt: `${systemPrompt}\n${interviewPolicy(state.practiceIntensity).guidance}`,
      history: historyText,
    });

    const model = this.aiModelFactory.createDefaultModel();
    const stream = await model.stream(formattedPrompt);
    let fullText = '';

    for await (const chunk of stream) {
      const content = chunk.content?.toString() || '';
      if (content) {
        fullText += content;
        onChunkToken(content);
      }
    }

    return {
      messages: [new AIMessage(fullText)],
      questionsAskedCount: state.questionsAskedCount + 1,
      shouldTransition: false,
      currentPhase: 'candidate_qa',
    };
  }

  private async handleClosing(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const text = `好的，今天的面试就到这里。非常感谢你的时间和精彩回答。本次为模拟面试，你可以在复盘页查看回答与改进建议。祝你一切顺利！`;

    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunkToken(text.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, 20));
    }

    return {
      messages: [new AIMessage(text)],
      interviewEnded: true,
      currentPhase: 'closing',
    };
  }

  private async handleExecuteTool(
    state: any,
    onChunkToken: (t: string) => void,
  ): Promise<any> {
    const lastMsg = state.messages[state.messages.length - 1];
    if (
      !(lastMsg instanceof AIMessage) ||
      !lastMsg.tool_calls ||
      lastMsg.tool_calls.length === 0
    ) {
      return {};
    }

    const toolCalls = lastMsg.tool_calls;
    const toolMessages: BaseMessage[] = [];
    const sandboxTool = createCodeSandboxTool();

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'run_javascript_code') {
        this.logger.log(
          `🤖 执行代码沙箱工具，代码长度: ${toolCall.args.code?.length}`,
        );
        const result = await sandboxTool.invoke(toolCall.args as any);
        if (typeof result === 'string') {
          toolMessages.push(
            new ToolMessage({
              content: result,
              tool_call_id: toolCall.id || '',
            }),
          );
        } else {
          toolMessages.push(result as any);
        }
      }
    }

    return {
      messages: toolMessages,
    };
  }

  // ========================================================
  // 辅助判定函数：评测阶段流转
  // ========================================================

  private async evaluatePhaseTransition(state: any): Promise<PhaseTransition> {
    const lastHumanMsg = [...state.messages]
      .reverse()
      .find((m) => m._getType() === 'human')?.content;
    if (!lastHumanMsg) {
      return {
        analysis: '面试开始',
        isQuestionAnswered: false,
        discoveredSkills: [],
        suggestTransition: false,
        reason: '没有对话历史',
      };
    }

    try {
      const model = this.aiModelFactory.createDefaultModel();
      const parser = StructuredOutputParser.fromZodSchema(
        PhaseTransitionSchema,
      );

      const systemPrompt = `你现在是面试主控路由裁判。你需要客观分析最后一次候选人的回答，判断他的回答是否针对提问做出了正面充分的回答，是否识别到了新的专业技能点，以及是否建议跳转至下一面试阶段。
当前面试阶段：{currentPhase}
目标岗位JD: {jd}
候选人简历: {resume}

请严格按指定的 JSON 结构输出打分和转移理由。
格式化要求: {format_instructions}

最新候选人回答:
{lastMessage}`;

      const chain = model.pipe(parser);
      const result = await chain.invoke(
        await PromptTemplate.fromTemplate(systemPrompt).format({
          currentPhase: state.currentPhase,
          resume: state.resumeContent,
          jd: state.jd,
          lastMessage: lastHumanMsg.toString(),
          format_instructions: parser.getFormatInstructions(),
        }),
      );

      return result;
    } catch (error) {
      this.logger.error(`阶段流转评估决策失败: ${error.message}`);
      // 容错退避，不影响主流程继续提问
      return {
        analysis: '判定失败兜底',
        isQuestionAnswered: true,
        discoveredSkills: [],
        suggestTransition: false,
        reason: '评估出错兜底',
      };
    }
  }

  private formatHistoryForLLM(messages: BaseMessage[]): string {
    return messages
      .map(
        (m) =>
          `${m._getType() === 'human' ? '候选人' : '面试官'}: ${m.content}`,
      )
      .join('\n\n');
  }

  private async summarizeConversation(
    messages: BaseMessage[],
  ): Promise<string> {
    try {
      const model = this.aiModelFactory.createDefaultModel();
      const historyText = this.formatHistoryForLLM(messages);
      const prompt = `你现在是面试主控协调官。请对以下面试对话历史进行简明扼要的摘要总结，提取出已考察的要点、候选人的表现评估、已识别的技术点与软实力水平，用于传递给接下来的面试官。字数控制在200字以内。

对话历史：
${historyText}

摘要总结：`;

      const response = await model.invoke(prompt);
      return response.content?.toString() || '（暂无有效摘要）';
    } catch (err) {
      this.logger.error(`生成对话历史摘要失败: ${err.message}`);
      return '（历史摘要生成失败）';
    }
  }

  /**
   * 改造后的对外流式接口，兼容原来的 generateInterviewQuestionStream
   */
  async *generateInterviewQuestionStream(context: {
    interviewType: 'special' | 'comprehensive';
    resumeContent: string;
    company?: string;
    positionName?: string;
    jd?: string;
    conversationHistory: Array<{
      role: 'interviewer' | 'candidate';
      content: string;
    }>;
    elapsedMinutes: number;
    targetDuration: number;
    practiceIntensity?: PracticeIntensity;
    currentPhase?: any; // 从 session 传入的当前阶段
    questionsAskedCount?: number;
    extractedSkills?: string[];
  }): AsyncGenerator<
    string,
    {
      question: string;
      shouldEnd: boolean;
      standardAnswer?: string;
      reasoning?: string;
      metadata?: {
        currentPhase?: any;
        questionsAskedCount?: number;
        extractedSkills?: string[];
      };
    }
  > {
    const queue = new AsyncQueue<string>();

    let messages: BaseMessage[] = context.conversationHistory.map((h) =>
      h.role === 'candidate'
        ? new HumanMessage(h.content)
        : new AIMessage(h.content),
    );

    // 维持 Smart Zone: 如果对话记录超过 15 条，清空早期消息，只保留最近的 4 条作为 active context
    if (messages.length > 15) {
      this.logger.log(
        `⚠️ 对话历史消息数达 ${messages.length} 条，触发 Context Resets 以防进入 Dumb Zone...`,
      );
      const activeContext = messages.slice(-4);
      const prefixSummaryText = await this.summarizeConversation(
        messages.slice(0, -4),
      );
      messages = [
        new SystemMessage(
          `[此前对话内容摘要]:\n${prefixSummaryText}\n请基于此前的对话总结和接下来的最新几轮对话，继续扮演你的角色，顺畅地进行面试。`,
        ),
        ...activeContext,
      ];
    }

    // 1. 构建 LangGraph 状态输入
    const stateInput = {
      messages,
      practiceIntensity:
        context.practiceIntensity || PracticeIntensity.STANDARD,
      company: context.company || '',
      currentPhase: context.currentPhase || 'introduction',
      candidateName: '候选人',
      positionName: context.positionName || '全栈工程师',
      resumeContent: context.resumeContent,
      jd: context.jd || '未提供',
      questionsAskedCount: context.questionsAskedCount || 0,
      maxQuestionsPerPhase: context.practiceIntensity
        ? interviewPolicy(context.practiceIntensity).maxQuestionsPerPhase
        : context.interviewType === 'special'
          ? 3
          : 2,
      extractedSkills: context.extractedSkills || [],
      shouldTransition: false,
      interviewEnded: false,
    };

    let generatedText = '';
    const onChunkToken = (token: string) => {
      generatedText += token;
      queue.push(token);
    };

    // 2. 异步拉起 LangGraph 实例运行
    const graph = this.compileInterviewGraph(onChunkToken);

    let finalState: any = null;
    let graphError: unknown;
    const graphPromise = graph
      .invoke(stateInput)
      .then((res) => {
        finalState = res;
        queue.close();
      })
      .catch((err) => {
        this.logger.error(`LangGraph 执行抛出异常: ${err.message}`, err.stack);
        graphError = err;
        queue.close();
      });

    // 3. 消费队列并 yield
    for await (const chunk of queue.generator()) {
      yield chunk;
    }

    // 等待图彻底完成
    await graphPromise;
    if (graphError)
      throw graphError instanceof Error
        ? graphError
        : new Error('面试模型执行失败');

    // 4. 构造符合原来接口的返回值
    return {
      question: generatedText,
      shouldEnd:
        finalState?.interviewEnded || finalState?.currentPhase === 'closing',
      standardAnswer: undefined,
      reasoning: finalState?.interviewEnded ? '面试流程已执行完毕' : undefined,
      // 捎带传回最终状态，以便调用方能同步保存
      metadata: {
        currentPhase: finalState?.currentPhase,
        questionsAskedCount: finalState?.questionsAskedCount,
        extractedSkills: finalState?.extractedSkills,
      },
    } as any;
  }
}
