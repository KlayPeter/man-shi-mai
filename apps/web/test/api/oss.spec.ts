// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOSSClient } from '@/utils/oss'

const { construct } = vi.hoisted(() => ({ construct: vi.fn() }))
vi.mock('ali-oss', () => ({ default: function (config: unknown) { construct(config) } }))
const data = () => ({ accessKeyId: 'temporary-id', accessKeySecret: 'temporary-secret', securityToken: 'temporary-token', expiration: new Date(Date.now() + 900_000).toISOString(), region: 'oss-cn-hangzhou', bucket: 'configured-bucket' })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('OSS temporary authorization', () => {
  it('uses server bucket/region, HTTPS, and mandatory STS token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ code: 200, data: data() })))
    await getOSSClient('user-token')
    const config = construct.mock.calls[0][0]
    expect(config).toMatchObject({ region: 'oss-cn-hangzhou', bucket: 'configured-bucket', stsToken: 'temporary-token', secure: true })
    expect(await config.refreshSTSToken()).toEqual({ accessKeyId: 'temporary-id', accessKeySecret: 'temporary-secret', stsToken: 'temporary-token' })
  })

  it.each([{ securityToken: '' }, { expiration: '2000-01-01' }, { accessKeySecret: null }])('does not fall back to permanent credentials for invalid response %j', async override => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 200, data: { ...data(), ...override } })))
    await expect(getOSSClient('user-token')).rejects.toThrow()
    expect(construct).not.toHaveBeenCalled()
  })

  it('does not instantiate a client after failed authorization', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 503 }, { status: 503 })))
    await expect(getOSSClient('user-token')).rejects.toThrow('暂时无法获取上传授权')
    expect(construct).not.toHaveBeenCalled()
  })
})
