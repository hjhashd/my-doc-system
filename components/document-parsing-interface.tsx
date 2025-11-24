"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import http from "@/lib/http"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, Zap } from "lucide-react"

// 引入拆分的组件
import { DocumentList } from "@/components/document/document-list"
import { OverviewTab } from "@/components/document/tabs/overview-tab"
import { ContentTab } from "@/components/document/tabs/content-tab"
// 下面两个比较简单，我这里假设你暂时保留在原文件或另外拆分，为节省篇幅暂不展开，逻辑同上
// import { ExportTab } from "@/components/document/tabs/export-tab" 
// import { StorageTab } from "@/components/document/tabs/storage-tab"

import { Document, DocumentDetails } from "@/types/document"

export default function DocumentParsingInterface() {
  const searchParams = useSearchParams()
  
  // 状态管理
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  
  // 列表加载状态
  const [listLoading, setListLoading] = useState<boolean>(true)
  const [listError, setListError] = useState<string | null>(null)

  // 详情数据 & 加载状态 (这里是新的!)
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)

  // 1. 获取文档列表 (保留原始逻辑)
  const fetchDocuments = useCallback(async () => {
    try {
      setListLoading(true)
      setListError(null)
      const agentUserId = searchParams.get('agentUserId') || undefined
      
      const res: any = await http.get('/api/document/list', {
        params: agentUserId ? { agentUserId } : undefined
      })
      
      if (res && res.ok && Array.isArray(res.data)) {
        setDocuments(res.data)
        // 只有当没有选中项时，才默认选第一个
        if (!selectedDoc && res.data.length > 0) {
          setSelectedDoc(res.data[0])
        }
      } else {
        setDocuments([])
        setListError(res?.message || '无法加载文档列表')
      }
    } catch (e: any) {
      setDocuments([])
      setListError('加载文档列表失败，请检查网络')
    } finally {
      setListLoading(false)
    }
  }, [searchParams, selectedDoc])

  // 2. 获取单个文档的详细内容 (Text, Tables, Images)
  // TODO: 这里需要对接真实的后端接口
  const fetchDocumentDetails = useCallback(async (docId: string) => {
    if (!docId) return;
    
    try {
      setDetailsLoading(true);
      setDocDetails(null); // 清空旧数据
      
      // === 真实对接点 ===
      // const res = await http.get(`/api/document/${docId}/details`);
      // setDocDetails(res.data);
      
      // 临时模拟：因为删除了 Mock 数据，这里暂时给空数据，防止报错
      // 你需要在后端写好接口后，取消上面的注释
      console.log(`正在请求文档 ${docId} 的详情...`);
      await new Promise(r => setTimeout(r, 800)); // 模拟网络延迟
      
      // 构造一个空的结构，或者根据真实数据填充
      setDocDetails({
        text: [],
        tables: [],
        images: []
      });

    } catch (error) {
      console.error("获取详情失败", error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // 当选中不同文档时，拉取该文档详情
  useEffect(() => {
    if (selectedDoc && selectedDoc.status === 'completed') {
       fetchDocumentDetails(selectedDoc.id);
    } else {
       setDocDetails(null); // 如果文档未完成，不显示详情
    }
  }, [selectedDoc, fetchDocumentDetails]);

  return (
    <div className="p-6 space-y-6 h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded-lg shadow-sm border border-border/30">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">文档解析工作台</h1>
          <p className="text-muted-foreground text-sm mt-1">智能视觉解析技术 • 多类型内容识别</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={fetchDocuments} disabled={listLoading} className="border border-border/50 hover:bg-primary/5">
            <RefreshCw className={`w-4 h-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
            刷新队列
          </Button>
          <Button size="sm" className="shadow-md bg-primary hover:bg-primary/90 transition-all">
            <Zap className="w-4 h-4 mr-2" />
            批量处理
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left: Queue */}
        <DocumentList 
          documents={documents}
          selectedDoc={selectedDoc}
          loading={listLoading}
          error={listError}
          onSelect={setSelectedDoc}
          onRefresh={fetchDocuments}
        />

        {/* Right: Details Tabs */}
        <Card className="lg:col-span-2 shadow-md border border-border/80 flex flex-col h-full overflow-hidden bg-white">
          <CardHeader className="pb-0 shrink-0 border-b bg-muted/20">
            <div className="flex items-center justify-between mb-2">
               <div>
                  <CardTitle className="text-xl font-bold">解析详情</CardTitle>
                  <CardDescription className="text-sm">
                    {selectedDoc ? `当前查看: ${selectedDoc.name}` : '请选择文档查看详情'}
                  </CardDescription>
               </div>
            </div>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 pb-1 h-auto gap-2 border-b border-border/30">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md rounded-b-none py-3 text-base font-medium"
                >
                  概览
                </TabsTrigger>
                <TabsTrigger 
                  value="content" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md rounded-b-none py-3 text-base font-medium"
                >
                  内容分类
                </TabsTrigger>
                <TabsTrigger 
                  value="export" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md rounded-b-none py-3 text-base font-medium"
                >
                  导出
                </TabsTrigger>
                <TabsTrigger 
                  value="storage" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md rounded-b-none py-3 text-base font-medium"
                >
                  入库
                </TabsTrigger>
              </TabsList>

              <div className="p-6 bg-background min-h-[550px] rounded-b-md">
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab doc={selectedDoc} />
                </TabsContent>

                <TabsContent value="content" className="mt-0">
                  <ContentTab details={docDetails} loading={detailsLoading} />
                </TabsContent>
                
                <TabsContent value="export" className="mt-0">
                  {/* <ExportTab /> 占位 */}
                  <div className="text-center text-muted-foreground py-10">导出模块待拆分...</div>
                </TabsContent>

                <TabsContent value="storage" className="mt-0">
                   {/* <StorageTab /> 占位 */}
                   <div className="text-center text-muted-foreground py-10">入库模块待拆分...</div>
                </TabsContent>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {/* 内容区域已移动到 Header 的 Tabs 内部，为了更好的样式控制 */}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}