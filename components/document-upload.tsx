"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Globe,
  X,
  Settings,
  Zap,
  Clock,
  Brain,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
}

const supportedFormats = [
  { type: "PDF", icon: FileText, description: "PDF文档（文本型、扫描件、混合型）" },
  { type: "Word", icon: FileText, description: "Word文档（.doc, .docx）" },
]

const processingTemplates = [
  { id: "contract", name: "合同文档", description: "专门用于合同条款和法律文档的解析" },
  { id: "report", name: "研究报告", description: "学术论文和研究报告的结构化分析" },
  { id: "financial", name: "财务文档", description: "财务报表和会计文档的数据提取" },
  { id: "technical", name: "技术文档", description: "技术规范和API文档的解析" },
  { id: "general", name: "通用模板", description: "适用于各种类型文档的通用解析" },
]

export function DocumentUpload() {
  const router = useRouter()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("general")
  const [extractionSettings, setExtractionSettings] = useState({
    enableEntityExtraction: true,
    enableRelationExtraction: true,
    enableKnowledgeGraph: true,
    confidenceThreshold: 0.8,
    customInstructions: "",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState("")
  const [processingProgress, setProcessingProgress] = useState(0)
  const [useLargeModel, setUseLargeModel] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    try {
      const v = localStorage.getItem("useLargeModel")
      setUseLargeModel(v === "1")
    } catch {}
  }, [])

  const handleToggleLargeModel = (checked: boolean) => {
    setUseLargeModel(checked)
    try {
      localStorage.setItem("useLargeModel", checked ? "1" : "0")
    } catch {}
    toast({
      title: checked ? "已启用大模型" : "已切换为小模型",
      description: checked ? "更高质量，处理时间更长" : "更快速度，结果较为简略",
    })
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

  const handleFiles = async (files: FileList) => {
    // 默认用户ID，实际应用中应该从登录状态获取
    const agentUserId = "123";
    // 不再传递taskId，让后端自动生成顺序编号

    for (const file of Array.from(files)) {
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
      }

      // 上传到后端，保存到基于用户ID和任务ID的目录结构
      const formData = new FormData()
      formData.append('file', file)
      formData.append('agentUserId', agentUserId)
      formData.append('useLargeModel', useLargeModel ? '1' : '0')
      // 不再传递taskId，让后端自动生成顺序编号

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('上传失败')
        const data = await res.json()

        try {
          await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task_id: data.taskId,
              status: 2,
              agentUserId: agentUserId,
              file_name: data.fileName,
              input_file_path: '/home/cqj/my-doc-system-uploads/upload',
              output_file_path: '/home/cqj/my-doc-system-uploads/save',
              use_large_model: useLargeModel,
              model_size: useLargeModel ? 'large' : 'small'
            })
          })
        } catch {}

        setIsProcessing(true)
        setProcessingMessage(useLargeModel ? '已启用大模型处理，正在后台生成可编辑文档...' : '任务已提交，正在后台处理...')
        setProcessingProgress(5)

        const pollIntervalMs = useLargeModel ? 4000 : 3000
        let attempts = 0
        const maxAttempts = useLargeModel ? 80 : 40

        const poll = async () => {
          attempts++
          try {
            const params = new URLSearchParams({
              agentUserId: agentUserId,
              taskId: data.taskId,
              fileName: data.fileName
            })
            const r = await fetch(`/api/onlyoffice-docurl?${params.toString()}`)
            const j = await r.json()
            if (j && j.ok) {
              setIsProcessing(false)
              // 对于所有文件类型，都使用原始文件URL作为fileUrl
              const navigateUrl = `/pdf-ocr-editor?docUrl=${encodeURIComponent(j.docUrl)}&docName=${encodeURIComponent(j.docName)}&fileUrl=${encodeURIComponent(data.localUrl)}&callbackUrl=${encodeURIComponent(j.callbackUrl)}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(data.taskId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}`
              router.push(navigateUrl)
              return
            }
            if (j && j.processing) {
              setProcessingMessage(j.message || '文档处理中...')
              setProcessingProgress(Math.min(95, 5 + attempts * 2))
              if (attempts < maxAttempts) setTimeout(poll, pollIntervalMs)
              else {
                setIsProcessing(false)
                // 对于所有文件类型，都使用原始文件URL作为fileUrl
                const navigateUrl = `/pdf-ocr-editor?fileUrl=${encodeURIComponent(data.localUrl)}&docName=${encodeURIComponent(data.fileName)}&fileName=${encodeURIComponent(newFile.name)}&callbackUrl=${encodeURIComponent('/api/onlyoffice-callback')}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(data.taskId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}`
                router.push(navigateUrl)
              }
              return
            }
            setIsProcessing(false)
            // 对于所有文件类型，都使用原始文件URL作为fileUrl
            const navigateUrl = `/pdf-ocr-editor?fileUrl=${encodeURIComponent(data.localUrl)}&docName=${encodeURIComponent(data.fileName)}&fileName=${encodeURIComponent(newFile.name)}&callbackUrl=${encodeURIComponent('/api/onlyoffice-callback')}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(data.taskId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}`
            router.push(navigateUrl)
          } catch {
            if (attempts < maxAttempts) {
              setTimeout(poll, pollIntervalMs)
            } else {
              setIsProcessing(false)
              // 对于所有文件类型，都使用原始文件URL作为fileUrl
              const navigateUrl = `/pdf-ocr-editor?fileUrl=${encodeURIComponent(data.localUrl)}&docName=${encodeURIComponent(data.fileName)}&fileName=${encodeURIComponent(newFile.name)}&callbackUrl=${encodeURIComponent('/api/onlyoffice-callback')}&agentUserId=${encodeURIComponent(agentUserId)}&taskId=${encodeURIComponent(data.taskId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}`
              router.push(navigateUrl)
            }
          }
        }
        // 立即开始轮询，不再等待3秒
        poll()
      } catch (e) {
        const blobUrl = URL.createObjectURL(file)
        const navigateUrl = `/pdf-ocr-editor?docUrl=${encodeURIComponent(blobUrl)}&fileUrl=${encodeURIComponent(blobUrl)}&docName=${encodeURIComponent(newFile.name)}&fileName=${encodeURIComponent(newFile.name)}&agentUserId=${encodeURIComponent(agentUserId)}&model=${encodeURIComponent(useLargeModel ? 'large' : 'small')}`
        router.push(navigateUrl)
      }
    }
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return FileText
    if (type.includes("word") || type.includes("document") || type.includes("doc")) return FileText
    return FileText
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="p-6 space-y-6">
      {isProcessing && (
        <div className="fixed inset-0 bg-muted/30 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-lg border w-full max-w-md">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center space-y-1 w-full">
              <h3 className="font-semibold text-lg text-foreground">正在处理文档</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {processingMessage || '请稍候...'}
              </p>
              <Progress value={processingProgress} className="w-full" />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">文档上传与处理</h1>
          <p className="text-muted-foreground mt-1">支持多种格式的智能文档解析和信息抽取</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20">
            <Zap className="w-3 h-3 mr-1" />
            AI 增强处理
          </Badge>
          <div className="flex items-center space-x-2">
            <Switch checked={useLargeModel} onCheckedChange={handleToggleLargeModel} disabled={isProcessing} />
            <span className="text-sm text-muted-foreground">{useLargeModel ? "大模型（高质量）" : "小模型（快速）"}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">文档上传</TabsTrigger>
          <TabsTrigger value="settings">处理设置</TabsTrigger>
          <TabsTrigger value="queue">处理队列</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Supported Formats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>支持的文档格式</span>
              </CardTitle>
              <CardDescription>系统支持多种文档格式的智能解析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {supportedFormats.map((format, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                    <format.icon className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground">{format.type}</h4>
                      <p className="text-sm text-muted-foreground">{format.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>上传文档</CardTitle>
              <CardDescription>拖拽文件到此区域或点击选择文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">上传您的文档</h3>
                <p className="text-muted-foreground mb-4">支持 PDF、Word 文档等多种格式</p>
                <Button
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="bg-primary hover:bg-primary/90"
                >
                  选择文件
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
                <p className="text-xs text-muted-foreground mt-2">最大文件大小: 100MB</p>
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>上传的文件</CardTitle>
                <CardDescription>文件处理状态和结果</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadedFiles.map((file) => {
                    const FileIcon = getFileIcon(file.type)
                    return (
                      <div key={file.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <FileIcon className="w-8 h-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-foreground truncate">{file.name}</h4>
                            <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{formatFileSize(file.size)}</p>

                          <div className="flex items-center space-x-4 mb-2">
                            {file.status === "uploading" && (
                              <>
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className="text-sm text-blue-600">上传中...</span>
                              </>
                            )}
                            {file.status === "processing" && (
                              <>
                                <Brain className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm text-yellow-600">AI 解析中...</span>
                              </>
                            )}
                            {file.status === "completed" && (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-green-600">处理完成</span>
                              </>
                            )}
                            {file.status === "error" && (
                              <>
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm text-red-600">处理失败</span>
                              </>
                            )}
                          </div>

                          <Progress value={file.progress} className="h-2 mb-2" />

                          {file.status === "completed" && (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <span>实体: {file.extractedEntities}</span>
                                <span>关系: {file.extractedRelations}</span>
                                <span>用时: {file.processingTime}</span>
                              </div>

                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-primary" />
                <span>处理模板</span>
              </CardTitle>
              <CardDescription>选择适合您文档类型的预设处理模板</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {processingTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          selectedTemplate === template.id ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}
                      />
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>抽取设置</CardTitle>
              <CardDescription>配置信息抽取和知识图谱构建参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="entity-extraction"
                    checked={extractionSettings.enableEntityExtraction}
                    onCheckedChange={(checked) =>
                      setExtractionSettings((prev) => ({
                        ...prev,
                        enableEntityExtraction: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="entity-extraction">启用实体抽取</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="relation-extraction"
                    checked={extractionSettings.enableRelationExtraction}
                    onCheckedChange={(checked) =>
                      setExtractionSettings((prev) => ({
                        ...prev,
                        enableRelationExtraction: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="relation-extraction">启用关系抽取</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="knowledge-graph"
                    checked={extractionSettings.enableKnowledgeGraph}
                    onCheckedChange={(checked) =>
                      setExtractionSettings((prev) => ({
                        ...prev,
                        enableKnowledgeGraph: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="knowledge-graph">构建知识图谱</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confidence">置信度阈值</Label>
                <Select
                  value={extractionSettings.confidenceThreshold.toString()}
                  onValueChange={(value) =>
                    setExtractionSettings((prev) => ({
                      ...prev,
                      confidenceThreshold: Number.parseFloat(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.6">0.6 - 较低（更多结果）</SelectItem>
                    <SelectItem value="0.7">0.7 - 中等</SelectItem>
                    <SelectItem value="0.8">0.8 - 较高（推荐）</SelectItem>
                    <SelectItem value="0.9">0.9 - 很高（精确结果）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-instructions">自定义抽取指令</Label>
                <Textarea
                  id="custom-instructions"
                  placeholder="输入特定的抽取要求或关注点..."
                  value={extractionSettings.customInstructions}
                  onChange={(e) =>
                    setExtractionSettings((prev) => ({
                      ...prev,
                      customInstructions: e.target.value,
                    }))
                  }
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>


        </TabsContent>

        <TabsContent value="queue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>处理队列状态</CardTitle>
              <CardDescription>当前系统处理能力和队列状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">12</div>
                  <div className="text-sm text-muted-foreground">等待处理</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">3</div>
                  <div className="text-sm text-muted-foreground">正在处理</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">847</div>
                  <div className="text-sm text-muted-foreground">已完成</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
