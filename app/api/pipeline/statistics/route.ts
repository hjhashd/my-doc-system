// app/api/pipeline/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentUserId, taskId, fileName } = body

    if (!agentUserId || !taskId || !fileName) {
      return NextResponse.json({ ok: false, message: '缺少必要参数' }, { status: 400 })
    }

    // 配置 Python 服务的地址 (注意：这里用的是 8005 端口的服务，不是数据库那个 8006)
    const pythonServiceUrl = process.env.PYTHON_PIPELINE_SERVICE_URL || 'http://192.168.3.10:8005'
    
    // 构造 Docker 映射路径 (和之前保持一致)
    const baseUploadPath = '/home/cqj/my-doc-system-uploads/save'
    const pythonInputPath = `${baseUploadPath}/${agentUserId}`

    const payload = {
      file_name: fileName,
      task_id: taskId,
      agentUserId: parseInt(agentUserId),
      input_file_path: pythonInputPath, 
      output_file_path: baseUploadPath
    }

    console.log('[Statistics] 请求获取统计信息:', payload)

    // 调用 Python 的 /pipeline/statistics 接口
    const res = await fetch(`${pythonServiceUrl}/pipeline/statistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || '获取统计信息失败')
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[Statistics] API Error:', error)
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}