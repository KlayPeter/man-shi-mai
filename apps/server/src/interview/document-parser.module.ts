import { Module } from '@nestjs/common';
import { StsModule } from '../sts/sts.module';
import { DocumentParserService } from './services/document-parser.service';

@Module({
  imports: [StsModule],
  providers: [DocumentParserService],
  exports: [DocumentParserService],
})
export class DocumentParserModule {}
