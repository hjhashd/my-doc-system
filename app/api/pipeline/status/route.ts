// app/api/pipeline/status/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const queryId = searchParams.get('query_id') // Python 返回的 unique_key

    if (!queryId) {
      return NextResponse.json({ ok: false, message: '缺少 query_id' }, { status: 400 })
    }

    // 在 Docker 容器中，使用宿主机的实际 IP 地址来访问主机上的服务
  const pythonServiceUrl = process.env.PYTHON_PIPELINE_SERVICE_URL || 'http://192.168.3.10:8005' // 使用宿主机 IP 地址

    const res = await fetch(`${pythonServiceUrl}/pipeline/status?query_id=${queryId}`, {
      method: 'GET',
    })

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}