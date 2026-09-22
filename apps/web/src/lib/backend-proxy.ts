/** 服务端代理：普通请求与 SSE 在请求时读取同一个后端地址。 */
export async function forwardBackendRequest(request: Request, path: string, streaming = false) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return Response.json({ code: 400, message: '无效的接口路径' }, { status: 400 })
  }

  const headers = new Headers()
  for (const name of ['authorization', 'content-type', 'accept']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (streaming) headers.set('accept', 'text/event-stream')

  try {
    const base = new URL(process.env.BACKEND_API_URL || 'http://localhost:3000')
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
      throw new Error('Invalid backend configuration')
    }
    const target = new URL(`${base.href.replace(/\/$/, '')}${path}`)
    if (target.origin !== base.origin) throw new Error('Invalid backend origin')
    const response = await fetch(target.href, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: request.signal,
      cache: 'no-store',
      redirect: 'manual',
    })
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' })
    const contentType = response.headers.get('content-type')
    if (contentType) responseHeaders.set('Content-Type', contentType)
    if (streaming) responseHeaders.set('X-Accel-Buffering', 'no')
    return new Response(response.body, { status: response.status, headers: responseHeaders })
  } catch {
    return Response.json(
      { code: request.signal.aborted ? 499 : 502, message: request.signal.aborted ? '请求已取消' : '暂时无法连接服务，请稍后重试' },
      { status: request.signal.aborted ? 499 : 502 },
    )
  }
}
