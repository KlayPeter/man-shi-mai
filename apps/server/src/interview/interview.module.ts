import { InterviewStartService } from './services/interview-start.service';
import { QuotaLedgerModule } from '../user/quota-ledger.module';
import { InterviewTurnService } from './services/interview-turn.service';
import { AudioTranscoderService } from './services/audio-transcoder.service';
import { BaiduSpeechService } from './services/baidu-speech.service';
import { InterviewSpeechService } from './services/interview-speech.service';
import { Module } from '@nestjs/common';
import { InterviewReportService } from './services/interview-report.service';
import { InterviewQuizService } from './services/interview-quiz.service';
import { InterviewController } from './interview.controller';
import { InterviewService } from './services/interview.service';
import { InterviewAIService } from './services/interview-ai.service';
import { InterviewAgentService } from './services/interview-agent.service';
import { DocumentParserService } from './services/document-parser.service';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from '../ai/ai.module';
import { StsModule } from '../sts/sts.module';
import { ResumeAnalysisService } from './services/resume-analysis.service';
import { ConversationContinuationService } from './services/conversation-continuation.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConsumptionRecord,
  ConsumptionRecordSchema,
} from './schemas/consumption-record.schema';
import {
  ResumeQuizResult,
  ResumeQuizResultSchema,
} from './schemas/interview-quiz-result.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Resume, ResumeSchema } from '../resume/schemas/resume.schema';
import {
  AIInterviewResult,
  AIInterviewResultSchema,
} from './schemas/ai-interview-result.schema';
import {
  UserTransaction,
  UserTransactionSchema,
} from '../user/schemas/user-transaction.schema';

@Module({
  imports: [
    ConfigModule,
    QuotaLedgerModule,
    StsModule,
    AIModule, // 导入 AI 模块以使用 AIModelFactory
    MongooseModule.forFeature([
      { name: ConsumptionRecord.name, schema: ConsumptionRecordSchema },
      { name: ResumeQuizResult.name, schema: ResumeQuizResultSchema },
      { name: User.name, schema: UserSchema },
      { name: Resume.name, schema: ResumeSchema },
      { name: AIInterviewResult.name, schema: AIInterviewResultSchema },
      { name: UserTransaction.name, schema: UserTransactionSchema },
    ]),
  ],
  controllers: [InterviewController],
  providers: [
    AudioTranscoderService,
    BaiduSpeechService,
    InterviewSpeechService,
    InterviewReportService,
    InterviewQuizService,
    InterviewTurnService,
    InterviewStartService,
    InterviewService,
    InterviewAIService,
    InterviewAgentService,
    DocumentParserService,
    ResumeAnalysisService,
    ConversationContinuationService,
  ],
  exports: [
    InterviewService,
    InterviewAIService,
    InterviewAgentService,
    DocumentParserService,
  ],
})
export class InterviewModule {}
