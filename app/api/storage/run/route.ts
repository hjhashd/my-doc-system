// app/api/storage/run/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentUserId, taskId, fileName } = body

    if (!agentUserId || !taskId || !fileName) {
      return NextResponse.json({ ok: false, message: '缺少必要参数' }, { status: 400 })
    }

    // 1. 配置 Python 数据库服务的地址 (指向你的 save_in_database_api.py)
    // 在 Docker 内部访问宿主机 IP
    const pythonDbServiceUrl = process.env.PYTHON_DB_SERVICE_URL || 'http://192.168.3.10:8006'
    
    // 2. 构建 Python 服务所需的文件绝对路径
    // 路径必须与 Python 服务所在环境一致
    const baseUploadPath = '/home/cqj/my-doc-system-uploads/save'
    
    // 直接使用传入的完整JSON文件名
    // 前端已经根据表格路径动态构建了正确的文件名
    const targetJsonName = fileName.endsWith('.json') ? fileName : `${fileName}.json`
    
    // 拼接完整绝对路径
    const jsonFilePath = `${baseUploadPath}/${agentUserId}/${taskId}/${targetJsonName}`

    console.log(`[Storage] 请求入库，目标文件: ${jsonFilePath}`)

    // 3. 转发请求给 Python 后端 (核心中介步骤)
    const response = await fetch(`${pythonDbServiceUrl}/import/table_cells`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json_file_path: jsonFilePath
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Storage] Python服务报错: ${response.status} ${errorText}`)
      return NextResponse.json({ 
        ok: false, 
        message: `数据库服务请求失败: ${response.status}` 
      }, { status: 500 })
    }

    const data = await response.json()

    // 4. 将 Python 的处理结果透传给前端
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[Storage] API Error:', error)
    return NextResponse.json({ 
      ok: false, 
      status: 0, 
      message: error.message || '入库请求处理异常' 
    }, { status: 500 })
  }
}