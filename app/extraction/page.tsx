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
import { ValueDisplayCell } from "@/components/extraction/value-display-cell"
import { ExtractionProgress } from "@/components/extraction/extraction-progress"
import { useSchemaGeneration } from "@/hooks/use-schema-generation"
import { useExtraction } from "@/hooks/use-extraction"
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
import { feedback } from "@/lib/feedback"

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

export default function InformationExtractionPage() {
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState("")
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
  
  // Schema generation hook
  const { handleGenerateSchema, taskId: generatedTaskId } = useSchemaGeneration({
    document: selectedDocument,
    onSchemaGenerated: setSchemaData,
    onProcessingChange: setProcessing,
    onStartTimeChange: setStartTime,
    onProgressChange: setProgress,
    onStatusTextChange: setStatusText
  })
  
  // Extraction hook
  const { handleSaveSchema } = useExtraction({
    document: selectedDocument,
    schemaData,
    taskId: taskId || generatedTaskId,
    onSchemaDataChange: setSchemaData,
    onProcessingChange: setProcessing,
    onStartTimeChange: setStartTime,
    onProgressChange: setProgress,
    onStatusTextChange: setStatusText
  })
  
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
      feedback.error("无法加载文档列表")
    } finally {
      setLoadingDocuments(false)
    }
  }
  
  const handleDocumentSelect = async (doc: any) => {
    setSelectedDocument(doc)
    setIsDocumentDialogOpen(false)
    setTaskId(doc.id) 
    feedback.success(`已选择文档: ${doc.name}`)
    await handleGenerateSchema(doc)
  }

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
      feedback.error("该字段已存在")
      return
    }

    updatedSchema[selectedCategory][newField.key] = [] 
    setSchemaData(updatedSchema)
    setNewField({ category: '', key: '', value: '' })
    setNewFieldDialogOpen(false)
    feedback.success("字段添加成功")
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
    feedback.success(deletedCount > 1 ? `已删除 ${deletedCount} 个字段` : "字段已删除")
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
       feedback.error("该字段名已存在")
       return
     }
     
     const value = categoryData[originalKey]
     delete categoryData[originalKey]
     categoryData[newKey] = value
     
     setSchemaData(updatedSchema)
     setEditingField(null)
     feedback.success("字段修改成功")
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

            <div className="flex items-center gap-2">
              {processing && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-current"></div>
                  <span className="text-sm font-medium">处理中</span>
                </div>
              )}
            </div>
            
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
                               {/* 使用拆分后的值显示组件 */}
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
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 右下角进度条 */}
      <ExtractionProgress 
        progress={progress}
        statusText={statusText}
        isVisible={processing}
        type={taskId ? "extraction" : "schema"}
        startTime={startTime}
      />
    </div>
  )
}