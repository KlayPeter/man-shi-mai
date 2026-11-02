import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ResumeService } from '../../src/resume/resume.service';
import { DocumentParserService } from '../../src/interview/services/document-parser.service';
import { StsService } from '../../src/sts/sts.service';

const userId = '507f1f77bcf86cd799439011';
describe('local resume uploads', () => {
  let directory: string;
  let service: ResumeService;
  let config: ConfigService;
  const save = jest.fn();
  const findOneAndDelete = jest.fn();
  class ResumeModel {
    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }
    save() {
      return save(this);
    }
    static findOneAndDelete = findOneAndDelete;
    static findOne = jest.fn();
  }
  beforeEach(async () => {
    jest.resetAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'msm-resume-unit-'));
    save.mockImplementation((document: unknown) => Promise.resolve(document));
    config = new ConfigService({ RESUME_LOCAL_DIR: directory });
    const storage = new StsService(new ConfigService({}));
    const module = await Test.createTestingModule({
      providers: [
        ResumeService,
        {
          provide: ConfigService,
          useValue: config,
        },
        { provide: StsService, useValue: storage },
        {
          provide: DocumentParserService,
          useValue: new DocumentParserService(storage),
        },
        { provide: getModelToken('Resume'), useValue: ResumeModel },
      ],
    }).compile();
    service = module.get(ResumeService);
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));
  const fixture = (extension: string) =>
    readFile(
      join(__dirname, '..', 'interview', 'fixtures', `resume.${extension}`),
    );

  it.each(['pdf', 'docx'])(
    'parses %s before saving private files and a usable snapshot',
    async (extension) => {
      const buffer = await fixture(extension);
      const name = extension === 'pdf' ? '合成#秋招?.PDF' : 'resume.docx';
      const saved = await service.uploadLocalResume(userId, {
        originalname: `../../${name}`,
        buffer,
      });
      expect(saved.plainTextSnapshot).toContain('1.8 seconds to 0.9 seconds');
      expect(saved).toMatchObject({
        sourceType: 'upload',
        status: 'ready',
        resumeName: name,
      });
      expect(saved.url).toBeUndefined();
      const path = join(directory, saved.localFileKey!);
      expect(await readFile(path)).toEqual(buffer);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      findOneAndDelete.mockResolvedValue(saved);
      await service.deleteResume(userId, 'saved');
      expect(await readdir(join(directory, userId))).toEqual([]);
    },
  );
  it('reads the local original and gives an actionable error after its removal', async () => {
    const buffer = await fixture('pdf');
    const saved = await service.uploadLocalResume(userId, {
      originalname: '中文简历.pdf',
      buffer,
    });
    ResumeModel.findOne.mockReturnValue({ lean: async () => saved });
    expect((await service.getOriginalFile(userId, userId)).buffer).toEqual(
      buffer,
    );
    await rm(join(directory, saved.localFileKey!));
    await expect(service.getOriginalFile(userId, userId)).rejects.toThrow(
      '原文件已不存在',
    );
  });
  it('cleans up a newly written file if database saving fails', async () => {
    save.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.uploadLocalResume(userId, {
        originalname: 'resume.pdf',
        buffer: await fixture('pdf'),
      }),
    ).rejects.toThrow('database unavailable');
    expect(await readdir(join(directory, userId))).toEqual([]);
  });
  it('returns a recoverable storage error without persisting a broken record', async () => {
    const invalidDirectory = join(directory, 'not-a-directory');
    await writeFile(invalidDirectory, 'occupied');
    config.set('RESUME_LOCAL_DIR', invalidDirectory);
    await expect(
      service.uploadLocalResume(userId, {
        originalname: 'resume.pdf',
        buffer: await fixture('pdf'),
      }),
    ).rejects.toThrow('暂时无法保存');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects missing, excessive, mismatched and invalid owner input before saving', async () => {
    await expect(service.uploadLocalResume(userId)).rejects.toThrow('请选择');
    await expect(
      service.uploadLocalResume(userId, {
        originalname: 'resume.pdf',
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow('5MB');
    await expect(
      service.uploadLocalResume(userId, {
        originalname: 'resume.pdf',
        buffer: Buffer.from('not a PDF'),
      }),
    ).rejects.toThrow('格式不符');
    await expect(
      service.uploadLocalResume('../another-user', {
        originalname: 'resume.pdf',
        buffer: await fixture('pdf'),
      }),
    ).rejects.toThrow('无效');
    expect(save).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
  });
});
