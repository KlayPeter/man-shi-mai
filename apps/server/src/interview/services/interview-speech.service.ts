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

@Injectable()
export class InterviewSpeechService {
  private active = 0;
  private users = new Map<string, { active: boolean; starts: number[] }>();
  constructor(
    private readonly audio: AudioTranscoderService,
    private readonly provider: BaiduSpeechService,
  ) {}
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }
  async transcribe(userId: string, encoded: string): Promise<string> {
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
    this.provider.assertConfigured();
    const now = Date.now();
    for (const [key, item] of this.users) {
      item.starts = item.starts.filter((time) => time > now - 60000);
      if (!item.active && !item.starts.length) this.users.delete(key);
    }
    const state = this.users.get(userId) || { active: false, starts: [] };
    if (state.active || state.starts.length >= 8)
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
    try {
      return await this.provider.recognize(
        await this.audio.toPcm(buffer),
        userId,
      );
    } finally {
      state.active = false;
      this.active--;
    }
  }
}
