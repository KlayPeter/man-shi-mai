import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import WebSocket, { RawData } from 'ws';
import { MAX_PCM_BYTES } from './audio-transcoder.service';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

@Injectable()
export class DashscopeSpeechService {
  private readonly logger = new Logger(DashscopeSpeechService.name);
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('DASHSCOPE_API_KEY')?.trim();
  }

  protected connect(key: string): WebSocket {
    return new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference', {
      headers: { Authorization: `Bearer ${key}` },
      handshakeTimeout: 5000,
      maxPayload: 512 * 1024,
      followRedirects: false,
    });
  }

  async recognize(pcm: Buffer, signal?: AbortSignal): Promise<string> {
    if (pcm.length < 3200 || pcm.length > MAX_PCM_BYTES || pcm.length % 2)
      throw new BadRequestException('录音时长或格式不符合要求。');
    const result = await this.run('asr', { pcm }, signal);
    if (!result.text)
      throw new UnprocessableEntityException(
        '没有识别到清晰语音，请重录或使用文字回答。',
      );
    return result.text;
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<Buffer> {
    if (!text.trim() || text.length > 500)
      throw new BadRequestException('每段朗读文字应为 1 至 500 字符。');
    const result = await this.run('tts', { text: text.trim() }, signal);
    if (
      result.audio.length < 44 ||
      result.audio.toString('ascii', 0, 4) !== 'RIFF' ||
      result.audio.toString('ascii', 8, 12) !== 'WAVE'
    )
      throw new BadGatewayException('语音合成返回了无效音频，请重试。');
    return result.audio;
  }

  private providerError(code: unknown, taskId: string): HttpException {
    const safeCode =
      typeof code === 'string' && /^[\w.-]{1,80}$/.test(code)
        ? code
        : 'Unknown';
    this.logger.warn(`speech task=${taskId} code=${safeCode}`);
    if (/AllocationQuota|QuotaExhausted/.test(safeCode))
      return new ServiceUnavailableException(
        '百炼语音免费额度已用完或已过期，请检查额度。',
      );
    if (/InvalidApiKey|AccessDenied|Forbidden|ModelNotFound/.test(safeCode))
      return new ServiceUnavailableException(
        '百炼语音未授权，请检查北京地域密钥和模型开通状态。',
      );
    return new BadGatewayException('百炼语音处理失败，请稍后重试。');
  }

  private run(
    kind: 'asr' | 'tts',
    input: { pcm?: Buffer; text?: string },
    signal?: AbortSignal,
  ): Promise<{ text: string; audio: Buffer }> {
    const key = this.config.get<string>('DASHSCOPE_API_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('百炼语音尚未配置。');
    if (signal?.aborted) throw new HttpException('语音请求已取消', 499);
    const taskId = randomUUID();
    const model =
      kind === 'asr'
        ? 'paraformer-realtime-v2'
        : this.config.get<string>('DASHSCOPE_TTS_MODEL') || 'sambert-zhida-v1';
    return new Promise((resolve, reject) => {
      const socket = this.connect(key);
      const sentences = new Map<number, string>();
      const audio: Buffer[] = [];
      let size = 0;
      let started = false;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        socket.terminate();
      };
      const fail = (error: HttpException) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const abort = () => fail(new HttpException('语音请求已取消', 499));
      const timer = setTimeout(
        () => fail(new GatewayTimeoutException('百炼语音处理超时，请重试。')),
        20000,
      );
      signal?.addEventListener('abort', abort, { once: true });
      socket.on('unexpected-response', (_request, response) => {
        response.resume();
        fail(
          response.statusCode === 401 || response.statusCode === 403
            ? new ServiceUnavailableException(
                '百炼语音鉴权失败，请检查北京地域密钥。',
              )
            : new BadGatewayException('百炼语音连接失败，请稍后重试。'),
        );
      });
      socket.on('error', () =>
        fail(new BadGatewayException('百炼语音连接失败，请稍后重试。')),
      );
      socket.on('close', () => {
        if (!settled)
          fail(new BadGatewayException('语音任务未完成，连接已断开。'));
      });
      socket.on('open', () => {
        if (settled) return;
        socket.send(
          JSON.stringify({
            header: {
              action: 'run-task',
              task_id: taskId,
              streaming: kind === 'asr' ? 'duplex' : 'out',
            },
            payload: {
              task_group: 'audio',
              task: kind,
              function: kind === 'asr' ? 'recognition' : 'SpeechSynthesizer',
              model,
              parameters:
                kind === 'asr'
                  ? {
                      format: 'pcm',
                      sample_rate: 16000,
                      language_hints: ['zh', 'en'],
                    }
                  : {
                      text_type: 'PlainText',
                      format: 'wav',
                      sample_rate: 16000,
                      rate: 1,
                    },
              input: kind === 'asr' ? {} : { text: input.text },
            },
          }),
        );
      });
      socket.on('message', (data: RawData, binary: boolean) => {
        if (settled) return;
        const bytes = Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(
              data instanceof ArrayBuffer ? new Uint8Array(data) : data,
            );
        if (binary) {
          size += bytes.length;
          if (kind !== 'tts' || !started || size > 2 * 1024 * 1024) {
            fail(new BadGatewayException('语音服务返回音频异常。'));
            return;
          }
          audio.push(bytes);
          return;
        }
        try {
          const message: unknown = JSON.parse(bytes.toString('utf8'));
          if (
            !record(message) ||
            !record(message.header) ||
            message.header.task_id !== taskId
          )
            throw new Error('invalid event');
          const event = message.header.event;
          if (event === 'task-failed') {
            fail(this.providerError(message.header.error_code, taskId));
          } else if (event === 'task-started' && !started) {
            started = true;
            if (kind === 'asr' && input.pcm) {
              for (let offset = 0; offset < input.pcm.length; offset += 16000)
                socket.send(input.pcm.subarray(offset, offset + 16000));
              socket.send(
                JSON.stringify({
                  header: {
                    action: 'finish-task',
                    task_id: taskId,
                    streaming: 'duplex',
                  },
                  payload: { input: {} },
                }),
              );
            }
          } else if (event === 'result-generated' && kind === 'asr') {
            const payload = message.payload;
            const sentence =
              record(payload) && record(payload.output)
                ? payload.output.sentence
                : undefined;
            if (
              record(sentence) &&
              sentence.sentence_end === true &&
              !sentence.heartbeat
            ) {
              if (
                typeof sentence.text !== 'string' ||
                typeof sentence.begin_time !== 'number'
              )
                throw new Error('invalid sentence');
              sentences.set(sentence.begin_time, sentence.text);
              if ([...sentences.values()].join('').length > 12000)
                throw new Error('oversized transcript');
            }
          } else if (event === 'task-finished') {
            if (!started) throw new Error('task not started');
            settled = true;
            cleanup();
            resolve({
              audio: Buffer.concat(audio),
              text: [...sentences.entries()]
                .sort(([a], [b]) => a - b)
                .map(([, text]) => text)
                .join('')
                .trim(),
            });
          }
        } catch {
          fail(new BadGatewayException('百炼语音返回格式异常，请重试。'));
        }
      });
    });
  }
}
