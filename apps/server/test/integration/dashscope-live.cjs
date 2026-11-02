/* Opt-in, bounded live check: one fixed short TTS task + one ASR task. No MongoDB or interview data. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { InterviewController } = require('../../dist/src/interview/interview.controller');
const { InterviewService } = require('../../dist/src/interview/services/interview.service');
const { InterviewReportService } = require('../../dist/src/interview/services/interview-report.service');
const { InterviewSpeechService } = require('../../dist/src/interview/services/interview-speech.service');
const { AudioTranscoderService } = require('../../dist/src/interview/services/audio-transcoder.service');
const { DashscopeSpeechService } = require('../../dist/src/interview/services/dashscope-speech.service');
const { BaiduSpeechService } = require('../../dist/src/interview/services/baidu-speech.service');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');

if (process.env.RUN_DASHSCOPE_LIVE !== '1' || !process.env.DASHSCOPE_API_KEY) throw Error('Explicit RUN_DASHSCOPE_LIVE=1 and DASHSCOPE_API_KEY required');
(async () => {
  const secret = 'dashscope-local-test-only-not-a-production-secret';
  const config = new ConfigService({ JWT_SECRET: secret, DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY, DASHSCOPE_TTS_MODEL: 'sambert-zhida-v1' });
  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [InterviewController],
    providers: [InterviewSpeechService, AudioTranscoderService, DashscopeSpeechService, BaiduSpeechService, JwtStrategy, JwtAuthGuard,
      { provide: InterviewService, useValue: {} }, { provide: InterviewReportService, useValue: {} }, { provide: ConfigService, useValue: config }],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useBodyParser('json', { limit: '8mb' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3015, '127.0.0.1');
  const token = new JwtService({ secret }).sign({ userId: 'dashscope-synthetic-owner' }, { expiresIn: '15m' });
  const base = process.env.TEST_API_BASE || 'http://127.0.0.1:3015';
  assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const send = (path, body, authenticated = true) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  try {
    const status = await fetch(`${base}/interview/speech/status`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(status.status, 200);
    const capability = await status.json();
    assert.deepEqual(capability.data, { available: true, synthesisAvailable: true });
    assert.equal((await send('/interview/speech/synthesize', { text: '你好' }, false)).status, 401);
    assert.equal((await send('/interview/speech/synthesize', { text: ' ' })).status, 400);
    const result = await send('/interview/speech/synthesize', { text: '你好，欢迎面试。' });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-type'), /audio\/wav/);
    const audio = Buffer.from(await result.arrayBuffer());
    assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
    const recognized = await send('/interview/speech-to-text', { audio: audio.toString('base64') });
    assert.equal(recognized.status, 201);
    const body = await recognized.json();
    assert.equal(body.data.text.replace(/[\s，。！!]/g, ''), '你好欢迎面试');
    console.log('PASS: real JWT/DTO -> HTTP/proxy -> Sambert WAV -> ffmpeg -> Paraformer transcription');
    if (process.env.DASHSCOPE_FIXTURE_DIR) {
      const fs = require('node:fs'); const path = require('node:path');
      fs.mkdirSync(process.env.DASHSCOPE_FIXTURE_DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(process.env.DASHSCOPE_FIXTURE_DIR, 'test.wav'), audio, { mode: 0o600 });
      fs.writeFileSync(path.join(process.env.DASHSCOPE_FIXTURE_DIR, 'fixture.json'), JSON.stringify({ token }), { mode: 0o600 });
    }
  } finally { await app.close(); }
})().catch(error => { console.error('Live speech check failed:', error.code || error.message); process.exitCode = 1; });
