import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { lastValueFrom, toArray } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { InterviewTurnService } from '../../src/interview/services/interview-turn.service';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { AnswerMockInterviewDto } from '../../src/interview/dto/mock-interview.dto';
jest.mock('../../src/interview/services/interview-agent.service', () => ({
  InterviewAgentService: class {},
}));

const fixture = () => ({
  toObject() {
    return { qaList: this.qaList.map((qa) => ({ ...qa })) };
  },
  _id: 'record',
  userId: 'owner',
  resultId: 'result',
  status: 'in_progress',
  turnVersion: 0,
  qaList: [{ question: '介绍项目', answer: '' }],
  sessionState: {
    sessionId: 'session',
    resultId: 'result',
    userId: 'owner',
    interviewType: 'special',
    interviewerName: '面试官',
    candidateName: null,
    company: '',
    resumeContent: '',
    questionCount: 0,
    startTime: new Date().toISOString(),
    targetDuration: 30,
    isActive: true,
    conversationHistory: [
      {
        role: 'interviewer',
        content: '介绍项目',
        timestamp: new Date().toISOString(),
      },
    ],
  },
});

describe('persistent interview turns', () => {
  const db = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const agent = { generateInterviewQuestionStream: jest.fn() };
  let service: InterviewTurnService;
  const dto = () => ({
    sessionId: 'session',
    requestId: randomUUID(),
    expectedVersion: 0,
    answer: '我做了缓存',
  });
  const answer = (body = dto()) =>
    lastValueFrom(service.answer('owner', body).pipe(toArray()));
  beforeEach(async () => {
    jest.resetAllMocks();
    db.findOne.mockResolvedValue(fixture());
    db.findOneAndUpdate.mockResolvedValue(fixture());
    const module = await Test.createTestingModule({
      providers: [
        InterviewTurnService,
        { provide: getModelToken('AIInterviewResult'), useValue: db },
        { provide: InterviewAgentService, useValue: agent },
      ],
    }).compile();
    service = module.get(InterviewTurnService);
    agent.generateInterviewQuestionStream.mockImplementation(
      async function* () {
        yield '如何测量收益？';
        return { question: '如何测量收益？', shouldEnd: false };
      },
    );
  });
  it('validates request id, version and blank answers at the boundary', async () => {
    expect(
      await validate(plainToInstance(AnswerMockInterviewDto, dto())),
    ).toHaveLength(0);
    for (const patch of [
      { requestId: undefined },
      { requestId: 'x' },
      { expectedVersion: -1 },
      { expectedVersion: 0.5 },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(AnswerMockInterviewDto, { ...dto(), ...patch }),
          )
        ).length,
      ).toBeGreaterThan(0);
    }
    expect((await answer({ ...dto(), answer: '   ' })).at(-1)?.type).toBe(
      'error',
    );
    expect(agent.generateInterviewQuestionStream).not.toHaveBeenCalled();
  });
  it('commits an entire turn once before sending waiting', async () => {
    const events = await answer();
    expect(events.map((event) => event.type)).toEqual([
      'thinking',
      'question',
      'question',
      'waiting',
    ]);
    expect(events.at(-1)?.questionVersion).toBe(1);
    const [filter, update] = db.findOneAndUpdate.mock.calls[1];
    expect(filter).toMatchObject({
      userId: 'owner',
      turnVersion: 0,
      status: 'in_progress',
    });
    expect(filter.turnLeaseToken).toBeTruthy();
    expect(update.$set.qaList).toEqual([
      expect.objectContaining({ question: '介绍项目', answer: '我做了缓存' }),
      expect.objectContaining({ question: '如何测量收益？', answer: '' }),
    ]);
    expect(update.$set.lastTurn.events.at(-1).type).toBe('waiting');
  });
  it('starts the next question in the relevant phase instead of repeating the introduction', async () => {
    await answer();
    expect(agent.generateInterviewQuestionStream).toHaveBeenCalledWith(
      expect.objectContaining({ currentPhase: 'resume_digging' }),
    );
    const behavioral = fixture();
    Object.assign(behavioral.sessionState, { interviewType: 'behavior' });
    db.findOne.mockResolvedValue(behavioral);
    await answer();
    expect(agent.generateInterviewQuestionStream).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentPhase: 'behavioral_test' }),
    );
  });
  it('saves the final answer and ends at the chosen practice limit without another model call', async () => {
    const record = fixture();
    Object.assign(record.sessionState, {
      practiceIntensity: 'warmup',
      questionCount: 5,
      targetDuration: 15,
    });
    record.turnVersion = 5;
    db.findOne.mockResolvedValue(record);
    const events = await answer({ ...dto(), expectedVersion: 5 });
    expect(events.at(-1)?.type).toBe('end');
    expect(events.at(-1)?.questionVersion).toBe(6);
    expect(agent.generateInterviewQuestionStream).not.toHaveBeenCalled();
    const saved = db.findOneAndUpdate.mock.calls[1][1].$set;
    expect(saved.status).toBe('completed');
    expect(saved.qaList).toEqual([
      expect.objectContaining({ question: '介绍项目', answer: '我做了缓存' }),
    ]);
  });
  it('never signals waiting on a save failure and releases only its own lease', async () => {
    db.findOneAndUpdate
      .mockResolvedValueOnce(fixture())
      .mockRejectedValueOnce(new Error('database down'));
    const events = await answer();
    expect(events.at(-1)?.type).toBe('error');
    expect(events.some((event) => event.type === 'waiting')).toBe(false);
    expect(db.updateOne.mock.calls[0][0].turnLeaseToken).toBe(
      db.findOneAndUpdate.mock.calls[0][1].$set.turnLeaseToken,
    );
    expect(events.at(-1)?.error).not.toContain('database down');
  });
  it('does not call the model for stale versions, busy turns or foreign sessions', async () => {
    expect((await answer({ ...dto(), expectedVersion: 1 })).at(-1)?.type).toBe(
      'error',
    );
    db.findOneAndUpdate.mockResolvedValue(null);
    expect((await answer()).at(-1)?.error).toContain('正在处理');
    db.findOne.mockResolvedValue(null);
    expect((await answer()).at(-1)?.error).toContain('不存在');
    expect(agent.generateInterviewQuestionStream).not.toHaveBeenCalled();
  });
  it('rejects empty model output instead of persisting a fake successful turn', async () => {
    agent.generateInterviewQuestionStream.mockImplementation(
      async function* () {
        yield '';
        return { question: '', shouldEnd: false };
      },
    );
    expect((await answer()).at(-1)?.type).toBe('error');
    expect(db.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
  it('times out a stuck generator without acknowledging or saving late output', async () => {
    jest.useFakeTimers();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    agent.generateInterviewQuestionStream.mockImplementation(
      async function* () {
        await gate;
        yield '迟到内容';
        return { question: '迟到问题', shouldEnd: false };
      },
    );
    try {
      const running = answer();
      await jest.advanceTimersByTimeAsync(90001);
      const events = await running;
      expect(events.at(-1)?.error).toContain('超时');
      release();
      await jest.advanceTimersByTimeAsync(0);
      expect(db.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(db.updateOne).toHaveBeenCalledTimes(1);
      expect(events.some((event) => event.type === 'waiting')).toBe(false);
    } finally {
      release();
      jest.useRealTimers();
    }
  });

  it('recovers dates from persisted JSON and exposes no resume or lease token', async () => {
    const recovered = await service.resume('owner', 'result');
    expect(recovered.questionVersion).toBe(0);
    expect(recovered.conversationHistory[0].timestamp).toBeInstanceOf(Date);
    expect(recovered).not.toHaveProperty('sessionState');
    expect(recovered).not.toHaveProperty('turnLeaseToken');
    expect(db.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
