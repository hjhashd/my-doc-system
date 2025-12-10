"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, RefreshCw, AlertCircle, Edit3, X, Maximize2, Minimize2, List, Image as ImageIcon, Table } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import http from '@/lib/http'
import { feedback } from "@/lib/feedback"
import { OnlyOfficeEditor as OnlyOfficeEditorComponent } from "./components/OnlyOfficeEditor"
import { PDFViewer } from "./components/PDFViewer"
import { ExcelPreview } from "./components/ExcelPreview"
import { ImagePreview } from "./components/ImagePreview"
import { HeaderBar } from "./components/HeaderBar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

export default function PDFOCREditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
  
  const [leftEditor, setLeftEditor] = useState<any>(null)
  const [rightEditor, setRightEditor] = useState<any>(null)

  // 预览面板状态
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)
  const [previewData, setPreviewData] = useState<{type: 'image' | 'table', url: string, name: string} | null>(null)
  
  // 资源列表状态
  const [resourceList, setResourceList] = useState<{images: any[], tables: any[]}>({ images: [], tables: [] })
  const [isResourcesLoading, setIsResourcesLoading] = useState(false)
  const [resourcePanelOpen, setResourcePanelOpen] = useState(false)

  // 重命名相关状态
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [customFileName, setCustomFileName] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  
  // 接收解析耗时
  const [elapsedTime, setElapsedTime] = useState<string | null>(null)

  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')

  // 获取资源列表
  const fetchResources = async () => {
      const agentUserId = searchParams.get('agentUserId')
      const taskId = searchParams.get('taskId')
      if (!agentUserId || !taskId) return
      
      setIsResourcesLoading(true)
      try {
          // 修改为调用 Next.js 自己的 API 路由
          const res = await http.get(`/api/resources?agentUserId=${agentUserId}&taskId=${taskId}`)
          if (res) {
              setResourceList({
                  images: res.images || [],
                  tables: res.tables || []
              })
          }
      } catch (error) {
          console.error("Failed to fetch resources:", error)
      } finally {
          setIsResourcesLoading(false)
      }
  }

  // 监听来自 OnlyOffice 的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证来源安全性等...
      const data = event.data;
      if (data && typeof data === 'object') {
        if (data.type === 'preview_image' || data.type === 'preview_table') {
           console.log('收到预览请求:', data);
           setPreviewData({
             type: data.type === 'preview_image' ? 'image' : 'table',
             url: data.url,
             name: data.name
           });
           setPreviewPanelOpen(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 文档加载成功后获取资源列表
  useEffect(() => {
      if (docUrl && !isLoading && !isPolling) {
          fetchResources()
      }
  }, [docUrl, isLoading, isPolling])

  // 处理资源点击
  const handleResourceClick = (item: any, type: 'image' | 'table') => {
      // 1. 打开预览并关闭资源列表侧边栏
      setPreviewData({
          type: type,
          url: item.url,
          name: item.name
      })
      setPreviewPanelOpen(true)
      setResourcePanelOpen(false) // 自动关闭资源列表侧边栏
      
      // 2. 尝试跳转 PDF (根据文件名解析页码)
      // 假设图片命名规则是: XA_certificate_0_layout_det_res_1.png
      // 其中 0 是页码索引
      try {
          const match = item.name.match(/_(\d+)_layout_det_res/);
          if (match && match[1] && leftEditor) {
             // PDFViewer 暴露的 window.Api 可能不同，这里假设 leftEditor 是 iframe 的 contentWindow
             // 需要确认 PDFViewer 组件是否正确暴露了跳转方法
             // 这里复用之前的联动逻辑中的调用方式
             const pageIndex = parseInt(match[1]);
             if (!isNaN(pageIndex) && leftEditor.Api && typeof leftEditor.Api.asc_moveToPage === 'function') {
                 // 注意：OnlyOffice 的 PDF 预览可能不支持 moveToPage，这里假设左侧是 PDF.js 或类似
                 // 如果左侧是 OnlyOffice PDF Viewer，API 应该是 asc_moveToPage
                 // 如果是自定义 PDFViewer，可能需要通过 postMessage 或其他方式
                 
                 // 修正：之前的联动逻辑显示 leftWindow.Api.asc_moveToPage(pdfIndex)
                 leftEditor.Api.asc_moveToPage(pageIndex);
             }
          }
      } catch (e) {
          console.error("跳转失败", e)
      }
  }

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

  // PDF-DOCX 联动逻辑（保持不变）
  useEffect(() => {
    if (viewMode !== 'split' || !leftEditor || !rightEditor) {
      return;
    }

    const syncInterval = setInterval(() => {
      try {
        const rightContainer = document.getElementById('onlyoffice-editor-container-right');
        const leftContainer = document.getElementById('onlyoffice-editor-container-left');
        
        if (rightContainer && leftContainer) {
          const rightFrame = rightContainer.querySelector('iframe');
          const leftFrame = leftContainer.querySelector('iframe');
          
          if (rightFrame && leftFrame) {
            try {
              const rightWindow = rightFrame.contentWindow;
              const leftWindow = leftFrame.contentWindow;
              
              if (rightWindow && leftWindow && typeof rightWindow.Api === 'object' && rightWindow.Api && typeof leftWindow.Api === 'object' && leftWindow.Api) {
                  const rightDoc = rightWindow.Api.GetDocument();
                  const rightSelection = rightDoc.GetRangeBySelect();
                  const rightParagraph = rightSelection.GetParagraph(0);
                  
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
                    const pdfIndex = targetPage - 1;
                    leftWindow.Api.asc_moveToPage(pdfIndex);
                  }
              }
            } catch (e) {
            }
          }
        }
      } catch (error) {
        console.error("联动过程中出错:", error);
      }
    }, 800);

    return () => clearInterval(syncInterval);
  }, [viewMode, leftEditor, rightEditor]);

  useEffect(() => {
    const handleToggleSidebar = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener('toggleSidebar', handleToggleSidebar)
    
    // 自动收起侧边栏
    const timer = setTimeout(() => {
       // 检查当前侧边栏状态，如果未收起则触发收起
       // 注意：这里无法直接获取最新的 sidebarCollapsed 状态，所以我们总是触发一次 toggleSidebar 事件
       // 更好的做法是在 Layout 中控制，或者在这里直接发事件
       window.dispatchEvent(new CustomEvent('toggleSidebar'))
    }, 100)

    return () => {
      window.removeEventListener('toggleSidebar', handleToggleSidebar)
      clearTimeout(timer)
    }
  }, [])

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
    setCustomFileName(finalFileName.replace('.pdf', '').replace('.docx', ''))
    
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
                
                if (finalFileName.toLowerCase().endsWith('.pdf') || originalFileUrl.toLowerCase().includes('.pdf')) {
                  setViewMode('split')
                } else {
                  setViewMode('editor')
                }
                
                setIsPolling(false)
                setIsLoading(false)
                feedback.success('文档加载成功')
                return
              } 
              
              if (res?.processing) {
                setDocStatusMessage(res.message || '正在智能处理文档...')
                if (attempts < maxAttempts) {
                  setTimeout(poll, 3000)
                } else {
                  const errorMsg = '文档处理超时，请检查后端服务'
                  setApiError(errorMsg)
                  setIsPolling(false)
                  setIsLoading(false)
                  feedback.error(errorMsg)
                }
              } else {
                const errorMsg = res?.message || '获取文档失败'
                setApiError(errorMsg)
                setIsPolling(false)
                setIsLoading(false)
                feedback.error(errorMsg)
              }
            } catch (err) {
              console.error('轮询失败:', err)
              if (attempts < maxAttempts) setTimeout(poll, 3000)
              else {
                const errorMsg = '网络连接不稳定，请重试'
                setApiError(errorMsg)
                setIsPolling(false)
                setIsLoading(false)
                feedback.error(errorMsg)
              }
            }
          }
          await poll()
        } else {
          setDocUrl(params.docUrl)
          setDocName(params.docName || (params.docUrl ? params.docUrl.split('/').pop() : ""))
          const isOffice = ['.docx', '.xlsx', '.pptx'].some(ext => finalFileName.toLowerCase().endsWith(ext))
          setViewMode(isOffice ? 'editor' : 'split')
          setIsLoading(false)
          feedback.success('文档加载成功')
        }
      } catch (err) {
        console.error('加载失败:', err)
        setApiError('初始化失败')
        setIsLoading(false)
        feedback.error('初始化失败')
      }
    }

    fetchDocUrl()
  }, [searchParams])

  // 处理下一步点击
  const handleNextStep = () => {
    window.dispatchEvent(new CustomEvent('onlyoffice-force-save'))
    setIsRenameDialogOpen(true)
  }

  // 处理确认重命名
  const handleConfirmRename = async () => {
    setIsRenaming(true)
    const agentUserId = searchParams.get('agentUserId')
    const taskId = searchParams.get('taskId')

    if (!agentUserId || !taskId) {
      router.push('/parsing')
      return
    }

    try {
      const res = await http.post('/api/document/rename', {
        agentUserId,
        taskId,
        newFileName: customFileName
      })

      if (res.ok) {
        feedback.success('重命名成功')
        router.push(`/parsing?agentUserId=${encodeURIComponent(agentUserId)}`)
      } else {
        feedback.error('重命名失败: ' + res.message)
        setIsRenaming(false)
      }
    } catch (error) {
      console.error('Rename failed', error)
      feedback.error('重命名请求出错')
      setIsRenaming(false)
    }
  }

  // 进度条组件
  const TopProgressBar = ({ progress, message }: { progress: number, message: string }) => (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border shadow-lg rounded-full px-6 py-2 flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
        <div className="relative flex items-center justify-center w-5 h-5">
           <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        </div>
        <span className="text-sm font-medium text-slate-700">{message}</span>
        <span className="text-sm font-bold text-blue-600 tabular-nums">{progress}%</span>
      </div>
    </div>
  )

  // 计算模拟进度 (用于轮询时显示)
  const [mockProgress, setMockProgress] = useState(0)
  useEffect(() => {
    if (isPolling || isLoading) {
      const timer = setInterval(() => {
        setMockProgress(prev => {
          if (prev >= 95) return 95
          // 随机增加进度，前期快后期慢
          const inc = prev < 60 ? Math.random() * 5 + 2 : Math.random() * 2 + 0.5
          return Math.min(Math.round((prev + inc) * 10) / 10, 95)
        })
      }, 800)
      return () => clearInterval(timer)
    } else {
      setMockProgress(100)
    }
  }, [isPolling, isLoading])

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
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {(isLoading || isPolling) && (
        <TopProgressBar 
          progress={mockProgress} 
          message={docStatusMessage || (isPolling ? '正在进行智能解析...' : '正在加载资源...')} 
        />
      )}
      
      <HeaderBar 
        fileName={getOriginalFileName(fileData.fileName)}
        isPdfFile={isPdfFile}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          if (viewMode === 'editor' && mode !== 'editor') {
            window.dispatchEvent(new CustomEvent('onlyoffice-force-save'))
          }
          setViewMode(mode)
          window.dispatchEvent(new CustomEvent('onlyoffice-visibility-change', { detail: { isVisible: true } }))
        }}
        onNextClick={handleNextStep}
        elapsedTime={elapsedTime}
      />
      
      {isLoading ? (
         <main className="flex-1 p-4 md:p-6 flex items-center justify-center min-h-[calc(100vh-64px)]">
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
               <div className="relative w-32 h-32">
                  <div className="absolute inset-0 bg-blue-100 rounded-full opacity-20 animate-pulse"></div>
                  <div className="absolute inset-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-blue-50">
                     <FileText className="w-12 h-12 text-blue-500/50" />
                  </div>
                  <div className="absolute -right-2 -top-2 bg-white rounded-full p-2 shadow-md animate-bounce">
                     <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
               </div>
               <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-xl font-semibold text-slate-800">正在准备您的工作台</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    系统正在处理文档内容，这可能需要一点时间，请稍候...
                  </p>
               </div>
            </div>
         </main>
      ) : (
        <>
      {/* 重命名对话框 */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>保存并继续</DialogTitle>
            <DialogDescription>
              您可以自定义文档名称，原文件将保留为备份。完成后将进入文档解析页面。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="filename" className="text-right">
                文件名
              </Label>
              <Input
                id="filename"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="col-span-3"
                placeholder="输入文档名称"
              />
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmRename} disabled={isRenaming || !customFileName.trim()}>
              {isRenaming ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认并继续
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className={`flex-1 p-4 md:p-6 transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : ''}`}>
        <div className={`h-full ${sidebarCollapsed ? 'w-full' : 'max-w-[1920px]'} mx-auto transition-all duration-300`}>
          {viewMode === 'split' && (
            <div className="h-[calc(100vh-100px)] min-h-[1200px] flex flex-col lg:flex-row gap-4 lg:gap-6">
              <div className="w-full lg:w-1/2 h-full animate-in slide-in-from-left-4 fade-in duration-500">
                {(isPdf || isPdfFile) ? (
                  <PDFViewer
                    pdfUrl={fileData.fileUrl}
                    fileName={getOriginalFileName(fileData.fileName)}
                  />
                ) : (
                  <Card className="h-full flex items-center justify-center bg-muted/20 border-dashed border-2 shadow-none">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground">预览不可用</h3>
                      <p className="text-sm text-muted-foreground px-6">此文件格式 (.docx) 不支持分屏预览，请切换到"编辑"模式。</p>
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

              <div className="w-full lg:w-1/2 h-full animate-in slide-in-from-right-4 fade-in duration-500">
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
                    docName={docName || getOriginalFileName(fileData.fileName)}
                    callbackUrl={callbackUrl || ''}
                    onEditorReady={setRightEditor}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'pdf' && (
            <div className="h-[calc(100vh-100px)] min-h-[1200px] animate-in zoom-in-95 fade-in duration-300">
              <PDFViewer 
                pdfUrl={fileData.fileUrl}
                fileName={fileData.fileName.endsWith('.docx') ? fileData.fileName.replace('.docx', '.pdf') : fileData.fileName}
              />
            </div>
          )}

          {viewMode === 'editor' && (
            <div className="h-[calc(100vh-100px)] min-h-[1200px] animate-in zoom-in-95 fade-in duration-300">
              <OnlyOfficeEditorComponent 
                docUrl={docUrl}
                docName={docName || getOriginalFileName(fileData.fileName)}
                callbackUrl={callbackUrl || ''}
              />
            </div>
          )}
        </div>
        
        {/* 资源列表侧边按钮 (固定在右下角) */}
        {/* 修复：确保按钮始终可见，增加 z-index 并调整位置 */}
        {viewMode === 'split' && (
            <div className={`fixed bottom-8 transition-all duration-300 z-30 ${sidebarCollapsed ? 'right-8' : 'right-8'}`}>
                <Button 
                    size="lg" 
                    className="shadow-xl rounded-full h-14 px-6 bg-slate-800 hover:bg-slate-700 text-white gap-2 transition-all duration-300 animate-in zoom-in duration-300"
                    onClick={() => setResourcePanelOpen(true)}
                >
                    <List className="w-5 h-5" />
                    <span className="font-medium">文档资源 ({resourceList.images.length + resourceList.tables.length})</span>
                </Button>
            </div>
        )}
      </main>
      
      {/* 资源列表侧边栏 */}
      {resourcePanelOpen && (
          <div className="fixed inset-y-0 right-0 w-[320px] bg-white shadow-2xl z-50 border-l animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <List className="w-5 h-5 text-slate-500" />
                    文档提取资源
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setResourcePanelOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                </Button>
              </div>
              
              <Tabs defaultValue="tables" className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 pt-2">
                      <TabsList className="w-full grid grid-cols-2">
                          <TabsTrigger value="tables" className="gap-2">
                              <Table className="w-4 h-4" /> 表格 ({resourceList.tables.length})
                          </TabsTrigger>
                          <TabsTrigger value="images" className="gap-2">
                              <ImageIcon className="w-4 h-4" /> 图片 ({resourceList.images.length})
                          </TabsTrigger>
                      </TabsList>
                  </div>
                  
                  <TabsContent value="tables" className="flex-1 overflow-hidden p-0 mt-2">
                      <ScrollArea className="h-full">
                          <div className="p-4 space-y-3">
                              {resourceList.tables.length > 0 ? (
                                  resourceList.tables.map((table, index) => (
                                      <div 
                                          key={index} 
                                          className="p-3 border rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all group"
                                          onClick={() => handleResourceClick(table, 'table')}
                                      >
                                          <div className="flex items-start gap-3">
                                              <div className="w-10 h-10 bg-green-50 rounded-md flex items-center justify-center shrink-0 text-green-600">
                                                  <Table className="w-6 h-6" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-slate-700 truncate mb-1" title={table.name}>{table.name}</p>
                                                  <p className="text-xs text-slate-400 truncate">点击预览并定位</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-12 text-slate-400 text-sm">
                                      <Table className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                      暂无提取的表格
                                  </div>
                              )}
                          </div>
                      </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="images" className="flex-1 overflow-hidden p-0 mt-2">
                      <ScrollArea className="h-full">
                          <div className="p-4 space-y-3">
                              {resourceList.images.length > 0 ? (
                                  resourceList.images.map((img, index) => (
                                      <div 
                                          key={index} 
                                          className="p-3 border rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all group"
                                          onClick={() => handleResourceClick(img, 'image')}
                                      >
                                          <div className="flex items-start gap-3">
                                              <div className="w-16 h-16 bg-slate-100 rounded-md overflow-hidden shrink-0 border">
                                                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                                              </div>
                                              <div className="flex-1 min-w-0 py-1">
                                                  <p className="text-sm font-medium text-slate-700 truncate mb-1" title={img.name}>{img.name}</p>
                                                  <p className="text-xs text-slate-400 truncate">点击预览并定位</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-12 text-slate-400 text-sm">
                                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                      暂无提取的图片
                                  </div>
                              )}
                          </div>
                      </ScrollArea>
                  </TabsContent>
              </Tabs>
          </div>
      )}
      
      {/* 右侧预览面板 */}
      {previewPanelOpen && previewData && (
         <div className="fixed top-[64px] right-0 bottom-0 w-[800px] bg-white shadow-2xl z-40 border-l animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <div className="flex items-center gap-2 overflow-hidden">
                <Button variant="ghost" size="sm" onClick={() => {
                    setPreviewPanelOpen(false);
                    setResourcePanelOpen(true);
                }} className="mr-2 text-slate-500 hover:text-slate-800">
                   ← 返回列表
                </Button>
                <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
                {previewData.type === 'image' ? <FileText className="w-5 h-5 text-blue-600 shrink-0"/> : <Edit3 className="w-5 h-5 text-green-600 shrink-0"/>}
                <h3 className="font-medium text-slate-800 truncate" title={previewData.name}>
                  {previewData.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                 {previewData.type === 'table' && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => {
                            const agentUserId = searchParams.get('agentUserId');
                            const taskId = searchParams.get('taskId');
                            // 提取文件名
                            const docName = previewData.name;
                            // 这里的 url 已经是 /save/... 格式，可以直接用作 docUrl
                            const docUrl = previewData.url;
                            
                            const editUrl = `/excel-editor?docUrl=${encodeURIComponent(docUrl)}&docName=${encodeURIComponent(docName)}&agentUserId=${agentUserId}&taskId=${taskId}`;
                            window.open(editUrl, '_blank');
                        }}
                    >
                        <Edit3 className="w-4 h-4 mr-1" />
                        编辑表格
                    </Button>
                 )}
                 <Button variant="ghost" size="icon" onClick={() => setPreviewPanelOpen(false)}>
                    <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
                 </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-slate-50/50 p-6 flex items-center justify-center">
                {previewData.type === 'image' ? (
                  <ImagePreview url={previewData.url} alt={previewData.name} />
                ) : (
                  <div className="w-full h-full bg-white rounded-lg shadow-sm border overflow-hidden">
                     {/* 这里的 URL 如果是 excel-editor 开头，则用 iframe 加载 excel 编辑器，否则可能是静态预览 */}
                     {previewData.url.startsWith('/excel-editor') ? (
                       <iframe 
                          src={previewData.url} 
                          className="w-full h-full border-0"
                          title="Table Preview"
                       />
                     ) : (
                       <ExcelPreview url={previewData.url} />
                     )}
                  </div>
                )}
            </div>
         </div>
      )}
    </>
      )}
    </div>
  )
}
