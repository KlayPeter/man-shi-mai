import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { CandidateProfile } from './candidate-simulator';

const JudgeOutputSchema = z.object({
  metrics: z.object({
    technical_depth: z
      .number()
      .describe(
        '打分1-10。技术追问是否击中要害，是否有效探清了求职者的真实底座水平。',
      ),
    question_relevance: z
      .number()
      .describe(
        '打分1-10。面试官提出的问题是否与职位描述（JD）、简历以及求职者上一步的回答强相关，有无走偏。',
      ),
    tone: z
      .number()
      .describe(
        '打分1-10。语气是否符合专业面试官的素养，是否保持尊重，有无粗鲁用语。',
      ),
    flow_control: z
      .number()
      .describe('打分1-10。面试阶段流转是否顺畅，是否卡死在一个问题无限循环。'),
    hallucination_rate: z
      .number()
      .describe(
        '评分1-10。面试官提问中出现常识性技术概念混淆或自己脑补幻想的频率。分值越低说明越无幻觉，0分为完美。',
      ),
  }),
  justification: z
    .string()
    .describe('详细的扣分和加分理由，列举具体话术对话进行举证。'),
  suggestions: z
    .array(z.string())
    .describe('优化面试官 Prompt 或流程控制的改进具体建议'),
});

export type JudgeResult = z.infer<typeof JudgeOutputSchema>;

/**
 * 运行大模型裁判对对局记录进行科学评估打分
 */
export async function runJudge(
  model: BaseChatModel,
  profile: CandidateProfile,
  transcripts: { role: string; content: string }[],
): Promise<JudgeResult> {
  const parser = StructuredOutputParser.fromZodSchema(JudgeOutputSchema);

  const judgePrompt = `
  你现在是顶尖的 AI Agent 系统评测官。你的任务是根据一段模拟面试的聊天记录（Transcript），严苛地对“AI 面试官 Agent”进行多维度评估打分。
  
  【被面试人画像】
  姓名：${profile.name}
  性格偏向：${profile.personality}
  技术水平：${profile.technicalLevel}
  模拟简历：${profile.resumeMock}
  
  请根据以下 JSON 约束输出你的最终评估报告。评分必须严肃客观，符合真实软件工程水准，不能无脑给高分！
  格式化要求：{format_instructions}
  
  【面试完整聊天历史记录】
  {transcriptText}
  `;

  const transcriptText = transcripts
    .map(
      (t, i) =>
        `${i + 1}. [${t.role === 'interviewer' ? 'AI 面试官' : '候选人'}]: ${t.content}`,
    )
    .join('\n\n');

  const chain = model.pipe(parser);

  const formattedPrompt = await PromptTemplate.fromTemplate(judgePrompt).format(
    {
      transcriptText,
      format_instructions: parser.getFormatInstructions(),
    },
  );

  const result = await chain.invoke(formattedPrompt);
  return result;
}
