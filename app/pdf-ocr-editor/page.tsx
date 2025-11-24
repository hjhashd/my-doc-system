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

  const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf')
  const isPdfFile = fileData.fileUrl.toLowerCase().includes('.pdf')

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
              
              if (rightWindow && leftWindow && rightWindow.Api && leftWindow.Api) {
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
    return () => window.removeEventListener('toggleSidebar', handleToggleSidebar)
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

    const finalFileName = params.fileName || params.docName || (params.docUrl ? params.docUrl.split('/').pop() || "" : "")
    setCustomFileName(finalFileName.replace('.pdf', '').replace('.docx', ''))
    
    let originalFileUrl = params.fileUrl || params.localUrl
    
    if (!originalFileUrl && params.agentUserId && params.taskId && finalFileName) {
      const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
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
    <div className="flex flex-col h-[calc(100vh-0px)] bg-muted/30">
      <HeaderBar 
        fileName={docName || fileData.fileName}
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
      />

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

      {/* 工作区内容保持原样 */}
      <main className={`flex-1 p-4 md:p-6 transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : ''}`}>
        <div className={`h-full ${sidebarCollapsed ? 'w-full' : 'max-w-[1920px]'} mx-auto transition-all duration-300`}>
          {viewMode === 'split' && (
            <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              <div className="w-full lg:w-1/2 h-full min-h-[400px] animate-in slide-in-from-left-4 fade-in duration-500">
                {(isPdf || isPdfFile) ? (
                  <OnlyOfficeEditorComponent
                    docUrl={fileData.fileUrl}
                    docName={fileData.fileName}
                    callbackUrl={callbackUrl}
                    containerId="onlyoffice-editor-container-left"
                    instanceId="left"
                    onEditorReady={setLeftEditor}
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
                    onEditorReady={setRightEditor}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'pdf' && (
            <div className="h-full animate-in zoom-in-95 fade-in duration-300">
              <OnlyOfficeEditorComponent 
                docUrl={fileData.fileUrl}
                docName={fileData.fileName}
                callbackUrl={callbackUrl}
              />
            </div>
          )}

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
