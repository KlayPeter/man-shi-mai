import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentService } from '../../src/payment/payment.service';
import {
  PaymentRecord,
  PaymentRecordStatus,
} from '../../src/payment/payment-record.schema';
import { User } from '../../src/user/schemas/user.schema';
import { UserTransaction } from '../../src/user/schemas/user-transaction.schema';
import { VirtualPaymentService } from '../../src/payment/providers/virtual-payment.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentChannel } from '../../src/payment/payment.types';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRecordModel: any;
  let userModel: any;
  let userTransactionModel: any;
  let virtualPayment: any;

  const mockPaymentRecord = {
    orderId: 'order-123',
    userId: '507f1f77bcf86cd799439011',
    channel: PaymentChannel.ALIPAY,
    amount: 18.8,
    currency: 'CNY',
    planId: 'single',
    planName: 'Single Plan',
    source: 'web',
    description: 'Single Plan Description',
    status: PaymentRecordStatus.PENDING,
    metadata: {},
    createdAt: new Date().toISOString(),
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const mockPaymentRecordModel = {
      create: jest.fn().mockResolvedValue(mockPaymentRecord),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPaymentRecord),
      }),
    };

    const mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    const mockUserTransactionModel = {
      create: jest.fn(),
    };

    const mockVirtualPayment = {
      initiatePayment: jest.fn().mockResolvedValue({
        channel: PaymentChannel.ALIPAY,
        orderId: 'order-123',
        redirectUrl: 'https://alipay.com/pay',
        createdAt: new Date().toISOString(),
      }),
      queryTrade: jest.fn().mockResolvedValue({
        tradeStatus: 'TRADE_SUCCESS',
        buyerLogonId: 'buyer@example.com',
        buyerPayAmount: '18.8',
        invoiceAmount: '18.8',
        outTradeNo: 'order-123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getModelToken(PaymentRecord.name),
          useValue: mockPaymentRecordModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(UserTransaction.name),
          useValue: mockUserTransactionModel,
        },
        {
          provide: VirtualPaymentService,
          useValue: mockVirtualPayment,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRecordModel = module.get(getModelToken(PaymentRecord.name));
    userModel = module.get(getModelToken(User.name));
    userTransactionModel = module.get(getModelToken(UserTransaction.name));
    virtualPayment = module.get(VirtualPaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should successfully initiate payment with valid plan', async () => {
      const result = await service.initiatePayment(
        {
          planId: 'single',
          amount: 18.8,
          planName: 'Single Plan',
          channel: PaymentChannel.ALIPAY,
          source: 'web',
          description: 'Single Plan Description',
        },
        { userId: '507f1f77bcf86cd799439011' },
      );

      expect(paymentRecordModel.create).toHaveBeenCalled();
      expect(virtualPayment.initiatePayment).toHaveBeenCalled();
      expect(result.redirectUrl).toBe('https://alipay.com/pay');
    });

    it('should throw BadRequestException if planId is invalid', async () => {
      await expect(
        service.initiatePayment({
          planId: 'invalid-plan',
          amount: 100,
          planName: 'Invalid Plan',
          channel: PaymentChannel.ALIPAY,
          source: 'web',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount does not match plan validation', async () => {
      await expect(
        service.initiatePayment({
          planId: 'single',
          amount: 99.9, // Incorrect amount for single plan (should be 18.8)
          planName: 'Single Plan',
          channel: PaymentChannel.ALIPAY,
          source: 'web',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('queryAlipayPaymentStatus', () => {
    it('should throw BadRequestException if order does not exist', async () => {
      paymentRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.queryAlipayPaymentStatus('nonexistent-order', {
          userId: '507f1f77bcf86cd799439011',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if order belongs to a different user', async () => {
      paymentRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPaymentRecord),
      });

      await expect(
        service.queryAlipayPaymentStatus('order-123', {
          userId: '507f1f77bcf86cd799439012',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should directly return success if the payment record status is already SUCCESS', async () => {
      const mockSuccessRecord = {
        ...mockPaymentRecord,
        status: PaymentRecordStatus.SUCCESS,
      };

      paymentRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSuccessRecord),
      });

      const result = await service.queryAlipayPaymentStatus('order-123', {
        userId: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
      expect(virtualPayment.queryTrade).not.toHaveBeenCalled();
    });
  });
});
