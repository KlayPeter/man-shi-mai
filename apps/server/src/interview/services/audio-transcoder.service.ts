import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as installer from '@ffmpeg-installer/ffmpeg';

export const MAX_PCM_BYTES = 60 * 16000 * 2;
export const TRANSCODE_TIMEOUT_MS = 8000;

function inputFormat(buffer: Buffer): string {
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    return 'matroska';
  if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'mov';
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  )
    return 'wav';
  throw new BadRequestException(
    '不支持的录音格式，请使用 WebM、Ogg、M4A/MP4 或 WAV。',
  );
}

@Injectable()
export class AudioTranscoderService {
  async toPcm(audio: Buffer): Promise<Buffer> {
    const format = inputFormat(audio);
    const dir = await mkdtemp(join(tmpdir(), 'msm-speech-'));
    const input = join(dir, 'recording');
    try {
      await writeFile(input, audio, { mode: 0o600 });
      return await new Promise<Buffer>((resolve, reject) => {
        const process = spawn(
          installer.path,
          [
            '-nostdin',
            '-hide_banner',
            '-loglevel',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-threads',
            '1',
            '-f',
            format,
            '-i',
            input,
            '-map',
            '0:a:0',
            '-vn',
            '-sn',
            '-dn',
            '-t',
            '61',
            '-ac',
            '1',
            '-ar',
            '16000',
            '-acodec',
            'pcm_s16le',
            '-f',
            's16le',
            'pipe:1',
          ],
          { stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const chunks: Buffer[] = [];
        let size = 0;
        let failure: Error | null = null;
        const timeout = setTimeout(() => {
          failure = new GatewayTimeoutException(
            '录音处理超时，请缩短录音后重试。',
          );
          process.kill('SIGKILL');
        }, TRANSCODE_TIMEOUT_MS);
        process.on('error', () => {
          failure = new ServiceUnavailableException(
            '录音处理服务不可用，请使用文字回答。',
          );
        });
        process.stdout.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_PCM_BYTES) {
            failure = new BadRequestException(
              '每段录音不能超过 60 秒，请分段录制。',
            );
            process.kill('SIGKILL');
          } else if (!failure) chunks.push(chunk);
        });
        process.on('close', (code) => {
          clearTimeout(timeout);
          if (failure) {
            reject(failure);
            return;
          }
          if (code !== 0 || size < 3200) {
            reject(new BadRequestException('录音损坏或过短，请重新录制。'));
            return;
          }
          resolve(Buffer.concat(chunks));
        });
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
