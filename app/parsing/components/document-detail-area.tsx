import React from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { List } from "lucide-react"
import { OverviewTab } from "@/components/document/tabs/overview-tab"
import { ContentTab } from "@/components/document/tabs/content-tab"
import { ExportTab } from "@/components/document/tabs/export-tab"
import { StorageTab } from "@/components/document/tabs/storage-tab"
import { Document, DocumentDetails, DocumentStatistics } from "@/types/document"

interface DocumentDetailAreaProps {
  selectedDoc: Document | null
  docDetails: DocumentDetails | null
  detailsLoading: boolean
  docStatistics: DocumentStatistics | null
  statisticsLoading: boolean
  isParsing: boolean
  parsingProgress: number
  parsingStatusText: string
  // 新增：是否已完成智能解析
  isSmartParsingCompleted?: boolean;
}

export function DocumentDetailArea({
  selectedDoc,
  docDetails,
  detailsLoading,
  docStatistics,
  statisticsLoading,
  isParsing,
  parsingProgress,
  parsingStatusText,
  isSmartParsingCompleted = false
}: DocumentDetailAreaProps) {
  const searchParams = useSearchParams()

  const handleTablePreview = (tablePath: string) => {
    if (!selectedDoc) return '';
    const agentUserId = searchParams.get('agentUserId') || '123';
    return `/api/file-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${selectedDoc.id}/${tablePath}`;
  }

  const handleTableEdit = (tablePath: string) => {
    if (!selectedDoc) return;
    const agentUserId = searchParams.get('agentUserId') || '123';
    
    // 构造跳转 URL
    // 1. 获取物理文件名 (例如 XA_certificate_res.docx)
    // const physicalFileName = selectedDoc.physicalName || selectedDoc.name;
    
    // 2. 从 tablePath 中提取纯文件名 (例如 XA_certificate_1.xlsx)
    const tableFileName = tablePath.split('/').pop() || '';
    
    // 3. 直接使用原始文件名，不再使用自定义名称
    const displayName = tableFileName;
    
    // 4. 构造回调 URL，用于保存编辑后的内容
    // 必须传递 subDir=table，以确保保存到正确的 table 子目录
    // 注意：这里我们复用 pdf-ocr-editor 的逻辑，将 agentUserId 和 taskId 传递给 excel-editor
    
    const query = new URLSearchParams({
      docUrl: `/api/file-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${selectedDoc.id}/${tablePath}`,
      docName: displayName, // 使用原始文件名
      agentUserId: agentUserId,
      taskId: selectedDoc.id,
      tableDir: 'table',
      subDir: 'table' // 明确指定子目录
    });
    
    // 使用 window.open 在新标签页打开，避免覆盖当前页面
    window.open(`/excel-editor?${query.toString()}`, '_blank');
  }

  return (
    <Card className="flex-1 shadow-sm border border-border/60 flex flex-col min-h-[600px] lg:min-h-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-0 shrink-0 border-b border-border/40 bg-muted/20 pt-4 px-6">
        <div className="flex items-center justify-between mb-4">
           <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <List className="w-4 h-4" />
                解析详情
              </CardTitle>
              <CardDescription className="text-xs mt-1 ml-6">
                {selectedDoc ? `当前查看: ${selectedDoc.customName ? `${selectedDoc.customName}.docx` : selectedDoc.name}` : '请从左侧选择文档查看详情'}
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
          
          <div className="flex-1 bg-transparent pt-4"> 
            <TabsContent value="overview" className="mt-0 pr-2 pb-4">
              <OverviewTab 
                doc={selectedDoc} 
                isParsing={isParsing}
                parsingProgress={parsingProgress}
                parsingStatusText={parsingStatusText}
                statistics={docStatistics}
                statisticsLoading={statisticsLoading}
                isSmartParsingCompleted={isSmartParsingCompleted}
              />
            </TabsContent>

            <TabsContent value="content" className="mt-0">
              <ContentTab 
                details={docDetails} 
                loading={detailsLoading || isParsing} 
                onTablePreview={handleTablePreview}
                onTableEdit={handleTableEdit}
              />
            </TabsContent>
            
            <TabsContent value="export" className="mt-0 pr-2 pb-4">
              <ExportTab 
                doc={selectedDoc}
                details={docDetails}
                loading={detailsLoading}
              />
            </TabsContent>

            <TabsContent value="storage" className="mt-0 h-full overflow-auto pr-2 pb-4">
                <StorageTab doc={selectedDoc} />
            </TabsContent>
          </div>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
      </CardContent>
    </Card>
  )
}
