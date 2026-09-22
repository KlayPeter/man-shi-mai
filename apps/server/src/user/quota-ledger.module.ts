import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import {
  QuotaOperation,
  QuotaOperationSchema,
} from './schemas/quota-operation.schema';
import { QuotaLedgerService } from './quota-ledger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: QuotaOperation.name, schema: QuotaOperationSchema },
    ]),
  ],
  providers: [QuotaLedgerService],
  exports: [QuotaLedgerService],
})
export class QuotaLedgerModule {}
