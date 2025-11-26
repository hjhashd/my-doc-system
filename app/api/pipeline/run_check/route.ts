// app/api/pipeline/run_check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import http from '@/lib/http' // 假设你有一个封装好的 http 请求工具，或者直接用 fetch

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentUserId, taskId, fileName } = body

    if (!agentUserId || !taskId || !fileName) {
      return NextResponse.json({ ok: false, message: '缺少必要参数' }, { status: 400 })
    }

    // 配置 Python 服务的地址
    // 在 Docker 容器中，使用宿主机的实际 IP 地址来访问主机上的服务
    const pythonServiceUrl = process.env.PYTHON_PIPELINE_SERVICE_URL || 'http://192.168.3.10:8005' // 使用宿主机 IP 地址

    // 构造传递给 Python 的参数
    // 注意：这里的 input_file_path 需要是 Python 容器/服务能访问到的绝对路径
    // Docker 挂载映射关系是 /home/cqj/my-doc-system-uploads/save -> /app/public/save
    // Python 脚本里拼接逻辑是: input_file_path + taskId + fileName (看代码似乎漏了 agentUserId)
    // 我们这里传入包含 agentUserId 的路径作为 input_file_path 的基础
    // Python 服务运行在主机上，所以我们需要使用主机路径
    const baseUploadPath = '/home/cqj/my-doc-system-uploads/save' 
    
    // 根据 pipeline_api.py 的逻辑，我们需要传入 input_file_path
    // 它的拼接逻辑是 os.path.join(req_data.input_file_path, str(req_data.task_id), req_data.file_name)
    // 所以我们要把 agentUserId 拼在 input_file_path 里
    const pythonInputPath = `${baseUploadPath}/${agentUserId}`

    const payload = {
      file_name: fileName, // 例如 "测试文档.docx"
      task_id: taskId,
      agentUserId: parseInt(agentUserId),
      input_file_path: pythonInputPath, 
      output_file_path: baseUploadPath // 输出目录通常和输入在同一大目录下
    }

    console.log('正在请求 Python Pipeline (智能检查):', payload)

    // 调用 Python 接口 - 使用 run_check 接口
    const res = await fetch(`${pythonServiceUrl}/pipeline/run_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Python 服务请求失败')
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Pipeline Run Check Error:', error)
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}