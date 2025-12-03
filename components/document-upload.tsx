"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card" // 新增 CardFooter
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import {
  Upload,
  FileText,
  X,
  Zap,
  Brain,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Rocket,
  Bot,
  Play, // 新增图标
  Loader2 // 新增图标
} from "lucide-react"
import { cn } from "@/lib/utils"

// 1. 修改接口：新增 serverData 用于暂存上传成功后的数据
interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  // 新增 'ready' 状态，表示已上传文件但未开始OCR
  status?: "uploading" | "ready" | "processing" | "completed" | "error"
  progress?: number
  // 暂存后端返回的关键信息
  serverData?: {
    taskId: string
    fileName: string
    localUrl: string
    agentUserId: string
  }
}

const DEFAULT_PROMPT = `<image>\n<|grounding|>Convert the document to markdown,Filter out watermarks named CSG, keep table structure.`

import { useRef } from "react"
// ...
export function DocumentUpload() {
  const router = useRouter()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileListRef = useRef<HTMLDivElement>(null)

  // 监听 uploadedFiles 变化，如果有新文件加入（长度增加），自动滚动到底部
  useEffect(() => {
    if (uploadedFiles.length > 0 && fileListRef.current) {
        // 使用 setTimeout 确保 DOM 更新后再滚动
        setTimeout(() => {
            fileListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
    }
  }, [uploadedFiles.length]) // 仅在长度变化时触发，避免状态更新时频繁滚动
  const [dragActive, setDragActive] = useState(false)
  
  const [useLargeModel, setUseLargeModel] = useState(false)
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT)
  
  // 控制是否正在进行批量处理
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    try {
      const v = localStorage.getItem("useLargeModel")
      if (v === "1") setUseLargeModel(true)
    } catch {}
  }, [])

  const handleModelChange = (value: string) => {
    const isLarge = value === "large"
    setUseLargeModel(isLarge)
    try {
      localStorage.setItem("useLargeModel", isLarge ? "1" : "0")
    } catch {}
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, []) 

  // 2. 修改：只负责上传文件，不触发 OCR
  const handleFiles = async (files: FileList) => {
    const agentUserId = "123"

    for (const file of Array.from(files)) {
      const tempId = Math.random().toString(36).substr(2, 9)
      const newFile: UploadedFile = {
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        progress: 0
      }
      
      setUploadedFiles(prev => [newFile, ...prev])

      const formData = new FormData()
      formData.append('file', file)
      formData.append('agentUserId', agentUserId)
      // 上传阶段其实不需要 model 参数，但为了兼容保持一致可以带上
      formData.append('useLargeModel', useLargeModel ? '1' : '0')

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('上传失败')
        const data = await res.json()

        // 关键修改：上传成功后，状态变为 'ready'，并存储 serverData
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { 
          ...f, 
          status: "ready", // 这里改为 ready
          progress: 100, // 上传进度满了，但总任务还没开始
          serverData: {
            taskId: data.taskId,
            fileName: data.fileName,
            localUrl: data.localUrl,
            agentUserId: agentUserId
          }
        } : f))

      } catch (e) {
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "error" } : f))
        toast({
            variant: "destructive",
            title: "文件上传失败",
            description: file.name
        })
      }
    }
  }

  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  // 计时器逻辑
  useEffect(() => {
    let timer: NodeJS.Timeout
    // 只要有 startTime，就开始计时，直到手动清除或重置
    if (startTime) {
      timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime)
      }, 100)
    }
    return () => clearInterval(timer)
  }, [startTime])

  const formatTime = (ms: number) => {
    const seconds = (ms / 1000).toFixed(1)
    return `${seconds}s`
  }

  // 3. 新增：用户点击“开始”后触发的逻辑
  const handleStartProcessing = async () => {
    // 找出所有状态为 ready 的文件
    const filesToProcess = uploadedFiles.filter(f => f.status === "ready" && f.serverData)
    
    if (filesToProcess.length === 0) {
        toast({ title: "没有待处理的文件", description: "请先上传文件" })
        return
    }

    const now = Date.now()
    setStartTime(now) // 开始计时
    setElapsedTime(0)
    setIsBatchProcessing(true)

    // 并行或串行处理都可以，这里演示并行触发
    const tasks = filesToProcess.map(async (file) => {
        if (!file.serverData) return

        // 更新状态为 processing
        setUploadedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "processing", progress: 5 } : f))

        try {
            // 构造 OCR 请求
            const ocrBody: any = {
                task_id: file.serverData.taskId,
                status: 2,
                agentUserId: file.serverData.agentUserId,
                file_name: file.serverData.fileName,
                // 这里写死路径，或者由后端处理
                input_file_path: '/home/cqj/my-doc-system-uploads/upload', 
                output_file_path: '/home/cqj/my-doc-system-uploads/save',
                // 关键：在这里将用户当前选择的模型参数传进去
                use_large_model: useLargeModel, 
                prompt: useLargeModel ? customPrompt : undefined
            }

            // 触发 OCR
            await fetch('/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ocrBody)
            })

            // 开始轮询
            await pollStatus(file.id, file.serverData, now)

        } catch (e) {
            console.error(e)
            setUploadedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: "error" } : f))
        }
    })

    await Promise.all(tasks)
    setIsBatchProcessing(false)
  }

  // 4. 抽离轮询逻辑
  const pollStatus = async (fileId: string, data: NonNullable<UploadedFile['serverData']>, currentStartTime: number) => {
    const pollIntervalMs = useLargeModel ? 4000 : 2000
    let attempts = 0
    const maxAttempts = useLargeModel ? 120 : 60 // 增加次数防止大模型超时

    const poll = async () => {
        attempts++
        try {
            const params = new URLSearchParams({
                agentUserId: data.agentUserId,
                taskId: data.taskId,
                fileName: data.fileName
            })
            const r = await fetch(`/api/onlyoffice-docurl?${params.toString()}`)
            const j = await r.json()

            // 模拟进度条动画
            const currentProgress = Math.min(95, 5 + attempts * 2)
            setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: currentProgress } : f))

            if (j && j.ok) {
                const finalTime = Date.now() - currentStartTime // 计算最终耗时
                
                // 完成！跳转
                setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "completed", progress: 100 } : f))
                const navigateUrl = `/pdf-ocr-editor?docUrl=${encodeURIComponent(j.docUrl)}&docName=${encodeURIComponent(j.docName)}&fileUrl=${encodeURIComponent(data.localUrl)}&callbackUrl=${encodeURIComponent(j.callbackUrl)}&agentUserId=${encodeURIComponent(data.agentUserId)}&taskId=${encodeURIComponent(data.taskId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}&elapsedTime=${finalTime}`
                
                // 如果是批量处理，通常不自动跳转，或者只跳转第一个。这里为了演示，只跳转最后一个完成的，实际业务中可能需要优化
                if (uploadedFiles.length === 1) {
                    router.push(navigateUrl)
                }
                return
            }
            
            if (attempts < maxAttempts) {
                setTimeout(poll, pollIntervalMs)
            } else {
                 setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "error" } : f))
            }
        } catch {
             // ... 错误处理逻辑
        }
    }
    poll()
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }
  
  // 计算有多少文件准备好了
  const readyCount = uploadedFiles.filter(f => f.status === 'ready').length

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* 头部标题区域 */}
      <div className="relative overflow-hidden rounded-2xl bg-primary/5 p-8 md:p-12 text-center lg:text-left lg:flex lg:items-center lg:justify-between gap-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-primary/5 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 mb-4">
            ✨ 全新升级
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mb-4">
            智能文档解析中心
          </h1>
          <p className="text-lg text-muted-foreground">
            基于先进 AI 引擎，精准提取文档中的结构化数据。支持 PDF、Word 等多种格式，一键上传，即刻解析。
          </p>
        </div>
        <div className="relative z-10 mt-8 lg:mt-0 flex gap-4 justify-center lg:justify-end">
             <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-xl backdrop-blur-sm border shadow-sm">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium">极速响应</span>
             </div>
             <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-xl backdrop-blur-sm border shadow-sm">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium">深度理解</span>
             </div>
             <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-xl backdrop-blur-sm border shadow-sm">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium">精准提取</span>
             </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：上传主区域 */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-2 border-dashed border-muted-foreground/20 shadow-sm hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-0">
              <div
                className={cn(
                  "flex flex-col items-center justify-center min-h-[400px] p-10 text-center transition-colors rounded-xl",
                  dragActive ? "bg-primary/5" : "bg-card"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">点击或拖拽上传文档</h3>
                <p className="text-muted-foreground max-w-sm mb-8">
                  文档上传后需在右侧点击“开始解析”
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="px-8 font-semibold shadow-sm"
                >
                  选择本地文件
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：配置与控制台 - 这里的 UI 做了重大升级 */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="flex flex-col h-full border-none shadow-md bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                解析控制台
              </CardTitle>
              <CardDescription>配置 AI 模型并启动任务</CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 space-y-6">
              {/* 模型选择区 */}
              <div className="space-y-3">
                 <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-muted-foreground ml-1">选择解析引擎</Label>
                    {/* 显示计时器 */}
                    {startTime && (
                        <Badge variant="outline" className="font-mono text-primary border-primary animate-pulse">
                            ⏱ {formatTime(elapsedTime)}
                        </Badge>
                    )}
                 </div>
                 <RadioGroup
                    value={useLargeModel ? "large" : "small"}
                    onValueChange={handleModelChange}
                    className="grid grid-cols-1 gap-3"
                    // 如果正在处理中，禁用修改模型
                    disabled={isBatchProcessing} 
                  >
                    <div 
                        className={cn(
                        "flex items-center justify-between space-x-2 border p-4 rounded-lg cursor-pointer transition-all hover:bg-accent",
                        !useLargeModel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-muted"
                        )}
                        onClick={() => handleModelChange("small")}
                    >
                      <RadioGroupItem value="small" id="model-small" />
                      <Label htmlFor="model-small" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 font-semibold">
                            <Rocket className="w-4 h-4 text-blue-500" /> 极速模式
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">毫秒级响应，适合简单文档</div>
                      </Label>
                    </div>

                    <div 
                        className={cn(
                        "flex items-center justify-between space-x-2 border p-4 rounded-lg cursor-pointer transition-all hover:bg-accent",
                        useLargeModel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-muted"
                        )}
                        onClick={() => handleModelChange("large")}
                    >
                      <RadioGroupItem value="large" id="model-large" />
                      <Label htmlFor="model-large" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 font-semibold">
                            <Brain className="w-4 h-4 text-purple-500" /> 深度解析 (DeepSeek)
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">AI 语义理解，处理复杂表格</div>
                      </Label>
                    </div>
                  </RadioGroup>
              </div>

              {/* 提示词输入 - 带有动画效果 */}
              <div className={cn(
                "transition-all duration-500 ease-in-out overflow-hidden space-y-2",
                useLargeModel ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
              )}>
                 <Label className="text-xs text-muted-foreground ml-1">自定义 Prompt</Label>
                 <Textarea
                  placeholder="输入提示词..."
                  className="font-mono text-xs bg-background/50 resize-none h-24"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isBatchProcessing}
                />
              </div>

            </CardContent>

            {/* 底部：巨大的开始按钮 */}
            <CardFooter className="pt-2 pb-6">
                <Button 
                    size="lg" 
                    className={cn(
                        "w-full text-lg h-14 shadow-lg transition-all duration-300",
                        isBatchProcessing ? "opacity-80" : "hover:scale-[1.02] hover:shadow-primary/25"
                    )}
                    onClick={handleStartProcessing}
                    disabled={readyCount === 0 || isBatchProcessing}
                >
                    {isBatchProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            正在解析 {uploadedFiles.filter(f=>f.status==='processing').length} 个文档...
                        </>
                    ) : (
                        <>
                            <Play className="mr-2 h-5 w-5 fill-current" />
                            开始解析 {readyCount > 0 ? `(${readyCount})` : ''}
                        </>
                    )}
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* 底部文件列表 - 状态展示优化 */}
      {uploadedFiles.length > 0 && (
        <div ref={fileListRef} className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                文档列表
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {uploadedFiles.map((file) => (
                    <Card key={file.id} className={cn(
                        "group relative overflow-hidden transition-all duration-500",
                        file.status === 'processing' ? "ring-2 ring-primary/20 shadow-lg scale-[1.02] bg-primary/5" : "hover:shadow-md bg-card/50"
                    )}>
                        {/* 背景流光动画 */}
                        {file.status === 'processing' && (
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -skew-x-12 translate-x-[-200%] animate-[shimmer_1.5s_infinite]" />
                        )}
                        
                        <CardContent className="p-4 flex items-start gap-3 relative z-10">
                            {/* 图标根据状态变化 */}
                            <div className={cn("p-2 rounded-xl transition-all duration-300 shadow-sm", 
                                file.status === 'ready' ? "bg-blue-500/10 text-blue-600" : 
                                file.status === 'processing' ? "bg-primary/10 text-primary scale-110" : 
                                file.status === 'completed' ? "bg-green-500/10 text-green-600" :
                                "bg-muted text-muted-foreground"
                            )}>
                                {file.status === 'processing' ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : file.status === 'ready' ? (
                                    <CheckCircle className="w-6 h-6" />
                                ) : file.status === 'completed' ? (
                                    <CheckCircle className="w-6 h-6" />
                                ) : (
                                    <FileText className="w-6 h-6" />
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex justify-between items-start">
                                    <p className="font-medium truncate pr-2 text-sm" title={file.name}>{file.name}</p>
                                    <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all duration-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                    
                                    {/* 状态徽章 */}
                                    {file.status === "uploading" && <Badge variant="outline" className="text-[10px] h-5">上传中...</Badge>}
                                    {file.status === "ready" && <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200/50 text-[10px] h-5 shadow-none">等待解析</Badge>}
                                    {file.status === "processing" && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5 shadow-none animate-pulse">解析中 {file.progress}%</Badge>}
                                    {file.status === "completed" && <Badge className="bg-green-500/10 text-green-700 border-green-200/50 text-[10px] h-5 shadow-none">已完成</Badge>}
                                    {file.status === "error" && <Badge variant="destructive" className="text-[10px] h-5">失败</Badge>}
                                </div>
                                
                                {/* 进度条：只在处理中或上传中显示 */}
                                <div className={cn(
                                    "h-1 w-full bg-muted rounded-full overflow-hidden transition-all duration-300",
                                    (file.status === "processing" || file.status === "uploading") ? "opacity-100 mt-2" : "opacity-0 h-0 mt-0"
                                )}>
                                    <div 
                                        className="h-full bg-primary transition-all duration-300 ease-out"
                                        style={{ width: `${file.progress}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
      )}
    </div>
  )
}