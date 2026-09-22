// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/sse-proxy/route'
import { GET, POST as jsonPost } from '@/app/dev-api/[...path]/route'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('runtime backend proxy', () => {
  it.each([
    [undefined, 'http://localhost:3000'],
    ['http://backend.internal:4500/', 'http://backend.internal:4500'],
  ])('routes HTTP and SSE to the same runtime backend %s', async (configured, expected) => {
    vi.stubEnv('BACKEND_API_URL', configured)
    const event = 'data: {"content":"下一题"}\n\ndata: [DONE]\n\n'
    const fetchMock = vi.fn().mockImplementation(async () => new Response(event, { headers: { 'Content-Type': 'text/event-stream' } }))
    vi.stubGlobal('fetch', fetchMock)

    await GET(new Request('http://localhost:8000/dev-api/user/info?page=2'))
    expect(fetchMock.mock.calls[0][0]).toBe(`${expected}/user/info?page=2`)
    const request = new Request('http://localhost:8000/api/sse-proxy?path=%2Finterview%2Fmock%2Fanswer', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: '{"answer":"示例回答"}',
    })
    const response = await POST(request)
    const [target, options] = fetchMock.mock.calls[1]
    expect(target).toBe(`${expected}/interview/mock/answer`)
    expect(options.headers.get('authorization')).toBe('Bearer test-token')
    expect(options.headers.get('accept')).toBe('text/event-stream')
    expect(options.signal).toBe(request.signal)
    expect(new TextDecoder().decode(options.body)).toBe('{"answer":"示例回答"}')
    expect(options.redirect).toBe('manual')
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(await response.text()).toBe(event)
  })

  it('preserves an upstream JSON rejection instead of labeling it SSE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Unauthorized' }, { status: 401 })))
    const response = await POST(new Request('http://localhost/api/sse-proxy?path=%2Finterview%2Fmock%2Fanswer', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ message: 'Unauthorized' })
  })

  it('does not forward arbitrary stream destinations or credentials to them', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await POST(new Request('http://localhost/api/sse-proxy?path=//evil.test', { method: 'POST' }))
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves JSON bodies and does not forward browser cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await jsonPost(new Request('http://localhost/dev-api/user/update', { method: 'POST', body: '{"username":"新名字"}', headers: { Cookie: 'private=1' } }))
    const options = fetchMock.mock.calls[0][1]
    expect(new TextDecoder().decode(options.body)).toBe('{"username":"新名字"}')
    expect(options.headers.has('cookie')).toBe(false)
  })

  it('returns a recoverable gateway error without exposing backend details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private backend detail')))
    const response = await GET(new Request('http://localhost/dev-api/user/info'))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private backend detail')
  })
})
