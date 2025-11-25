"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import http from "@/lib/http"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, Zap, Trash2, Download, LayoutGrid, List } from "lucide-react"

import { DocumentList } from "@/components/document/document-list"
import { OverviewTab } from "@/components/document/tabs/overview-tab"
import { ContentTab } from "@/components/document/tabs/content-tab"
import { Document, DocumentDetails } from "@/types/document"

export default function DocumentParsingInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const [listLoading, setListLoading] = useState<boolean>(true)
  const [listError, setListError] = useState<string | null>(null)
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)

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
        if (!selectedDoc && res.data.length > 0) {
          setSelectedDoc(res.data[0])
        }
      } else {
        setDocuments([])
        setListError(res?.message || '无法加载文档列表')
      }
    } catch (e: any) {
      setDocuments([])
      setListError('加载文档列表失败')
    } finally {
      setListLoading(false)
    }
  }, [searchParams, selectedDoc])

  const fetchDocumentDetails = useCallback(async (docId: string) => {
    if (!docId) return;
    try {
      setDetailsLoading(true);
      setDocDetails(null); 
      await new Promise(r => setTimeout(r, 600));
      setDocDetails({ text: [], tables: [], images: [] }); 
    } catch (error) {
      console.error(error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(documents.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 跳转查看/编辑逻辑
  const handleViewDocument = (doc: Document) => {
    // 获取当前的 agentUserId，如果没有则为空字符串
    const agentUserId = searchParams.get('agentUserId') || '';
    
    // 构建查询参数
    const query = new URLSearchParams({
        fileName: doc.name,
        docName: doc.name,
        // 假设 doc 对象里有 taskId (id)，如果是真实数据需要确认字段名
        taskId: doc.id, 
        mode: 'edit' // 默认进入编辑模式
    });

    if (agentUserId) {
        query.append('agentUserId', agentUserId);
    }

    // 跳转到 pdf-ocr-editor 页面
    router.push(`/pdf-ocr-editor?${query.toString()}`);
  };

  const handleBatchParse = () => {
    if (selectedIds.length === 0) return;
    alert(`开始批量解析 ${selectedIds.length} 个文档`);
  };

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  useEffect(() => {
    if (selectedDoc && selectedDoc.status === 'completed') {
       fetchDocumentDetails(selectedDoc.id);
    } else {
       setDocDetails(null);
    }
  }, [selectedDoc, fetchDocumentDetails]);

  return (
    // 背景色调整：使用系统默认背景，不强制白色，允许淡粉色透出
    <div className="p-4 md:p-6 space-y-4 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      
      {/* Header: 增加玻璃拟态效果 */}
      <div className="flex items-center justify-between shrink-0 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            文档解析工作台
          </h1>
          <p className="text-muted-foreground text-xs mt-1 ml-8">智能视觉解析技术 • 多类型内容识别</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedIds.length > 0 ? (
             <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <span className="text-xs font-medium text-primary mr-2">已选 {selectedIds.length} 项</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs shadow-sm">
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  删除
                </Button>
                <Button size="sm" className="h-7 text-xs shadow-sm bg-primary hover:bg-primary/90">
                  <Zap className="w-3 h-3 mr-1.5" />
                  批量解析
                </Button>
             </div>
          ) : (
             <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={listLoading} className="bg-white/50 hover:bg-white border-border/60 shadow-sm">
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                  刷新列表
                </Button>
                <Button size="sm" className="shadow-md bg-primary hover:bg-primary/90 transition-all">
                  <Zap className="w-3.5 h-3.5 mr-2" />
                  一键解析
                </Button>
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* Left: Queue */}
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

        {/* Right: Details Tabs */}
        <Card className="lg:col-span-2 shadow-sm border border-border/60 flex flex-col h-full overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-0 shrink-0 border-b border-border/40 bg-muted/20 pt-4 px-6">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <List className="w-4 h-4" />
                    解析详情
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 ml-6">
                    {selectedDoc ? `当前查看: ${selectedDoc.name}` : '请从左侧选择文档查看详情'}
                  </CardDescription>
               </div>
            </div>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 h-auto gap-6">
                {['overview', 'content', 'export', 'storage'].map(tab => (
                  <TabsTrigger 
                    key={tab}
                    value={tab} 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3 pt-2 text-sm data-[state=active]:text-primary px-0 font-medium transition-all hover:text-primary/80"
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
              
              <div className="flex-1 min-h-0 overflow-hidden bg-transparent pt-4"> 
                <TabsContent value="overview" className="mt-0 h-full overflow-auto pr-2 pb-4">
                  <OverviewTab doc={selectedDoc} />
                </TabsContent>

                <TabsContent value="content" className="mt-0 h-full overflow-hidden">
                  <ContentTab details={docDetails} loading={detailsLoading} />
                </TabsContent>
                
                <TabsContent value="export" className="mt-0 h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground text-sm">导出功能开发中...</div>
                </TabsContent>

                <TabsContent value="storage" className="mt-0 h-full flex items-center justify-center">
                   <div className="text-center text-muted-foreground text-sm">入库功能开发中...</div>
                </TabsContent>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
          </CardContent>
        </Card>
      </div>
    </div>
  )
}