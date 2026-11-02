import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { of } from 'rxjs';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { InterviewController } from '../../src/interview/interview.controller';
import { InterviewReportService } from '../../src/interview/services/interview-report.service';
import { InterviewService } from '../../src/interview/services/interview.service';
import { InterviewSpeechService } from '../../src/interview/services/interview-speech.service';

jest.mock('../../src/interview/services/interview.service', () => ({
  InterviewService: class InterviewService {},
}));
jest.mock('../../src/interview/services/interview-report.service', () => ({
  InterviewReportService: class InterviewReportService {},
}));

describe('interview speech status HTTP boundary', () => {
  let app: INestApplication;
  const speech = {
    isConfigured: jest.fn(),
    synthesisConfigured: jest.fn(() => false),
    synthesize: jest.fn().mockResolvedValue(Buffer.from('synthetic-wav')),
  };
  const interview = { startMockInterviewWithStream: jest.fn(() => of()) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InterviewController],
      providers: [
        { provide: InterviewService, useValue: interview },
        { provide: InterviewReportService, useValue: {} },
        { provide: InterviewSpeechService, useValue: speech },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { userId: 'test-user' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns the configured capability without provider calls', async () => {
    speech.isConfigured.mockReturnValue(false);
    await request(app.getHttpServer())
      .get('/interview/speech/status')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          available: false,
          synthesisAvailable: false,
        });
      });
    speech.isConfigured.mockReturnValue(true);
    await request(app.getHttpServer())
      .get('/interview/speech/status')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          available: true,
          synthesisAvailable: false,
        });
      });
  });

  it('does not add a wildcard origin to interview SSE', async () => {
    await request(app.getHttpServer())
      .post('/interview/mock/start')
      .set('Origin', 'https://untrusted.example')
      .send({
        requestId: '88a0a392-6497-46b7-82e7-c924db38fb12',
        interviewType: 'special',
        positionName: '前端工程师',
      })
      .expect(200)
      .expect((response) => {
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      });
  });
  it('returns audio bytes and validates text before calling the provider', async () => {
    await request(app.getHttpServer())
      .post('/interview/speech/synthesize')
      .send({ text: '你好', userId: 'foreign' })
      .expect(200)
      .expect('Content-Type', /audio\/wav/)
      .expect('Cache-Control', 'no-store');
    expect(speech.synthesize).toHaveBeenCalledWith(
      'test-user',
      '你好',
      expect.any(AbortSignal),
    );
    const count = speech.synthesize.mock.calls.length;
    for (const body of [
      {},
      { text: ' ' },
      { text: 123 },
      { text: 'a'.repeat(501) },
    ])
      await request(app.getHttpServer())
        .post('/interview/speech/synthesize')
        .send(body)
        .expect(400);
    expect(speech.synthesize).toHaveBeenCalledTimes(count);
  });
});
