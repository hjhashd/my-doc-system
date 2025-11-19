"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  FileText, 
  Download, 
  Save, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Edit3,
  Maximize2,
  Minimize2,
  Loader2
} from "lucide-react"
import http from '@/lib/http'

interface PDFPreviewProps {
  fileUrl: string
  fileName: string
}

interface OnlyOfficeEditorProps {
  docUrl: string
  docName?: string
  callbackUrl?: string
}



function PDFPreview({ fileUrl, fileName }: PDFPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100) // 恢复默认缩放比例为100%
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 加载状态处理
  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError("无法加载PDF文件，请检查文件是否有效")
  }

  // 重新加载
  const handleReload = () => {
    setIsLoading(true)
    setError(null)
    if (iframeRef.current) {
      iframeRef.current.src = fileUrl
    }
  }

  // 缩放控制
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25))
  }

  const handleZoomReset = () => {
    setZoom(100) // 重置为默认100%
  }

  // 旋转控制
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  // 全屏切换
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 更新iframe参数
  useEffect(() => {
    if (iframeRef.current && fileUrl) {
      const pdfUrl = `${fileUrl}#zoom=${zoom}&rotation=${rotation}`
      iframeRef.current.src = pdfUrl
    }
  }, [fileUrl, zoom, rotation])

  return (
    <Card className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className={`${isFullscreen ? 'flex-shrink-0' : ''} pb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">PDF 预览</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">{zoom}%</span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            {error && (
              <Button variant="outline" size="sm" onClick={handleReload}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden" ref={containerRef}>
        <div className="relative w-full h-full bg-white">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">正在加载PDF...</p>
              </div>
            </div>
          )}
          
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <Button onClick={handleReload} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                重新加载
              </Button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={fileUrl}
              className="w-full h-full border-0"
              title={`PDF预览: ${fileName}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ 
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.3s ease',
                minHeight: '100%'
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function OnlyOfficeEditor({ docUrl, docName, callbackUrl }: OnlyOfficeEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const editorRef = useRef<any>(null)
  const makeKeyFromUrl = (url: string) => {
    let h = 0
    for (let i = 0; i < url.length; i++) {
      h = (h * 31 + url.charCodeAt(i)) >>> 0
    }
    return h.toString(36)
  }

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    if (!docUrl) {
      setError('缺少文档URL（docUrl）')
      setIsLoading(false)
      return
    }

    const fileExt = docUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || 'docx'
    const title = docName || docUrl.split('/').pop() || `文档-${Date.now()}`
    const cbUrl = callbackUrl || '/onlyoffice-callback'

    // --- 开始：添加这段新逻辑 ---

    // 1. 定义可编辑的类型
    const EDITABLE_TYPES = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt']
    // 2. 检查当前文件是否可编辑
   const isEditable = EDITABLE_TYPES.includes(fileExt);
// [!! 修复 !!] 确保 PDF 也使用 'edit' 模式来触发转换
const editorMode = (isEditable || fileExt === 'pdf') ? 'edit' : 'view';

    // 4. 动态设置编辑器类型
    let docType = 'word'; // 默认是 Word
    if (['xlsx', 'xls', 'csv'].includes(fileExt)) {
      docType = 'spreadsheet';
    } else if (['pptx', 'ppt'].includes(fileExt)) {
      docType = 'presentation';
    }
    // --- 结束：新逻辑 ---
    
    const init = () => {
      try {
        // @ts-ignore
        const DocsAPI = (window as any).DocsAPI
        if (!DocsAPI) {
          setError('OnlyOffice API 未加载')
          setIsLoading(false)
          return
        }
        if (editorRef.current && typeof editorRef.current.destroyEditor === 'function') {
          editorRef.current.destroyEditor()
          editorRef.current = null
        }
        
        // 确保文档URL和回调URL都是公网可访问的
        const publicDocUrl = docUrl.startsWith('http') ? docUrl : `${window.location.origin}${docUrl}`
        
        // 修复回调URL，确保它使用正确的主机地址
        let publicCallbackUrl = callbackUrl.startsWith('http') ? callbackUrl : `${window.location.origin}${callbackUrl}`
        
        // 如果回调URL是相对路径，确保使用当前页面的协议和主机
        if (!publicCallbackUrl.startsWith('http')) {
          publicCallbackUrl = `${window.location.protocol}//${window.location.host}${callbackUrl}`
        }
        
        // 添加调试日志
        console.log('OnlyOffice Editor Config:', {
          docUrl: publicDocUrl,
          callbackUrl: publicCallbackUrl,
          windowLocation: {
            origin: window.location.origin,
            host: window.location.host,
            hostname: window.location.hostname,
            protocol: window.location.protocol
          }
        })
        
       const config = {
        document: {
          fileType: fileExt,
          key: `doc-${makeKeyFromUrl(docUrl)}-${Date.now()}`, // 确保你有 makeKeyFromUrl 函数
          title,
          url: publicDocUrl // (这里就是我之前打错 "_" 符号的地方，保持这行原样)
        },
        documentType: docType, // <-- ★★★ 修改点 1：使用变量 docType
        editorConfig: {
          mode: editorMode, // <-- ★★★ 修改点 2：使用变量 editorMode
          callbackUrl: publicCallbackUrl,
          customization: {
            spellcheck: false, // 关闭拼写检查，避免文字下方出现红线
            review: {
              hideReviewDisplay: true, // 隐藏修订显示
              hideReviewChanges: false, // 保留修订功能但不在编辑时显示
              trackChanges: false, // 关闭修订跟踪
              hoverMode: false // 关闭悬停模式
            }
          }
        }
      };
        // @ts-ignore
        editorRef.current = new DocsAPI.DocEditor('onlyoffice-editor-container', config)
        setIsLoading(false)
      } catch (e: any) {
        setError(e?.message || String(e))
        setIsLoading(false)
      }
    }

    // 加载 DocsAPI 脚本（来源于文档服务器）
    // 如需修改地址，可通过 query 参数 docsApi 指定
   // 这段代码的意思是：如果浏览器地址栏是 192.168.3.10，我就去 192.168.3.10:8082 找服务
const defaultApi = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8082/web-apps/apps/api/documents/api.js`
    : 'http://localhost:8082/web-apps/apps/api/documents/api.js';
    
    const docsApi = defaultApi
    // 已加载则直接初始化
    // @ts-ignore
    if ((window as any).DocsAPI) {
      init()
      return
    }
    let scriptEl = document.querySelector('script[data-onlyoffice-api]') as HTMLScriptElement | null
    if (!scriptEl) {
      scriptEl = document.createElement('script')
      scriptEl.type = 'text/javascript'
      scriptEl.src = docsApi
      scriptEl.setAttribute('data-onlyoffice-api', 'true')
      scriptEl.onload = init
      scriptEl.onerror = () => {
        setError('无法加载 OnlyOffice API 脚本')
        setIsLoading(false)
      }
      document.head.appendChild(scriptEl)
    } else {
      scriptEl.addEventListener('load', init, { once: true })
    }

    return () => {
      try {
        if (editorRef.current && typeof editorRef.current.destroyEditor === 'function') {
          editorRef.current.destroyEditor()
        }
      } catch {}
      editorRef.current = null
    }
  }, [docUrl, docName, callbackUrl])

  return (
    <Card className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Word 文档编辑</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">OnlyOffice</Badge>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="relative w-full h-full bg-white">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">正在加载OnlyOffice编辑器...</p>
              </div>
            </div>
          )}
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
            </div>
          ) : (
            <div id="onlyoffice-editor-container" className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PDFOCREditorPage() {
  const searchParams = useSearchParams()
  const [fileData, setFileData] = useState({
    fileName: "",
    fileUrl: ""
  })
  const [docUrl, setDocUrl] = useState<string>("")
  const [docName, setDocName] = useState<string>("")
  const [callbackUrl, setCallbackUrl] = useState<string>("/onlyoffice-callback")
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'editor'>('split')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // 新增状态管理
  const [apiError, setApiError] = useState<string | null>(null)
  const [docStatus, setDocStatus] = useState<number | null>(null)
  const [docStatusMessage, setDocStatusMessage] = useState<string>("")
  const [isPolling, setIsPolling] = useState(false)
  
  // 新增一个判断：使用原始文件名判断是否为PDF
  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  
  // 新增一个判断：使用原始文件URL判断是否为PDF文件
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')
  
  // 监听侧边栏切换事件
  useEffect(() => {
    const handleToggleSidebar = () => {
      setSidebarCollapsed(prev => !prev)
    }

    window.addEventListener('toggleSidebar', handleToggleSidebar)
    
    return () => {
      window.removeEventListener('toggleSidebar', handleToggleSidebar)
    }
  }, [])

  // 从URL参数获取文件信息
    useEffect(() => {
      const fileName = searchParams.get('fileName') || ""
      const fileUrlParam = searchParams.get('fileUrl') || ""
      const docUrlParam = searchParams.get('docUrl') || ""
      const docNameParam = searchParams.get('docName') || (docUrlParam ? (docUrlParam.split('/').pop() || "") : "")
      const cbUrlParam = searchParams.get('callbackUrl') || "/onlyoffice-callback"
      const localUrlParam = searchParams.get('localUrl') || ""
      
      // 获取用户ID和任务ID参数
      const agentUserIdParam = searchParams.get('agentUserId') || ""
      const taskIdParam = searchParams.get('taskId') || ""
      
      // 如果没有文件名，但有docUrl，尝试从docUrl中提取文件名
      const finalFileName = fileName || docNameParam || (docUrlParam ? docUrlParam.split('/').pop() || "" : "")
      
      // 确定原始文件URL
      // 1. 优先使用URL参数中的fileUrl
      // 2. 如果没有，使用URL参数中的localUrl
      // 3. 如果都没有，尝试构建PDF文件URL
      let originalFileUrl = fileUrlParam || localUrlParam
      
      // 如果没有fileUrl和localUrl参数，尝试构建文件URL
      if (!originalFileUrl && agentUserIdParam && taskIdParam && finalFileName) {
        const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
        originalFileUrl = `${publicBase}/upload/${agentUserIdParam}/${taskIdParam}/${encodeURIComponent(finalFileName)}`
      }
      
      // 如果还是没有文件URL，使用默认的PDF文件
      const finalFileUrl = originalFileUrl || `/files/upload/dummy.pdf`

    setFileData({
      fileName: finalFileName,
      fileUrl: finalFileUrl
    })

    const tryFetchDocUrl = async () => {
      try {
        // 重置错误状态
        setApiError(null)
        
        if (agentUserIdParam && taskIdParam) {
          // 轮询获取文档URL，直到文档处理完成
          const pollForDocUrl = async () => {
            setIsPolling(true)
            let attempts = 0
            const maxAttempts = 30 // 最多轮询30次
            const pollInterval = 3000 // 每3秒轮询一次
            
            const poll = async (): Promise<void> => {
              attempts++
              
              try {
                const res = await http.get('/api/onlyoffice-docurl', {
                  params: {
                    agentUserId: agentUserIdParam,
                    taskId: taskIdParam,
                    fileName: fileName
                  }
                })

                if (res && res.ok) {
                  // 文档处理成功
                  setDocUrl(res.docUrl || '')
                  setDocName(res.docName || '')
                  setCallbackUrl(res.callbackUrl || cbUrlParam)
                  // 对于PDF文件，默认使用分屏视图，这样用户可以对照着编辑
                  // 使用文件URL判断是否为PDF，而不是仅依赖文件名
                  if (finalFileName.toLowerCase().endsWith('.pdf') || originalFileUrl.toLowerCase().includes('.pdf')) {
                    setViewMode('split')
                  } else {
                    setViewMode('editor')
                  }
                  setDocStatus(0)
                  setDocStatusMessage('文档处理成功')
                  setIsPolling(false)
                  setIsLoading(false) // 文档处理完成，设置加载完成
                  return
                } else if (res && res.processing) {
                  // 文档正在处理中
                  setDocStatus(res.status)
                  setDocStatusMessage(res.message || '文档处理中...')
                  setIsLoading(false) // 显示处理状态后，关闭初始加载状态
                  
                  // 继续轮询
                  if (attempts < maxAttempts) {
                    setTimeout(poll, pollInterval)
                  } else {
                    // 超过最大轮询次数
                    setApiError('文档处理超时，请稍后再试')
                    setIsPolling(false)
                    setIsLoading(false)
                  }
                } else {
                  // 其他错误
                  setApiError(res.message || '获取文档URL失败')
                  setIsPolling(false)
                  setIsLoading(false)
                }
              } catch (error) {
                console.error('轮询文档URL失败:', error)
                if (attempts >= maxAttempts) {
                  setApiError('无法获取文档URL，请检查网络连接')
                  setIsPolling(false)
                  setIsLoading(false)
                } else {
                  // 继续尝试
                  setTimeout(poll, pollInterval)
                }
              }
            }
            
            // 开始轮询
            await poll()
          }
          
          await pollForDocUrl()
        } else {
          // 没有agentUserId和taskId，使用默认处理
          setDocUrl(docUrlParam)
          setDocName(docNameParam)

          let finalCallbackUrl = cbUrlParam
          if (docNameParam) {
            finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}fileName=${encodeURIComponent(docNameParam)}`
          }
          if (agentUserIdParam) {
            finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}agentUserId=${encodeURIComponent(agentUserIdParam)}`
          }
          if (taskIdParam) {
            finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}taskId=${encodeURIComponent(taskIdParam)}`
          }
          setCallbackUrl(finalCallbackUrl)

          const isOfficeDoc = docNameParam.toLowerCase().endsWith('.docx') || 
                              docNameParam.toLowerCase().endsWith('.xlsx') || 
                              docNameParam.toLowerCase().endsWith('.pptx')
          setViewMode(isOfficeDoc ? 'editor' : 'split')
          setIsLoading(false) // 非轮询情况，直接设置加载完成
        }
      } catch (err) {
        console.error('获取文档URL失败:', err)
        setApiError(`获取文档URL失败: ${err instanceof Error ? err.message : String(err)}`)
        
        // 设置默认值作为后备
        setDocUrl(docUrlParam)
        setDocName(docNameParam)

        let finalCallbackUrl = cbUrlParam
        if (docNameParam) {
          finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}fileName=${encodeURIComponent(docNameParam)}`
        }
        if (agentUserIdParam) {
          finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}agentUserId=${encodeURIComponent(agentUserIdParam)}`
        }
        if (taskIdParam) {
          finalCallbackUrl += `${finalCallbackUrl.includes('?') ? '&' : '?'}taskId=${encodeURIComponent(taskIdParam)}`
        }
        setCallbackUrl(finalCallbackUrl)

        const isOfficeDoc = docNameParam.toLowerCase().endsWith('.docx') || 
                              docNameParam.toLowerCase().endsWith('.xlsx') || 
                              docNameParam.toLowerCase().endsWith('.pptx')
        setViewMode(isOfficeDoc ? 'editor' : 'split')
        setIsLoading(false) // 错误情况，设置加载完成
      }
    }

    tryFetchDocUrl()
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isPolling ? '正在处理文档，请稍候...' : '正在加载文档...'}
          </p>
          {isPolling && docStatusMessage && (
            <p className="text-sm text-muted-foreground mt-2">{docStatusMessage}</p>
          )}
        </div>
      </div>
    )
  }

  // 显示API错误
  if (apiError) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">加载失败</h3>
              <p className="text-muted-foreground mb-4">{apiError}</p>
              <Button onClick={() => window.location.reload()}>
                重新加载
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 简洁的页面头部 */}
      <div className="border-b px-4 md:px-6 py-4 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold text-gray-900">文档编辑器</h1>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {fileData.fileName}
            </Badge>
            
            {/* 显示文档处理状态 */}
            {isPolling && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                处理中: {docStatusMessage || '正在处理文档...'}
              </Badge>
            )}
            
            {/* 响应式视图切换按钮 */}
            <div className="flex items-center bg-gray-100 rounded-md p-1">
              <Button
                variant={viewMode === 'split' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('split')}
                className="h-7 px-2 text-xs"
              >
                分屏
              </Button>
              <Button
                variant={viewMode === 'pdf' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('pdf')}
                className="h-7 px-2 text-xs"
              >
                PDF
              </Button>
              <Button
                variant={viewMode === 'editor' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('editor')}
                className="h-7 px-2 text-xs"
              >
                编辑
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 响应式布局 */}
      <div className={`h-[calc(100vh-80px)] p-4 md:p-6 transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : ''}`}>
        <div className={`h-full ${sidebarCollapsed ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
          {/* 分屏视图 */}
          {viewMode === 'split' && (
            <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              
              {/* 左侧 - PDF预览区域 */}
              <div className="w-full lg:w-1/2 h-full transition-all duration-300 border-r border-gray-200 overflow-auto">
                
                {isPdf || isPdfFile ? (
                  // 如果是 PDF，显示原始PDF文件
                  <PDFPreview 
                    fileUrl={fileData.fileUrl} 
                    fileName={fileData.fileName}
                  />
                ) : (
                  // 如果不是 PDF (e.g. .docx)，显示转换后的docx文件
                  <Card className="h-full flex items-center justify-center bg-gray-50">
                    <CardContent className="text-center p-6">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg">不支持分屏预览</h3>
                      <p className="text-muted-foreground text-sm mt-2">此文件类型 (.docx) 无法在左侧预览。<br/>请使用 "编辑" 视图进行操作。</p>
                      {fileData.fileUrl && (
                        <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
                          <p>文件URL: {fileData.fileUrl}</p>
                          <p>文件名: {fileData.fileName}</p>
                          <p>isPdf: {isPdf.toString()}</p>
                          <p>isPdfFile: {isPdfFile.toString()}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 右侧 - OnlyOffice编辑器区域 */}
              <div className="w-full lg:w-1/2 h-full transition-all duration-300">
                {(isPdf || isPdfFile) && !docUrl ? (
                  // PDF分屏视图且docUrl未准备好时，显示提示
                  <Card className="h-full flex items-center justify-center bg-gray-50">
                    <CardContent className="text-center p-6">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">PDF 文档预览</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        左侧显示PDF文档预览，右侧将显示可编辑内容。
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  // 显示OnlyOffice编辑器（无论是PDF转换后的docx还是原始docx）
                  <OnlyOfficeEditor 
                    docUrl={docUrl}
                    docName={docName}
                    callbackUrl={callbackUrl}
                  />
                )}
              </div>
            </div>
          )}

          {/* 仅PDF视图 */}
          {viewMode === 'pdf' && (
            <div className="h-full">
              <PDFPreview 
                fileUrl={fileData.fileUrl} 
                fileName={fileData.fileName}
              />
            </div>
          )}

          {/* 仅编辑器视图 */}
          {viewMode === 'editor' && (
            <div className="h-full">
              <OnlyOfficeEditor 
                docUrl={docUrl}
                docName={docName}
                callbackUrl={callbackUrl}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
