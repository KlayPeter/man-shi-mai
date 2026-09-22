import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
@Injectable()
export class BaiduSpeechService {
  private token?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  constructor(private readonly config: ConfigService) {}
  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('BAIDU_API_KEY') &&
      this.config.get<string>('BAIDU_SECRET_KEY'),
    );
  }
  assertConfigured() {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        '语音识别暂未开通，请使用文字回答。',
      );
  }
  private async json(
    url: string,
    body: URLSearchParams | Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
        headers: {
          'Content-Type':
            body instanceof URLSearchParams
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
        },
        body:
          body instanceof URLSearchParams
            ? body.toString()
            : JSON.stringify(body),
      });
      if (!response.ok)
        throw new BadGatewayException('语音服务暂时不可用，请稍后重试。');
      return await response.json();
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (
        isRecord(error) &&
        typeof error.name === 'string' &&
        ['TimeoutError', 'AbortError'].includes(error.name)
      )
        throw new GatewayTimeoutException(
          '语音识别超时，请重试或使用文字回答。',
        );
      throw new BadGatewayException('语音服务连接失败，请稍后重试。');
    }
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now())
      return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      this.assertConfigured();
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.get<string>('BAIDU_API_KEY')!,
        client_secret: this.config.get<string>('BAIDU_SECRET_KEY')!,
      });
      const data = await this.json(
        'https://aip.baidubce.com/oauth/2.0/token',
        body,
        5000,
      );
      if (
        !isRecord(data) ||
        typeof data.access_token !== 'string' ||
        !data.access_token ||
        typeof data.expires_in !== 'number' ||
        data.expires_in <= 60
      )
        throw new ServiceUnavailableException(
          '语音服务授权失败，请使用文字回答并联系反馈。',
        );
      this.token = {
        value: data.access_token,
        expiresAt: Date.now() + Math.min(data.expires_in - 60, 86400) * 1000,
      };
      return data.access_token;
    })();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }
  async recognize(pcm: Buffer, userId: string): Promise<string> {
    const token = await this.accessToken();
    const result = await this.json(
      'https://vop.baidu.com/server_api',
      {
        format: 'pcm',
        rate: 16000,
        channel: 1,
        dev_pid: 1537,
        token,
        cuid: createHash('sha256').update(userId).digest('hex').slice(0, 32),
        speech: pcm.toString('base64'),
        len: pcm.length,
      },
      12000,
    );
    const code = isRecord(result)
      ? (result.err_no ?? result.error_code)
      : undefined;
    if (!isRecord(result) || typeof code !== 'number')
      throw new BadGatewayException('语音服务返回异常，请稍后重试。');
    if ([3302, 110, 111].includes(code)) {
      this.token = undefined;
      throw new ServiceUnavailableException('语音服务授权失效，请稍后重试。');
    }
    if (code === 3301)
      throw new UnprocessableEntityException(
        '没有识别到清晰语音，请重录或使用文字回答。',
      );
    if (code !== 0)
      throw new BadGatewayException('语音识别暂时失败，请稍后重试。');
    if (
      !Array.isArray(result.result) ||
      !result.result.length ||
      result.result.some((value) => typeof value !== 'string')
    )
      throw new BadGatewayException('语音服务返回异常，请稍后重试。');
    const text = result.result.join('').trim();
    if (!text)
      throw new UnprocessableEntityException(
        '没有识别到清晰语音，请重录或使用文字回答。',
      );
    return text;
  }
}
