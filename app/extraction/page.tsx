
"use client"

import { useState, useMemo, useEffect } from "react"
import { DocumentList } from "@/components/document/document-list"
import { useDocumentList } from "@/hooks/use-document-list"
import { useEntityExtraction } from "@/hooks/use-entity-extraction"
import { Document } from "@/types/document"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Play, Save, Plus, Trash2, Edit2, Check, X, FileJson, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Helper to flatten the nested JSON structure for display
const flattenEntities = (data: any) => {
  const flattened: any[] = [];
  if (!data) return flattened;

  Object.entries(data).forEach(([category, fields]: [string, any]) => {
    Object.entries(fields).forEach(([field, values]: [string, any]) => {
      // If values is array, it might be multiple extractions for same field
      if (Array.isArray(values)) {
        if (values.length === 0) {
           flattened.push({
            id: `${category}-${field}-empty`,
            category,
            field,
            value: '',
            context: ''
          });
        } else {
          values.forEach((val: any, idx: number) => {
            // Value can be string or object
            const valueText = typeof val === 'object' ? JSON.stringify(val) : val;
            flattened.push({
              id: `${category}-${field}-${idx}`,
              category,
              field,
              value: valueText,
              context: '' // Context might not be available in this simple structure
            });
          });
        }
      } else {
        flattened.push({
          id: `${category}-${field}`,
          category,
          field,
          value: typeof values === 'object' ? JSON.stringify(values) : values,
          context: ''
        });
      }
    });
  });
  return flattened;
};

// Helper to reconstruct the nested JSON structure from flattened data
const reconstructEntities = (flattened: any[]) => {
  const result: any = {};
  
  flattened.forEach(item => {
    if (!result[item.category]) {
      result[item.category] = {};
    }
    
    if (!result[item.category][item.field]) {
      result[item.category][item.field] = [];
    }
    
    if (item.value && item.value.trim() !== '') {
       // Try to parse if it looks like JSON/Object, otherwise keep as string
       let val = item.value;
       try {
         if (val.startsWith('{') || val.startsWith('[')) {
           val = JSON.parse(val);
         }
       } catch (e) {
         // keep as string
       }
       result[item.category][item.field].push(val);
    }
  });
  
  return result;
};

