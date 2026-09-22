export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''
  const body = await request.text()

  const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:3000'}${path}`
  const token = request.headers.get('authorization')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  }
  if (token) headers['Authorization'] = token

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers,
    body
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
