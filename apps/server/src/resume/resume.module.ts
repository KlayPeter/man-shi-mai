import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { Resume, ResumeSchema } from './schemas/resume.schema';
import { StsModule } from '../sts/sts.module';
import { ConfigModule } from '@nestjs/config';
import { DocumentParserModule } from '../interview/document-parser.module';

@Module({
  imports: [
    StsModule,
    ConfigModule,
    DocumentParserModule,
    MongooseModule.forFeature([{ name: Resume.name, schema: ResumeSchema }]),
  ],
  controllers: [ResumeController],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
