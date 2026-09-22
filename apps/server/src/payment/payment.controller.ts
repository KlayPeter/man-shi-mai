import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { QueryPaymentStatusDto } from './dto/query-payment-status.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MockPaymentSuccessDto } from './dto/mock-payment-success.dto';

/**
 * 身份由 JwtAuthGuard 验证并写入。
 */
type AuthenticatedRequest = { user: { userId: string } };

@ApiTags('支付管理')
@ApiBearerAuth()
@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('capabilities')
  @ApiOperation({ summary: '充值可用状态与实际套餐权益' })
  capabilities() {
    return this.paymentService.getCapabilities();
  }

  /**
   * 创建支付订单
   * @param dto 支付订单信息
   * @returns 支付订单结果
   */
  @Post('order')
  @ApiOperation({ summary: '创建支付订单' })
  initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentService.initiatePayment(dto, req.user);
  }

  /**
   * 主动查询支付结果
   * 只读当前用户订单的持久化状态，不触发发放。
   */
  @Post('order/status')
  @ApiOperation({ summary: '查询支付状态' })
  queryAlipayPaymentStatus(
    @Body() dto: QueryPaymentStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentService.queryAlipayPaymentStatus(dto.orderId, req.user);
  }

  @Post('mock-success')
  @ApiOperation({ summary: '模拟支付成功' })
  mockPaymentSuccess(
    @Body() body: MockPaymentSuccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentService.mockPaymentSuccess(body.orderId, req.user);
  }
}
