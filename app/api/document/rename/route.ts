import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentUserId, taskId, newFileName } = body

    if (!agentUserId || !taskId || !newFileName) {
      return NextResponse.json({ ok: false, message: '缺少必要参数' }, { status: 400 })
    }

    const saveDir = path.join(process.cwd(), 'public', 'save', agentUserId, taskId)
    
    if (!fs.existsSync(saveDir)) {
      return NextResponse.json({ ok: false, message: '找不到任务目录' }, { status: 404 })
    }

    const metadataPath = path.join(saveDir, 'metadata.json')
    let metadata: any = {}
    let physicalFile = ''

    // 1. 尝试读取现有的 metadata
    if (fs.existsSync(metadataPath)) {
      try {
        const content = fs.readFileSync(metadataPath, 'utf-8')
        metadata = JSON.parse(content)
        physicalFile = metadata.physicalFile
      } catch (e) {
        console.error('解析 metadata.json 失败', e)
      }
    }

    // 2. 如果 metadata 中没有记录物理文件，扫描目录找到真实的 .docx 文件
    if (!physicalFile) {
      const files = fs.readdirSync(saveDir).filter(f => {
        return f.endsWith('.docx') && !f.startsWith('~$') && f !== 'metadata.json'
      })
      
      if (files.length > 0) {
        physicalFile = files[0] // 默认取第一个找到的 docx
      }
    }

    if (!physicalFile) {
      return NextResponse.json({ ok: false, message: '目录下找不到可用的 docx 源文件' }, { status: 404 })
    }

    // 3. 处理新文件名 (去掉后缀，只存纯名称)
    let displayName = newFileName.trim()
    if (displayName.toLowerCase().endsWith('.docx')) {
      displayName = displayName.slice(0, -5)
    }

    // 4. 更新 metadata (虚拟重命名核心逻辑)
    metadata = {
      ...metadata,
      id: taskId,
      agentUserId: agentUserId,
      physicalFile: physicalFile, // 物理文件保持不变
      customName: displayName,    // 记录用户的自定义名称
      lastModified: new Date().toISOString()
    }

    // 写入 JSON
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    return NextResponse.json({ 
      ok: true, 
      message: '重命名成功', 
      data: { physicalFile, customName: displayName } 
    })

  } catch (error: any) {
    console.error('Rename error:', error)
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}
