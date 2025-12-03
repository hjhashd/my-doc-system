// app/api/ocr/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import http from '@/lib/http'

export const runtime = 'nodejs'

// OCR处理状态枚举
enum OCRStatus {
  PENDING = 1,
  PROCESSING = 2,
  COMPLETED = 3,
  FAILED = 4
}

// 简单的内存存储，生产环境应使用数据库
const ocrTasks = new Map<string, {
  status: OCRStatus;
  agentUserId: string;
  fileName: string;
  inputFilePath: string;
  outputFilePath: string;
  createdAt: Date;
  updatedAt: Date;
  progress?: number;
  errorMessage?: string;
}>()

// 生成顺序任务ID
async function getNextTaskId(userDir: string): Promise<string> {
  try {
    // 确保用户目录存在
    await fs.promises.mkdir(userDir, { recursive: true })
    
    // 读取用户目录下的所有子目录
    const items = await fs.promises.readdir(userDir, { withFileTypes: true })
    
    // 过滤出数字目录
    const taskDirs = items
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .filter(name => /^\d+$/.test(name))
      .map(Number)
      .sort((a, b) => a - b)
    
    // 找到下一个可用的ID
    let nextId = 1
    for (const id of taskDirs) {
      if (id === nextId) {
        nextId++
      } else {
        break
      }
    }
    
    return nextId.toString()
  } catch (error) {
    // 如果出错，返回默认ID
    return '1'
  }
}

// 生成任务ID
function generateTaskId(): string {
  // 修改：使用时间戳和随机数生成任务ID
  return Date.now().toString() + Math.random().toString(36).substring(2, 9)
}

// 处理OCR请求
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // 1. 获取前端传来的 use_large_model 和 prompt
    const { task_id, agentUserId, file_name, use_large_model, prompt } = body

    // 验证必需参数
    if (!agentUserId || !file_name) {
      return NextResponse.json({ ok: false, message: '缺少必需参数' }, { status: 400 })
    }

    // 任务ID处理逻辑 (保持原有逻辑，若无taskId则生成)
    let taskId = task_id
    if (!taskId) {
       // ... 这里保留您原有的生成ID逻辑 ...
       // 如果您需要代码，我可以补上，但通常这里不需要改
       const uploadRoot = path.join(process.cwd(), 'public', 'upload')
       taskId = await getNextTaskId(path.join(uploadRoot, agentUserId))
    }

    // 2. 关键修改：统一服务器存储路径 (硬编码为您的服务器绝对路径)
    const SERVER_INPUT_PATH = '/home/cqj/my-doc-system-uploads/upload'
    const SERVER_OUTPUT_PATH = '/home/cqj/my-doc-system-uploads/save'

    // 3. 关键逻辑：根据模型选择分流
    if (use_large_model) {
      // ===========================
      // Branch A: 大模型 (DeepSeek)
      // ===========================
      // 优先读环境变量，读不到则使用 host.docker.internal (因为你在yml里配了)，最后才试 localhost
const largeModelUrl = process.env.DEEPSEEK_SERVICE_URL || 'http://host.docker.internal:22222'; // 大模型端口
      
      const largeModelRequest = {
        task_id: taskId,
        status: 1,            // 大模型要求 status: 1
        agentUserId: parseInt(agentUserId),
        file_name: file_name,
        input_file_path: SERVER_INPUT_PATH,
        output_file_path: SERVER_OUTPUT_PATH,
        // 透传用户输入的 prompt，如果没有则使用默认值
        prompt: prompt || "<image>\\n<|grounding|>Convert the document to markdown,Filter out watermarks named CSG, keep table structure."
      }

      console.log('[Large Model] Request:', largeModelRequest)

      // 调用 22222 端口接口
      const response = await http.post(`${largeModelUrl}/generate_task/`, largeModelRequest)
      
      // 注意：根据 curl 示例，大模型可能不直接返回 report_generation_status 结构
      // 这里假设只要请求成功即视为提交成功
      
      return NextResponse.json({ 
        ok: true, 
        taskId, 
        status: 2, 
        message: '大模型任务已提交' 
      })

    } else {
      // ===========================
      // Branch B: 小模型 (Existing)
      // ===========================
      const smallModelUrl = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:11111' // 小模型端口
      
      const smallModelRequest = {
        task_id: taskId,
        status: 0,            // 小模型要求 status: 0
        agentUserId: parseInt(agentUserId),
        file_name: file_name,
        input_file_path: SERVER_INPUT_PATH,
        output_file_path: SERVER_OUTPUT_PATH
      }

      console.log('[Small Model] Request:', smallModelRequest)
      
      // 调用 11111 端口接口
      const response = await http.post(`${smallModelUrl}/generate_report/`, smallModelRequest)

      if (response && response.report_generation_status === 0) {
        return NextResponse.json({ ok: true, taskId, status: 2, message: '任务提交成功' })
      } else {
        throw new Error(response?.report_generation_condition || '小模型服务返回错误')
      }
    }

  } catch (err: any) {
    console.error('OCR API Error:', err)
    return NextResponse.json({ ok: false, message: err.message || String(err) }, { status: 500 })
  }
}

