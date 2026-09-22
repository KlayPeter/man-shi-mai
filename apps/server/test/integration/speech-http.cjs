/* Actual Nest controller/JWT/DTO + bundled ffmpeg. Only the speech provider is a deterministic stub. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile, readdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
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
const { BaiduSpeechService } = require('../../dist/src/interview/services/baidu-speech.service');
const { JwtStrategy } = require('../../dist/src/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
if (process.env.RUN_LOCAL_INTEGRATION !== '1') throw new Error('Explicit local integration opt-in required');
(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'msm-audio-fixture-'));
  const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('msm-speech-')));
  const provider = { calls: 0, assertConfigured() {}, async recognize(pcm, userId) { assert(pcm.length >= 3200 && pcm.length <= 1920000); assert(userId.startsWith('speech-local')); this.calls++; return '合成音频已经完成本地转码'; } };
  const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [InterviewController], providers: [
    InterviewSpeechService, AudioTranscoderService, JwtStrategy, JwtAuthGuard,
    { provide: InterviewService, useValue: {} }, { provide: InterviewReportService, useValue: {} },
    { provide: BaiduSpeechService, useValue: provider }, { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'speech-local-test-secret' }) },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useBodyParser('json', { limit: '8mb' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3005, '127.0.0.1');
  const jwt = new JwtService({ secret: 'speech-local-test-secret' });
  const token = jwt.sign({ userId: 'speech-local-owner' });
  const base = process.env.TEST_API_BASE || 'http://127.0.0.1:3005';
  assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  async function post(body, bearer = token) {
    const response = await fetch(`${base}/interview/speech-to-text`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    return { status: response.status, body: await response.json() };
  }
  const wav = join(dir, 'one.wav');
  try {
    execFileSync(ffmpeg, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ar', '16000', '-ac', '1', wav]);
    const source = await readFile(wav);
    assert.equal((await post({ audio: source.toString('base64') }, null)).status, 401);
    for (const body of [{}, { audio: '!invalid' }, { audio: '' }, { audio: Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64') }]) assert.equal((await post(body)).status, 400);
    const extensions = ['wav', 'webm', 'ogg', 'm4a'];
    for (const ext of extensions) {
      const path = ext === 'wav' ? wav : join(dir, `one.${ext}`);
      if (ext !== 'wav') execFileSync(ffmpeg, ['-loglevel', 'error', '-i', wav, ...(ext === 'm4a' ? ['-c:a', 'aac'] : ['-c:a', 'libopus']), path]);
      const audio = (await readFile(path)).toString('base64');
      const response = await post({ audio, userId: 'injected-user' });
      assert.equal(response.status, 201); assert.equal(response.body.code, 200); assert.equal(response.body.data.text, '合成音频已经完成本地转码');
    }
    const priorCalls = provider.calls;
    const long = join(dir, 'long.wav');
    execFileSync(ffmpeg, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=61', '-ar', '16000', '-ac', '1', long]);
    assert.equal((await post({ audio: (await readFile(long)).toString('base64') })).status, 400);
    assert.equal((await post({ audio: Buffer.from('RIFFxxxxWAVEbroken').toString('base64') })).status, 400);
    assert.equal((await post({ audio: Buffer.from('#EXTM3U\nhttps://example.test/audio').toString('base64') })).status, 400);
    assert.equal(provider.calls, priorCalls, 'bad audio never reaches the provider');
    const after = (await readdir(tmpdir())).filter(name => name.startsWith('msm-speech-') && !before.has(name));
    assert.deepEqual(after, [], 'all transcode temp directories removed');
    if (process.env.KEEP_SPEECH_SERVER === '1') {
      await writeFile('/tmp/msm-phase1-local/speech-ui-fixture.json', JSON.stringify({ token, audio: source.toString('base64') }), { mode: 0o600 });
      console.log('PASS: real JWT/DTO/HTTP, WAV/WebM/Ogg/M4A transcoding, oversized and >60s rejection, no provider on invalid media, temp cleanup. ASR stub only. Listening on 3005.');
      await new Promise(resolve => process.once('SIGTERM', resolve));
    } else console.log('PASS: real JWT/DTO/HTTP, four codecs, >60s rejection and temp cleanup; ASR stub only.');
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
