import { BaseMessage } from '@langchain/core/messages';

export interface InterviewState {
  // 1. 聊天历史消息记录
  messages: BaseMessage[];

  // 2. 当前所处的面试阶段
  currentPhase:
    | 'introduction'
    | 'resume_digging'
    | 'tech_assessment'
    | 'behavioral_test'
    | 'candidate_qa'
    | 'closing';

  // 3. 候选人上下文
  candidateName: string;
  positionName: string;
  resumeContent: string;
  jd: string;

  // 4. 控制与评估指标
  questionsAskedCount: number; // 当前阶段已提问次数
  maxQuestionsPerPhase: number; // 每个阶段允许的最大问题数
  extractedSkills: string[]; // 已考察/覆盖的技术点

  // 5. 阶段退出与流程控制标志
  shouldTransition: boolean; // 是否应当跳转到下一阶段
  interviewEnded: boolean; // 面试是否彻底结束
}