// 查询OCR任务状态
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    
    if (!taskId) {
      return NextResponse.json({ 
        ok: false, 
        message: '缺少taskId参数' 
      }, { status: 400 })
    }
    
    // 直接从Python后端服务获取状态
    try {
      const pythonServiceUrl = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:11111'
      const response = await http.get(`${pythonServiceUrl}/report_status/${taskId}`)
      
      if (!response) {
        return NextResponse.json({ 
          ok: false, 
          message: `无法获取任务状态: ${taskId}` 
        }, { status: 404 })
      }
      
      // 确定任务状态
      let status = OCRStatus.PENDING
      if (response.report_generation_status === 0) {
        status = OCRStatus.COMPLETED
      } else if (response.report_generation_status === 2) {
        status = OCRStatus.PROCESSING
      } else if (response.report_generation_status === 1) {
        status = OCRStatus.FAILED
      }
      
      // 构建文件路径
      const uploadRoot = path.join(process.cwd(), 'public', 'upload')
      const saveRoot = path.join(process.cwd(), 'public', 'save')
      
      // 从任务ID推断用户ID（这里假设任务ID是数字，用户ID可以从任务目录中获取）
      // 在实际应用中，可能需要更复杂的逻辑来获取用户ID
      let agentUserId = '123' // 默认用户ID，实际应用中应该从其他地方获取
      
      // 尝试从任务目录获取用户ID
      try {
        const userDirs = await fs.promises.readdir(path.join(uploadRoot))
        for (const userId of userDirs) {
          const userTaskDir = path.join(uploadRoot, userId, taskId)
          if (fs.existsSync(userTaskDir)) {
            agentUserId = userId
            break
          }
        }
      } catch (error) {
        // 忽略错误，使用默认用户ID
      }
      
      // 构建输入和输出文件路径
      const inputDir = path.join(uploadRoot, agentUserId, taskId)
      const outputDir = path.join(saveRoot, agentUserId, taskId)
      
      // 获取目录中的文件
      let inputFiles = []
      let outputFiles = []
      
      try {
        if (fs.existsSync(inputDir)) {
          inputFiles = await fs.promises.readdir(inputDir)
        }
      } catch (error) {
        // 忽略错误
      }
      
      try {
        if (fs.existsSync(outputDir)) {
          outputFiles = await fs.promises.readdir(outputDir)
        }
      } catch (error) {
        // 忽略错误
      }
      
      // 获取文件信息
      let fileExists = false
      let fileSize = 0
      let fileName = ''
      let inputFilePath = ''
      let outputFilePath = ''
      
      // 使用输入文件名作为输出文件名的基础
      if (inputFiles.length > 0) {
        fileName = inputFiles[0]
        inputFilePath = path.join(inputDir, fileName)
        
        // 检查输出文件
        const baseName = fileName.replace(/\.[^/.]+$/, '')
        const possibleExtensions = ['.docx', '.doc', '.pdf']
        
        for (const ext of possibleExtensions) {
          const possibleOutputFile = path.join(outputDir, baseName + ext)
          if (fs.existsSync(possibleOutputFile)) {
            const stats = await fs.promises.stat(possibleOutputFile)
            fileExists = true
            fileSize = stats.size
            outputFilePath = possibleOutputFile
            break
          }
        }
      }
      
      // 返回任务状态和文件信息
      return NextResponse.json({
        ok: true,
        taskId,
        status,
        fileName,
        agentUserId,
        inputFilePath,
        outputFilePath,
        fileExists,
        fileSize,
        progress: response.progress || 0,
        errorMessage: status === OCRStatus.FAILED ? response.report_generation_condition : undefined
      })
    } catch (error) {
      console.error('无法从Python服务获取状态:', error)
      
      return NextResponse.json({ 
        ok: false, 
        message: `无法获取任务状态: ${error}` 
      }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ 
      ok: false, 
      message: err?.message || String(err) 
    }, { status: 500 })
  }
}

// 删除OCR任务
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    
    if (!taskId) {
      return NextResponse.json({ 
        ok: false, 
        message: '缺少taskId参数' 
      }, { status: 400 })
    }
    
    // 尝试从Python服务删除任务
    try {
      const pythonServiceUrl = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:11111'
      // 注意：这里假设Python服务有删除任务的接口，如果没有，可以忽略这部分
      // await http.delete(`${pythonServiceUrl}/tasks/${taskId}`)
    } catch (error) {
      // 忽略Python服务删除错误
    }
    
    // 查找并删除任务相关文件
    const uploadRoot = path.join(process.cwd(), 'public', 'upload')
    const saveRoot = path.join(process.cwd(), 'public', 'save')
    
    // 尝试找到任务所属的用户
    let agentUserId = null
    try {
      const userDirs = await fs.promises.readdir(uploadRoot)
      for (const userId of userDirs) {
        const userTaskDir = path.join(uploadRoot, userId, taskId)
        if (fs.existsSync(userTaskDir)) {
          agentUserId = userId
          break
        }
      }
    } catch (error) {
      // 忽略错误
    }
    
    if (agentUserId) {
      // 删除输入和输出文件
      const uploadTaskDir = path.join(uploadRoot, agentUserId, taskId)
      const saveTaskDir = path.join(saveRoot, agentUserId, taskId)
      
      try {
        // 删除上传目录中的任务目录
        if (fs.existsSync(uploadTaskDir)) {
          await fs.promises.rm(uploadTaskDir, { recursive: true, force: true })
        }
      } catch (error) {
        // 忽略删除错误
      }
      
      try {
        // 删除保存目录中的任务目录
        if (fs.existsSync(saveTaskDir)) {
          await fs.promises.rm(saveTaskDir, { recursive: true, force: true })
        }
      } catch (error) {
        // 忽略删除错误
      }
    }
    
    return NextResponse.json({ 
      ok: true, 
      message: '任务已删除' 
    })
  } catch (err: any) {
    return NextResponse.json({ 
      ok: false, 
      message: err?.message || String(err) 
    }, { status: 500 })
  }
}