import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ContinueConversationDto {
  @IsUUID('4')
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  question: string;
}
