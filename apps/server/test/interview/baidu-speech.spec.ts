import { ConfigService } from '@nestjs/config';
import { BaiduSpeechService } from '../../src/interview/services/baidu-speech.service';

describe('Baidu speech transport (no network)', () => {
  let service: BaiduSpeechService;
  let http: jest.SpyInstance;
  const ok = (value: unknown) => new Response(JSON.stringify(value));
  beforeEach(() => {
    service = new BaiduSpeechService(
      new ConfigService({
        BAIDU_API_KEY: 'test-key',
        BAIDU_SECRET_KEY: 'test-secret',
      }),
    );
    http = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => http.mockRestore());
  it('checks whether both credentials are configured without making a request', () => {
    expect(service.isConfigured()).toBe(true);
    expect(
      new BaiduSpeechService(
        new ConfigService({ BAIDU_API_KEY: 'test-key' }),
      ).isConfigured(),
    ).toBe(false);
    expect(http).not.toHaveBeenCalled();
  });
  it('caches authorization, uses HTTPS and never sends a raw user identifier', async () => {
    http
      .mockResolvedValueOnce(
        ok({ access_token: 'test-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(ok({ err_no: 0, result: ['测试回答。'] }))
      .mockResolvedValueOnce(ok({ err_no: 0, result: ['另一段。'] }));
    await expect(
      service.recognize(Buffer.alloc(32000), 'private-user-id'),
    ).resolves.toBe('测试回答。');
    await service.recognize(Buffer.alloc(32000), 'private-user-id');
    expect(http).toHaveBeenCalledTimes(3);
    const [url, request] = http.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://vop.baidu.com/server_api');
    expect(request.redirect).toBe('error');
    expect(request.signal).toBeDefined();
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      format: 'pcm',
      rate: 16000,
      channel: 1,
      len: 32000,
      dev_pid: 1537,
    });
    expect(body.cuid).not.toContain('private-user-id');
  });
  it.each([
    { err_no: 3301, expected: 422 },
    { err_no: 3302, expected: 503 },
    { error_code: 110, expected: 503 },
    { error_code: 111, expected: 503 },
    { err_no: 3303, expected: 502 },
    { err_no: 0, result: [], expected: 502 },
  ])('maps provider error safely %j', async ({ expected, ...body }) => {
    http
      .mockResolvedValueOnce(
        ok({ access_token: 'test-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        ok({ ...body, err_msg: 'sensitive-upstream-error' }),
      );
    await expect(
      service.recognize(Buffer.alloc(32000), 'u'),
    ).rejects.toMatchObject({ status: expected });
  });
  it('surfaces network timeouts as 504 and never retries paid recognition automatically', async () => {
    http
      .mockResolvedValueOnce(
        ok({ access_token: 'test-token', expires_in: 3600 }),
      )
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    await expect(
      service.recognize(Buffer.alloc(32000), 'u'),
    ).rejects.toMatchObject({ status: 504 });
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('invalidates rejected token so the next explicit attempt reauthorizes', async () => {
    http
      .mockResolvedValueOnce(
        ok({ access_token: 'old-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(ok({ err_no: 3302 }))
      .mockResolvedValueOnce(
        ok({ access_token: 'new-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(ok({ err_no: 0, result: ['ok'] }));
    await expect(
      service.recognize(Buffer.alloc(32000), 'u'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(service.recognize(Buffer.alloc(32000), 'u')).resolves.toBe(
      'ok',
    );
    expect(http).toHaveBeenCalledTimes(4);
  });
});
