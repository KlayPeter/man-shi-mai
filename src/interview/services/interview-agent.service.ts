import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { AIModelFactory } from '../../ai/services/ai-model.factory';
import { PhaseTransitionSchema, PhaseTransition } from '../dto/transition.schema';

/**
 * 定义 LangGraph 的状态 Annotation
 */
const InterviewStateAnnotation = Annotation.Root({
  // 1. 聊天历史消息记录
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  
  // 2. 当前所处的面试阶段
  currentPhase: Annotation<'introduction' | 'resume_digging' | 'tech_assessment' | 'behavioral_test' | 'candidate_qa' | 'closing'>({
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
    workflow.addNode('introduction', (state: any) => this.handleIntroduction(state, onChunkToken));
    workflow.addNode('resume_digging', (state: any) => this.handleResumeDigging(state, onChunkToken));
    workflow.addNode('tech_assessment', (state: any) => this.handleTechAssessment(state, onChunkToken));
    workflow.addNode('behavioral_test', (state: any) => this.handleBehavioralTest(state, onChunkToken));
    workflow.addNode('candidate_qa', (state: any) => this.handleCandidateQA(state, onChunkToken));
    workflow.addNode('closing', (state: any) => this.handleClosing(state, onChunkToken));

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
      return state.shouldTransition ? 'behavioral_test' : END;
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

  private async handleIntroduction(state: any, onChunkToken: (t: string) => void): Promise<any> {
    const text = `你好，我是你今天的面试官。很高兴能与你进行这次面试。我看到你申请的是 ${state.positionName} 岗位。首先，请你简单介绍一下自己。`;
    
    // 模拟打字机流式回传开场白
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunkToken(text.slice(i, i + chunkSize));
      await new Promise(r => setTimeout(r, 20));
    }

    return {
      messages: [new AIMessage(text)],
      currentPhase: 'resume_digging',
      shouldTransition: false
    };
  }

  private async handleResumeDigging(state: any, onChunkToken: (t: string) => void): Promise<any> {
    const reachedLimit = state.questionsAskedCount >= state.maxQuestionsPerPhase;
    // 如果还没提问过，不要进行转移判断
    const transitionData = state.questionsAskedCount > 0
      ? await this.evaluatePhaseTransition(state)
      : { suggestTransition: false, discoveredSkills: [] as string[], reason: '刚进入阶段' };

    if (transitionData.suggestTransition || reachedLimit) {
      this.logger.log(`[resume_digging] -> 跳转。原因: ${transitionData.reason || '已达到最大提问次数'}`);
      return {
        shouldTransition: true,
        questionsAskedCount: 0, // 重置计数器给下一阶段使用
        extractedSkills: transitionData.discoveredSkills
      };
    }

    // 生成下一个深挖问题
    const systemPrompt = `你现在是专业的面试官。当前面试处于第一阶段：【简历与项目深挖阶段】。
候选人姓名: ${state.candidateName}
求职岗位: ${state.positionName}
岗位描述(JD): ${state.jd}
候选人简历内容: ${state.resumeContent}

请根据聊天历史记录，针对候选人简历中提到的某一个核心项目或者技术细节进行追问。
要求：
1. 追问要细致，直击痛点，验证简历真实度。
2. 每次只提一个问题。
3. 保持专业、严谨但有礼貌的面试官语气。`;

    const promptTemplate = PromptTemplate.fromTemplate(`{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成下一个追问：`);
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt,
      history: historyText || '（暂无对话历史，请直接抛出第一个追问）'
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
      currentPhase: 'resume_digging'
    };
  }

  private async handleTechAssessment(state: any, onChunkToken: (t: string) => void): Promise<any> {
    const reachedLimit = state.questionsAskedCount >= state.maxQuestionsPerPhase;
    // 如果还没提问过，不要进行转移判断
    const transitionData = state.questionsAskedCount > 0
      ? await this.evaluatePhaseTransition(state)
      : { suggestTransition: false, discoveredSkills: [] as string[], reason: '刚进入阶段' };

    if (transitionData.suggestTransition || reachedLimit) {
      this.logger.log(`[tech_assessment] -> 跳转。原因: ${transitionData.reason || '已达到最大提问次数'}`);
      return {
        shouldTransition: true,
        questionsAskedCount: 0
      };
    }

    const systemPrompt = `你现在是专业的面试官。当前面试处于第二阶段：【技术实战与核心原理考核阶段】。
求职岗位: ${state.positionName}
岗位描述(JD): ${state.jd}
候选人简历内容: ${state.resumeContent}
先前已识别的技能: ${state.extractedSkills.join(', ')}

请根据聊天历史，对候选人的技术底子、算法能力或系统设计进行考察。
要求：
1. 提出一道符合岗位要求的算法题、场景设计题或硬核技术原理题。
2. 每次只提一个问题。
3. 保持专业、严谨的面试官语气。`;

    const promptTemplate = PromptTemplate.fromTemplate(`{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成下一个问题：`);
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt,
      history: historyText
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
      currentPhase: 'tech_assessment'
    };
  }

  private async handleBehavioralTest(state: any, onChunkToken: (t: string) => void): Promise<any> {
    const reachedLimit = state.questionsAskedCount >= state.maxQuestionsPerPhase;
    // 如果还没提问过，不要进行转移判断
    const transitionData = state.questionsAskedCount > 0
      ? await this.evaluatePhaseTransition(state)
      : { suggestTransition: false, discoveredSkills: [] as string[], reason: '刚进入阶段' };

    if (transitionData.suggestTransition || reachedLimit) {
      return {
        shouldTransition: true,
        questionsAskedCount: 0
      };
    }

    const systemPrompt = `你现在是专业的面试官。当前面试处于第三阶段：【行为面试与软实力评估阶段】。
求职岗位: ${state.positionName}
岗位描述(JD): ${state.jd}

请考察候选人的团队协作、沟通流畅度、抗压经历及解决冲突的能力（参考 STAR 原则）。
要求：
1. 每次只提一个行为面试问题。
2. 保持专业、温和但深入的面试官语气。`;

    const promptTemplate = PromptTemplate.fromTemplate(`{systemPrompt}\n\n当前聊天历史:\n{history}\n\n生成下一个问题：`);
    const historyText = this.formatHistoryForLLM(state.messages);
    const formattedPrompt = await promptTemplate.format({
      systemPrompt,
      history: historyText
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
      currentPhase: 'behavioral_test'
    };
  }

  private async handleCandidateQA(state: any, onChunkToken: (t: string) => void): Promise<any> {
    // 如果候选人已经没有问题，准备结束
    const lastUserMessage = [...state.messages].reverse().find(m => m._getType() === 'human')?.content?.toString() || '';
    // 如果还没提问过，不要立即判断结束，必须给用户一次提问机会
    const wantsToEnd = state.questionsAskedCount > 0 && 
      (lastUserMessage.includes('没有问题') || lastUserMessage.includes('没了') || state.questionsAskedCount >= 2);

    if (wantsToEnd) {
      return {
        shouldTransition: true,
        questionsAskedCount: 0
      };
    }

    const text = `好的，我对你的考察基本结束了。请问你对我们公司或者这个岗位有什么想了解的吗？`;
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunkToken(text.slice(i, i + chunkSize));
      await new Promise(r => setTimeout(r, 20));
    }

    return {
      messages: [new AIMessage(text)],
      questionsAskedCount: state.questionsAskedCount + 1,
      shouldTransition: false,
      currentPhase: 'candidate_qa'
    };
  }

  private async handleClosing(state: any, onChunkToken: (t: string) => void): Promise<any> {
    const text = `好的，今天的面试就到这里。非常感谢你的时间和精彩回答。我们会将评估结果反馈给 HR，预计在 3-5 个工作日内给您答复。祝你一切顺利！`;
    
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunkToken(text.slice(i, i + chunkSize));
      await new Promise(r => setTimeout(r, 20));
    }

    return {
      messages: [new AIMessage(text)],
      interviewEnded: true,
      currentPhase: 'closing'
    };
  }

  // ========================================================
  // 辅助判定函数：评测阶段流转
  // ========================================================

  private async evaluatePhaseTransition(state: any): Promise<PhaseTransition> {
    const lastHumanMsg = [...state.messages].reverse().find(m => m._getType() === 'human')?.content;
    if (!lastHumanMsg) {
      return { analysis: '面试开始', isQuestionAnswered: false, discoveredSkills: [], suggestTransition: false, reason: '没有对话历史' };
    }

    try {
      const model = this.aiModelFactory.createDefaultModel();
      const parser = StructuredOutputParser.fromZodSchema(PhaseTransitionSchema);

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
          format_instructions: parser.getFormatInstructions()
        })
      );

      return result as PhaseTransition;
    } catch (error) {
      this.logger.error(`阶段流转评估决策失败: ${error.message}`);
      // 容错退避，不影响主流程继续提问
      return {
        analysis: '判定失败兜底',
        isQuestionAnswered: true,
        discoveredSkills: [],
        suggestTransition: false,
        reason: '评估出错兜底'
      };
    }
  }

  private formatHistoryForLLM(messages: BaseMessage[]): string {
    return messages
      .map(m => `${m._getType() === 'human' ? '候选人' : '面试官'}: ${m.content}`)
      .join('\n\n');
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
    conversationHistory: Array<{ role: 'interviewer' | 'candidate'; content: string }>;
    elapsedMinutes: number;
    targetDuration: number;
    currentPhase?: any; // 从 session 传入的当前阶段
    questionsAskedCount?: number;
    extractedSkills?: string[];
  }): AsyncGenerator<string, {
    question: string;
    shouldEnd: boolean;
    standardAnswer?: string;
    reasoning?: string;
    metadata?: {
      currentPhase?: any;
      questionsAskedCount?: number;
      extractedSkills?: string[];
    };
  }> {
    const queue = new AsyncQueue<string>();

    // 1. 构建 LangGraph 状态输入
    const stateInput = {
      messages: context.conversationHistory.map(h => 
        h.role === 'candidate' ? new HumanMessage(h.content) : new AIMessage(h.content)
      ),
      currentPhase: context.currentPhase || 'introduction',
      candidateName: '候选人',
      positionName: context.positionName || '全栈工程师',
      resumeContent: context.resumeContent,
      jd: context.jd || '未提供',
      questionsAskedCount: context.questionsAskedCount || 0,
      maxQuestionsPerPhase: context.interviewType === 'special' ? 3 : 2,
      extractedSkills: context.extractedSkills || [],
      shouldTransition: false,
      interviewEnded: false
    };

    let generatedText = '';
    const onChunkToken = (token: string) => {
      generatedText += token;
      queue.push(token);
    };

    // 2. 异步拉起 LangGraph 实例运行
    const graph = this.compileInterviewGraph(onChunkToken);
    
    let finalState: any = null;
    const graphPromise = graph.invoke(stateInput)
      .then((res) => {
        finalState = res;
        queue.close();
      })
      .catch((err) => {
        this.logger.error(`LangGraph 执行抛出异常: ${err.message}`, err.stack);
        queue.close();
      });

    // 3. 消费队列并 yield
    for await (const chunk of queue.generator()) {
      yield chunk;
    }

    // 等待图彻底完成
    await graphPromise;

    // 4. 构造符合原来接口的返回值
    return {
      question: generatedText,
      shouldEnd: finalState?.interviewEnded || finalState?.currentPhase === 'closing',
      standardAnswer: '（当前阶段正在深入简历评估，暂无标准答案，请根据回答质量打分）',
      reasoning: finalState?.interviewEnded ? '面试流程已执行完毕' : undefined,
      // 捎带传回最终状态，以便调用方能同步保存
      metadata: {
        currentPhase: finalState?.currentPhase,
        questionsAskedCount: finalState?.questionsAskedCount,
        extractedSkills: finalState?.extractedSkills,
      }
    } as any;
  }
}
