import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const agentUserIdParam = url.searchParams.get('agentUserId')
    const agentUserId = agentUserIdParam && agentUserIdParam.trim() !== '' ? agentUserIdParam : '123'
    
    // 定义保存路径：优先使用外部挂载目录
    const EXTERNAL_UPLOAD_ROOT = '/home/cqj/my-doc-system-uploads'
    const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), 'public')
    
    // 确定使用的根目录
    const rootDir = fs.existsSync(EXTERNAL_UPLOAD_ROOT) ? EXTERNAL_UPLOAD_ROOT : LOCAL_UPLOAD_ROOT
    const saveRoot = path.join(rootDir, 'save', agentUserId)

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
      let physicalFileName: string | null = null
      let updateTime = ''
      let isValid = false
      let fileSizeStr = '未知'

      // 1. 优先从 metadata 读取虚拟名称和物理文件名
      let meta: any = {};
      if (fs.existsSync(metadataPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
          // 记录 metadata 信息，但不要过早确定最终展示名，等扫描完再统一决策
          physicalFileName = meta.physicalFile || null // 保存物理文件名
          updateTime = meta.lastModified || updateTime
          isValid = true
        } catch {}
      }

      // 2. 降级：扫描物理文件（当 metadata 缺少 physicalFile 或不存在时）
      if (!physicalFileName) {
        try {
          const files = fs.readdirSync(taskPath).filter(f => 
            f.endsWith('.docx') && 
            !f.startsWith('~$') &&
            !f.includes('.origin.') // 排除带有"origin"后缀的文件
          )
          if (files.length > 0) {
            // 优先选择最近修改的文件
            files.sort((a, b) => {
              const sa = fs.statSync(path.join(taskPath, a)).mtime.getTime()
              const sb = fs.statSync(path.join(taskPath, b)).mtime.getTime()
              return sb - sa
            })
            physicalFileName = physicalFileName || files[0]
            const stats = fs.statSync(path.join(taskPath, physicalFileName))
            updateTime = stats.mtime.toISOString()
            isValid = true
          }
        } catch {}
      }

      // 3. 统一确定展示名：
      //    - 优先使用 metadata.customName（加 .docx）
      //    - 否则使用物理文件名
      //    - 都没有则保持默认 "未命名文档-<id>"
      if (meta.customName && typeof meta.customName === 'string' && meta.customName.trim() !== '') {
        fileName = `${meta.customName}.docx`
      } else if (physicalFileName) {
        fileName = physicalFileName
      }

      // 计算文件大小 (现在确保对所有有效文件都尝试计算)
      if (meta.file_size_kb) {
          // 如果 metadata 中已有 file_size_kb，直接使用 (如果是数字，加上 KB)
          fileSizeStr = meta.file_size_kb + ' KB';
      } else if (physicalFileName) {
          try {
              const stats = fs.statSync(path.join(taskPath, physicalFileName));
              const sizeInBytes = stats.size;
              if (sizeInBytes < 1024) {
                  fileSizeStr = sizeInBytes + ' B';
              } else if (sizeInBytes < 1024 * 1024) {
                  fileSizeStr = (sizeInBytes / 1024).toFixed(1) + ' KB';
              } else {
                  fileSizeStr = (sizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
              }
          } catch (e) {
              // 如果读取失败，保持默认 '未知'
          }
      }

      if (!isValid) return null

      // 检查是否已解析完成
      // 规则：检查目录下是否存在以 _tables_with_heading.json 结尾的文件
      let status = 'pending' // 默认为等待中/未开始
      
      try {
        const allFiles = fs.readdirSync(taskPath);
        const hasResultJson = allFiles.some(f => f.endsWith('_tables_with_heading.json'));
        if (hasResultJson) {
            status = 'completed';
        }
      } catch (e) {}

      const formattedDate = updateTime ? new Date(updateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

      return {
        id: taskId,
        name: fileName,
        customName: meta.customName || null,
        physicalName: physicalFileName, // 新增物理文件名字段
        type: 'DOCX',
        uploadDate: formattedDate,
        status: status,
        size: fileSizeStr, 
        pages: meta.pages || 0,
        elements: { 
            text: meta.element_counts?.text || 0, 
            tables: meta.element_counts?.tables || 0, 
            images: meta.element_counts?.images || 0 
        },
        // 将 metadata 中的完整统计信息也传给前端，方便直接使用
        statistics: {
            text_blocks_count: meta.element_counts?.text || 0,
            tables_count: meta.element_counts?.tables || 0,
            images_count: meta.element_counts?.images || 0,
            total_pages: meta.pages || 0,
            file_size_kb: meta.file_size_kb || 0
        }
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
