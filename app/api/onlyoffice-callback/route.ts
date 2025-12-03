// app/api/onlyoffice-callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

type OnlyOfficeCallbackPayload = {
  status?: number
  url?: string
  key?: string
  fileType?: string
  title?: string
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'onlyoffice-callback is alive' })
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as OnlyOfficeCallbackPayload
    const status = payload.status ?? 0

    // 从 URL 参数中获取自定义文件名、用户ID和任务ID
    const url = new URL(req.url)
    const customFileName = url.searchParams.get('fileName')
    const agentUserId = url.searchParams.get('agentUserId')
    const taskId = url.searchParams.get('taskId')
    const subDir = url.searchParams.get('subDir') || ''
    const docTypeHint = url.searchParams.get('docType') || ''

    // 按 OnlyOffice 回调状态处理：2=保存完成，4=强制保存
    if (status === 2 || status === 4) {
      const downloadUrl = payload.url
      if (!downloadUrl) {
        // OnlyOffice 期望收到 { error: 0 }，即使业务侧出错也不要阻塞其流程
        return NextResponse.json({ error: 0, ok: false, message: 'Missing url in OnlyOffice callback payload' })
      }

      const res = await fetch(downloadUrl)
      if (!res.ok) {
        return NextResponse.json({ error: 0, ok: false, message: `Failed to download file: ${res.status} ${res.statusText}` })
      }

      const buf = Buffer.from(await res.arrayBuffer())

      const contentType = res.headers.get('content-type') || ''
      const extFromType = (() => {
        if (contentType.includes('wordprocessingml')) return 'docx'
        if (contentType.includes('msword')) return 'doc'
        if (contentType.includes('application/pdf')) return 'pdf'
        if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) return 'xlsx'
        if (contentType.includes('application/vnd.ms-excel')) return 'xls'
        if (contentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) return 'pptx'
        if (contentType.includes('application/vnd.ms-powerpoint')) return 'ppt'
        return null
      })()

      // 优先使用自定义文件名，其次使用 payload 中的 title
      const rawTitle = customFileName || payload.title || ''
      const titleHasExt = /\.[a-zA-Z0-9]+$/.test(rawTitle)
      let fileName: string
      if (rawTitle && titleHasExt) {
        // 标题已包含扩展名，直接使用原始文件名（保留中文及特殊字符）
        fileName = rawTitle
      } else {
        const ext = (payload.fileType || extFromType || 'docx').toLowerCase()
        const baseName = rawTitle || (payload.key ? `document_${payload.key}` : `document_${Date.now()}`)
        fileName = `${baseName}.${ext}`
      }

      // 修改：按照用户ID和任务ID的目录结构保存文件
      let saveDir: string
      let relativePath: string

      const isSpreadsheet = (payload.fileType?.toLowerCase() === 'xlsx' || payload.fileType?.toLowerCase() === 'xls')
        || (extFromType === 'xlsx' || extFromType === 'xls')
        || docTypeHint.toLowerCase() === 'spreadsheet'

      const targetSubDir = (subDir && subDir.trim() !== '')
        ? subDir.trim()
        : (isSpreadsheet ? 'table' : '')

      if (agentUserId && taskId) {
        saveDir = targetSubDir
          ? path.join(process.cwd(), 'public', 'save', agentUserId, taskId, targetSubDir)
          : path.join(process.cwd(), 'public', 'save', agentUserId, taskId)
        relativePath = targetSubDir
          ? `/save/${agentUserId}/${taskId}/${targetSubDir}/${fileName}`
          : `/save/${agentUserId}/${taskId}/${fileName}`
      } else {
        saveDir = targetSubDir
          ? path.join(process.cwd(), 'public', 'save', targetSubDir)
          : path.join(process.cwd(), 'public', 'save')
        relativePath = targetSubDir
          ? `/save/${targetSubDir}/${fileName}`
          : `/save/${fileName}`
      }
      
      await fs.promises.mkdir(saveDir, { recursive: true })
      const filePath = path.join(saveDir, fileName)
      await fs.promises.writeFile(filePath, buf)
      
      const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
      const dsBase = process.env.NEXT_PUBLIC_DS_BASE_URL || publicBase
      const localUrl = `${publicBase}${relativePath}`
      const docUrl = `${dsBase}${relativePath}`
      
      // 获取请求的Host头，用于生成正确的回调URL
      const requestHost = req.headers.get('host') || ''
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const callbackUrl = `${protocol}://${requestHost}/api/onlyoffice-callback`
      
      console.log('OnlyOffice callback info:', {
        requestHost,
        protocol,
        callbackUrl,
        publicBase,
        dsBase,
        fileName,
        agentUserId,
        taskId,
        subDir: targetSubDir,
        saveDir,
        relativePath
      })
      
      // 按 OnlyOffice 要求返回 { error: 0 } 表示已处理
      return NextResponse.json({ 
        error: 0, 
        ok: true, 
        fileName, 
        savedPath: relativePath, 
        docUrl, 
        localUrl,
        agentUserId,
        taskId,
        subDir: targetSubDir
      })
    }

    // 其他状态返回透传信息，方便调试
    return NextResponse.json({ error: 0, ok: true, status })
  } catch (err: any) {
    // 出错也返回 { error: 0 }，避免 OnlyOffice 认为保存失败
    return NextResponse.json({ error: 0, ok: false, message: err?.message || String(err) })
  }
}
