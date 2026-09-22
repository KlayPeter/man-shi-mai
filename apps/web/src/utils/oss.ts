'use client'

import OSS from 'ali-oss'

export async function getOSSClient(token: string): Promise<OSS> {
  const res = await fetch('/dev-api/sts/getStsToken', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('获取 OSS 凭证失败')
  const result = await res.json()
  const { accessKeyId, accessKeySecret, securityToken } = result.data || result
  const config: any = {
    region: 'oss-cn-beijing',
    accessKeyId,
    accessKeySecret,
    bucket: 'asset-mai',
  }
  if (securityToken) config.stsToken = securityToken
  return new OSS(config)
}
