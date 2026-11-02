import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/request', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/utils/oss', () => ({ getOSSClient: vi.fn() }))
import request from '@/lib/request'
import { getOSSClient } from '@/utils/oss'
import { uploadResumeFile } from '@/api/resume-upload'
const file = new File(['synthetic'], 'resume.pdf', { type: 'application/pdf' })
beforeEach(() => vi.resetAllMocks())
describe('resume upload routing', () => {
  it('registers an OSS upload with enough time for signed download and parsing, and surfaces parse failures', async () => {
    vi.mocked(request.get).mockResolvedValue({ provider: 'oss' })
    const put = vi.fn().mockResolvedValue({ url: 'https://storage.example.test/resume.pdf' })
    vi.mocked(getOSSClient).mockResolvedValue({ put } as Awaited<ReturnType<typeof getOSSClient>>)
    vi.mocked(request.post).mockResolvedValue({ _id: 'saved' })
    expect(await uploadResumeFile(file, 'synthetic-token', 'owner')).toEqual({ _id: 'saved' })
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^user-resumes\/owner\/.+\.pdf$/), file)
    expect(request.post).toHaveBeenCalledWith('/resume/uploadResume', expect.objectContaining({ url: 'https://storage.example.test/resume.pdf' }), { timeout: 60000 })
    vi.mocked(request.post).mockRejectedValue(new Error('文件解析失败'))
    await expect(uploadResumeFile(file, 'synthetic-token', 'owner')).rejects.toThrow('文件解析失败')
  })
  it('sends multipart content through the proxy without requesting OSS credentials in local mode', async () => {
    vi.mocked(request.get).mockResolvedValue({ provider: 'local' })
    vi.mocked(request.post).mockResolvedValue({ _id: 'saved' })
    expect(await uploadResumeFile(file, 'synthetic-token', 'owner')).toEqual({ _id: 'saved' })
    const [path, body, options] = vi.mocked(request.post).mock.calls[0]
    expect(path).toBe('/resume/upload-file')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
    expect(options?.headers?.['Content-Type']).toBe('multipart/form-data')
    expect(getOSSClient).not.toHaveBeenCalled()
  })
  it('keeps failures visible instead of claiming success', async () => {
    vi.mocked(request.get).mockResolvedValue({ provider: 'local' })
    vi.mocked(request.post).mockRejectedValue(new Error('文件损坏'))
    await expect(uploadResumeFile(file, '', '')).rejects.toThrow('文件损坏')
    vi.mocked(request.post).mockResolvedValue({})
    await expect(uploadResumeFile(file, '', '')).rejects.toThrow('简历编号')
  })
  it('rejects unknown storage configurations', async () => {
    vi.mocked(request.get).mockResolvedValue({ provider: 'unknown' })
    await expect(uploadResumeFile(file, '', '')).rejects.toThrow('配置无效')
    expect(request.post).not.toHaveBeenCalled()
  })
})
