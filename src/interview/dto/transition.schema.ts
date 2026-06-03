import { z } from 'zod';

export const PhaseTransitionSchema = z.object({
  // 对候选人上一次回答的简要总结分析
  analysis: z.string().describe('对候选人回答的简要分析与主要关注点说明'),
  
  // 当前问题是否已经得到了充分回答
  isQuestionAnswered: z.boolean().describe('候选人是否正面且充分回答了面试官的上一个技术或项目问题'),
  
  // 从对话中新识别到的候选人掌握的技术点
  discoveredSkills: z.array(z.string()).describe('从候选人回答中新识别到的技能、框架或专业领域，如果没有则为空数组'),
  
  // 是否建议跳转到下一阶段
  suggestTransition: z.boolean().describe('是否建议面试官结束当前考核阶段，跳转转移至下一个面试阶段'),
  
  // 决定转移的理由
  reason: z.string().describe('决定跳转或留在当前阶段的合理逻辑解释和技术理由')
});

export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>;
