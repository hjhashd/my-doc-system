// app/api/pipeline/result/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentUserId = searchParams.get('agentUserId')
    const taskId = searchParams.get('taskId')
    // 1. 获取前端传来的文件名
    const originalFileName = searchParams.get('fileName')

    // 添加日志到文件
    const logMessage = `[${new Date().toISOString()}] Request: agentUserId=${agentUserId}, taskId=${taskId}, fileName=${originalFileName}\n`
    await fs.appendFile('/tmp/api-debug.log', logMessage)

    if (!agentUserId || !taskId) {
      return NextResponse.json({ ok: false, message: '缺少参数: agentUserId 或 taskId' }, { status: 400 })
    }

    const baseUploadPath = '/app/public/save'
    const resultDir = path.join(baseUploadPath, agentUserId, taskId)
    
    // 2. 处理文件名拼接逻辑
    let resultFilePath: string
    
    if (originalFileName) {
      // 如果提供了文件名，按照新逻辑处理：去掉扩展名，加上 _blocks_merge.json
      // 例如：XA_certificate_res.docx -> XA_certificate_res_blocks_merge.json
      const fileNameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "")
      const targetJsonName = `${fileNameWithoutExt}_blocks_merge.json`
      resultFilePath = path.join(resultDir, targetJsonName)
      console.log(`使用文件名参数构建路径: ${resultFilePath}`)
      await fs.appendFile('/tmp/api-debug.log', `使用文件名参数构建路径: ${resultFilePath}\n`)
    } else {
      // 如果没有提供文件名，使用默认的 blocks_merge.json
      resultFilePath = path.join(resultDir, 'blocks_merge.json')
      console.log(`使用默认文件名: ${resultFilePath}`)
      await fs.appendFile('/tmp/api-debug.log', `使用默认文件名: ${resultFilePath}\n`)
    }

    // 3. 检查文件是否存在
    try {
      await fs.access(resultFilePath)
      console.log(`文件存在: ${resultFilePath}`)
      await fs.appendFile('/tmp/api-debug.log', `文件存在: ${resultFilePath}\n`)
    } catch (e) {
      console.log(`文件不存在: ${resultFilePath}`)
      await fs.appendFile('/tmp/api-debug.log', `文件不存在: ${resultFilePath}\n`)
      // 如果找不到文件，尝试使用默认的 tables_with_heading.json 作为兜底方案
      // 只有在已经使用了文件名参数的情况下才需要尝试兜底
      if (originalFileName) {
        const fallbackPath = path.join(resultDir, 'tables_with_heading.json')
        console.log(`尝试默认文件: ${fallbackPath}`)
        await fs.appendFile('/tmp/api-debug.log', `尝试默认文件: ${fallbackPath}\n`)
        try {
          await fs.access(fallbackPath)
          console.log(`默认文件存在: ${fallbackPath}`)
          await fs.appendFile('/tmp/api-debug.log', `默认文件存在: ${fallbackPath}\n`)
          // 如果 fallback 存在，就读取 fallback
          const fileContent = await fs.readFile(fallbackPath, 'utf-8')
          return NextResponse.json({ ok: true, data: JSON.parse(fileContent) })
        } catch (fallbackError) {
          console.log(`默认文件也不存在: ${fallbackPath}`)
          await fs.appendFile('/tmp/api-debug.log', `默认文件也不存在: ${fallbackPath}\n`)
          // 如果默认文件名也不存在，尝试查找目录中所有可能的表格文件
          try {
            console.log(`尝试读取目录: ${resultDir}`)
            await fs.appendFile('/tmp/api-debug.log', `尝试读取目录: ${resultDir}\n`)
            const files = await fs.readdir(resultDir)
            console.log(`目录中的文件: ${files.join(', ')}`)
            await fs.appendFile('/tmp/api-debug.log', `目录中的文件: ${files.join(', ')}\n`)
            const tableFiles = files.filter(file => file.includes('_tables_with_heading.json'))
            console.log(`找到的表格文件: ${tableFiles.join(', ')}`)
            await fs.appendFile('/tmp/api-debug.log', `找到的表格文件: ${tableFiles.join(', ')}\n`)
            
            if (tableFiles.length > 0) {
              const foundFilePath = path.join(resultDir, tableFiles[0])
              console.log(`使用找到的表格文件: ${foundFilePath}`)
              await fs.appendFile('/tmp/api-debug.log', `使用找到的表格文件: ${foundFilePath}\n`)
              const fileContent = await fs.readFile(foundFilePath, 'utf-8')
              return NextResponse.json({ ok: true, data: JSON.parse(fileContent) })
            } else {
              console.log(`没有找到任何表格文件`)
              await fs.appendFile('/tmp/api-debug.log', `没有找到任何表格文件\n`)
              return NextResponse.json({ 
                ok: false, 
                message: '结果文件不存在', 
                path: resultFilePath,
                triedPaths: [resultFilePath, fallbackPath],
                availableFiles: files
              }, { status: 404 })
            }
          } catch (dirError) {
            console.log(`读取目录失败: ${dirError}`)
            await fs.appendFile('/tmp/api-debug.log', `读取目录失败: ${dirError}\n`)
            return NextResponse.json({ 
              ok: false, 
              message: '结果文件不存在', 
              path: resultFilePath,
              triedPaths: [resultFilePath, fallbackPath]
            }, { status: 404 })
          }
        }
      } else {
        // 如果没有使用文件名参数，且默认文件也不存在，直接返回错误
        console.log(`没有使用文件名参数，且默认文件也不存在`)
        await fs.appendFile('/tmp/api-debug.log', `没有使用文件名参数，且默认文件也不存在\n`)
        return NextResponse.json({ 
          ok: false, 
          message: '结果文件不存在', 
          path: resultFilePath
        }, { status: 404 })
      }
    }

    // 4. 读取文件内容
    const fileContent = await fs.readFile(resultFilePath, 'utf-8')
    const jsonData = JSON.parse(fileContent)

    // 统计元素数量
    let textCount = 0;
    let tableCount = 0;
    let imageCount = 0;

    if (Array.isArray(jsonData) || (jsonData.blocks && Array.isArray(jsonData.blocks))) {
        const blocks = Array.isArray(jsonData) ? jsonData : jsonData.blocks;

        // 统计文本
        textCount = blocks.filter((item: any) => 
            item.content && 
            !item.content.includes('🖼️ 点击查看高清原图') && !item.content.startsWith('📊 点击编辑关联表格') &&
            !item.content.includes('🖼️ 点击查看图片') && !item.content.startsWith('📊 点击编辑表格')
        ).length;

        // 统计表格
        tableCount = blocks.filter((item: any) => 
            item.content && (item.content.startsWith('📊 点击编辑关联表格') || item.content.startsWith('📊 点击编辑表格'))
        ).length;

        // 统计图片
        imageCount = blocks.filter((item: any) => 
            item.content && (item.content.includes('🖼️ 点击查看高清原图') || item.content.includes('🖼️ 点击查看图片'))
        ).length;

        // 计算最大页数 (查找PDF-LOC标记)
        let maxPage = 0;
        blocks.forEach((item: any) => {
            if (item.content) {
                const pdfLocMatch = item.content.match(/\[#PDF-LOC:(\d+)#\]/);
                if (pdfLocMatch) {
                    const page = parseInt(pdfLocMatch[1]);
                    if (!isNaN(page) && page > maxPage) {
                        maxPage = page;
                    }
                }
            }
        });
        // 如果没有找到PDF-LOC，默认为1页 (或者0，取决于需求，这里设为1如果内容不为空)
        if (maxPage === 0 && blocks.length > 0) {
             maxPage = 1;
        }

        // 尝试读取并更新 metadata.json
        const metadataPath = path.join(resultDir, 'metadata.json');
        try {
            let meta: any = {};
            if (await fs.access(metadataPath).then(() => true).catch(() => false)) {
                const metaContent = await fs.readFile(metadataPath, 'utf-8');
                meta = JSON.parse(metaContent);
            }
            
            // 计算文件大小 (如果 metadata 中没有或者需要更新)
            let fileSizeKB = meta.file_size_kb;
            if (!fileSizeKB && meta.physicalFile) {
                 try {
                    const physicalFilePath = path.join(resultDir, meta.physicalFile);
                    const stats = await fs.stat(physicalFilePath);
                    // 转换为数字类型，保留两位小数
                    fileSizeKB = parseFloat((stats.size / 1024).toFixed(2));
                 } catch(e) {}
            }

            // 检查是否有变更
            const needsUpdate = 
                !meta.element_counts || 
                meta.element_counts.text !== textCount || 
                meta.element_counts.tables !== tableCount || 
                meta.element_counts.images !== imageCount ||
                meta.pages !== maxPage ||
                (fileSizeKB && meta.file_size_kb !== fileSizeKB);

            if (needsUpdate) {
                meta.element_counts = {
                    text: textCount,
                    tables: tableCount,
                    images: imageCount
                };
                meta.pages = maxPage;
                if (fileSizeKB) {
                    meta.file_size_kb = fileSizeKB;
                }
                
                await fs.writeFile(metadataPath, JSON.stringify(meta, null, 2), 'utf-8');
                console.log(`已更新 metadata.json 统计信息: ${metadataPath}`);
            }
        } catch (metaError) {
            console.error('更新 metadata.json 失败:', metaError);
        }
    }

    return NextResponse.json({ ok: true, data: jsonData })

  } catch (error: any) {
    console.error('读取结果失败:', error)
    await fs.appendFile('/tmp/api-debug.log', `读取结果失败: ${error.message}\n`)
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }
}
