import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { AIModelFactory } from '../../src/ai/services/ai-model.factory';
import { CandidateSimulator, CandidateProfile } from './candidate-simulator';
import { runJudge } from './judge';
import * as fs from 'fs';
import * as path from 'path';

// 加载本地候选人画像配置
const blufferProfile: CandidateProfile = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'candidate-profiles/bluffer.json'), 'utf8')
);

const silentExpertProfile: CandidateProfile = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'candidate-profiles/silent-expert.json'), 'utf8')
);

async function runMockInterviewSession(profile: CandidateProfile) {
  // 1. 初始化 NestJS 应用程序上下文
  const app = await NestFactory.createApplicationContext(AppModule);
  const agentService = app.get(InterviewAgentService);
  const modelFactory = app.get(AIModelFactory);
  const model = modelFactory.createDefaultModel();

  // 2. 实例化候选人模拟器
  const simulator = new CandidateSimulator(model, profile);
  const transcripts: { role: 'interviewer' | 'candidate'; content: string }[] = [];

  console.log(`\n==================================================`);
  console.log(`🚀 开始模拟面试对局：候选人 - ${profile.name}`);
  console.log(`==================================================\n`);

  // 3. 构建初始 Agent 状态，获取开场白
  let currentPhase: any = 'introduction';
  let questionsAskedCount = 0;
  let extractedSkills: string[] = [];

  const contextInput = {
    interviewType: 'special' as const,
    resumeContent: profile.resumeMock,
    company: '大迈科技',
    positionName: '高级全栈工程师',
    jd: '负责核心业务架构设计。熟练手写算法，精通 Node.js/TypeScript，对高并发分布式架构及底层数据库优化有实战经验。',
    conversationHistory: transcripts,
    elapsedMinutes: 0,
    targetDuration: 45,
    currentPhase,
    questionsAskedCount,
    extractedSkills
  };

  // 生成开场白 (由 introduction 节点执行并流式吐回)
  let openingQuestion = '';
  const openingGenerator = agentService.generateInterviewQuestionStream(contextInput);
  
  let result = await openingGenerator.next();
  while (!result.done) {
    openingQuestion += result.value;
    result = await openingGenerator.next();
  }

  transcripts.push({ role: 'interviewer', content: openingQuestion });
  console.log(`[面试官 - ${currentPhase}]: ${openingQuestion}\n`);

  // 更新下一轮迭代的状态
  const finalOpeningOutput = result.value;
  if (finalOpeningOutput && finalOpeningOutput.metadata) {
    currentPhase = finalOpeningOutput.metadata.currentPhase ?? currentPhase;
    questionsAskedCount = finalOpeningOutput.metadata.questionsAskedCount ?? questionsAskedCount;
    extractedSkills = finalOpeningOutput.metadata.extractedSkills ?? extractedSkills;
  }

  // 4. 对局循环（限制最多 8 轮交互）
  const maxTurns = 8;
  for (let turn = 1; turn <= maxTurns; turn++) {
    // 候选人作答
    const candidateAnswer = await simulator.respondToInterviewer(transcripts);
    transcripts.push({ role: 'candidate', content: candidateAnswer });
    console.log(`[候选人]: ${candidateAnswer}\n`);

    // 面试官生成下一个问题
    const nextContext = {
      interviewType: 'special' as const,
      resumeContent: profile.resumeMock,
      company: '大迈科技',
      positionName: '高级全栈工程师',
      jd: contextInput.jd,
      conversationHistory: transcripts,
      elapsedMinutes: turn * 3, // 假定每轮大约3分钟
      targetDuration: 45,
      currentPhase,
      questionsAskedCount,
      extractedSkills
    };

    let nextQuestion = '';
    const questionGenerator = agentService.generateInterviewQuestionStream(nextContext);
    
    let genResult = await questionGenerator.next();
    while (!genResult.done) {
      nextQuestion += genResult.value;
      genResult = await questionGenerator.next();
    }

    transcripts.push({ role: 'interviewer', content: nextQuestion });
    console.log(`[面试官 - ${currentPhase}]: ${nextQuestion}\n`);

    // 提取状态数据
    const agentOutput = genResult.value;
    if (agentOutput && agentOutput.metadata) {
      currentPhase = agentOutput.metadata.currentPhase ?? currentPhase;
      questionsAskedCount = agentOutput.metadata.questionsAskedCount ?? questionsAskedCount;
      extractedSkills = agentOutput.metadata.extractedSkills ?? extractedSkills;
    }

    // 检查是否结束
    if (agentOutput && agentOutput.shouldEnd) {
      console.log(`🏁 智能体检测到面试结束信号，退出对话循环。`);
      break;
    }
  }

  // 5. 保存对局完整 Transcripts
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const transcriptFileName = `transcript_${profile.name.replace(/\s+/g, '')}_${Date.now()}.json`;
  fs.writeFileSync(
    path.join(logDir, transcriptFileName),
    JSON.stringify(transcripts, null, 2),
    'utf8'
  );
  console.log(`💾 原始对话记录已保存至: test/harness/logs/${transcriptFileName}`);

  // 6. 调用裁判打分
  console.log(`⚖️ 正在唤起裁判模型对对局记录进行科学审计打分...`);
  const evalReport = await runJudge(model, profile, transcripts);

  // 7. 保存 Markdown 评测报告
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const averageScore = (
    (evalReport.metrics.technical_depth +
      evalReport.metrics.question_relevance +
      evalReport.metrics.tone +
      evalReport.metrics.flow_control) / 4
  ).toFixed(1);

  const reportContent = `
# 评测报告：候选人 - ${profile.name}

## 1. 评测基本信息
- **评测时间**：${new Date().toLocaleString()}
- **岗位**：高级全栈工程师
- **测试候选人技术属性**：${profile.technicalLevel}
- **测试候选人沟通画像**：${profile.personality}

## 2. 评测指标得分 (LLM-as-a-Judge)
- **技术考察深度 (Technical Depth)**: ${evalReport.metrics.technical_depth} / 10
- **提问切合度 (Question Relevancy)**: ${evalReport.metrics.question_relevance} / 10
- **语气与专业度 (Tone & Professionalism)**: ${evalReport.metrics.tone} / 10
- **流程控制质量 (Flow Control)**: ${evalReport.metrics.flow_control} / 10
- **幻觉发生率 (Hallucination Rate)**: ${evalReport.metrics.hallucination_rate} / 10 (越低越好，0分表示无任何幻觉)

### 📌 综合平均得分：${averageScore} / 10

## 3. 裁判裁决理由 (Justification)
${evalReport.justification}

## 4. 后续改进建议 (Suggestions)
${evalReport.suggestions.map(s => `- ${s}`).join('\n')}
  `;

  const reportFileName = `report_${profile.name.replace(/\s+/g, '')}.md`;
  fs.writeFileSync(path.join(reportDir, reportFileName), reportContent.trim(), 'utf8');

  console.log(`\n==================================================`);
  console.log(`✅ 评测成功完成！综合得分: ${averageScore} / 10`);
  console.log(`📊 评测报告已保存至: test/harness/reports/${reportFileName}`);
  console.log(`==================================================\n`);

  await app.close();
}

async function main() {
  try {
    // 默认测试简历注水型画像
    await runMockInterviewSession(blufferProfile);
  } catch (error: any) {
    console.error(`❌ 评测跑流过程发生异常: ${error.message}`, error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
