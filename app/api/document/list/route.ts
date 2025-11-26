import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const agentUserIdParam = url.searchParams.get('agentUserId')
    const agentUserId = agentUserIdParam && agentUserIdParam.trim() !== '' ? agentUserIdParam : '123'
    const saveRoot = path.join(process.cwd(), 'public', 'save', agentUserId)

    if (!fs.existsSync(saveRoot)) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const taskDirs = fs.readdirSync(saveRoot).filter(dir => {
      return fs.statSync(path.join(saveRoot, dir)).isDirectory()
    })

    const documents = taskDirs.map(taskId => {
      const taskPath = path.join(saveRoot, taskId)
      const metadataPath = path.join(taskPath, 'metadata.json')
      
      let fileName = `未命名文档-${taskId}`
      let physicalFileName = null
      let updateTime = ''
      let isValid = false

      // 1. 优先从 metadata 读取虚拟名称和物理文件名
      if (fs.existsSync(metadataPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
          if (meta.customName) {
            fileName = `${meta.customName}.docx`
          } else if (meta.physicalFile) {
            fileName = meta.physicalFile
          }
          physicalFileName = meta.physicalFile // 保存物理文件名
          updateTime = meta.lastModified
          isValid = true
        } catch {}
      }

      // 2. 降级：扫描物理文件
      if (!isValid) {
        try {
          const files = fs.readdirSync(taskPath).filter(f => f.endsWith('.docx') && !f.startsWith('~$'))
          if (files.length > 0) {
            fileName = files[0]
            physicalFileName = files[0] // 同时保存为物理文件名
            const stats = fs.statSync(path.join(taskPath, files[0]))
            updateTime = stats.mtime.toISOString()
            isValid = true
          }
        } catch {}
      }

      if (!isValid) return null

      const formattedDate = updateTime ? new Date(updateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

      return {
        id: taskId,
        name: fileName,
        physicalName: physicalFileName, // 新增物理文件名字段
        type: 'DOCX',
        uploadDate: formattedDate,
        status: 'completed',
        size: '未知', 
        pages: 0,
        elements: { text: 0, tables: 0, images: 0 }
      }
    }).filter(Boolean)

    // 按 ID (时间顺序) 倒序
    documents.sort((a: any, b: any) => {
        const idA = parseInt(a.id)
        const idB = parseInt(b.id)
        if (!isNaN(idA) && !isNaN(idB)) return idB - idA
        return b.id.localeCompare(a.id)
    })

    return NextResponse.json({ ok: true, data: documents })
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}
