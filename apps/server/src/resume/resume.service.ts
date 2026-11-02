import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { DocumentParserService } from '../interview/services/document-parser.service';
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
  private readonly logger = new Logger(ResumeService.name);
  constructor(
    @InjectModel(Resume.name)
    private resumeModel: Model<ResumeDocument>,
    private readonly storage: StsService,
    private readonly config: ConfigService,
    private readonly parser: DocumentParserService,
  ) {}

  uploadConfig() {
    return {
      provider: this.config.get<string>('RESUME_STORAGE_DRIVER') || 'local',
      maxFileSize: 5 * 1024 * 1024,
    };
  }

  private localPath(userId: string, key: string) {
    if (
      !/^[a-f0-9]{24}$/i.test(userId) ||
      !new RegExp(`^${userId}/[a-f0-9-]{36}\\.(pdf|docx)$`, 'i').test(key)
    ) {
      throw new BadRequestException('无效的本地简历文件');
    }
    return join(
      resolve(
        this.config.get<string>('RESUME_LOCAL_DIR') ||
          join(process.cwd(), 'data', 'resumes'),
      ),
      key,
    );
  }

  async uploadLocalResume(
    userId: string,
    file?: { originalname: string; buffer: Buffer },
  ) {
    if (this.uploadConfig().provider !== 'local')
      throw new BadRequestException('当前使用云端文件上传');
    if (!file || !Buffer.isBuffer(file.buffer))
      throw new BadRequestException('请选择简历文件');
    if (file.buffer.length > this.uploadConfig().maxFileSize)
      throw new BadRequestException('文件大小不能超过 5MB');
    let originalName = file.originalname;
    if (/^[\u0000-\u00ff]+$/.test(originalName)) {
      const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
      if (!decoded.includes('\ufffd')) originalName = decoded;
    }
    const name = basename(originalName.replace(/\\/g, '/'))
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
    const extension = extname(name).toLowerCase();
    if (!name || name.length > 200 || !['.pdf', '.docx'].includes(extension))
      throw new BadRequestException(
        '请上传名称不超过 200 字的 PDF 或 DOCX 简历',
      );
    const key = `${userId}/${randomUUID()}${extension}`;
    const path = this.localPath(userId, key);
    const text = this.parser.cleanText(
      await this.parser.parseDocument(file.buffer, key),
    );
    const validation = this.parser.validateResumeContent(text);
    if (!validation.isValid) throw new BadRequestException(validation.reason);
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    } catch (error: unknown) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'EEXIST')
      ) {
        await unlink(path).catch(() => undefined);
      }
      this.logger.error('本地简历文件写入失败，请检查存储目录和磁盘空间');
      throw new ServiceUnavailableException('简历文件暂时无法保存，请稍后重试');
    }
    try {
      return await new this.resumeModel({
        userId,
        resumeName: name,
        originalFileName: name,
        localFileKey: key,
        uploadTime: new Date(),
        sourceType: 'upload',
        plainTextSnapshot: text,
        status: 'ready',
      }).save();
    } catch (error: unknown) {
      await unlink(path).catch(() =>
        this.logger.error('简历保存失败，临时文件清理失败'),
      );
      throw error;
    }
  }

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
    // shortcut: 上传后登记失败会留下云端孤立文件，正式运营前补充定期回收。
    const text = this.parser.cleanText(
      await this.parser.parseDocumentFromUrl(
        url.href,
        userId,
        this.uploadConfig().maxFileSize,
      ),
    );
    const validation = this.parser.validateResumeContent(text);
    if (!validation.isValid) throw new BadRequestException(validation.reason);
    const resume = new this.resumeModel({
      userId,
      resumeName: dto.resumeName,
      originalFileName: dto.resumeName,
      url: url.href,
      uploadTime: new Date(dto.uploadTime),
      sourceType: 'upload',
      plainTextSnapshot: text,
      status: 'ready',
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
    if (result.localFileKey) {
      // shortcut: Mongo 与文件系统不共享事务，清理失败需人工处理告警；规模扩大时增加孤立文件回收。
      await unlink(this.localPath(userId, result.localFileKey)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT')
            this.logger.error('简历记录已删除，本地原文件清理失败');
        },
      );
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

  async getOriginalFile(userId: string, resumeId: string) {
    if (!/^[a-f0-9]{24}$/i.test(resumeId))
      throw new BadRequestException('无效的简历编号');
    const resume = await this.getResumeDetail(userId, resumeId);
    if (!resume.localFileKey && !resume.url)
      throw new BadRequestException('这份在线简历没有上传原文件');
    const key =
      resume.localFileKey ||
      this.storage.assertOwnedResumeUrl(resume.url!, userId);
    const extension = extname(key).toLowerCase();
    if (!['.pdf', '.docx'].includes(extension))
      throw new BadRequestException('仅支持 PDF 或 DOCX 简历');
    const limit = this.uploadConfig().maxFileSize;
    let buffer: Buffer;
    if (resume.localFileKey) {
      try {
        const path = this.localPath(userId, resume.localFileKey);
        if ((await stat(path)).size > limit)
          throw new BadRequestException('文件大小不能超过 5MB');
        buffer = await readFile(path);
      } catch (error: unknown) {
        if (error instanceof BadRequestException) throw error;
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          throw new NotFoundException('原文件已不存在，请重新上传');
        throw new ServiceUnavailableException('原文件暂时无法读取，请稍后重试');
      }
    } else {
      buffer = await this.parser.downloadDocumentFromUrl(
        resume.url!,
        userId,
        limit,
      );
    }
    if (!buffer.length || buffer.length > limit)
      throw new BadRequestException('原文件为空或超过 5MB');
    const name = basename(resume.originalFileName || resume.resumeName).replace(
      /[\r\n\0]/g,
      '',
    );
    return {
      buffer,
      fileName: extname(name) ? name : name + extension,
      contentType:
        extension === '.pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
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
