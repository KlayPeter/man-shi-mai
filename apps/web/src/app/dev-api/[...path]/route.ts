import { forwardBackendRequest } from '@/lib/backend-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function proxy(request: Request) {
  const url = new URL(request.url)
  return forwardBackendRequest(request, `${url.pathname.slice('/dev-api'.length)}${url.search}`)
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD }
