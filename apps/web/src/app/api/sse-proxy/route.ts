import { forwardBackendRequest } from '@/lib/backend-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedPaths = new Set([
  '/interview/resume/quiz/stream',
  '/interview/mock/start',
  '/interview/mock/answer',
])

export async function POST(request: Request) {
  const path = new URL(request.url).searchParams.get('path') || ''
  if (!allowedPaths.has(path)) {
    return Response.json({ code: 400, message: '不支持的流式接口' }, { status: 400 })
  }
  return forwardBackendRequest(request, path, true)
}
