import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

export const runtime = 'nodejs'

// 处理同名文件，自动添加后缀
function getUniqueFileName(uploadDir: string, fileName: string): string {
  const ext = path.extname(fileName)
  const baseName = path.basename(fileName, ext)
  let uniqueFileName = fileName
  let counter = 1
  
  // 检查文件是否已存在
  while (fs.existsSync(path.join(uploadDir, uniqueFileName))) {
    uniqueFileName = `${baseName}(${counter})${ext}`
    counter++
  }
  
  return uniqueFileName
}

// 获取用户的下一个任务ID（顺序编号）
function getNextTaskId(userUploadDir: string): string {
  // 确保用户目录存在
  if (!fs.existsSync(userUploadDir)) {
    fs.mkdirSync(userUploadDir, { recursive: true })
    return "1"
  }
  
  // 获取用户目录下所有子目录（任务目录）
  const taskDirs = fs.readdirSync(userUploadDir)
    .filter(name => {
      const fullPath = path.join(userUploadDir, name)
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name)
    })
    .map(name => parseInt(name, 10))
    .sort((a, b) => a - b)
  
  // 如果没有任务目录，返回1
  if (taskDirs.length === 0) {
    return "1"
  }
  
  // 找到最大的任务编号并加1
  const maxTaskId = taskDirs[taskDirs.length - 1]
  return (maxTaskId + 1).toString()
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as unknown as File | null
    const agentUserId = form.get('agentUserId') as string || 'default'
    let taskId = form.get('taskId') as string
    
    if (!file) {
      return NextResponse.json({ ok: false, message: '缺少文件(file)' }, { status: 400 })
    }

    const originalName = (file as any).name || `upload-${Date.now()}`
    const buf = Buffer.from(await (file as any).arrayBuffer())

    // 创建用户上传目录
    const userUploadDir = path.join(process.cwd(), 'public', 'upload', agentUserId)
    
    // 如果没有提供taskId，则自动生成下一个顺序编号
    if (!taskId) {
      taskId = getNextTaskId(userUploadDir)
    }
    
    // 创建基于用户ID和任务ID的目录结构
    const uploadDir = path.join(userUploadDir, taskId)
    await fs.promises.mkdir(uploadDir, { recursive: true })
    
    // 处理同名文件，自动添加后缀
    const uniqueFileName = getUniqueFileName(uploadDir, originalName)
    const filePath = path.join(uploadDir, uniqueFileName)
    await fs.promises.writeFile(filePath, buf)

    // 返回的路径包含用户ID和任务ID
    const relativePath = `/upload/${agentUserId}/${taskId}/${encodeURIComponent(uniqueFileName)}`
  
    // publicBase 是你的 Next.js 应用的 URL
    const publicBase = process.env.BASE_URL || '' 
    // dsBase 是你的 OnlyOffice 服务器的 URL
    const dsBase = process.env.DS_BASE_URL || publicBase 

    const localUrl = `${publicBase}${relativePath}`
    
    // [!! 修改点 1 !!]
    // 删除了多余的 "/files" 前缀
    // 这样 OnlyOffice 容器就会去请求 http://host.docker.internal:10043/upload/用户ID/任务ID/文件名.docx
    // 这个 URL 会被你的 Nginx [规则 A] (root /var/www/my-doc-system-uploads;) 正确处理
    const docUrl = `${dsBase}${relativePath}`
    
    // 这是 OnlyOffice 保存后应该调用的 Next.js API 路由
    const nextJsCallbackUrl = `${dsBase}/api/onlyoffice-callback`

    if (/\.(docx)$/i.test(uniqueFileName)) {
      try {
        await rewriteDocxHyperlinks(filePath)
      } catch (e) {
        console.warn('重写超链接失败（忽略继续）:', e)
      }
    }

    try {
      const pythonServiceUrl = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:11111'
      const ocrRequest = {
        task_id: taskId,
        status: 0,
        agentUserId: parseInt(agentUserId, 10) || 0,
        file_name: uniqueFileName,
        input_file_path: '/home/cqj/my-doc-system-uploads/upload',
        output_file_path: '/home/cqj/my-doc-system-uploads/save'
      }
      
      const response = await fetch(`${pythonServiceUrl}/generate_report/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ocrRequest)
      })
      
      if (!response.ok) {
        console.error(`Python服务调用失败: ${response.status} ${response.statusText}`)
        // 不阻止上传完成，但记录错误
      } else {
        const result = await response.json()
        if (result.report_generation_status !== 0) {
          console.error(`Python服务返回错误: ${result.report_generation_condition}`)
        }
      }
    } catch (error) {
      console.error('调用Python服务时发生错误:', error)
      // 不阻止上传完成，但记录错误
    }

    return NextResponse.json({ 
      ok: true, 
      fileName: uniqueFileName, 
      savedPath: relativePath, 
      docUrl: docUrl,
      localUrl: localUrl,
      callbackUrl: nextJsCallbackUrl,
      agentUserId: agentUserId,
      taskId: taskId
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 })
  }
}


async function rewriteDocxHyperlinks(docxPath: string) {
  const buf = await fs.promises.readFile(docxPath)
  const zip = await JSZip.loadAsync(buf)

  const relFiles = [
    'word/_rels/document.xml.rels',
    'word/_rels/footer1.xml.rels',
    'word/_rels/footer2.xml.rels',
    'word/_rels/header1.xml.rels',
    'word/_rels/header2.xml.rels',
  ]

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '' })

  for (const relPath of relFiles) {
    const file = zip.file(relPath)
    if (!file) continue
    const xml = await file.async('string')
    const json = parser.parse(xml)

    const rels = json.Relationships?.Relationship
    if (!rels) continue

    const arr = Array.isArray(rels) ? rels : [rels]
    let changed = false

    for (const r of arr) {
      const target: string = r.Target || ''
      if (target.startsWith('file://')) {
        const encoded = encodeURIComponent(target)
        r.Target = `/open?target=${encoded}`
        changed = true
      }
    }

    if (changed) {
      const newXml = builder.build(json)
      zip.file(relPath, newXml)
    }
  }

  const out = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.promises.writeFile(docxPath, out)
}