import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InterviewHistoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export interface InterviewHistoryItem {
  resultId: string;
  company?: string;
  position?: string;
  createdAt?: Date;
  status: string;
  reportStatus?: string;
  startStatus?: 'prepared' | 'ready' | 'refunding' | 'cancelled';
}

export interface InterviewHistoryPage {
  list: InterviewHistoryItem[];
  total: number;
  page: number;
  limit: number;
}
