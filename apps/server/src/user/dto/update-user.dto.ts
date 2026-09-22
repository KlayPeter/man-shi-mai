import { IsString, IsOptional, IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ description: '用户名', required: false })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 20)
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: '用户昵称，用于显示',
    example: '张三',
    required: false,
  })
  @IsString()
  @Length(2, 20)
  @IsOptional()
  nickname?: string;

  @ApiProperty({
    description: '用户头像URL地址',
    example: 'https://example.oss.com/avatars/user123.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: '用户邮箱，必须是有效的邮箱格式',
    example: 'newemail@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: '用户手机号',
    example: '13800138000',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}
