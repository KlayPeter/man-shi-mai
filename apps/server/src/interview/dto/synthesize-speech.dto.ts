import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class SynthesizeSpeechDto {
  @ApiProperty({ description: '待朗读的问题，最多 500 字符' })
  @IsString()
  @Matches(/\S/, { message: '朗读内容不能为空' })
  @MaxLength(500)
  text: string;
}
