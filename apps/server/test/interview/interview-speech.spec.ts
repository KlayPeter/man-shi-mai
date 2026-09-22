import { Test } from '@nestjs/testing';
import { ValidationPipe, ServiceUnavailableException } from '@nestjs/common';
import {
  SpeechToTextDto,
  MAX_SPEECH_BYTES,
} from '../../src/interview/dto/speech-to-text.dto';
import { InterviewSpeechService } from '../../src/interview/services/interview-speech.service';
import { AudioTranscoderService } from '../../src/interview/services/audio-transcoder.service';
import { BaiduSpeechService } from '../../src/interview/services/baidu-speech.service';

describe('speech request boundary', () => {
  const audio = { toPcm: jest.fn() };
  const provider = {
    isConfigured: jest.fn(),
    assertConfigured: jest.fn(),
    recognize: jest.fn(),
  };
  let service: InterviewSpeechService;
  const input = Buffer.from('synthetic-input').toString('base64');
  beforeEach(async () => {
    jest.resetAllMocks();
    provider.isConfigured.mockReturnValue(true);
    audio.toPcm.mockResolvedValue(Buffer.alloc(32000));
    provider.recognize.mockResolvedValue('合成转写');
    const module = await Test.createTestingModule({
      providers: [
        InterviewSpeechService,
        { provide: AudioTranscoderService, useValue: audio },
        { provide: BaiduSpeechService, useValue: provider },
      ],
    }).compile();
    service = module.get(InterviewSpeechService);
  });
  it('reports configuration without contacting or charging the provider', () => {
    expect(service.isConfigured()).toBe(true);
    provider.isConfigured.mockReturnValue(false);
    expect(service.isConfigured()).toBe(false);
    expect(provider.recognize).not.toHaveBeenCalled();
  });
  it('validates real DTO and preserves only audio', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const parse = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: SpeechToTextDto });
    await expect(parse({ audio: input, userId: 'foreign' })).resolves.toEqual({
      audio: input,
    });
    for (const body of [
      {},
      { audio: '' },
      { audio: 1 },
      { audio: 'data:audio/wav;base64,aaa' },
      { audio: '!' },
      { audio: Buffer.alloc(MAX_SPEECH_BYTES + 3).toString('base64') },
    ])
      await expect(parse(body)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects malformed, noncanonical and oversized Base64 before provider calls', async () => {
    for (const value of [
      '!',
      'abc',
      'AB==',
      Buffer.alloc(MAX_SPEECH_BYTES + 1).toString('base64'),
    ])
      await expect(service.transcribe('u', value)).rejects.toMatchObject({
        status: 400,
      });
    expect(provider.recognize).not.toHaveBeenCalled();
    expect(audio.toPcm).not.toHaveBeenCalled();
  });
  it('does not transcode when unconfigured', async () => {
    provider.assertConfigured.mockImplementation(() => {
      throw new ServiceUnavailableException('disabled');
    });
    await expect(service.transcribe('u', input)).rejects.toMatchObject({
      status: 503,
    });
    expect(audio.toPcm).not.toHaveBeenCalled();
  });
  it('allows one active request per user and releases the slot after failure', async () => {
    let fail!: (error: Error) => void;
    provider.recognize.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const first = service.transcribe('u', input);
    const rejected = expect(first).rejects.toThrow('offline');
    await Promise.resolve();
    await expect(service.transcribe('u', input)).rejects.toMatchObject({
      status: 429,
    });
    fail(new Error('offline'));
    await rejected;
    await expect(service.transcribe('u', input)).resolves.toBe('合成转写');
  });
  it('bounds process concurrency and limits eight attempts per minute', async () => {
    const release: (() => void)[] = [];
    provider.recognize.mockImplementation(
      () => new Promise((resolve) => release.push(() => resolve('ok'))),
    );
    const requests = ['a', 'b', 'c', 'd'].map((id) =>
      service.transcribe(id, input),
    );
    await Promise.resolve();
    await expect(service.transcribe('e', input)).rejects.toMatchObject({
      status: 503,
    });
    release.forEach((done) => done());
    await Promise.all(requests);
    provider.recognize.mockResolvedValue('ok');
    for (let i = 0; i < 8; i++) await service.transcribe('f', input);
    await expect(service.transcribe('f', input)).rejects.toMatchObject({
      status: 429,
    });
    const time = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    try {
      await expect(service.transcribe('f', input)).resolves.toBe('ok');
    } finally {
      time.mockRestore();
    }
  });
});
