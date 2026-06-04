import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ResumeDocument = Resume & Document;

@Schema({ timestamps: true })
export class Resume {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  resumeName: string;

  @Prop({ required: false })
  url?: string;

  @Prop()
  uploadTime: Date;

  @Prop({ enum: ['upload', 'editor', 'hybrid'], default: 'upload' })
  sourceType: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  editorData: any;

  @Prop({ default: '' })
  plainTextSnapshot: string;

  @Prop({ default: 'default' })
  templateId: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  themeSettings: any;

  @Prop()
  originalFileName?: string;

  @Prop()
  lastImportedAt?: Date;

  @Prop()
  lastPolishedAt?: Date;

  @Prop({ enum: ['draft', 'ready', 'archived'], default: 'draft' })
  status: string;
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
