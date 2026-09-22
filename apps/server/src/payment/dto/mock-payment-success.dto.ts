import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MockPaymentSuccessDto {
  @ApiProperty({ description: '测试环境中创建的模拟订单 ID' })
  @IsUUID('4')
  orderId: string;
}
