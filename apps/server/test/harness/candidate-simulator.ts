import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';

export interface CandidateProfile {
  name: string;
  personality: string; // 性格偏向
  technicalLevel: string; // 技术层级
  resumeMock: string; // 模拟简历内容
  responseStyle: string; // 回复风格
}

/**
 * 候选人模拟器 Agent
 */
export class CandidateSimulator {
  constructor(
    private readonly model: BaseChatModel,
    private readonly profile: CandidateProfile,
  ) {}

  /**
   * 候选人接收面试官提问，并根据人设在历史对话中自动作答
   */
  async respondToInterviewer(
    history: { role: string; content: string }[],
  ): Promise<string> {
    const systemPrompt = `
    你现在需要扮演一名求职者参加面试。请严格遵守以下人设进行作答。
    
    【基本信息】
    姓名：${this.profile.name}
    简历背景：${this.profile.resumeMock}
    技术水平：${this.profile.technicalLevel}
    
    【性格特征】
    性格偏向：${this.profile.personality}
    作答风格：${this.profile.responseStyle}
    
    【重要守则】
    1. 你只能代表候选人发言。绝对不能抢面试官的台词，或者自己生成面试官的问题！
    2. 如果被问到不会的技术点，必须按照你的【技术水平】和【性格特征】来演绎（例如不懂装懂强行解释，或者直接诚实认错）。
    3. 每次回答保持自然、口语化，不要生成多余的标记（如 [STANDARD_ANSWER] 等）。
    4. 你的字里行间必须完全沉浸于该人设，语气要自然逼真。
    `;

    const formattedHistory = history
      .map(
        (h) =>
          `${h.role === 'interviewer' ? '面试官' : '我(候选人)'}: ${h.content}`,
      )
      .join('\n\n');

    const prompt = PromptTemplate.fromTemplate(`
    {systemPrompt}
    
    对话历史记录：
    {history}
    
    请输出你对面试官最新提问的作答内容：`);

    const response = await this.model.invoke(
      await prompt.format({
        systemPrompt,
        history: formattedHistory,
      }),
    );

    return response.content.toString().trim();
  }
}
