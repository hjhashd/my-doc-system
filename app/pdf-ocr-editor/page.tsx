"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, RefreshCw, AlertCircle, Edit3 } from "lucide-react"
import http from '@/lib/http'
import { OnlyOfficeEditor as OnlyOfficeEditorComponent } from "./components/OnlyOfficeEditor"
import { HeaderBar } from "./components/HeaderBar"

// ==========================================
// 组件：OnlyOffice 编辑器 (右侧)
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
  
  // [修改点 1] 新增两个 state 来存储编辑器实例
  const [leftEditor, setLeftEditor] = useState<any>(null)
  const [rightEditor, setRightEditor] = useState<any>(null)
  
  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')
  
  // [修改点 2] 联动核心逻辑
  useEffect(() => {
    // 只有当两个编辑器都就绪时才启动
    if (viewMode !== 'split' || !leftEditor || !rightEditor) {
      // 调试日志：看看哪个还没准备好
      // console.log('Waiting for editors...', { left: !!leftEditor, right: !!rightEditor, mode: viewMode });
      return;
    }

    console.log("✅ 文档联动已启动！");
    console.log("右侧编辑器实例:", rightEditor);
    console.log("左侧编辑器实例:", leftEditor);

    // 检查编辑器实例的可用方法
    console.log("右侧编辑器可用方法:", Object.getOwnPropertyNames(rightEditor));
    console.log("左侧编辑器可用方法:", Object.getOwnPropertyNames(leftEditor));

    const syncInterval = setInterval(() => {
      try {
        // 方法1：尝试通过编辑器实例获取iframe并访问其内容
        const rightContainer = document.getElementById('onlyoffice-editor-container-right');
        const leftContainer = document.getElementById('onlyoffice-editor-container-left');
        
        if (rightContainer && leftContainer) {
          const rightFrame = rightContainer.querySelector('iframe');
          const leftFrame = leftContainer.querySelector('iframe');
          
          if (rightFrame && leftFrame) {
            try {
              const rightWindow = rightFrame.contentWindow;
              const leftWindow = leftFrame.contentWindow;
              
              if (rightWindow && leftWindow) {
                console.log("找到编辑器窗口对象");
                
                // 检查是否有 OnlyOffice API
                if (rightWindow.Api && leftWindow.Api) {
                  console.log("找到 OnlyOffice API");
                  
                  // 在右侧编辑器中查找隐藏标记
                  const rightDoc = rightWindow.Api.GetDocument();
                  const rightSelection = rightDoc.GetRangeBySelect();
                  const rightParagraph = rightSelection.GetParagraph(0);
                  
                  // 向下查找 50 个段落
                  let targetPage = null;
                  let tempPara = rightParagraph;
                  
                  for (let i = 0; i < 50; i++) {
                    if (!tempPara) break;
                    const text = tempPara.GetText().trim();
                    const match = text.match(/\[#PDF-LOC:(\d+)#\]/);
                    if (match && match[1]) {
                      targetPage = parseInt(match[1]);
                      break;
                    }
                    tempPara = tempPara.GetNextParagraph();
                  }
                  
                  if (targetPage !== null && !isNaN(targetPage)) {
                    console.log("🎯 捕获到光标所在 PDF 页码:", targetPage);
                    const pdfIndex = targetPage - 1;
                    
                    // 在左侧PDF中跳转到指定页面
                    leftWindow.Api.asc_moveToPage(pdfIndex);
                  }
                } else {
                  console.log("未找到 OnlyOffice API，等待编辑器完全加载...");
                }
              }
            } catch (e) {
              console.error("访问编辑器内容时出错:", e);
            }
          }
        }
      } catch (error) {
        console.error("联动过程中出错:", error);
      }
    }, 800);

    return () => clearInterval(syncInterval);
  }, [viewMode, leftEditor, rightEditor]);
  
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
      <HeaderBar 
        fileName={fileData.fileName}
        isPdfFile={isPdfFile}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          if (viewMode === 'editor' && mode !== 'editor') {
            window.dispatchEvent(new CustomEvent('onlyoffice-force-save'))
          }
          setViewMode(mode)
          window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
        }}
      />

      {/* 工作区内容 - 增加内边距 */}
      <main className={`flex-1 p-4 md:p-6 transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : ''}`}>
        <div className={`h-full ${sidebarCollapsed ? 'w-full' : 'max-w-[1920px]'} mx-auto transition-all duration-300`}>
          
          {/* 分屏模式 */}
          {viewMode === 'split' && (
            <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* 左侧：PDF预览 */}
              <div className="w-full lg:w-1/2 h-full min-h-[400px] animate-in slide-in-from-left-4 fade-in duration-500">
                {(isPdf || isPdfFile) ? (
                  <OnlyOfficeEditorComponent
                    docUrl={fileData.fileUrl}
                    docName={fileData.fileName}
                    callbackUrl={callbackUrl}
                    containerId="onlyoffice-editor-container-left"
                    instanceId="left"
                    // [关键] 绑定左侧实例
                    onEditorReady={setLeftEditor}
                  />
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
                        window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true, id: 'right' } }))
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
                  <OnlyOfficeEditorComponent 
                    docUrl={docUrl}
                    docName={docName}
                    callbackUrl={callbackUrl}
                    // [关键] 绑定右侧实例 (注意: 只有在 split 模式下我们才需要绑定这个来做联动)
                    onEditorReady={setRightEditor}
                  />
                )}
              </div>
            </div>
          )}

          {/* 纯PDF模式 */}
          {viewMode === 'pdf' && (
            <div className="h-full animate-in zoom-in-95 fade-in duration-300">
              <OnlyOfficeEditorComponent 
                docUrl={fileData.fileUrl}
                docName={fileData.fileName}
                callbackUrl={callbackUrl}
              />
            </div>
          )}

          {/* 纯编辑器模式 */}
          {viewMode === 'editor' && (
            <div className="h-full animate-in zoom-in-95 fade-in duration-300">
              <OnlyOfficeEditorComponent 
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
