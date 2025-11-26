import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentUserId, taskId, fileName, format, contentTypes, content } = body

    // 验证必要参数
    if (!agentUserId || !taskId || !fileName || !format || !contentTypes || !content) {
      return NextResponse.json(
        { ok: false, message: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证格式
    const validFormats = ['word', 'excel', 'json', 'markdown']
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { ok: false, message: '不支持的导出格式' },
        { status: 400 }
      )
    }

    // 创建导出目录
    const exportDir = path.join(process.cwd(), 'uploads', 'exports', agentUserId, taskId)
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }

    // 生成导出文件名
    const baseName = fileName.replace(/\.[^/.]+$/, '') // 移除文件扩展名
    const exportFileName = `${baseName}_export_${Date.now()}.${format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : format}`
    const exportFilePath = path.join(exportDir, exportFileName)

    // 根据格式处理导出
    let downloadUrl = ''
    let fileContent = ''

    switch (format) {
      case 'json':
        fileContent = JSON.stringify({
          document: {
            name: fileName,
            taskId,
            exportDate: new Date().toISOString(),
            contentTypes
          },
          content
        }, null, 2)
        
        fs.writeFileSync(exportFilePath, fileContent, 'utf8')
        downloadUrl = `/api/file-proxy?path=/my-doc-system-uploads/exports/${agentUserId}/${taskId}/${exportFileName}`
        break

      case 'markdown':
        fileContent = generateMarkdown(content, fileName)
        fs.writeFileSync(exportFilePath, fileContent, 'utf8')
        downloadUrl = `/api/file-proxy?path=/my-doc-system-uploads/exports/${agentUserId}/${taskId}/${exportFileName}`
        break

      case 'word':
        // 对于Word和Excel，这里只是简单实现，实际项目中可能需要使用专门的库
        // 例如: docx, exceljs 等
        fileContent = generateSimpleWord(content, fileName)
        fs.writeFileSync(exportFilePath, fileContent, 'utf8')
        downloadUrl = `/api/file-proxy?path=/my-doc-system-uploads/exports/${agentUserId}/${taskId}/${exportFileName}`
        break

      case 'excel':
        fileContent = generateSimpleExcel(content, fileName)
        fs.writeFileSync(exportFilePath, fileContent, 'utf8')
        downloadUrl = `/api/file-proxy?path=/my-doc-system-uploads/exports/${agentUserId}/${taskId}/${exportFileName}`
        break

      default:
        return NextResponse.json(
          { ok: false, message: '不支持的导出格式' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      ok: true,
      data: {
        fileName: exportFileName,
        downloadUrl,
        format,
        contentTypes
      }
    })
  } catch (error: any) {
    console.error('导出错误:', error)
    return NextResponse.json(
      { ok: false, message: `导出失败: ${error.message}` },
      { status: 500 }
    )
  }
}

// 生成Markdown格式内容
function generateMarkdown(content: any, fileName: string): string {
  let markdown = `# ${fileName}\n\n`
  markdown += `导出时间: ${new Date().toLocaleString()}\n\n`

  // 添加文本内容
  if (content.text && content.text.length > 0) {
    markdown += `## 文本内容\n\n`
    content.text.forEach((item: any) => {
      if (item.metadata?.heading_title) {
        markdown += `### ${item.metadata.heading_title}\n\n`
      }
      markdown += `${item.content}\n\n`
    })
  }

  // 添加表格内容
  if (content.tables && content.tables.length > 0) {
    markdown += `## 表格内容\n\n`
    content.tables.forEach((item: any, index: number) => {
      markdown += `### 表格 ${index + 1}: ${item.content || ''}\n\n`
      if (item.metadata?.table_path) {
        markdown += `表格文件路径: ${item.metadata.table_path}\n\n`
      }
    })
  }

  // 添加图片内容
  if (content.images && content.images.length > 0) {
    markdown += `## 图片内容\n\n`
    content.images.forEach((item: any, index: number) => {
      markdown += `### 图片 ${index + 1}: ${item.content || ''}\n\n`
      if (item.imageUrl) {
        markdown += `![${item.content || `图片 ${index + 1}`}](${item.imageUrl})\n\n`
      }
    })
  }

  return markdown
}

// 生成简单的Word格式内容（实际项目中应使用docx等库）
function generateSimpleWord(content: any, fileName: string): string {
  // 这里只是简单实现，返回HTML格式的文档
  // 实际项目中应该使用专门的库如docx来生成真正的Word文档
  let html = `<html><head><title>${fileName}</title><meta charset="utf-8"></head><body>`
  html += `<h1>${fileName}</h1>`
  html += `<p>导出时间: ${new Date().toLocaleString()}</p>`

  // 添加文本内容
  if (content.text && content.text.length > 0) {
    html += `<h2>文本内容</h2>`
    content.text.forEach((item: any) => {
      if (item.metadata?.heading_title) {
        html += `<h3>${item.metadata.heading_title}</h3>`
      }
      html += `<p>${item.content}</p>`
    })
  }

  // 添加表格内容
  if (content.tables && content.tables.length > 0) {
    html += `<h2>表格内容</h2>`
    content.tables.forEach((item: any, index: number) => {
      html += `<h3>表格 ${index + 1}: ${item.content || ''}</h3>`
      if (item.metadata?.table_path) {
        html += `<p>表格文件路径: ${item.metadata.table_path}</p>`
      }
    })
  }

  // 添加图片内容
  if (content.images && content.images.length > 0) {
    html += `<h2>图片内容</h2>`
    content.images.forEach((item: any, index: number) => {
      html += `<h3>图片 ${index + 1}: ${item.content || ''}</h3>`
      if (item.imageUrl) {
        html += `<img src="${item.imageUrl}" alt="${item.content || `图片 ${index + 1}`}" />`
      }
    })
  }

  html += `</body></html>`
  return html
}

// 生成简单的Excel格式内容（实际项目中应使用exceljs等库）
function generateSimpleExcel(content: any, fileName: string): string {
  // 这里只是简单实现，返回CSV格式的文档
  // 实际项目中应该使用专门的库如exceljs来生成真正的Excel文档
  let csv = `"${fileName}"\n`
  csv += `"导出时间","${new Date().toLocaleString()}"\n\n`

  // 添加文本内容
  if (content.text && content.text.length > 0) {
    csv += `"文本内容"\n`
    csv += `"标题","内容"\n`
    content.text.forEach((item: any) => {
      const title = (item.metadata?.heading_title || '').replace(/"/g, '""')
      const text = (item.content || '').replace(/"/g, '""')
      csv += `"${title}","${text}"\n`
    })
    csv += "\n"
  }

  // 添加表格内容
  if (content.tables && content.tables.length > 0) {
    csv += `"表格内容"\n`
    csv += `"表格名称","文件路径"\n`
    content.tables.forEach((item: any) => {
      const name = (item.content || '').replace(/"/g, '""')
      const path = (item.metadata?.table_path || '').replace(/"/g, '""')
      csv += `"${name}","${path}"\n`
    })
    csv += "\n"
  }

  // 添加图片内容
  if (content.images && content.images.length > 0) {
    csv += `"图片内容"\n`
    csv += `"图片名称","图片URL"\n`
    content.images.forEach((item: any) => {
      const name = (item.content || '').replace(/"/g, '""')
      const url = (item.imageUrl || '').replace(/"/g, '""')
      csv += `"${name}","${url}"\n`
    })
  }

  return csv
}