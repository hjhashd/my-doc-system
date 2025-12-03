"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, RefreshCw, AlertCircle, Edit3 } from "lucide-react"
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
import { OnlyOfficeEditor as OnlyOfficeEditorComponent } from "./components/OnlyOfficeEditor"
import { PDFViewer } from "./components/PDFViewer"
import { HeaderBar } from "./components/HeaderBar"

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

  // 重命名相关状态
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [customFileName, setCustomFileName] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  
  // 接收解析耗时
  const [elapsedTime, setElapsedTime] = useState<string | null>(null)

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
        } else {
          setDocUrl(params.docUrl)
          setDocName(params.docName || (params.docUrl ? params.docUrl.split('/').pop() : ""))
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
        router.push(`/parsing?agentUserId=${encodeURIComponent(agentUserId)}`)
      } else {
        alert('重命名失败: ' + res.message)
        setIsRenaming(false)
      }
    } catch (error) {
      console.error('Rename failed', error)
      alert('重命名请求出错')
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
      </main>
    </>
      )}
    </div>
  )
}
