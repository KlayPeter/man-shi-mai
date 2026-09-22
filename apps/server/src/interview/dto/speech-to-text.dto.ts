import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_SPEECH_BYTES = 4 * 1024 * 1024;
export class SpeechToTextDto {
  @ApiProperty({
    description: '完整录音文件的 Base64，最大 4 MB，不含 data URL 前缀',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(Math.ceil(MAX_SPEECH_BYTES / 3) * 4)
  @IsBase64()
  audio: string;
}
