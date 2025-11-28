"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import http from "@/lib/http"
import { Card } from "@/components/ui/card" // 现在只需要一个大 Card
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap, Trash2, LayoutGrid, MoreHorizontal, Maximize2, Loader2, Brain } from "lucide-react"

import { DocumentList } from "@/components/document/document-list"
import { OverviewTab } from "@/components/document/tabs/overview-tab"
import { ContentTab } from "@/components/document/tabs/content-tab"
import { Document, DocumentDetails } from "@/types/document"

export default function DocumentParsingInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // 状态管理
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const [listLoading, setListLoading] = useState<boolean>(true)
  const [listError, setListError] = useState<string | null>(null)
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)
  
  // 新增状态用于控制解析状态
  const [isParsing, setIsParsing] = useState(false)
  const [parsingProgress, setParsingProgress] = useState(0)
  const [parsingStatusText, setParsingStatusText] = useState("")
  
  // 新增状态用于控制智能解析状态
  const [isSmartParsing, setIsSmartParsing] = useState(false)
  const [smartParsingProgress, setSmartParsingProgress] = useState(0)
  const [smartParsingStatusText, setSmartParsingStatusText] = useState("")

  const fetchDocuments = useCallback(async () => {
    // ... 原有逻辑
    try {
      setListLoading(true)
      const res: any = await http.get('/api/document/list', {}) // 简写
      if (res && res.data) {
          setDocuments(res.data)
          if (!selectedDoc && res.data.length > 0) setSelectedDoc(res.data[0])
      }
    } catch (e) { setListError("加载失败") } 
    finally { setListLoading(false) }
  }, [selectedDoc])

  const fetchDocumentDetails = useCallback(async (docId: string) => {
      // ... 原有逻辑 (模拟请求)
      setDetailsLoading(true)
      await new Promise(r => setTimeout(r, 500))
      setDocDetails({ text: [], tables: [], images: [] }) // 模拟空数据
      setDetailsLoading(false)
  }, [])

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleToggleAll = (checked: boolean) => {
    setSelectedIds(checked ? documents.map(d => d.id) : []);
  };
  const handleViewDocument = (doc: Document) => { router.push(`/pdf-ocr-editor`) }; // 简化展示

  // 2. 新增：处理单文档智能解析的函数
  const handleRunSmartParsing = async (doc: Document) => {
    if (!doc) return

    // 如果已经在解析中，则停止解析
    if (isSmartParsing) {
      setIsSmartParsing(false)
      setSmartParsingStatusText("已停止智能解析")
      return
    }

    try {
      setIsSmartParsing(true)
      setSmartParsingProgress(0)
      setSmartParsingStatusText("正在检查文档是否已解析...")
      
      // 使用物理文件名进行解析，如果物理文件名不存在则使用显示名称
      const fileName = doc.physicalName || doc.name
      
      // 1. 提交智能检查任务
      console.log("提交智能解析任务:", { taskId: doc.id, fileName: fileName, displayName: doc.name })
      const runRes = await http.post('/api/pipeline/run_check', { 
        agentUserId: '123', // 注意：这里以后要改成动态获取真实用户ID 
        taskId: doc.id, 
        fileName: fileName // 使用物理文件名
      })

      if (!runRes.ok) throw new Error(runRes.message || '提交失败')

      const queryId = runRes.query_id
      console.log("智能检查任务提交成功，queryId:", queryId)
      setSmartParsingStatusText(`任务已提交，ID: ${queryId}`)

      // 2. 开始轮询
      console.log("开始轮询状态...")
      const pollInterval = setInterval(async () => {
        try {
          console.log(`查询状态: /api/pipeline/status?query_id=${queryId}`)
          const statusRes: any = await http.get(`/api/pipeline/status?query_id=${queryId}`)
          
          console.log("状态响应:", statusRes)
          
          if (statusRes.ok) {
            const { status, percent, message } = statusRes
            setSmartParsingProgress(percent)
            setSmartParsingStatusText(message || `处理中 ${percent}%`)
            console.log(`当前状态: ${status}, 进度: ${percent}%`)

            // === 成功时的处理 ===
            if (status === 'success') {
              console.log("智能解析成功，停止轮询，获取结果...")
              clearInterval(pollInterval)
              setSmartParsingStatusText("解析完成，正在获取结果...")
              
              // 3. 核心新增：获取解析结果数据
              try {
                  // 🔴 修改点：添加 &fileName=... 参数
                  // 注意：Python 生成的文件名通常去掉了后缀，但为了保险，我们传入完整名，在后端处理
                  const resultUrl = `/api/pipeline/result?agentUserId=123&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`
                  
                  console.log(`获取结果: ${resultUrl}`)
                  const resultRes: any = await http.get(resultUrl)
                  
                  console.log("结果响应:", resultRes)
                  
                  if (resultRes.ok) {
                      setIsSmartParsing(false)
                      // 这里拿到了 Python 解析出来的完整 JSON 数据！ 
                      const parsedData = resultRes.data
                      
                      console.log("解析结果:", parsedData) // 在控制台打印看看结构
                      
                      // 转换数据为DocumentDetails格式
                      const convertedDetails: DocumentDetails = {
                        text: Array.isArray(parsedData) ? parsedData.map((item: any, index: number) => ({
                          id: item.block_id || `text-${index}`,
                          type: 'text',
                          content: item.content || '',
                          metadata: {
                            heading_level: item.heading_level,
                            heading_title: item.heading_title,
                            heading_meta: item.heading_meta,
                            char_start: item.char_start,
                            char_end: item.char_end,
                            line_start: item.line_start,
                            line_end: item.line_end
                          }
                        })) : [],
                        tables: [], // blocks_merge.json 中没有表格数据，设为空数组
                        images: [] // blocks_merge.json 中没有图片数据，设为空数组
                      };
                      
                      // 设置转换后的数据
                      setDocDetails(convertedDetails);
                      
                      setSmartParsingStatusText("智能解析成功！数据已加载")
                  } else {
                      console.error("获取结果失败:", resultRes)
                      setSmartParsingStatusText("解析成功但获取文件失败")
                  }
              } catch (fetchErr) {
                  console.error("获取结果出错:", fetchErr)
                  setSmartParsingStatusText("获取结果出错")
              }

            } else if (status === 'failed' || status === 'error') {
              console.log("智能解析失败:", message)
              clearInterval(pollInterval)
              setIsSmartParsing(false)
              setSmartParsingStatusText(`解析失败: ${message}`)
            }
          } else {
            console.error("状态查询失败:", statusRes)
          }
        } catch (err) {
          console.error("轮询出错:", err)
        }
      }, 2000)

    } catch (error: any) {
      console.error("智能解析请求出错:", error)
      setIsSmartParsing(false)
      setSmartParsingStatusText(`请求出错: ${error.message}`)
    }
  }

  // 1. 新增：处理单文档解析的函数
  const handleRunParsing = async (doc: Document) => {
    if (!doc) return

    // 如果已经在解析中，则停止解析
    if (isParsing) {
      setIsParsing(false)
      setParsingStatusText("已停止解析")
      return
    }

    try {
      setIsParsing(true)
      setParsingProgress(0)
      setParsingStatusText("正在启动解析任务...")
      
      // 使用物理文件名进行解析，如果物理文件名不存在则使用显示名称
      const fileName = doc.physicalName || doc.name
      
      // 1. 提交任务
      console.log("提交解析任务:", { taskId: doc.id, fileName: fileName, displayName: doc.name })
      const runRes = await http.post('/api/pipeline/run', { 
        agentUserId: '123', // 注意：这里以后要改成动态获取真实用户ID 
        taskId: doc.id, 
        fileName: fileName // 使用物理文件名
      })

      if (!runRes.ok) throw new Error(runRes.message || '提交失败')

      const queryId = runRes.query_id
      console.log("任务提交成功，queryId:", queryId)
      setParsingStatusText(`任务已提交，ID: ${queryId}`)

      // 2. 开始轮询
      console.log("开始轮询状态...")
      const pollInterval = setInterval(async () => {
        try {
          console.log(`查询状态: /api/pipeline/status?query_id=${queryId}`)
          const statusRes: any = await http.get(`/api/pipeline/status?query_id=${queryId}`)
          
          console.log("状态响应:", statusRes)
          
          if (statusRes.ok) {
            const { status, percent, message } = statusRes
            setParsingProgress(percent)
            setParsingStatusText(message || `处理中 ${percent}%`)
            console.log(`当前状态: ${status}, 进度: ${percent}%`)

            // === 成功时的处理 ===
            if (status === 'success') {
              console.log("解析成功，停止轮询，获取结果...")
              clearInterval(pollInterval)
              setParsingStatusText("解析完成，正在获取结果...")
              
              // 3. 核心新增：获取解析结果数据
              try {
                  // 🔴 修改点：添加 &fileName=... 参数
                  // 注意：Python 生成的文件名通常去掉了后缀，但为了保险，我们传入完整名，在后端处理
                  const resultUrl = `/api/pipeline/result?agentUserId=123&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`
                  
                  console.log(`获取结果: ${resultUrl}`)
                  const resultRes: any = await http.get(resultUrl)
                  
                  console.log("结果响应:", resultRes)
                  
                  if (resultRes.ok) {
                      setIsParsing(false)
                      // 这里拿到了 Python 解析出来的完整 JSON 数据！ 
                      const parsedData = resultRes.data
                      
                      console.log("解析结果:", parsedData) // 在控制台打印看看结构
                      
                      // 转换数据为DocumentDetails格式
                      const convertedDetails: DocumentDetails = {
                        text: Array.isArray(parsedData) ? parsedData.map((item: any, index: number) => ({
                          id: item.block_id || `text-${index}`,
                          type: 'text',
                          content: item.content || '',
                          metadata: {
                            heading_level: item.heading_level,
                            heading_title: item.heading_title,
                            heading_meta: item.heading_meta,
                            char_start: item.char_start,
                            char_end: item.char_end,
                            line_start: item.line_start,
                            line_end: item.line_end
                          }
                        })) : [],
                        tables: [], // blocks_merge.json 中没有表格数据，设为空数组
                        images: [] // blocks_merge.json 中没有图片数据，设为空数组
                      };
                      
                      // 设置转换后的数据
                      setDocDetails(convertedDetails);
                      
                      setParsingStatusText("解析成功！数据已加载")
                  } else {
                      console.error("获取结果失败:", resultRes)
                      setParsingStatusText("解析成功但获取文件失败")
                  }
              } catch (fetchErr) {
                  console.error("获取结果出错:", fetchErr)
                  setParsingStatusText("获取结果出错")
              }

            } else if (status === 'failed' || status === 'error') {
              console.log("解析失败:", message)
              clearInterval(pollInterval)
              setIsParsing(false)
              setParsingStatusText(`解析失败: ${message}`)
            }
          } else {
            console.error("状态查询失败:", statusRes)
          }
        } catch (err) {
          console.error("轮询出错:", err)
        }
      }, 2000)

    } catch (error: any) {
      console.error("解析请求出错:", error)
      setIsParsing(false)
      setParsingStatusText(`请求出错: ${error.message}`)
    }
  }

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  useEffect(() => {
    if (selectedDoc && selectedDoc.status === 'completed') {
       fetchDocumentDetails(selectedDoc.id);
    } else {
       setDocDetails(null);
    }
  }, [selectedDoc, fetchDocumentDetails]);


  return (
    <div className="p-4 md:p-6 h-screen flex flex-col bg-slate-50 overflow-hidden">
      
      {/* 顶部通栏：更简洁，只放全局操作 */}
      <div className="flex items-center justify-between shrink-0 mb-4 px-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            文档解析工作台
          </h1>
        </div>
        
        {/* 全局操作按钮区 */}
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
             <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 bg-white px-3 py-1 rounded-lg border shadow-sm">
                <span className="text-xs font-medium text-slate-600 mr-2">已选 {selectedIds.length} 项</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs">
                  <Trash2 className="w-3 h-3 mr-1.5" /> 删除
                </Button>
                <Button size="sm" className="h-7 text-xs">
                  <Zap className="w-3 h-3 mr-1.5" /> 批量解析
                </Button>
             </div>
          )}
          <Button variant="outline" size="sm" className="bg-white hover:bg-slate-50">
             <MoreHorizontal className="w-4 h-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* 核心改动：一体化大卡片 */}
      <Card className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-0 border-border/60 shadow-lg overflow-hidden bg-white">
        
        {/* 左侧：列表栏 (固定宽度 + 响应式调整) */}
        <div className="w-full sm:w-[240px] lg:w-[280px] xl:w-[300px] shrink-0 border-r border-border/40 bg-slate-50/50 flex flex-col min-h-0">
          <DocumentList 
            documents={documents}
            selectedDoc={selectedDoc}
            loading={listLoading}
            error={listError}
            onSelect={setSelectedDoc}
            onRefresh={fetchDocuments}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onViewDocument={handleViewDocument}
          />
        </div>

        {/* 右侧：详情内容区 (自适应宽度) */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-slate-50/30">
            {/* 右侧 Header - 更紧凑现代的设计 */}
            <div className="h-14 shrink-0 border-b border-border/40 px-4 flex items-center justify-between bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-800 truncate">
                            {selectedDoc ? selectedDoc.name : "未选择文档"}
                        </h2>
                        {selectedDoc && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>ID: {selectedDoc.id}</span>
                                <span className="w-px h-2 bg-slate-300"/>
                                <span>{selectedDoc.uploadDate}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* 操作区 */}
                <div className="flex items-center gap-2">
                    {selectedDoc && (
                        <>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                onClick={() => handleViewDocument(selectedDoc)}
                            >
                                <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                                全屏
                            </Button>
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                            <Button 
                                size="sm" 
                                className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm" 
                                onClick={() => selectedDoc && handleRunSmartParsing(selectedDoc)} 
                                disabled={!selectedDoc}
                            >
                                {isSmartParsing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        解析中
                                    </>
                                ) : (
                                    <>
                                        <Brain className="w-3.5 h-3.5 mr-1.5" />
                                        智能解析
                                    </>
                                )}
                            </Button>
                            <Button 
                                size="sm" 
                                className="h-8 shadow-sm" 
                                onClick={() => selectedDoc && handleRunParsing(selectedDoc)} 
                                disabled={!selectedDoc}
                            >
                                {isParsing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        停止
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                                        快速解析
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* 右侧 Content (Tabs) */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {selectedDoc ? (
                    <Tabs defaultValue="overview" className="h-full flex flex-col">
                        <div className="px-4 border-b border-border/40 bg-white/50">
                            <TabsList className="bg-transparent p-0 h-10 w-full justify-start gap-6">
                                {['overview', 'content', 'export', 'storage'].map(tab => (
                                <TabsTrigger 
                                    key={tab}
                                    value={tab} 
                                    className="relative h-10 px-0 bg-transparent shadow-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none text-xs font-medium text-slate-500 hover:text-slate-700 transition-all"
                                >
                                    {{
                                    overview: '文档概览',
                                    content: '内容识别',
                                    export: '导出数据',
                                    storage: '入库记录'
                                    }[tab]}
                                </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        
                        {/* Tab 内容区 */}
                        <div className="flex-1 overflow-hidden bg-slate-50/30">
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-6xl mx-auto">
                                    <TabsContent value="overview" className="mt-0 space-y-4 focus-visible:ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <OverviewTab 
                                            doc={selectedDoc} 
                                            isParsing={isSmartParsing || isParsing}
                                            parsingProgress={isSmartParsing ? smartParsingProgress : parsingProgress}
                                            parsingStatusText={isSmartParsing ? smartParsingStatusText : parsingStatusText}
                                        />
                                    </TabsContent>

                                    <TabsContent value="content" className="mt-0 focus-visible:ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <ContentTab details={docDetails} loading={detailsLoading} />
                                    </TabsContent>
                                    
                                    <TabsContent value="export" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                                <FileText className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p>导出功能正在开发中</p>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="storage" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                                <Database className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p>入库功能正在开发中</p>
                                        </div>
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </div>
                    </Tabs>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-sm">
                            <LayoutGrid className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-600 mb-1">未选择文档</h3>
                        <p className="text-xs text-slate-400">请从左侧列表选择一个文档以查看详情</p>
                    </div>
                )}
            </div>
        </div>
      </Card>
      
      {/* 可以在右侧显示一个临时的进度条，方便调试 */}
      {isSmartParsing && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80">
           <div className="flex justify-between text-sm mb-2">
              <span className="text-green-700">智能解析进度</span>
              <span>{smartParsingProgress}%</span>
           </div>
           <Progress value={smartParsingProgress} className="h-2" />
           <div className="text-xs text-muted-foreground mt-2 truncate">
             {smartParsingStatusText}
           </div>
        </div>
      )}
      {isParsing && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80">
           <div className="flex justify-between text-sm mb-2">
              <span>解析进度</span>
              <span>{parsingProgress}%</span>
           </div>
           <Progress value={parsingProgress} className="h-2" />
           <div className="text-xs text-muted-foreground mt-2 truncate">
             {parsingStatusText}
           </div>
        </div>
      )}
    </div>
  )
}
