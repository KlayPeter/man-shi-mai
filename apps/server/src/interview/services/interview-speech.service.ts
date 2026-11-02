import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAX_SPEECH_BYTES } from '../dto/speech-to-text.dto';
import { AudioTranscoderService } from './audio-transcoder.service';
import { BaiduSpeechService } from './baidu-speech.service';
import { DashscopeSpeechService } from './dashscope-speech.service';

@Injectable()
export class InterviewSpeechService {
  private active = 0;
  private users = new Map<string, { active: boolean; starts: number[] }>();
  constructor(
    private readonly audio: AudioTranscoderService,
    private readonly provider: BaiduSpeechService,
    private readonly dashscope: DashscopeSpeechService,
  ) {}
  isConfigured(): boolean {
    return this.dashscope.isConfigured() || this.provider.isConfigured();
  }
  synthesisConfigured(): boolean {
    return this.dashscope.isConfigured();
  }
  async synthesize(
    userId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    if (!this.dashscope.isConfigured())
      throw new ServiceUnavailableException('云端朗读尚未配置。');
    if (!text.trim() || text.length > 500)
      throw new BadRequestException('每段朗读文字应为 1 至 500 字符。');
    const release = this.claim(`tts:${userId}`, 30);
    try {
      return await this.dashscope.synthesize(text, signal);
    } finally {
      release();
    }
  }
  async transcribe(
    userId: string,
    encoded: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (
      typeof encoded !== 'string' ||
      !encoded ||
      encoded.length > Math.ceil(MAX_SPEECH_BYTES / 3) * 4 ||
      encoded.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
    )
      throw new BadRequestException('录音内容格式或大小不正确。');
    const buffer = Buffer.from(encoded, 'base64');
    if (
      !buffer.length ||
      buffer.length > MAX_SPEECH_BYTES ||
      buffer.toString('base64') !== encoded
    )
      throw new BadRequestException('录音不能超过 4 MB。');
    if (!this.dashscope.isConfigured()) this.provider.assertConfigured();
    const release = this.claim(userId, 8);
    try {
      const pcm = await this.audio.toPcm(buffer);
      return this.dashscope.isConfigured()
        ? await this.dashscope.recognize(pcm, signal)
        : await this.provider.recognize(pcm, userId);
    } finally {
      release();
    }
  }
  private claim(userId: string, attempts: number): () => void {
    const now = Date.now();
    for (const [key, item] of this.users) {
      item.starts = item.starts.filter((time) => time > now - 60000);
      if (!item.active && !item.starts.length) this.users.delete(key);
    }
    const state = this.users.get(userId) || { active: false, starts: [] };
    if (state.active || state.starts.length >= attempts)
      throw new HttpException(
        '语音请求过于频繁，请稍后重试。',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (this.active >= 4 || this.users.size >= 10000)
      throw new ServiceUnavailableException(
        '语音服务繁忙，请稍后重试或使用文字回答。',
      );
    state.active = true;
    state.starts.push(now);
    this.users.set(userId, state);
    this.active++;
    return () => {
      state.active = false;
      this.active--;
    };
  }
}
