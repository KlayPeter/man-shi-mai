import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongoSchema } from 'mongoose';

export const QUOTA_FIELDS = [
  'maiCoinBalance',
  'resumeRemainingCount',
  'specialRemainingCount',
  'behaviorRemainingCount',
] as const;
export type QuotaField = (typeof QUOTA_FIELDS)[number];
export type QuotaChanges = Partial<Record<QuotaField, number>>;

@Schema({ timestamps: true })
export class QuotaOperation {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  kind: string;

  @Prop({ required: true })
  requestId: string;

  @Prop({ type: MongoSchema.Types.Mixed, required: true })
  changes: QuotaChanges;

  @Prop({ required: true })
  payloadHash: string;

  @Prop({ enum: ['pending', 'applied'], default: 'pending' })
  status: 'pending' | 'applied';

  @Prop({ default: false })
  cancelRequested: boolean;

  @Prop()
  appliedAt?: Date;
}
export type QuotaOperationDocument = HydratedDocument<QuotaOperation>;
export const QuotaOperationSchema =
  SchemaFactory.createForClass(QuotaOperation);
QuotaOperationSchema.index({ userId: 1, createdAt: -1 });
