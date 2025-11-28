import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, statSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

function getDocName(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const base = fileName.replace(/\.[^/.]+$/, '')
  if (['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)) return fileName
  return `${base}.docx`
}

function findActualFile(basePath: string): { physicalFile: string | null, displayName: string } {
  try {
    // === 1. 优先检查 metadata.json ===
    const metadataPath = join(basePath, 'metadata.json')
    if (existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        if (metadata.physicalFile && existsSync(join(basePath, metadata.physicalFile))) {
          return {
            physicalFile: metadata.physicalFile,
            displayName: metadata.customName ? `${metadata.customName}.docx` : metadata.physicalFile
          }
        }
      } catch (e) {
        console.error('读取 metadata.json 失败:', e)
      }
    }

    // === 2. 降级策略：扫描目录 ===
    const files = readdirSync(basePath)
    
    // 查找文档文件（排除目录、临时文件和origin后缀文件）
    const docFiles = files.filter(file => {
      if (file.startsWith('~$') || file === 'metadata.json' || file.includes('.origin.')) return false
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
    
    // 如果有多个文件，优先返回最近修改的
    if (docFiles.length > 0) {
      docFiles.sort((a, b) => {
        return statSync(join(basePath, b)).mtime.getTime() - statSync(join(basePath, a)).mtime.getTime()
      })
      return {
        physicalFile: docFiles[0],
        displayName: docFiles[0]
      }
    }
    
    return { physicalFile: null, displayName: '' }
  } catch (error) {
    console.error('读取目录失败:', error)
    return { physicalFile: null, displayName: '' }
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const agentUserId = url.searchParams.get('agentUserId') || ''
    const taskId = url.searchParams.get('taskId') || ''

    if (!agentUserId || !taskId) {
      return NextResponse.json({ 
        ok: false, 
        message: '缺少必要参数: agentUserId, taskId' 
      }, { status: 400 })
    }

    // 直接从文件系统查找实际文件
    const basePath = join(process.cwd(), 'public', 'save', agentUserId, taskId)
    
    if (!existsSync(basePath)) {
       return NextResponse.json({ 
        ok: false, 
        processing: true, 
        message: '正在等待文档生成...' 
      })
    }

    const { physicalFile: actualFileName, displayName } = findActualFile(basePath)
    
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
    
    const relativePath = `/save/${encodeURIComponent(agentUserId)}/${encodeURIComponent(taskId)}/${encodeURIComponent(actualFileName)}`
    const docUrl = `${dsBase}${relativePath}`
    const callbackUrl = `${publicBase}/api/onlyoffice-callback?fileName=${encodeURIComponent(actualFileName)}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(taskId)}`

    console.log(`文档URL构建成功 (虚拟重命名):`, { docUrl, docName: displayName, physicalFile: actualFileName, callbackUrl })

    return NextResponse.json({ 
      ok: true, 
      docUrl, 
      docName: displayName,      // 显示虚拟名称
      callbackUrl, 
      relativePath,
      physicalFileName: actualFileName  // 额外返回物理文件名，供前端使用
    })
  } catch (err: any) {
    console.error('处理请求时发生错误:', err)
    return NextResponse.json({ 
      ok: false, 
      message: err?.message || String(err) 
    }, { status: 500 })
  }
}
