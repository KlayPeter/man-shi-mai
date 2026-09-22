import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import { z } from 'zod';

const credentialsSchema = z.object({
  AccessKeyId: z.string().min(1),
  AccessKeySecret: z.string().min(1),
  SecurityToken: z.string().min(1),
  Expiration: z
    .string()
    .refine((value) => Date.parse(value) > Date.now() + 60_000),
});

@Injectable()
export class StsService {
  private readonly logger = new Logger(StsService.name);
  constructor(private readonly configService: ConfigService) {}

  private location() {
    const bucket = this.configService.get<string>('OSS_BUCKET') || '';
    const region = this.configService.get<string>('OSS_REGION') || '';
    if (
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
      !/^oss-[a-z0-9-]+$/.test(region)
    ) {
      throw new ServiceUnavailableException(
        '文件存储尚未配置，请先使用文本简历',
      );
    }
    return { bucket, region, hostname: `${bucket}.${region}.aliyuncs.com` };
  }

  private validateUserId(userId: string) {
    if (!/^[a-f0-9]{24}$/i.test(userId))
      throw new BadRequestException('无效的用户身份');
  }

  /** 只接受配置 Bucket 内、当前用户目录中的对象，不信任客户端给出的签名或跳转。 */
  assertOwnedResumeUrl(rawUrl: string, userId: string): string {
    this.validateUserId(userId);
    const { hostname } = this.location();
    try {
      const url = new URL(rawUrl);
      const key = decodeURIComponent(url.pathname.slice(1));
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.hostname !== hostname ||
        url.port ||
        url.username ||
        url.password ||
        !key.startsWith(`user-resumes/${userId}/`) ||
        key.includes('\\') ||
        key.split('/').some((part) => part === '..' || part === '.') ||
        /[\u0000-\u001f\u007f]/.test(key)
      ) {
        throw new Error('Invalid object');
      }
      return key;
    } catch {
      throw new BadRequestException('只能使用本人上传到平台的简历文件');
    }
  }

  async getStsToken(userId: string) {
    this.validateUserId(userId);
    const { bucket, region } = this.location();
    const accessKeyId = this.configService.get<string>('OSS_ACCESS_KEY_ID');
    const accessKeySecret = this.configService.get<string>(
      'OSS_ACCESS_KEY_SECRET',
    );
    const roleArn = this.configService.get<string>('OSS_STS_ROLE_ARN');
    if (!accessKeyId || !accessKeySecret || !roleArn) {
      throw new ServiceUnavailableException(
        '上传服务尚未配置，请先使用文本简历',
      );
    }
    const prefixes = [`user-resumes/${userId}/`, `user-img/${userId}/`];
    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['oss:PutObject', 'oss:GetObject'],
          Resource: prefixes.map(
            (prefix) => `acs:oss:*:*:${bucket}/${prefix}*`,
          ),
        },
      ],
    };
    try {
      const sts = new OSS.STS({ accessKeyId, accessKeySecret });
      const result = await sts.assumeRole(
        roleArn,
        policy,
        900,
        `msm-${userId}`,
        { timeout: 10_000, ctx: undefined },
      );
      const credentials = credentialsSchema.parse(result.credentials);
      if (
        credentials.AccessKeyId === accessKeyId ||
        credentials.AccessKeySecret === accessKeySecret
      )
        throw new Error('Expected temporary credentials');
      return {
        accessKeyId: credentials.AccessKeyId,
        accessKeySecret: credentials.AccessKeySecret,
        securityToken: credentials.SecurityToken,
        expiration: credentials.Expiration,
        bucket,
        region,
      };
    } catch {
      // SDK 异常可能包含签名参数，不能原样记录或返回。
      this.logger.error('STS 临时授权失败，请检查 RAM 角色与服务配置');
      throw new ServiceUnavailableException('暂时无法获取上传授权，请稍后重试');
    }
  }

  async getResumeReadUrl(rawUrl: string, userId: string): Promise<string> {
    const key = this.assertOwnedResumeUrl(rawUrl, userId);
    const credentials = await this.getStsToken(userId);
    const client = new OSS({
      region: credentials.region,
      bucket: credentials.bucket,
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      stsToken: credentials.securityToken,
      secure: true,
    });
    // OSS 将到期时间取整到秒；59 秒保证实际有效期不会超过 60 秒。
    return client.signatureUrl(key, { expires: 59 });
  }
}
