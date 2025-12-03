"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  RefreshCw, 
  Save, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search, 
  FileText, 
  Layers, 
  Database,
  Clock,
  Copy,
  Maximize2,
  ChevronRight
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CategoryList } from "@/components/extraction/category-list"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DocumentList } from "@/components/document/document-list"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Types
interface SchemaField {
  id: string;
  key: string;
  value: any;
}

interface SchemaCategory {
  name: string;
  fields: SchemaField[];
}

// ----------------------------------------------------------------------------
// 优化组件：长文本展示单元格 (带复制功能)
// ----------------------------------------------------------------------------
const ValueDisplayCell = ({ value }: { value: any }) => {
  const [copied, setCopied] = useState(false)
  
  if (!value || (Array.isArray(value) && value.length === 0) || value === "") {
    return (
       <Badge variant="outline" className="text-muted-foreground bg-muted/50 border font-normal">
         {Array.isArray(value) ? "等待提取..." : "空值"}
       </Badge>
    )
  }

  const stringValue = String(value)
  const isLongText = stringValue.length > 30

  const handleCopy = () => {
    // 检查 clipboard API 是否可用
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(stringValue)
        .then(() => {
          setCopied(true)
          toast.success("内容已复制")
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => {
          console.error('复制失败:', err)
          // 降级方案：使用传统方法
          fallbackCopyToClipboard(stringValue)
          setCopied(true)
          toast.success("内容已复制")
          setTimeout(() => setCopied(false), 2000)
        })
    } else {
      // 降级方案：使用传统方法
      fallbackCopyToClipboard(stringValue)
      setCopied(true)
      toast.success("内容已复制")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 降级复制方案
  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }

  return (
    <div className="flex items-center gap-2 max-w-full">
       <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
       </span>
       
       {isLongText ? (
         <Popover>
           <PopoverTrigger asChild>
             <div className="group flex items-center gap-2 cursor-pointer hover:bg-muted/10 p-1.5 rounded-md transition-colors border border-transparent hover:border">
                <span className="font-mono text-sm text-foreground truncate max-w-[200px] xl:max-w-[300px]" title="点击查看完整内容">
                  {stringValue}
                </span>
                <Maximize2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
           </PopoverTrigger>
           <PopoverContent className="w-[400px] p-0" align="start">
             <div className="bg-muted/50 border-b px-4 py-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground">完整内容</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
             </div>
             <div className="p-4 max-h-[300px] overflow-y-auto bg-background text-sm font-mono whitespace-pre-wrap break-all text-foreground leading-relaxed">
               {stringValue}
             </div>
           </PopoverContent>
         </Popover>
       ) : (
         <div className="group flex items-center gap-2">
            <span className="font-mono text-sm text-foreground bg-emerald-50/50 px-2 py-1 rounded border border-emerald-100/50">
              {stringValue}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
            >
               {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
            </Button>
         </div>
       )}
    </div>
  )
}


export default function InformationExtractionPage() {
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<string>("00:00")
  const [schemaData, setSchemaData] = useState<Record<string, any>>({})
  const [taskId, setTaskId] = useState<string>("") 
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // Edit state
  const [editingField, setEditingField] = useState<{category: string, id: string, key: string, value: string} | null>(null)
  
  // Bulk Action State
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk', ids: string[] } | null>(null)

  // New Field State
  const [newFieldDialogOpen, setNewFieldDialogOpen] = useState(false)
  const [newField, setNewField] = useState({ category: '', key: '', value: '' })

  
  // Document Selection State
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  
  // Load documents when dialog opens
  useEffect(() => {
    if (isDocumentDialogOpen) {
      fetchDocuments()
    }
  }, [isDocumentDialogOpen])

  const fetchDocuments = async () => {
    setLoadingDocuments(true)
    try {
      const res = await fetch('/api/document/list')
      if (!res.ok) throw new Error('Failed to fetch documents')
      const data = await res.json()
      if (data.ok) {
        setDocuments(data.data)
      }
    } catch (error) {
      console.error(error)
      toast.error("无法加载文档列表")
    } finally {
      setLoadingDocuments(false)
    }
  }
  
  const handleDocumentSelect = async (doc: any) => {
    setSelectedDocument(doc)
    setIsDocumentDialogOpen(false)
    setTaskId(doc.id) 
    toast.success(`已选择文档: ${doc.name}`)
    await handleGenerateSchema(doc)
  }

  const handleGenerateSchema = async (doc: any) => {
    setProcessing(true)
    setStartTime(Date.now())
    setSchemaData({}) 
    
    try {
      const agentUserId = 123; 
      const currentTaskId = doc.id;
      const physicalName = doc.physicalName || doc.name;
      
      const contentFileHostPath = `/home/cqj/my-doc-system-uploads/save/${agentUserId}/${currentTaskId}/${physicalName}`;
      const outputJsonDirHost = "/root/zzp/langextract-main/zzpextract/generater_json"; 
      
      const res = await fetch('/api/extraction/schema/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          status: 0,
          agentUserId: agentUserId,
          content_file: contentFileHostPath,
          schema_map_file: outputJsonDirHost
        })
      })

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to start schema generation: ${errorData.error || 'Unknown error'}`);
      }
      
      toast.info("正在分析文档生成Schema...")

      let attempts = 0;
      const maxAttempts = 30; 
      
      const pollSchema = async () => {
        try {
          const schemaRes = await fetch(`/api/extraction/schema?taskId=${currentTaskId}&type=generated`)
          if (schemaRes.ok) {
             const data = await schemaRes.json()
             if (Object.keys(data).length > 0) {
               setSchemaData(data)
               toast.success("Schema生成完毕")
               return true
             }
          }
        } catch (e) { console.error(e) }
        return false
      }

      const interval = setInterval(async () => {
        attempts++;
        const success = await pollSchema();
        if (success || attempts >= maxAttempts) {
           clearInterval(interval)
           setProcessing(false)
           setStartTime(null)
           if (!success) toast.error("Schema生成超时，请重试")
        }
      }, 2000)

    } catch (error) {
      console.error(error)
      toast.error("Schema生成失败")
      setProcessing(false)
      setStartTime(null)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (processing && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0')
        const seconds = (diff % 60).toString().padStart(2, '0')
        setElapsedTime(`${minutes}:${seconds}`)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [processing, startTime])

  // Process data into categories for display
  const categories = useMemo(() => {
    return Object.entries(schemaData).map(([name, fields]) => ({
      name,
      fields: Object.entries(fields as Record<string, any>).map(([key, value], index) => ({
        id: `${name}-${key}-${index}`,
        key,
        value
      }))
    }))
  }, [schemaData])

  // Statistics
  const stats = useMemo(() => {
    const totalCategories = categories.length
    const totalFields = categories.reduce((acc, cat) => acc + cat.fields.length, 0)
    return { totalCategories, totalFields }
  }, [categories])

  const displayedFields = useMemo(() => {
    if (!selectedCategory) return []
    const category = categories.find(c => c.name === selectedCategory)
    if (!category) return []
    if (!searchQuery.trim()) return category.fields
    return category.fields.filter(field => 
      field.key.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [categories, selectedCategory, searchQuery])

  useEffect(() => {
    setSelectedFieldIds([])
  }, [selectedCategory])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFieldIds(displayedFields.map(f => f.id))
    } else {
      setSelectedFieldIds([])
    }
  }

  const handleSelectField = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedFieldIds(prev => [...prev, id])
    } else {
      setSelectedFieldIds(prev => prev.filter(fid => fid !== id))
    }
  }

  const handleAddField = () => {
    if (!selectedCategory || !newField.key.trim()) return

    const updatedSchema = { ...schemaData }
    if (!updatedSchema[selectedCategory]) {
      updatedSchema[selectedCategory] = {}
    }
    
    if (updatedSchema[selectedCategory][newField.key]) {
      toast.error("该字段已存在")
      return
    }

    updatedSchema[selectedCategory][newField.key] = [] 
    setSchemaData(updatedSchema)
    setNewField({ category: '', key: '', value: '' })
    setNewFieldDialogOpen(false)
    toast.success("字段添加成功")
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || !selectedCategory) return

    const updatedSchema = { ...schemaData }
    const categoryData = updatedSchema[selectedCategory]
    
    if (!categoryData) return

    let deletedCount = 0

    if (deleteTarget.type === 'single') {
      const fields = categories.find(c => c.name === selectedCategory)?.fields || []
      const targetField = fields.find(f => f.id === deleteTarget.ids[0])
      
      if (targetField) {
        delete categoryData[targetField.key]
        deletedCount = 1
      }
    } else {
      const fields = categories.find(c => c.name === selectedCategory)?.fields || []
      const targetIds = new Set(deleteTarget.ids)
      
      fields.forEach(field => {
        if (targetIds.has(field.id)) {
           delete categoryData[field.key]
           deletedCount++
        }
      })
      setSelectedFieldIds([])
    }

    setSchemaData(updatedSchema)
    setDeleteConfirmOpen(false)
    setDeleteTarget(null)
    toast.success(deletedCount > 1 ? `已删除 ${deletedCount} 个字段` : "字段已删除")
  }

  const initiateDelete = (id: string) => {
    setDeleteTarget({ type: 'single', ids: [id] })
    setDeleteConfirmOpen(true)
  }

  const initiateBulkDelete = () => {
    if (selectedFieldIds.length === 0) return
    setDeleteTarget({ type: 'bulk', ids: [...selectedFieldIds] })
    setDeleteConfirmOpen(true)
  }
  
  const handleSaveEdit = (originalKey: string, newKey: string) => {
     if (!editingField || !selectedCategory) return
     
     if (originalKey === newKey) {
       setEditingField(null)
       return
     }
     
     const updatedSchema = { ...schemaData }
     const categoryData = updatedSchema[selectedCategory]
     
     if (categoryData[newKey]) {
       toast.error("该字段名已存在")
       return
     }
     
     const value = categoryData[originalKey]
     delete categoryData[originalKey]
     categoryData[newKey] = value
     
     setSchemaData(updatedSchema)
     setEditingField(null)
     toast.success("字段修改成功")
  }

  const handleSaveSchema = async () => {
    if (!selectedDocument) {
      toast.error("请先选择一个文档")
      return
    }

    setProcessing(true)
    setStartTime(Date.now())
    
    try {
      const agentUserId = 123; 
      const currentTaskId = taskId || selectedDocument.id;
      const physicalName = selectedDocument.physicalName || selectedDocument.name;
      
      // Step 1: 保存逻辑 (这里直接保留了你的原始逻辑，只是不再展示UI)
      const resSaveSchema = await fetch('/api/debug/check-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          schemaData: schemaData
        })
      })
      
      if (!resSaveSchema.ok) throw new Error('Failed to save schema data')
      const saveResult = await resSaveSchema.json()
      if (!saveResult.success) throw new Error('Failed to save schema data')
      
      toast.info("Schema已保存，开始智能抽取...")
      
      // Step 2: 启动抽取
      const contentFileHostPath = `/home/cqj/my-doc-system-uploads/save/${agentUserId}/${currentTaskId}/${physicalName}`;
      const schemaFileHostPath = `/root/zzp/langextract-main/zzpextract/extractenti_json/${agentUserId}/${currentTaskId}.json`;
      const outputJsonDirHost = "/root/zzp/langextract-main/zzpextract/output"; 

      const resExtract = await fetch('/api/extraction/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          status: 0,
          agentUserId: agentUserId,
          content: contentFileHostPath, 
          schema_map: schemaFileHostPath, 
          output_json_file: outputJsonDirHost
        })
      })

      if (!resExtract.ok) throw new Error('Failed to start extraction')
      
      toast.success("AI 正在读取文档...")

      // Step 3: 轮询结果
      const pollResult = async () => {
        let attempts = 0;
        const maxAttempts = 20; 
        
        const intervalId = setInterval(async () => {
          attempts++;
          try {
            const res = await fetch(`/api/extraction/schema?taskId=${currentTaskId}&type=result`);
            
            if (res.status === 404) return;

            if (res.ok) {
              const resultData = await res.json();
              if (resultData && Object.keys(resultData).length > 0) {
                clearInterval(intervalId);
                setSchemaData(resultData);
                setProcessing(false);
                setStartTime(null);
                toast.success("🎉 提取完成！数据已更新");
                return;
              }
            }
            
            if (attempts >= maxAttempts) {
              clearInterval(intervalId);
              setProcessing(false);
              setStartTime(null);
              toast.error("提取时间较长，请稍后刷新页面查看");
            }
          } catch (e) {
            console.error("轮询出错", e);
          }
        }, 3000); 
      };

      pollResult();

    } catch (error) {
      console.error("Error in handleSaveSchema:", error)
      toast.error(`抽取任务启动失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setProcessing(false)
    }
  }

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Layers className="h-6 w-6 text-violet-600" />
              智能信息抽取配置
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">
              配置抽取模版，AI 将自动识别文档中的实体分类与关键字段
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
               <DialogTrigger asChild>
                 <Button variant="outline" className="gap-2 bg-card border hover:bg-accent hover:text-accent-foreground transition-all">
                   <FileText className="w-4 h-4 text-primary" />
                   {selectedDocument ? (
                     <span className="max-w-[150px] truncate">{selectedDocument.name}</span>
                   ) : "选择文档"}
                 </Button>
               </DialogTrigger>
               <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                 <DialogHeader>
                   <DialogTitle>选择文档源</DialogTitle>
                   <DialogDescription>
                     从已上传的文档库中选择一个文件进行分析
                   </DialogDescription>
                 </DialogHeader>
                 <div className="flex-1 overflow-hidden min-h-0 border rounded-md">
                    <DocumentList
                      documents={documents}
                      selectedDoc={selectedDocument}
                      loading={loadingDocuments}
                      error={null}
                      selectedIds={selectedDocument ? [selectedDocument.id] : []}
                      onSelect={handleDocumentSelect}
                      onRefresh={fetchDocuments}
                      onToggleSelect={() => {}}
                      onToggleAll={() => {}}
                      onViewDocument={() => {}}
                    />
                 </div>
               </DialogContent>
            </Dialog>

            {processing && (
               <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg border border-primary/20 animate-pulse">
                 <Clock className="w-4 h-4" />
                 <span className="font-medium text-sm tabular-nums">{elapsedTime}</span>
               </div>
            )}
            <Button
                    onClick={handleSaveSchema}
                    disabled={processing || loading || !selectedDocument}
                    className={cn(
                      "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all min-w-[140px]",
                      processing && "opacity-80 cursor-not-allowed"
                    )}
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        正在处理...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存并抽取
                      </>
                    )}
                  </Button>
          </div>
        </div>

        {/* Stats Section - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-4 rounded-xl border shadow-sm flex items-center justify-between">
             <div>
               <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">分类总数</p>
               <p className="text-2xl font-bold text-foreground mt-1">{stats.totalCategories}</p>
             </div>
             <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
               <Layers className="h-5 w-5 text-primary" />
             </div>
          </div>
          <div className="bg-card p-4 rounded-xl border shadow-sm flex items-center justify-between">
             <div>
               <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">字段总数</p>
               <p className="text-2xl font-bold text-foreground mt-1">{stats.totalFields}</p>
             </div>
             <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center">
               <Database className="h-5 w-5 text-secondary-foreground" />
             </div>
          </div>
          <div className="bg-card p-4 rounded-xl border shadow-sm flex items-center justify-between">
             <div>
               <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">当前状态</p>
               <div className="flex items-center gap-2 mt-1">
                 <div className={`h-2.5 w-2.5 rounded-full ${processing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                 <span className="text-lg font-bold text-foreground">{processing ? '运行中' : '就绪'}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Main Content Area: Responsive Layout */}
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-320px)] min-h-[500px]">
          
          {/* Categories Sidebar */}
          <Card className="w-full lg:w-[320px] xl:w-[380px] flex flex-col border shadow-md shrink-0 overflow-hidden">
             <CardContent className="p-0 flex-1 bg-muted/30 min-h-0">
               <ScrollArea className="h-full w-full">
                 <div className="p-4 w-full min-w-0"> 
                   <CategoryList 
                     categories={categories} 
                     selectedCategory={selectedCategory} 
                     onSelectCategory={setSelectedCategory} 
                   />
                 </div>
               </ScrollArea>
             </CardContent>
          </Card>

          {/* Fields Editor Table */}
          <Card className="flex-1 flex flex-col border shadow-md overflow-hidden bg-card min-w-0">
            <CardHeader className="py-4 px-6 border-b bg-card z-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-card-foreground truncate">
                      {selectedCategory || '请选择一个分类'}
                    </h3>
                    {selectedCategory && (
                      <Badge variant="secondary" className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                        {displayedFields.length} 个字段
                      </Badge>
                    )}
                  </div>
                </div>
                
                {selectedCategory && (
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    {selectedFieldIds.length > 0 && (
                       <Button 
                         variant="destructive" 
                         size="sm" 
                         onClick={initiateBulkDelete}
                         className="mr-2 h-9"
                       >
                         <Trash2 className="h-4 w-4 mr-1" />
                         删除 ({selectedFieldIds.length})
                       </Button>
                    )}
                    <div className="relative flex-1 sm:w-60">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索字段..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-muted/50 border focus:bg-background transition-colors"
                      />
                    </div>
                    <Dialog open={newFieldDialogOpen} onOpenChange={setNewFieldDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="icon" className="h-9 w-9 bg-primary hover:bg-primary/90 shadow-sm">
                          <Plus className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>添加字段</DialogTitle>
                          <DialogDescription>
                            在 <span className="font-bold text-foreground">{selectedCategory}</span> 分类下添加新字段。
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="field-name">字段名称</Label>
                          <Input
                            id="field-name"
                            value={newField.key}
                            onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                            placeholder="例如：合同编号"
                            className="mt-2"
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setNewFieldDialogOpen(false)}>取消</Button>
                          <Button onClick={handleAddField} className="bg-primary hover:bg-primary/90">确认添加</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 bg-card min-h-0 relative">
              {selectedCategory ? (
                <ScrollArea className="h-full">
                  {/* 使用 fixed layout 防止表格被撑爆 */}
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow className="hover:bg-transparent border">
                        <TableHead className="w-[50px] pl-6">
                          <Checkbox 
                            checked={displayedFields.length > 0 && selectedFieldIds.length === displayedFields.length}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </TableHead>
                        <TableHead className="w-[25%] text-muted-foreground font-semibold">字段名称</TableHead>
                        <TableHead className="w-auto text-muted-foreground font-semibold">提取内容 / 默认值</TableHead>
                        <TableHead className="w-[120px] text-right pr-6 text-muted-foreground font-semibold">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedFields.length > 0 ? (
                        displayedFields.map((field) => (
                          <TableRow key={field.id} className="group hover:bg-muted/30 border transition-colors">
                            <TableCell className="pl-6">
                              <Checkbox 
                                checked={selectedFieldIds.includes(field.id)}
                                onCheckedChange={(checked) => handleSelectField(field.id, !!checked)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {editingField?.id === field.id ? (
                                <Input
                                  value={editingField.key}
                                  onChange={(e) => setEditingField({ ...editingField, key: e.target.value })}
                                  className="h-8 w-full max-w-xs border-primary/30 focus:ring-primary/20"
                                  autoFocus
                                />
                              ) : (
                                <span>{field.key}</span>
                              )}
                            </TableCell>
                            <TableCell>
                               {/* 优化后的值显示组件 */}
                               <ValueDisplayCell value={field.value} />
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {editingField?.id === field.id ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-primary hover:text-primary/90 hover:bg-primary/10 rounded-full"
                                    onClick={() => handleSaveEdit(field.key, editingField.key)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-muted-foreground/90 hover:bg-muted/10 rounded-full"
                                    onClick={() => setEditingField(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                    onClick={() => setEditingField({
                                      category: selectedCategory,
                                      id: field.id,
                                      key: field.key,
                                      value: JSON.stringify(field.value)
                                    })}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                    onClick={() => initiateDelete(field.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-48 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                               <Search className="h-10 w-10 mb-2 opacity-20" />
                               <p>{searchQuery ? '未找到匹配的字段' : '该分类下暂无字段'}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                  <div className="bg-background rounded-full p-6 mb-4 border shadow-sm">
                     <Layers className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-foreground font-medium mb-1">未选择分类</h3>
                  <p className="text-sm text-muted-foreground">请从左侧列表选择一个分类以管理其字段</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'bulk' 
                ? `您确定要删除选中的 ${deleteTarget.ids.length} 个字段吗？` 
                : "您确定要删除这个字段吗？"}
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
               setDeleteConfirmOpen(false)
               setDeleteTarget(null)
            }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} variant="destructive">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}