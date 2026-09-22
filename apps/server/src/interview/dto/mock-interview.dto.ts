import { PracticeIntensity } from '../services/interview-policy';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/**
 * 面试类型枚举
 */
export enum MockInterviewType {
  SPECIAL = 'special', // 专业能力
  COMPREHENSIVE = 'behavior', // HR / 行为面试
}

/**
 * 开始模拟面试请求 DTO
 */
export class StartMockInterviewDto {
  @ApiProperty({
    enum: PracticeIntensity,
    required: false,
    default: PracticeIntensity.STANDARD,
  })
  @IsOptional()
  @IsEnum(PracticeIntensity)
  practiceIntensity?: PracticeIntensity;

  @ApiProperty({ description: '本次开始的请求 ID；断线重试复用' })
  @IsUUID('4')
  requestId: string;

  @ApiProperty({
    description: '面试类型',
    enum: MockInterviewType,
    example: MockInterviewType.SPECIAL,
  })
  @IsEnum(MockInterviewType, { message: '面试类型无效' })
  @IsNotEmpty({ message: '面试类型不能为空' })
  interviewType: MockInterviewType;

  @ApiProperty({
    description: '候选人姓名（可选）',
    example: '张三',
    required: false,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: '候选人姓名不能超过50个字符' })
  candidateName?: string;

  @ApiProperty({
    description: '公司名称（可选）',
    example: '字节跳动',
    required: false,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: '公司名称不能超过100个字符' })
  company?: string;

  @ApiProperty({
    description: '岗位名称（可选）',
    example: '前端开发工程师',
    required: false,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: '岗位名称不能超过100个字符' })
  positionName?: string;

  @ApiProperty({
    description: '最低薪资（单位：K）',
    example: 20,
    required: false,
  })
  @Min(0, { message: '最低薪资不能小于0' })
  @Max(9999, { message: '最低薪资不能超过9999K' })
  @IsOptional()
  minSalary?: number | string;

  @ApiProperty({
    description: '最高薪资（单位：K）',
    example: 35,
    required: false,
  })
  @Min(0, { message: '最高薪资不能小于0' })
  @Max(9999, { message: '最高薪资不能超过9999K' })
  @IsOptional()
  maxSalary?: number | string;

  @ApiProperty({
    description: '职位描述（JD）（可选）',
    example: '负责前端架构设计...',
    required: false,
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: '职位描述不能超过5000个字符' })
  jd?: string;

  @ApiProperty({
    description: '简历ID（从简历列表中选择）',
    example: 'uuid-xxx-xxx',
    required: false,
  })
  @IsString()
  @IsOptional()
  resumeId?: string;

  @ApiProperty({
    description: '简历内容（直接传递文本，二选一）',
    example: '个人信息：张三...',
    required: false,
    maxLength: 10000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000, { message: '简历内容不能超过10000个字符' })
  resumeContent?: string;
}

/**
 * 候选人回答请求 DTO
 */
export class AnswerMockInterviewDto {
  @ApiProperty({ description: '本轮请求唯一 ID；失败重试必须复用' })
  @IsUUID('4')
  requestId: string;

  @ApiProperty({ description: '当前问题版本，从 0 开始' })
  @IsInt()
  @Min(0)
  @Max(1000)
  expectedVersion: number;

  @ApiProperty({
    description: '面试会话ID',
    example: 'uuid-xxx-xxx',
  })
  @IsString()
  @IsNotEmpty({ message: '面试会话ID不能为空' })
  sessionId: string;

  @ApiProperty({
    description: '候选人的回答',
    example: '我叫张三，毕业于清华大学...',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty({ message: '回答内容不能为空' })
  @MaxLength(5000, { message: '回答内容不能超过5000个字符' })
  answer: string;
}

/**
 * 模拟面试事件类型
 */
export enum MockInterviewEventType {
  START = 'start', // 面试开始
  QUESTION = 'question', // 面试官提问
  WAITING = 'waiting', // 等待候选人回答
  REFERENCE_ANSWER = 'reference_answer', // 参考答案（标准答案）
  THINKING = 'thinking', // AI正在思考
  END = 'end', // 面试结束
  ERROR = 'error', // 发生错误
}

/**
 * 模拟面试 SSE 事件 DTO
 */
export class MockInterviewEventDto {
  @ApiProperty({
    description: '事件类型',
    enum: MockInterviewEventType,
  })
  type: MockInterviewEventType;

  @ApiProperty({
    description: '会话ID',
    required: false,
  })
  sessionId?: string;

  @ApiProperty({
    description: '面试官姓名',
    required: false,
  })
  interviewerName?: string;

  @ApiProperty({
    description: '问题或消息内容（流式传输时为累积内容）',
    required: false,
  })
  content?: string;

  @ApiProperty({
    description: '当前问题序号',
    required: false,
  })
  questionNumber?: number;

  @ApiProperty({
    description: '总问题数（预估）',
    required: false,
  })
  totalQuestions?: number;

  @ApiProperty({
    description: '已用时间（分钟）',
    required: false,
  })
  elapsedMinutes?: number;

  @ApiProperty({
    description: '错误信息（仅在error事件时返回）',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: '结果ID（持久化标识，从start事件开始就会返回）',
    required: false,
  })
  resultId?: string;

  @ApiProperty({
    description:
      '是否正在流式传输中（true表示内容还在生成，false表示生成完成）',
    required: false,
  })
  isStreaming?: boolean;

  @ApiProperty({
    description: '额外数据',
    required: false,
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({ enum: PracticeIntensity, required: false })
  practiceIntensity?: PracticeIntensity;

  @ApiProperty({ description: '本场时长上限（分钟）', required: false })
  targetDuration?: number;
  questionVersion?: number;
  requestId?: string;
  startStatus?: 'prepared' | 'ready' | 'refunding' | 'cancelled';
  conversationHistory?: Array<{
    role: 'interviewer' | 'candidate';
    content: string;
    timestamp: Date;
  }>;
  status?: string;
}
