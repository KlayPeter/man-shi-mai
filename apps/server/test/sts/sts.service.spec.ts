import OSS from 'ali-oss';
import { ConfigService } from '@nestjs/config';
import { StsService } from '../../src/sts/sts.service';

const userId = '507f1f77bcf86cd799439011';
const config = {
  OSS_BUCKET: 'test-bucket',
  OSS_REGION: 'oss-cn-beijing',
  OSS_ACCESS_KEY_ID: 'master-id',
  OSS_ACCESS_KEY_SECRET: 'master-secret',
  OSS_STS_ROLE_ARN: 'acs:ram::1234567890123456:role/upload',
};
const credentials = () => ({
  AccessKeyId: 'temporary-id',
  AccessKeySecret: 'temporary-secret',
  SecurityToken: 'session-token',
  Expiration: new Date(Date.now() + 900_000).toISOString(),
});

describe('temporary file access', () => {
  afterEach(() => jest.restoreAllMocks());
  const service = () => new StsService(new ConfigService(config));

  it('requests a 15 minute role session restricted to the current user directories', async () => {
    const assume = jest
      .spyOn(OSS.STS.prototype, 'assumeRole')
      .mockResolvedValue({ credentials: credentials() });
    const result = await service().getStsToken(userId);
    const [, policy, duration] = assume.mock.calls[0];
    expect(duration).toBe(900);
    expect(policy).toEqual({
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['oss:PutObject', 'oss:GetObject'],
          Resource: [
            `acs:oss:*:*:test-bucket/user-resumes/${userId}/*`,
            `acs:oss:*:*:test-bucket/user-img/${userId}/*`,
          ],
        },
      ],
    });
    expect(result.securityToken).toBe('session-token');
    expect(JSON.stringify(result)).not.toContain('master-');
    expect(result.bucket).toBe('test-bucket');
  });

  it('fails closed when the role is not configured', async () => {
    const assume = jest.spyOn(OSS.STS.prototype, 'assumeRole');
    await expect(
      new StsService(
        new ConfigService({ ...config, OSS_STS_ROLE_ARN: '' }),
      ).getStsToken(userId),
    ).rejects.toThrow('尚未配置');
    expect(assume).not.toHaveBeenCalled();
  });

  it.each([
    { SecurityToken: '' },
    { AccessKeyId: 'master-id' },
    { AccessKeySecret: 'master-secret' },
    { Expiration: '2000-01-01T00:00:00Z' },
  ])('never returns invalid or permanent credentials %j', async (override) => {
    jest
      .spyOn(OSS.STS.prototype, 'assumeRole')
      .mockResolvedValue({ credentials: { ...credentials(), ...override } });
    await expect(service().getStsToken(userId)).rejects.toThrow(
      '暂时无法获取上传授权',
    );
  });

  it.each([
    'http://127.0.0.1/private.pdf',
    'http://169.254.169.254/metadata.pdf',
    `https://test-bucket.oss-cn-beijing.aliyuncs.com.evil.test/user-resumes/${userId}/a.pdf`,
    'https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/another-user/a.pdf',
    `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/%2e%2e/other/a.pdf`,
    `https://name:password@test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/a.pdf`,
  ])(
    'rejects untrusted or cross-user source before any STS/network request: %s',
    async (url) => {
      const assume = jest.spyOn(OSS.STS.prototype, 'assumeRole');
      await expect(service().getResumeReadUrl(url, userId)).rejects.toThrow(
        '只能使用本人',
      );
      expect(assume).not.toHaveBeenCalled();
    },
  );

  it('creates a short-lived HTTPS read signature for private resumes', async () => {
    jest
      .spyOn(OSS.STS.prototype, 'assumeRole')
      .mockResolvedValue({ credentials: credentials() });
    const url = new URL(
      await service().getResumeReadUrl(
        `http://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/a.pdf?untrusted=1`,
        userId,
      ),
    );
    expect(url.protocol).toBe('https:');
    expect(url.searchParams.has('untrusted')).toBe(false);
    expect(url.searchParams.get('security-token')).toBe('session-token');
    expect(url.searchParams.get('OSSAccessKeyId')).toBe('temporary-id');
    expect(
      Number(url.searchParams.get('Expires')) - Date.now() / 1000,
    ).toBeLessThanOrEqual(60);
  });
});
