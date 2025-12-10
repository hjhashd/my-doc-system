"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  AlertCircle,
  Edit3,
  FileText,
  Maximize2,
  Minimize2,
  Loader2
} from "lucide-react"

interface OnlyOfficeEditorProps {
  docUrl: string
  docName: string
  callbackUrl: string
  containerId?: string
  instanceId?: string
  onEditorReady?: (editor: any) => void
  documentType?: string // 新增：明确指定文档类型
  fileType?: string // 新增：明确指定文件类型
}

export function OnlyOfficeEditor({ 
  docUrl, 
  docName, 
  callbackUrl, 
  containerId = 'onlyoffice-editor-container', 
  instanceId = 'default', 
  onEditorReady,
  documentType, // 新增：明确指定文档类型
  fileType // 新增：明确指定文件类型
}: OnlyOfficeEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const isPdfDoc = docUrl?.split('?')[0].split('#')[0].toLowerCase().endsWith('.pdf')
  const editorRef = useRef<any>(null)
  const instanceRef = useRef<any>(null)
  const initParamsRef = useRef<{docUrl: string, docName: string, callbackUrl: string} | null>(null)

  const makeKeyFromUrl = (url: string) => {
    let h = 0
    for (let i = 0; i < url.length; i++) {
      h = (h * 31 + url.charCodeAt(i)) >>> 0
    }
    return h.toString(36)
  }



  const initializeEditor = useCallback(() => {
    if (instanceRef.current) {
      setIsLoading(false)
      // 如果实例已存在，也尝试再次通知父组件（防止父组件刷新丢失引用）
      if (onEditorReady) onEditorReady(instanceRef.current)
      
      const container = document.getElementById(containerId)
      if (container) {
        const editorFrame = container.querySelector('iframe')
        if (editorFrame) {
          editorFrame.style.display = 'block'
        }
      }
      return
    }
    setIsLoading(true)
    setError(null)

    if (!docUrl) {
      setError('缺少文档URL')
      setIsLoading(false)
      return
    }

    // 优先从传入的 fileType 参数获取文件类型
    let fileExt = fileType;
    
    // 如果没有明确指定 fileType，则从 docName 获取文件扩展名
    if (!fileExt) {
      fileExt = docName?.split('.').pop()?.toLowerCase();
    }
    
    // 如果 docName 也没有扩展名，再尝试从 docUrl 获取
    if (!fileExt) {
      fileExt = docUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
    }
    
    // 默认兜底
    fileExt = fileExt || 'docx';
    const title = docName || docUrl.split('/').pop() || `文档-${Date.now()}`
    const isEditable = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(fileExt)
    const editorMode = fileExt === 'pdf' ? 'view' : (isEditable ? 'edit' : 'view')
    
    // 优先从传入的 documentType 参数获取文档类型
    let docType = documentType;
    if (!docType) {
      docType = 'word'
      if (['xlsx', 'xls', 'csv'].includes(fileExt)) docType = 'cell'
      else if (['pptx', 'ppt'].includes(fileExt)) docType = 'slide'
      else if (fileExt === 'pdf') docType = 'word'
    }

    const init = () => {
      try {
        const DocsAPI = (window as any).DocsAPI
        if (!DocsAPI) {
          setError('OnlyOffice API 加载失败')
          setIsLoading(false)
          return
        }
        const container = document.getElementById(containerId)
        if (!container) {
          setError('找不到编辑器容器')
          setIsLoading(false)
          return
        }
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
              edit: editorMode === 'edit',
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
              compactHeader: true,
              toolbarNoTabs: false,
              forcesave: editorMode === 'edit',
              goback: false,
              chat: false,
              comments: true,
              zoom: 100,
              logo: {
                image: "",
                imageEmbedded: ""
              },
              spellcheck: false,
              autosave: false,
              plugins: false,
              // 允许运行宏/脚本，以便我们的 javascript: 链接能生效
              macros: true,
              macrosMode: 'warn' 
            }
          },
          height: '100%',
          width: '100%'
        } as any

        const editor = new (window as any).DocsAPI.DocEditor(containerId, config)
        instanceRef.current = editor
        editorRef.current = editor
        
        // 【修改点3】核心：初始化成功后，把编辑器实例传给父组件
        if (onEditorReady) {
          console.log(`OnlyOffice Instance [${instanceId}] Ready!`); // 加个日志方便调试
          onEditorReady(editor)
        }
        
        setIsLoading(false)
      } catch (e: any) {
        setError(e?.message || String(e))
        setIsLoading(false)
      }
    }

    // 核心逻辑：使用 window.location.host，它会自动包含当前页面的端口 (10043)
    // 这样请求就会发往 http://192.168.3.10:10043/web-apps/...
    // 然后被 Nginx 拦截并转发给 OnlyOffice
    const defaultApi = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}/web-apps/apps/api/documents/api.js`
      : 'http://localhost:8082/web-apps/apps/api/documents/api.js' // 服务端渲染时的兜底

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

  useEffect(() => {
    const currentParams = {docUrl, docName: docName || '', callbackUrl: callbackUrl || ''}
    const prevParams = initParamsRef.current
    if (prevParams && 
        prevParams.docUrl === currentParams.docUrl && 
        prevParams.docName === currentParams.docName && 
        prevParams.callbackUrl === currentParams.callbackUrl) {
      return
    }
    initParamsRef.current = currentParams
    if (isVisible) {
      initializeEditor()
    }
  }, [docUrl, docName, callbackUrl])

  useEffect(() => {
    if (isVisible && !instanceRef.current && initParamsRef.current) {
      initializeEditor()
    }
  }, [isVisible])

  useEffect(() => {
    const handleVisibilityChange = (event: any) => {
      const eventId = event?.detail?.id
      if (eventId && eventId !== instanceId) return
      const newVisibility = event.detail.isVisible !== false
      if (instanceRef.current) {
        setIsVisible(newVisibility)
        const container = document.getElementById(containerId)
        if (container) {
          const editorFrame = container.querySelector('iframe')
          if (editorFrame) {
            if (newVisibility) {
              editorFrame.style.display = 'block'
            } else {
              editorFrame.style.display = 'none'
            }
          }
        }
      } else {
        setIsVisible(newVisibility)
      }
    }
    window.addEventListener('onlyoffice-visibility-change', handleVisibilityChange)
    const handleForceSave = () => {
      try {
        const inst = instanceRef.current
        if (inst && typeof inst.save === 'function') {
          inst.save()
        }
      } catch {}
    }
    const handleForceSaveEvent = (event: any) => {
      const eventId = event?.detail?.id
      if (eventId && eventId !== instanceId) return
      handleForceSave()
    }
    window.addEventListener('onlyoffice-force-save', handleForceSaveEvent)
    return () => {
      window.removeEventListener('onlyoffice-visibility-change', handleVisibilityChange)
      window.removeEventListener('onlyoffice-force-save', handleForceSaveEvent)
      try {
        if (instanceRef.current?.destroyEditor) {
          instanceRef.current.destroyEditor()
        }
      } catch {}
      instanceRef.current = null
    }
  }, [isVisible])

  return (
    <Card className={`h-full flex flex-col border-0 shadow-sm overflow-hidden transition-all duration-300 rounded-xl ring-1 ring-border/50`}>
      <div className="h-12 px-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className={isPdfDoc ? "p-1.5 bg-destructive/20 rounded-md text-destructive" : "p-1.5 bg-primary/20 rounded-md text-primary"}>
            {isPdfDoc ? <FileText className="w-4 h-4 font-bold" /> : <Edit3 className="w-4 h-4 font-bold" />}
          </div>
          <span className="text-foreground font-medium">{isPdfDoc ? '文档预览' : '文档编辑'}</span>
          <span className="text-xs text-muted-foreground max-w-[280px] truncate">{docName || (docUrl ? docUrl.split('/').pop() : '')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6 px-2 font-semibold bg-primary/20 text-primary-foreground text-primary hover:bg-primary/30 border-primary/30">
            {isPdfDoc ? 'OnlyOffice 预览中' : 'OnlyOffice 协作中'}
          </Badge>
        </div>
      </div>
      <CardContent className={`flex-1 p-0 relative bg-card`}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-10 backdrop-blur-[1px]">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
            <p className="text-xs font-medium text-muted-foreground animate-pulse">正在初始化编辑器...</p>
          </div>
        )}
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">编辑器加载失败</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">{error}</p>
          </div>
        ) : (
          <div 
            id={containerId}
            className="w-full h-full"
            style={{ display: isVisible ? 'block' : 'none' }}
          />
        )}
      </CardContent>
    </Card>
  )
}
