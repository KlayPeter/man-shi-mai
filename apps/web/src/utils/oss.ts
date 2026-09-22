'use client'

import OSS from 'ali-oss'

interface TemporaryCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  bucket: string
  region: string
}

async function getCredentials(token: string): Promise<TemporaryCredentials> {
  const res = await fetch('/dev-api/sts/getStsToken', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('暂时无法获取上传授权，请稍后重试或使用文本简历')
  const result: unknown = await res.json()
  if (!result || typeof result !== 'object' || !('code' in result) || result.code !== 200 || !('data' in result)) {
    throw new Error('上传授权响应无效')
  }
  const data = result.data
  if (!data || typeof data !== 'object') throw new Error('上传授权响应无效')
  const read = (key: keyof TemporaryCredentials) => {
    const value = key in data ? (data as Record<string, unknown>)[key] : undefined
    if (typeof value !== 'string' || !value) throw new Error('上传服务未返回有效的临时授权')
    return value
  }
  const credentials = {
    accessKeyId: read('accessKeyId'), accessKeySecret: read('accessKeySecret'), securityToken: read('securityToken'),
    expiration: read('expiration'), bucket: read('bucket'), region: read('region'),
  }
  if (!(Date.parse(credentials.expiration) > Date.now() + 30_000)) throw new Error('上传授权已过期，请重试')
  return credentials
}

export async function getOSSClient(token: string): Promise<OSS> {
  const credentials = await getCredentials(token)
  return new OSS({
    region: credentials.region,
    bucket: credentials.bucket,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    stsToken: credentials.securityToken,
    secure: true,
    refreshSTSToken: async () => {
      const refreshed = await getCredentials(token)
      return { accessKeyId: refreshed.accessKeyId, accessKeySecret: refreshed.accessKeySecret, stsToken: refreshed.securityToken }
    },
    refreshSTSTokenInterval: 10 * 60 * 1000,
  })
}
