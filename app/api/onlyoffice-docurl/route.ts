import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

function getDocName(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const base = fileName.replace(/\.[^/.]+$/, '')
  if (['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)) return fileName
  return `${base}.docx`
}

function findActualFile(basePath: string): string | null {
  try {
    const files = readdirSync(basePath)
    
    // 查找文档文件（排除目录）
    const docFiles = files.filter(file => {
      const filePath = join(basePath, file)
      try {
        const stat = statSync(filePath)
        if (!stat.isFile()) return false
        
        const ext = file.split('.').pop()?.toLowerCase() || ''
        return ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)
      } catch {
        return false
      }
    })
    
    if (docFiles.length > 0) {
      return docFiles[0]
    }
    
    return null
  } catch (error) {
    console.error('读取目录失败:', error)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const agentUserId = url.searchParams.get('agentUserId') || ''
    const taskId = url.searchParams.get('taskId') || ''
    const fileName = url.searchParams.get('fileName') || ''

    if (!agentUserId || !taskId) {
      return NextResponse.json({ 
        ok: false, 
        message: '缺少必要参数: agentUserId, taskId' 
      }, { status: 400 })
    }

    // 直接从文件系统查找实际文件
    const basePath = `/app/public/save/${agentUserId}/${taskId}`
    const actualFileName = findActualFile(basePath)
    
    if (!actualFileName) {
      return NextResponse.json({ 
        ok: false, 
        processing: true, 
        message: '文档处理中或未找到文档文件' 
      })
    }
    
    // 任务完成，构建文档URL
    const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
    const dsBase = process.env.NEXT_PUBLIC_DS_BASE_URL || publicBase
    
    const docName = getDocName(actualFileName)
    const relativePath = `/save/${encodeURIComponent(agentUserId)}/${encodeURIComponent(taskId)}/${encodeURIComponent(actualFileName)}`
    const docUrl = `${dsBase}${relativePath}`
    const callbackUrl = `${publicBase}/api/onlyoffice-callback?fileName=${encodeURIComponent(actualFileName)}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(taskId)}`

    console.log(`文档URL构建成功:`, { docUrl, docName, actualFileName, callbackUrl })

    return NextResponse.json({ 
      ok: true, 
      docUrl, 
      docName, 
      callbackUrl, 
      relativePath
    })
  } catch (err: any) {
    console.error('处理请求时发生错误:', err)
    return NextResponse.json({ 
      ok: false, 
      message: err?.message || String(err) 
    }, { status: 500 })
  }
}