export default function InformationExtractionPage() {
  const { documents, loading: listLoading, error: listError, refresh: refreshList } = useDocumentList()
  const { task, startExtraction, startGeneration, resetTask } = useEntityExtraction()
  
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Entity State
  const [entities, setEntities] = useState<any[]>([])
  const [rawEntities, setRawEntities] = useState<any>({})
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [newEntityDialogOpen, setNewEntityDialogOpen] = useState(false)
  const [newEntity, setNewEntity] = useState({ category: '', field: '', value: '', context: '' })
  const [formErrors, setFormErrors] = useState<{ category?: string; field?: string }>({})
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchField, setSearchField] = useState<'all' | 'category' | 'field' | 'value'>('all')
  
  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)

  // Filter documents to show only DOCX as per requirement or all
  const filteredDocuments = useMemo(() => {
    return documents;
  }, [documents]);

  // Filter entities based on search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entities;
    
    const query = searchQuery.toLowerCase();
    
    return entities.filter(entity => {
      switch (searchField) {
        case 'category':
          return entity.category.toLowerCase().includes(query);
        case 'field':
          return entity.field.toLowerCase().includes(query);
        case 'value':
          return entity.value.toLowerCase().includes(query);
        case 'all':
        default:
          return (
            entity.category.toLowerCase().includes(query) ||
            entity.field.toLowerCase().includes(query) ||
            entity.value.toLowerCase().includes(query)
          );
      }
    });
  }, [entities, searchQuery, searchField]);

  // Extract categories from entities
  useEffect(() => {
    const uniqueCategories = Array.from(new Set(entities.map(e => e.category)));
    setCategories(uniqueCategories);
  }, [entities]);

  // Category management functions
  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleDeleteCategory = (category: string) => {
    setCategories(categories.filter(c => c !== category));
    // Also remove entities with this category
    setEntities(entities.filter(e => e.category !== category));
  };

  const handleEditCategory = (oldCategory: string, newCategoryValue: string) => {
    if (newCategoryValue.trim() && newCategoryValue !== oldCategory) {
      setCategories(categories.map(c => c === oldCategory ? newCategoryValue.trim() : c));
      // Update all entities with this category
      setEntities(entities.map(e => 
        e.category === oldCategory ? { ...e, category: newCategoryValue.trim() } : e
      ));
    }
    setEditingCategory(null);
  };

  // Update entities when task completes
  useEffect(() => {
    if (task.status === 'completed' && task.result) {
      // When extraction is completed, we need to fetch the extracted data
      // The backend returns the file path, so we need to fetch the actual content
      if (task.result.file_path) {
        // Fetch the extracted JSON content from the backend
        fetchExtractedData(task.result.file_path);
      } else if (task.result.data) {
        // If data is directly included in the result
        setRawEntities(task.result.data);
        setEntities(flattenEntities(task.result.data));
      }
    }
  }, [task.status, task.result]);

  // Function to fetch extracted data from backend
  const fetchExtractedData = async (filePath: string) => {
    try {
      // We need to create an API endpoint to fetch the file content
      // For now, let's assume we have an endpoint that can return the file content
      const response = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
      
      if (response.ok) {
        const data = await response.json();
        setRawEntities(data);
        setEntities(flattenEntities(data));
      } else {
        console.error('Failed to fetch extracted data');
      }
    } catch (error) {
      console.error('Error fetching extracted data:', error);
    }
  };

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDoc(doc)
    // Reset extraction state when switching documents
    resetTask()
    setEntities([])
    setRawEntities({})
  }

  const handleExtract = async () => {
    if (!selectedDoc) return
    
    // Start extraction process - send only entity structure to backend
    await startExtraction({ 
      taskId: `${Date.now()}`, // Generate a task ID
      agentUserId: '123', // Hardcoded for now
      content: '', // We'll send the document content via the backend
      schemaMap: JSON.stringify(reconstructEntities(entities)), // Send current entity structure as schema
      outputJsonFile: `/tmp/output/${selectedDoc.id}` 
    })
  }
  
  const handleGenerate = async () => {
    if (!selectedDoc) return
    
    // Reconstruct JSON from current entities state
    const currentJson = reconstructEntities(entities);
    
    // Save/Generate call
    await startGeneration({
      taskId: `${Date.now()}_gen`,
      agentUserId: '123',
      contentFile: `/tmp/output/${selectedDoc.id}/${task.taskId}.json`, // Source JSON file?
      outputJsonFile: `/tmp/output/${selectedDoc.id}/final`
    })
  }
  
  const handleAddEntity = () => {
    // Validate form
    const errors: { category?: string; field?: string } = {}
    if (!newEntity.category.trim()) errors.category = "分类是必填项"
    if (!newEntity.field.trim()) errors.field = "字段是必填项"
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const id = `${newEntity.category}-${newEntity.field}-${Date.now()}`
    setEntities([...entities, { ...newEntity, id }])
    setNewEntity({ category: '', field: '', value: '', context: '' })
    setFormErrors({})
    setNewEntityDialogOpen(false)
  }
  
  const handleDeleteEntity = (id: string) => {
    setEntities(entities.filter(e => e.id !== id))
  }
  
  const handleUpdateEntity = (id: string, field: string, value: string) => {
    setEntities(entities.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar - File List */}
      <div className="w-full sm:w-[240px] lg:w-[280px] xl:w-[300px] border-r border-border/40 bg-background flex flex-col min-h-0">
        <DocumentList
          documents={filteredDocuments}
          selectedDoc={selectedDoc}
          loading={listLoading}
          error={listError}
          selectedIds={selectedIds}
          onSelect={handleDocumentSelect}
          onRefresh={refreshList}
          onToggleSelect={(id) => {
            setSelectedIds(prev => 
              prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            )
          }}
          onToggleAll={(checked) => {
            setSelectedIds(checked ? filteredDocuments.map(d => d.id) : [])
          }}
          onViewDocument={(doc) => console.log('View document', doc)}
          onSmartParse={(doc) => console.log('Smart parse', doc)}
        />
      </div>

      {/* Right Content Area - Extraction & Entity Management */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-muted/5">
        {selectedDoc ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {selectedDoc.name}
                  <Badge variant="outline">{selectedDoc.type}</Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {selectedDoc.id} | 大小: {selectedDoc.size}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleExtract} 
                  disabled={task.status === 'extracting' || task.status === 'generating'}
                >
                  {task.status === 'extracting' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在提取...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      提取实体
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={entities.length === 0 || task.status === 'extracting' || task.status === 'generating'}
                >
                   {task.status === 'generating' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在生成...
                    </>
                  ) : (
                    <>
                      <FileJson className="mr-2 h-4 w-4" />
                      生成JSON
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
              {task.status === 'idle' && entities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <FileJson className="h-16 w-16 mb-4 opacity-20" />
                  <p>点击"提取实体"按钮分析文档</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">实体总数</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{entities.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">分类数量</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Set(entities.map(e => e.category)).size}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">处理状态</CardTitle>
                      </CardHeader>
                      <CardContent>
                         {task.status === 'completed' ? (
                            <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                                <Check className="w-4 h-4" /> 已完成
                            </div>
                         ) : task.status === 'error' ? (
                            <div className="text-sm font-medium text-destructive flex items-center gap-1">
                                <X className="w-4 h-4" /> 失败
                            </div>
                         ) : task.status !== 'idle' ? (
                            <div className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                <Loader2 className="w-4 h-4 animate-spin" /> 处理中
                            </div>
                         ) : (
                            <div className="text-sm font-medium text-muted-foreground">空闲</div>
                         )}
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Entity Table */}
                  <Card className="flex-1">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>提取的实体</CardTitle>
                        <CardDescription>查看和编辑提取的信息</CardDescription>
                      </div>
                      <Dialog open={newEntityDialogOpen} onOpenChange={setNewEntityDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="mr-2 h-4 w-4" /> 添加实体
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>添加新实体</DialogTitle>
                            <DialogDescription>
                              手动添加文档中缺失的实体。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="category" className="text-right">分类 <span className="text-red-500">*</span></Label>
                              <div className="col-span-3 flex gap-2">
                                <select
                                  id="category"
                                  value={newEntity.category}
                                  onChange={(e) => {
                                    setNewEntity({...newEntity, category: e.target.value})
                                    if (formErrors.category) setFormErrors({...formErrors, category: undefined})
                                  }}
                                  className={`flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm ${formErrors.category ? "border-red-500" : ""}`}
                                >
                                  <option value="">选择分类</option>
                                  {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCategoryDialogOpen(true)}
                                >
                                  管理
                                </Button>
                              </div>
                              {formErrors.category && <p className="col-span-4 text-xs text-red-500">{formErrors.category}</p>}
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="field" className="text-right">字段 <span className="text-red-500">*</span></Label>
                              <div className="col-span-3">
                                <Input 
                                  id="field" 
                                  value={newEntity.field} 
                                  onChange={(e) => {
                                    setNewEntity({...newEntity, field: e.target.value})
                                    if (formErrors.field) setFormErrors({...formErrors, field: undefined})
                                  }}
                                  placeholder="例如: 合同价款"
                                  className={formErrors.field ? "border-red-500" : ""}
                                />
                                {formErrors.field && <p className="text-xs text-red-500 mt-1">{formErrors.field}</p>}
                              </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="value" className="text-right">值</Label>
                              <div className="col-span-3">
                                <Input 
                                  id="value" 
                                  value={newEntity.value} 
                                  onChange={(e) => setNewEntity({...newEntity, value: e.target.value})}
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleAddEntity}>保存实体</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {/* Search Controls */}
                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <Input
                          placeholder="搜索实体..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1"
                        />
                        <select
                          value={searchField}
                          onChange={(e) => setSearchField(e.target.value as 'all' | 'category' | 'field' | 'value')}
                          className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                        >
                          <option value="all">所有字段</option>
                          <option value="category">分类</option>
                          <option value="field">字段</option>
                          <option value="value">值</option>
                        </select>
                        {searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSearchQuery('')}
                          >
                            清除
                          </Button>
                        )}
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">分类</TableHead>
                            <TableHead className="w-[200px]">字段</TableHead>
                            <TableHead>值</TableHead>
                            <TableHead className="w-[100px] text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntities.map((entity) => (
                            <TableRow key={entity.id}>
                              <TableCell className="font-medium text-xs">
                                {editingEntityId === entity.id ? (
                                  <Input 
                                    value={entity.category} 
                                    onChange={(e) => handleUpdateEntity(entity.id, 'category', e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                ) : (
                                  <Badge variant="outline" className="font-normal">{entity.category}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {editingEntityId === entity.id ? (
                                  <Input 
                                    value={entity.field} 
                                    onChange={(e) => handleUpdateEntity(entity.id, 'field', e.target.value)}
                                    className="h-8"
                                  />
                                ) : (
                                  entity.field
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {editingEntityId === entity.id ? (
                                  <Input 
                                    value={entity.value} 
                                    onChange={(e) => handleUpdateEntity(entity.id, 'value', e.target.value)}
                                    className="h-8"
                                  />
                                ) : (
                                  entity.value
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {editingEntityId === entity.id ? (
                                    <>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-green-600"
                                        onClick={() => setEditingEntityId(null)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8"
                                      onClick={() => setEditingEntityId(entity.id)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteEntity(entity.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredEntities.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                {searchQuery ? '未找到匹配的实体' : '未找到实体'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileJson className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium mb-2">未选择文档</h3>
            <p className="max-w-sm text-center text-sm">
              从左侧列表中选择文档以开始提取信息和管理实体。
            </p>
          </div>
        )}
      </div>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>管理分类</DialogTitle>
            <DialogDescription>
              添加、编辑或删除实体分类。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="新分类名称"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <Button onClick={handleAddCategory}>添加</Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">暂无分类</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center gap-2">
                      {editingCategory === category ? (
                        <>
                          <Input
                            defaultValue={category}
                            onChange={(e) => setEditingCategory(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                handleEditCategory(category, input.value);
                              }
                            }}
                            className="flex-1"
                            ref={(input) => {
                              if (input) {
                                input.focus();
                                input.select();
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const input = document.querySelector(`input[defaultValue="${category}"]`) as HTMLInputElement;
                              handleEditCategory(category, input?.value || '');
                            }}
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingCategory(null)}
                          >
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 px-3 py-2 border rounded-md bg-muted">
                            {category}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingCategory(category)}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCategoryDialogOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
