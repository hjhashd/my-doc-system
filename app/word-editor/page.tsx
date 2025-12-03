"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, RefreshCw, AlertCircle, Edit3, Layout, PanelLeft, PanelRight, ChevronLeft } from "lucide-react"
import http from '@/lib/http'
import { OnlyOfficeEditor as OnlyOfficeEditorComponent } from "@/app/pdf-ocr-editor/components/OnlyOfficeEditor"
import { PDFViewer } from "@/app/pdf-ocr-editor/components/PDFViewer"

// 添加Window的Api属性类型声明
declare global {
  interface Window {
    Api?: any;
  }
}

export default function WordEditorPage() {
  const searchParams = useSearchParams()
  const [fileData, setFileData] = useState({ fileName: "", fileUrl: "" })
  const [docUrl, setDocUrl] = useState("")
  const [docName, setDocName] = useState("")
  const [callbackUrl, setCallbackUrl] = useState("/onlyoffice-callback")
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'editor'>('editor')
  const [apiError, setApiError] = useState<string | null>(null)
  const [docStatusMessage, setDocStatusMessage] = useState("")
  const [isPolling, setIsPolling] = useState(false)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // 移除不需要的编辑器引用状态
  
  const [elapsedTime, setElapsedTime] = useState<string | null>(null)
  
  // 保存文档功能
  const handleSaveDocument = () => {
    window.dispatchEvent(new CustomEvent('onlyoffice-force-save'))
    setDocStatusMessage('文档已保存')
    setTimeout(() => setDocStatusMessage(''), 3000)
  }
  
  // 在组件卸载时清理
  useEffect(() => {
    return () => {
      // 清理编辑器实例
      window.dispatchEvent(new CustomEvent('onlyoffice-force-save'))
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')

  // 处理文件名，确保显示原始文件名
  const getOriginalFileName = (fileName: string): string => {
    // 如果文件名包含_res，说明是处理后的文件，需要提取原始文件名
    if (fileName.includes('_res.')) {
      // 提取原始文件名部分（去掉_res）
      const parts = fileName.split('_res.');
      if (parts.length >= 2) {
        // 如果是PDF文件，确保扩展名是.pdf
        if (isPdfFile) {
          return `${parts[0]}.pdf`;
        }
        return `${parts[0]}.${parts[1]}`;
      }
    }
    
    // 如果是处理后的docx文件，但应该是PDF文件，则显示原始PDF文件名
    if (fileName.endsWith('.docx') && isPdfFile) {
      return fileName.replace('.docx', '.pdf');
    }
    
    return fileName;
  };

  // 移除PDF-DOCX联动逻辑，因为不再需要分屏功能
  useEffect(() => {
    const params = {
      fileName: searchParams.get('fileName') || "",
      fileUrl: searchParams.get('fileUrl') || "",
      docUrl: searchParams.get('docUrl') || "",
      docName: searchParams.get('docName') || "",
      callbackUrl: searchParams.get('callbackUrl') || "/onlyoffice-callback",
      localUrl: searchParams.get('localUrl') || "",
      agentUserId: searchParams.get('agentUserId') || "",
      taskId: searchParams.get('taskId') || ""
    }
    
    // 获取耗时参数
    const timeParam = searchParams.get('elapsedTime')
    if (timeParam) {
        const ms = parseInt(timeParam)
        if (!isNaN(ms)) {
            setElapsedTime((ms / 1000).toFixed(1) + "s")
        }
    }

    const finalFileName = params.fileName || params.docName || (params.docUrl ? params.docUrl.split('/').pop() || "未命名文档" : "未命名文档")
    
    let originalFileUrl = params.fileUrl || params.localUrl
    
    if (!originalFileUrl && params.agentUserId && params.taskId && finalFileName) {
      const publicBase = process.env.NEXT_PUBLIC_BASE_URL as string || ''
      originalFileUrl = `${publicBase}/upload/${params.agentUserId}/${params.taskId}/${encodeURIComponent(finalFileName)}`
    }
    const finalFileUrl = originalFileUrl || `/files/upload/dummy.pdf`

    setFileData({ fileName: finalFileName, fileUrl: finalFileUrl })

    const fetchDocUrl = async () => {
      try {
        setApiError(null)
        if (params.agentUserId && params.taskId) {
          setIsPolling(true)
          let attempts = 0
          const maxAttempts = 30
          
          const poll = async () => {
            attempts++
            try {
              const res = await http.get('/api/onlyoffice-docurl', {
                params: {
                  agentUserId: params.agentUserId,
                  taskId: params.taskId,
                  fileName: params.fileName
                }
              })

              if (res?.ok) {
                setDocUrl(res.docUrl || '')
                setDocName(res.docName || '')  // 使用虚拟名称
                setCallbackUrl(res.callbackUrl || params.callbackUrl)
                
                // 默认使用编辑模式
                setViewMode('editor')
                
                setIsPolling(false)
                setIsLoading(false)
                return
              } 
              
              if (res?.processing) {
                setDocStatusMessage(res.message || '正在智能处理文档...')
                if (attempts < maxAttempts) {
                  pollingIntervalRef.current = setTimeout(poll, 3000)
                } else {
                  setApiError('文档处理超时，请检查后端服务')
                  setIsPolling(false)
                  setIsLoading(false)
                }
              } else {
                setApiError(res?.message || '获取文档失败')
                setIsPolling(false)
                setIsLoading(false)
              }
            } catch (err) {
              console.error('轮询失败:', err)
              if (attempts < maxAttempts) pollingIntervalRef.current = setTimeout(poll, 3000)
              else {
                setApiError('网络连接不稳定，请重试')
                setIsPolling(false)
                setIsLoading(false)
              }
            }
          }
          await poll()
        } else {
          setDocUrl(params.docUrl)
          setDocName(params.docName || (params.docUrl ? params.docUrl.split('/').pop() || "" : ""))
          // 始终使用编辑模式
          setViewMode('editor')
          setIsLoading(false)
        }
      } catch (err) {
        console.error('加载失败:', err)
        setApiError('初始化失败')
        setIsLoading(false)
      }
    }

    fetchDocUrl()
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-muted/30">
        <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-lg border">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg text-foreground">正在准备工作台</h3>
            <p className="text-sm text-muted-foreground">
              {isPolling ? docStatusMessage || '正在进行智能解析...' : '正在加载资源...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (apiError) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted/30">
        <Card className="w-full max-w-md shadow-xl border-destructive/20">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">出错了</h3>
              <p className="text-muted-foreground text-sm px-4">{apiError}</p>
            </div>
            <Button onClick={() => window.location.reload()} className="gap-2 pl-4 pr-5">
              <RefreshCw className="w-4 h-4" />
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 简单的顶部导航栏 - 仿照 excel-editor */}
      <header className="h-14 border-b flex items-center px-4 bg-white shrink-0 justify-between">
        <div className="flex items-center gap-4">
            <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.close()} 
            className="gap-2 text-muted-foreground hover:text-foreground"
            >
            <ChevronLeft className="w-4 h-4" />
            返回
            </Button>
            
            <div className="h-6 w-px bg-border/60 mx-2"></div>
            
            <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{getOriginalFileName(fileData.fileName)}</span>
                {elapsedTime && (
                  <Badge variant="secondary" className="ml-2 text-xs font-normal h-5">
                    耗时 {elapsedTime}
                  </Badge>
                )}
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {/* 编辑模式按钮 */}
            <div className="flex bg-muted/50 p-1 rounded-lg border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setViewMode('editor')
                    window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
                }}
                className={`h-7 px-3 text-xs gap-1.5 rounded-md transition-all bg-white text-primary shadow-sm font-medium`}
              >
                <PanelRight className="w-3.5 h-3.5" />
                编辑
              </Button>
            </div>
        </div>
      </header>

      {/* 工作区内容 */}
      <main className="flex-1 overflow-hidden bg-muted/30 p-2">
        <div className="h-full w-full">
          {/* 只保留编辑模式 */}
          <div className="h-full bg-white rounded-lg border overflow-hidden">
            {(!docUrl) ? (
              <div className="h-full flex items-center justify-center bg-muted/20">
                <div className="text-center space-y-4">
                   <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                   <p className="text-sm text-muted-foreground">正在生成文档...</p>
                </div>
              </div>
            ) : (
              <OnlyOfficeEditorComponent 
                docUrl={docUrl}
                docName={docName || getOriginalFileName(fileData.fileName)}
                callbackUrl={callbackUrl || ''}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
