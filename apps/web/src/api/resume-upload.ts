import request from '@/lib/request'
import { getOSSClient } from '@/utils/oss'

export async function uploadResumeFile(file: File, token: string, userId: string): Promise<{ _id: string }> {
  const config = await request.get<unknown, unknown>('/resume/upload-config')
  if (!config || typeof config !== 'object' || !('provider' in config)) throw new Error('上传配置无效，请稍后重试')
  let result: unknown
  if (config.provider === 'local') {
    const form = new FormData()
    form.append('file', file)
    result = await request.post('/resume/upload-file', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
  } else if (config.provider === 'oss') {
    if (!userId) throw new Error('登录信息缺失，请重新登录')
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'docx'].includes(extension)) throw new Error('仅支持 PDF 或 DOCX 简历')
    const client = await getOSSClient(token)
    const uploaded = await client.put(`user-resumes/${userId}/${crypto.randomUUID()}.${extension}`, file)
    result = await request.post('/resume/uploadResume', { url: uploaded.url, resumeName: file.name, uploadTime: new Date().toISOString() })
  } else throw new Error('上传配置无效，请稍后重试')
  if (!result || typeof result !== 'object' || !('_id' in result) || typeof result._id !== 'string' || !result._id) throw new Error('上传结果缺少简历编号，请刷新列表确认')
  return { _id: result._id }
}
