"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import http from "@/lib/http"
import { Card } from "@/components/ui/card" // 现在只需要一个大 Card
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Zap, Trash2, LayoutGrid, MoreHorizontal, Maximize2 } from "lucide-react"

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

  // ... (保留原本的 fetchDocuments, fetchDocumentDetails, handleToggleSelect 等逻辑代码，不需要变)
  // 为了节省篇幅，这里省略逻辑部分，直接展示 Return 的布局结构
  // 请确保你保留了原文件里的 handleViewDocument, handleBatchParse 等函数

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
      <Card className="flex-1 min-h-0 flex border-border/60 shadow-lg overflow-hidden bg-white">
        
        {/* 左侧：列表栏 (固定宽度 + 响应式调整) */}
        <div className="w-[320px] shrink-0 border-r border-border/40 bg-slate-50/50 flex flex-col">
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
        <div className="flex-1 min-w-0 flex flex-col bg-white">
            {/* 右侧 Header */}
            <div className="h-16 shrink-0 border-b border-border/30 px-6 flex items-center justify-between bg-white">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-800 truncate">
                        {selectedDoc ? selectedDoc.name : "请选择文档"}
                    </h2>
                    {selectedDoc && (
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                           ID: {selectedDoc.id} 
                           <span className="w-px h-3 bg-slate-300 mx-1"/>
                           {selectedDoc.uploadDate}
                        </p>
                    )}
                </div>
                {/* 如果需要可以放详情页专属的操作按钮 */}
                <div className="flex gap-2">
                    {selectedDoc && (
                         <Button variant="ghost" size="sm" onClick={() => handleViewDocument(selectedDoc)}>
                            <Maximize2 className="w-4 h-4 mr-2" />
                            全屏编辑
                         </Button>
                    )}
                </div>
            </div>

            {/* 右侧 Content (Tabs) */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {selectedDoc ? (
                    <Tabs defaultValue="overview" className="h-full flex flex-col">
                        <div className="px-6 border-b border-border/20 bg-slate-50/30">
                            <TabsList className="bg-transparent p-0 h-10 w-full justify-start gap-6">
                                {['overview', 'content', 'export', 'storage'].map(tab => (
                                <TabsTrigger 
                                    key={tab}
                                    value={tab} 
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 pt-2 text-sm font-medium text-slate-500 data-[state=active]:text-primary transition-all"
                                >
                                    {{
                                    overview: '概览',
                                    content: '内容分类',
                                    export: '导出',
                                    storage: '入库'
                                    }[tab]}
                                </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        
                        {/* Tab 内容区：允许内部滚动 */}
                        <div className="flex-1 overflow-hidden bg-slate-50/10">
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-5xl mx-auto">
                                    <TabsContent value="overview" className="mt-0 space-y-4 focus-visible:ring-0">
                                        <OverviewTab doc={selectedDoc} />
                                    </TabsContent>

                                    <TabsContent value="content" className="mt-0 focus-visible:ring-0">
                                        <ContentTab details={docDetails} loading={detailsLoading} />
                                    </TabsContent>
                                    
                                    <TabsContent value="export" className="mt-0">
                                        <div className="h-64 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed rounded-xl">导出功能开发中...</div>
                                    </TabsContent>

                                    <TabsContent value="storage" className="mt-0">
                                        <div className="h-64 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed rounded-xl">入库功能开发中...</div>
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </div>
                    </Tabs>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/20">
                        <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                        <p>请从左侧列表选择一个文档查看详情</p>
                    </div>
                )}
            </div>
        </div>
      </Card>
    </div>
  )
}