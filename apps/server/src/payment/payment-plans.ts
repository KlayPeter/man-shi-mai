import { BadRequestException } from '@nestjs/common';

export type BenefitField =
  | 'maiCoinBalance'
  | 'resumeRemainingCount'
  | 'specialRemainingCount'
  | 'behaviorRemainingCount';
export interface PaymentPlan {
  id: string;
  name: string;
  price: number;
  benefits: Partial<Record<BenefitField, number>>;
}

// 版本 1 的已售规则必须保留。将来改价/权益需新增版本并按订单 metadata.version 分派。
export const PAYMENT_PLANS: readonly PaymentPlan[] = [
  {
    id: 'single',
    name: '单次练习',
    price: 18.8,
    benefits: { specialRemainingCount: 1 },
  },
  {
    id: 'pro',
    name: '综合练习',
    price: 28.8,
    benefits: {
      resumeRemainingCount: 1,
      specialRemainingCount: 1,
      behaviorRemainingCount: 1,
    },
  },
  {
    id: 'max',
    name: '强化练习',
    price: 68.8,
    benefits: {
      resumeRemainingCount: 3,
      specialRemainingCount: 3,
      behaviorRemainingCount: 3,
    },
  },
  {
    id: 'ultra',
    name: '持续练习',
    price: 128.8,
    benefits: {
      resumeRemainingCount: 6,
      specialRemainingCount: 16,
      behaviorRemainingCount: 8,
    },
  },
];

export function resolvePaymentPlan(id: string, amount: number): PaymentPlan {
  if (
    id === 'custom' &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= 10000
  ) {
    return {
      id,
      name: '小麦币',
      price: amount,
      benefits: { maiCoinBalance: amount },
    };
  }
  const plan = PAYMENT_PLANS.find((item) => item.id === id);
  if (!plan || !Number.isFinite(amount) || amount !== plan.price)
    throw new BadRequestException('套餐或金额无效');
  return plan;
}
