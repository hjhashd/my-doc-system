"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  RefreshCw,
  AlertCircle,
  Edit3,
  Maximize2,
  Minimize2,
  Loader2,
  Layout,
  PanelLeft,
  PanelRight,
  ChevronLeft,
  Download,
  ArrowRight
} from "lucide-react"
import http from '@/lib/http'
import Link from "next/link"

// ==========================================
// 类型定义
// ==========================================
interface PDFPreviewProps {
  fileUrl: string
  fileName: string
}

interface OnlyOfficeEditorProps {
  docUrl: string
  docName?: string
  callbackUrl?: string
}

// ==========================================
// 组件：PDF 预览器 (左侧)
// ==========================================
function PDFPreview({ fileUrl, fileName }: PDFPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError("无法加载PDF文件，请检查文件是否有效")
  }

  const handleReload = () => {
    setIsLoading(true)
    setError(null)
    if (iframeRef.current) {
      iframeRef.current.src = fileUrl
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  useEffect(() => {
    if (iframeRef.current && fileUrl) {
      const pdfUrl = `${fileUrl}#zoom=${zoom}&rotation=${rotation}`
      iframeRef.current.src = pdfUrl
    }
  }, [fileUrl, zoom, rotation])

  return (
    <Card className={`h-full flex flex-col border-0 shadow-sm overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-xl ring-1 ring-border/50'}`}>
      {/* 顶部工具栏 - 模拟专业软件的Header */}
      <div className="h-12 px-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="p-1.5 bg-red-50 rounded-md text-red-600">
            <FileText className="w-4 h-4" />
          </div>
          <span className="truncate max-w-[200px] text-foreground" title={fileName}>PDF预览</span>
        </div>

        {/* 中间悬浮感工具条 */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/50">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleZoomOut}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-mono w-10 text-center text-muted-foreground select-none">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleZoomIn}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleRotate}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {error && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleReload}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 p-0 relative bg-muted/30 overflow-hidden group">
        {/* 背景点状纹理 - 增加层次感 */}
        <div className="absolute inset-0 opacity-[0.4]" 
             style={{ 
               backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', 
               backgroundSize: '20px 20px' 
             }} 
        />

        <div className="relative w-full h-full overflow-auto flex items-center justify-center p-6">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">正在渲染文档...</p>
            </div>
          )}
          
          {error ? (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg shadow-sm border max-w-sm">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="font-medium text-foreground mb-1">预览失败</h3>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleReload} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-3 h-3" /> 重试
              </Button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={fileUrl}
              className="w-full h-full bg-white shadow-lg transition-all duration-300 ease-out rounded-sm border border-border/50"
              title={`PDF预览: ${fileName}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ 
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center top',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==========================================
// 组件：OnlyOffice 编辑器 (右侧)
// ==========================================
function OnlyOfficeEditor({ docUrl, docName, callbackUrl }: OnlyOfficeEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isVisible, setIsVisible] = useState(true) // 新增：控制编辑器可见性
  const editorRef = useRef<any>(null)
  const instanceRef = useRef<any>(null) // 新增：缓存编辑器实例
  const initParamsRef = useRef<{docUrl: string, docName: string, callbackUrl: string} | null>(null) // 新增：缓存初始化参数

  const makeKeyFromUrl = (url: string) => {
    let h = 0
    for (let i = 0; i < url.length; i++) {
      h = (h * 31 + url.charCodeAt(i)) >>> 0
    }
    return h.toString(36)
  }

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  // 新增：初始化编辑器实例的函数（优化缓存）
  const initializeEditor = useCallback(() => {
    // 如果编辑器实例已存在，直接显示并返回
    if (instanceRef.current) {
      console.log('OnlyOffice: 编辑器实例已存在，直接显示')
      setIsLoading(false)
      
      // 确保编辑器iframe可见
      const container = document.getElementById('onlyoffice-editor-container')
      if (container) {
        const editorFrame = container.querySelector('iframe')
        if (editorFrame) {
          editorFrame.style.display = 'block'
        }
      }
      return
    }
    
    console.log('OnlyOffice: 开始初始化编辑器实例')
    setIsLoading(true)
    setError(null)

    if (!docUrl) {
      setError('缺少文档URL')
      setIsLoading(false)
      return
    }

    const fileExt = docUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || 'docx'
    const title = docName || docUrl.split('/').pop() || `文档-${Date.now()}`
    
    // 关键逻辑：PDF 使用 edit 模式触发转换，其他 Office 格式也用 edit
    const isEditable = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(fileExt)
    const editorMode = (isEditable || fileExt === 'pdf') ? 'edit' : 'view'
    
    let docType = 'word'
    if (['xlsx', 'xls', 'csv'].includes(fileExt)) docType = 'spreadsheet'
    else if (['pptx', 'ppt'].includes(fileExt)) docType = 'presentation'
    
    const init = () => {
      try {
        // @ts-ignore
        const DocsAPI = (window as any).DocsAPI
        if (!DocsAPI) {
          setError('OnlyOffice API 加载失败')
          setIsLoading(false)
          return
        }
        
        // 确保容器存在并清空
        const container = document.getElementById('onlyoffice-editor-container')
        if (!container) {
          console.error('OnlyOffice: 找不到编辑器容器')
          setError('找不到编辑器容器')
          setIsLoading(false)
          return
        }
        
        // 清空容器内容
        container.innerHTML = ''
        
        const publicDocUrl = docUrl.startsWith('http') ? docUrl : `${window.location.origin}${docUrl}`
        let publicCallbackUrl = callbackUrl?.startsWith('http') ? callbackUrl : `${window.location.origin}${callbackUrl}`
        if (!publicCallbackUrl?.startsWith('http')) {
          publicCallbackUrl = `${window.location.protocol}//${window.location.host}${callbackUrl}`
        }
        
        const config = {
          document: {
            fileType: fileExt,
            key: `doc-${makeKeyFromUrl(docUrl)}-${Date.now()}`,
            title,
            url: publicDocUrl,
            permissions: {
              comment: true,
              copy: true,
              download: true,
              edit: true,
              fillForms: true,
              modifyFilter: true,
              modifyContentControl: true,
              review: true,
              print: true,
              protect: false,
              rename: false,
            },
          },
          documentType: docType,
          editorConfig: {
            mode: editorMode,
            callbackUrl: publicCallbackUrl,
            lang: "zh-CN",
            customization: {
              // 界面定制：让它看起来更像我们系统的一部分
              compactHeader: true,
              toolbarNoTabs: false,
              forcesave: true,
              goback: false,
              chat: false,
              comments: true,
              zoom: 100,
              logo: {
                image: "",
                imageEmbedded: ""
              },
              // 禁用拼写和语法检查，去除文档中的红线
              spellcheck: false,
              // 禁用自动更正功能
              autosave: false,
              // 禁用插件
              plugins: false
            }
          },
          height: '100%',
          width: '100%'
        }
        
        // @ts-ignore
        const editor = new DocsAPI.DocEditor('onlyoffice-editor-container', config)
        
        // 保存编辑器实例引用到两个ref中确保缓存
        instanceRef.current = editor
        editorRef.current = editor
        console.log('OnlyOffice: 编辑器实例创建成功并缓存')
        
        setIsLoading(false)
      } catch (e: any) {
        console.error('OnlyOffice: 初始化失败', e)
        setError(e?.message || String(e))
        setIsLoading(false)
      }
    }

    const defaultApi = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8082/web-apps/apps/api/documents/api.js`
      : 'http://localhost:8082/web-apps/apps/api/documents/api.js'
    
    // @ts-ignore
    if ((window as any).DocsAPI) {
      init()
      return
    }
    
    let scriptEl = document.querySelector('script[data-onlyoffice-api]') as HTMLScriptElement | null
    if (!scriptEl) {
      scriptEl = document.createElement('script')
      scriptEl.type = 'text/javascript'
      scriptEl.src = defaultApi
      scriptEl.setAttribute('data-onlyoffice-api', 'true')
      scriptEl.onload = init
      scriptEl.onerror = () => {
        setError('无法连接到文档服务器，请检查网络或配置')
        setIsLoading(false)
      }
      document.head.appendChild(scriptEl)
    } else {
      scriptEl.addEventListener('load', init, { once: true })
    }
  }, [docUrl, docName, callbackUrl])

  // 修改：只在文档URL、名称或回调URL变化时重新初始化，而不是每次组件渲染都初始化
  useEffect(() => {
    // 检查是否需要重新初始化
    const currentParams = {docUrl, docName, callbackUrl}
    const prevParams = initParamsRef.current
    
    // 如果参数没有变化，不需要重新初始化
    if (prevParams && 
        prevParams.docUrl === currentParams.docUrl && 
        prevParams.docName === currentParams.docName && 
        prevParams.callbackUrl === currentParams.callbackUrl) {
      console.log('OnlyOffice: 参数未变化，跳过重新初始化')
      return
    }
    
    // 保存当前参数
    initParamsRef.current = currentParams
    
    // 只有在编辑器可见时才初始化
    if (isVisible) {
      console.log('OnlyOffice: 参数已变化，重新初始化编辑器')
      initializeEditor()
    }
  }, [docUrl, docName, callbackUrl]) // 移除isVisible依赖，避免视图切换时重新初始化

  // 新增：监听可见性变化
  useEffect(() => {
    if (isVisible && !instanceRef.current && initParamsRef.current) {
      // 如果编辑器变为可见但实例不存在，重新初始化
      console.log('OnlyOffice: 编辑器变为可见但实例不存在，重新初始化')
      initializeEditor()
    }
  }, [isVisible])

  // 新增：提供外部控制编辑器可见性的方法
  useEffect(() => {
    // 添加自定义事件监听器
    const handleVisibilityChange = (event: any) => {
      const newVisibility = event.detail.isVisible !== false
      console.log('OnlyOffice: 收到可见性变化事件', { from: isVisible, to: newVisibility })
      
      // 如果编辑器实例存在，只是改变可见性，不重新初始化
      if (instanceRef.current) {
        console.log('OnlyOffice: 编辑器实例已存在，仅改变可见性')
        setIsVisible(newVisibility)
        
        // 如果编辑器容器元素存在，直接控制其显示/隐藏
        const container = document.getElementById('onlyoffice-editor-container')
        if (container) {
          const editorFrame = container.querySelector('iframe')
          if (editorFrame) {
            // 直接控制iframe的可见性，而不是重新创建编辑器
            if (newVisibility) {
              editorFrame.style.display = 'block'
              console.log('OnlyOffice: 显示编辑器iframe')
            } else {
              editorFrame.style.display = 'none'
              console.log('OnlyOffice: 隐藏编辑器iframe')
            }
          }
        }
      } else {
        // 如果编辑器实例不存在，设置可见性状态，会触发初始化
        setIsVisible(newVisibility)
        console.log('OnlyOffice: 编辑器实例不存在，设置可见性状态')
      }
    }
    
    window.addEventListener('onlyoffice-visibility-change', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('onlyoffice-visibility-change', handleVisibilityChange)
      // 清理编辑器实例
      try {
        if (instanceRef.current?.destroyEditor) {
          instanceRef.current.destroyEditor()
        }
      } catch {}
      instanceRef.current = null
    }
  }, [isVisible])

  return (
    <Card className={`h-full flex flex-col border-0 shadow-sm overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-xl ring-1 ring-border/50'}`}>
      <div className="h-12 px-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
            <Edit3 className="w-4 h-4" />
          </div>
          <span className="text-foreground">文档编辑</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6 px-2 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/50">
            OnlyOffice 协作中
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      <CardContent className={`flex-1 p-0 relative bg-white`}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 backdrop-blur-[1px]">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
            <p className="text-xs font-medium text-muted-foreground animate-pulse">正在初始化编辑器...</p>
          </div>
        )}
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">编辑器加载失败</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">{error}</p>
          </div>
        ) : (
          <div 
            id="onlyoffice-editor-container" 
            className="w-full h-full"
            style={{ display: isVisible ? 'block' : 'none' }}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ==========================================
// 页面主组件
// ==========================================
export default function PDFOCREditorPage() {
  const searchParams = useSearchParams()
  const [fileData, setFileData] = useState({ fileName: "", fileUrl: "" })
  const [docUrl, setDocUrl] = useState("")
  const [docName, setDocName] = useState("")
  const [callbackUrl, setCallbackUrl] = useState("/onlyoffice-callback")
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'editor'>('split')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [docStatusMessage, setDocStatusMessage] = useState("")
  const [isPolling, setIsPolling] = useState(false)
  const [editorInitialized, setEditorInitialized] = useState(false) // 新增：跟踪编辑器是否已初始化
  
  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')
  
  // 监听 Sidebar 状态
  useEffect(() => {
    const handleToggleSidebar = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener('toggleSidebar', handleToggleSidebar)
    return () => window.removeEventListener('toggleSidebar', handleToggleSidebar)
  }, [])

  // 初始化数据加载
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

    // 智能推断文件名和URL
    const finalFileName = params.fileName || params.docName || (params.docUrl ? params.docUrl.split('/').pop() || "" : "")
    let originalFileUrl = params.fileUrl || params.localUrl
    
    if (!originalFileUrl && params.agentUserId && params.taskId && finalFileName) {
      const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
      originalFileUrl = `${publicBase}/upload/${params.agentUserId}/${params.taskId}/${encodeURIComponent(finalFileName)}`
    }
    const finalFileUrl = originalFileUrl || `/files/upload/dummy.pdf`

    setFileData({ fileName: finalFileName, fileUrl: finalFileUrl })

    // 异步获取文档 URL 逻辑
    const fetchDocUrl = async () => {
      try {
        setApiError(null)
        
        // 场景1：有任务ID，需要轮询状态
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
                setDocName(res.docName || '')
                setCallbackUrl(res.callbackUrl || params.callbackUrl)
                
                // 自动判断最佳视图模式
                if (finalFileName.toLowerCase().endsWith('.pdf') || originalFileUrl.toLowerCase().includes('.pdf')) {
                  setViewMode('split')
                } else {
                  setViewMode('editor')
                }
                
                setIsPolling(false)
                setIsLoading(false)
                return
              } 
              
              if (res?.processing) {
                setDocStatusMessage(res.message || '正在智能处理文档...')
                if (attempts < maxAttempts) {
                  setTimeout(poll, 3000)
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
              if (attempts < maxAttempts) setTimeout(poll, 3000)
              else {
                setApiError('网络连接不稳定，请重试')
                setIsPolling(false)
                setIsLoading(false)
              }
            }
          }
          await poll()
        } 
        // 场景2：直接打开文档
        else {
          setDocUrl(params.docUrl)
          setDocName(params.docName || (params.docUrl ? params.docUrl.split('/').pop() : ""))
          
          let finalCallback = params.callbackUrl
          // 简单的参数拼接逻辑...
          
          const isOffice = ['.docx', '.xlsx', '.pptx'].some(ext => finalFileName.toLowerCase().endsWith(ext))
          setViewMode(isOffice ? 'editor' : 'split')
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

  // 全局加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-muted/30">
        <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-lg border animate-in fade-in duration-500">
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

  // 错误状态
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

  // 主界面
  return (
    <div className="flex flex-col h-[calc(100vh-0px)] bg-muted/30">
      {/* 顶部导航栏 - 悬浮式设计 */}
      <header className="h-16 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-secondary rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm md:text-base max-w-[300px] truncate">
                {fileData.fileName}
              </span>
              <Badge variant="outline" className="font-normal text-[10px] h-5 px-1.5 bg-secondary/50 text-muted-foreground border-border">
                {isPdfFile ? 'PDF' : 'DOCX'}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              自动保存已启用
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 视图切换器 - 胶囊样式 */}
          <div className="hidden md:flex bg-secondary/50 p-1 rounded-lg border border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('split')
                window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
              }}
              className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
            >
              <Layout className="w-3.5 h-3.5" />
              分屏
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('pdf')
                window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: false } }))
              }}
              className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'pdf' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              预览
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('editor')
                window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
              }}
              className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'editor' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              编辑
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          <Button className="h-9 gap-2 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
            下一步
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* 工作区内容 - 增加内边距 */}
      <main className={`flex-1 p-4 md:p-6 transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : ''}`}>
        <div className={`h-full ${sidebarCollapsed ? 'w-full' : 'max-w-[1920px]'} mx-auto transition-all duration-300`}>
          
          {/* 分屏模式 */}
          {viewMode === 'split' && (
            <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* 左侧：PDF预览 */}
              <div className="w-full lg:w-1/2 h-full min-h-[400px] animate-in slide-in-from-left-4 fade-in duration-500">
                {(isPdf || isPdfFile) ? (
                  <PDFPreview fileUrl={fileData.fileUrl} fileName={fileData.fileName} />
                ) : (
                  <Card className="h-full flex items-center justify-center bg-muted/20 border-dashed border-2 shadow-none">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground">预览不可用</h3>
                      <p className="text-sm text-muted-foreground px-6">此文件格式 (.docx) 不支持分屏预览，请切换到“编辑”模式。</p>
                      <Button variant="outline" size="sm" onClick={() => {
                        setViewMode('editor')
                        window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
                      }}>
                        切换到编辑模式
                      </Button>
                    </div>
                  </Card>
                )}
              </div>

              {/* 右侧：编辑器 */}
              <div className="w-full lg:w-1/2 h-full min-h-[400px] animate-in slide-in-from-right-4 fade-in duration-500">
                {((isPdf || isPdfFile) && !docUrl) ? (
                  <Card className="h-full flex items-center justify-center bg-muted/20 border-dashed border-2 shadow-none">
                    <div className="text-center space-y-4 max-w-xs">
                      <div className="relative mx-auto">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
                           <Edit3 className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground mb-1">正在生成可编辑文档</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          系统正在使用OCR技术识别文档内容并转换为Word格式，这通常需要几秒钟...
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <OnlyOfficeEditor 
                    docUrl={docUrl}
                    docName={docName}
                    callbackUrl={callbackUrl}
                  />
                )}
              </div>
            </div>
          )}

          {/* 纯PDF模式 */}
          {viewMode === 'pdf' && (
            <div className="h-full animate-in zoom-in-95 fade-in duration-300">
              <PDFPreview fileUrl={fileData.fileUrl} fileName={fileData.fileName} />
            </div>
          )}

          {/* 纯编辑器模式 */}
          {viewMode === 'editor' && (
            <div className="h-full animate-in zoom-in-95 fade-in duration-300">
              <OnlyOfficeEditor 
                docUrl={docUrl}
                docName={docName}
                callbackUrl={callbackUrl}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}