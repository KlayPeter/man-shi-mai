// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { POST } from '@/app/api/sse-proxy/route'

const require = createRequire(import.meta.url)
const nextConfig = require('../../next.config.js')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('backend proxy configuration', () => {
  it.each([
    [undefined, 'http://localhost:3000'],
    ['http://backend.internal:4500', 'http://backend.internal:4500'],
  ])('routes HTTP and SSE to the same backend when configured as %s', async (configured, expected) => {
    vi.stubEnv('BACKEND_API_URL', configured)
    const body = JSON.stringify({ answer: '示例回答' })
    const event = 'data: {"content":"下一题"}\n\ndata: [DONE]\n\n'
    const fetchMock = vi.fn().mockResolvedValue(new Response(event))
    vi.stubGlobal('fetch', fetchMock)

    const rewrites = await nextConfig.rewrites()
    expect(rewrites).toContainEqual({
      source: '/dev-api/:path*',
      destination: `${expected}/:path*`,
    })

    const response = await POST(new Request(
      'http://localhost:8000/api/sse-proxy?path=%2Finterview%2Fmock%2Fanswer',
      { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body },
    ))

    expect(fetchMock).toHaveBeenCalledWith(`${expected}/interview/mock/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: 'Bearer test-token',
      },
      body,
    })
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(await response.text()).toBe(event)
  })

  it('preserves an upstream rejection status and body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })))
    const response = await POST(new Request(
      'http://localhost:8000/api/sse-proxy?path=%2Finterview%2Fmock%2Fanswer',
      { method: 'POST', body: '{}' },
    ))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized')
  })
})
