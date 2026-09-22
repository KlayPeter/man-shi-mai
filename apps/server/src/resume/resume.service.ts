import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { StsService } from '../sts/sts.service';
import {
  UploadResumeDto,
  UpdateResumeNameDto,
  CreateEmptyResumeDto,
  UpdateResumeContentDto,
} from './dto/resume.dto';
@Injectable()
export class ResumeService {
  constructor(
    @InjectModel(Resume.name)
    private resumeModel: Model<ResumeDocument>,
    private readonly storage: StsService,
  ) {}

  async getInterviewResumeList(userId: string) {
    return await this.resumeModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async uploadResume(userId: string, dto: UploadResumeDto) {
    const key = this.storage.assertOwnedResumeUrl(dto.url, userId);
    const url = new URL(dto.url);
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    if (!/\.(pdf|docx)$/i.test(key)) {
      throw new BadRequestException('仅支持 PDF 或 DOCX 简历');
    }
    const resume = new this.resumeModel({
      userId,
      resumeName: dto.resumeName,
      url: url.href,
      uploadTime: new Date(dto.uploadTime),
    });
    return await resume.save();
  }

  async deleteResume(userId: string, resumeId: string) {
    const result = await this.resumeModel.findOneAndDelete({
      _id: resumeId,
      userId,
    });
    if (!result) {
      throw new NotFoundException('简历不存在');
    }
    return result;
  }

  async updateResumeName(userId: string, resumeId: string, resumeName: string) {
    const resume = await this.resumeModel.findOneAndUpdate(
      { _id: resumeId, userId },
      { resumeName },
      { new: true },
    );
    if (!resume) {
      throw new NotFoundException('简历不存在');
    }
    return resume;
  }

  async getResumeDetail(userId: string, resumeId: string) {
    const resume = await this.resumeModel
      .findOne({ _id: resumeId, userId })
      .lean();
    if (!resume) {
      throw new NotFoundException('简历不存在');
    }
    return resume;
  }

  async createEmptyResume(userId: string, dto: CreateEmptyResumeDto) {
    const resume = new this.resumeModel({
      userId,
      resumeName: dto.resumeName,
      sourceType: 'editor',
      editorData: {},
      plainTextSnapshot: '',
      status: 'draft',
      uploadTime: new Date(),
    });
    return await resume.save();
  }

  async updateResumeContent(
    userId: string,
    resumeId: string,
    dto: UpdateResumeContentDto,
  ) {
    const resume = await this.resumeModel.findOneAndUpdate(
      { _id: resumeId, userId },
      {
        editorData: dto.editorData,
        plainTextSnapshot: dto.plainTextSnapshot,
        status: 'ready',
      },
      { new: true },
    );
    if (!resume) {
      throw new NotFoundException('简历不存在');
    }
    return resume;
  }
}
