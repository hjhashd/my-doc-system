"use client"

import React, { memo, useState, useMemo, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Zap, 
  FileText,
  ArrowRight,
  Search,
  FileType,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from "lucide-react"
import { Document } from "@/types/document"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
 

interface DocumentListProps {
  documents: Document[];
  selectedDoc: Document | null;
  loading: boolean;
  error: string | null;
  selectedIds: string[];
  onSelect: (doc: Document) => void;
  onRefresh: () => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onViewDocument: (doc: Document) => void;
}


export const DocumentList = memo(function DocumentList({
  documents,
  selectedDoc,
  loading,
  error,
  selectedIds,
  onSelect,
  onRefresh,
  onToggleSelect,
  onToggleAll,
  onViewDocument,
  
}: DocumentListProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  

  // 过滤文档
  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredDocuments.length / itemsPerPage));
  }, [filteredDocuments]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const paginatedDocuments = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredDocuments.slice(start, start + itemsPerPage);
  }, [filteredDocuments, page]);

  // 全选逻辑
  const isAllSelected = filteredDocuments.length > 0 && filteredDocuments.every(doc => selectedIds.includes(doc.id));

  const handleToggleAllDocs = (checked: boolean) => {
    if (checked) {
       onToggleAll(true);
    } else {
       onToggleAll(false);
    }
  };

  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-secondary/30">
      {/* 列表头部：搜索与操作 */}
      <div className="p-3 border-b border-border/40 space-y-3 bg-popover/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"/>
              文档列表 
              <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {filteredDocuments.length}
              </span>
            </h2>
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={onRefresh} disabled={loading}>
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
               </Button>
            </div>
        </div>
        
        {/* 搜索框 - 优化视觉 */}
        <div className="relative group">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              className="h-8 pl-8 text-xs bg-input border-input focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" 
              placeholder="搜索文档名称..." 
              value={searchQuery}
              onChange={handleSearch}
            />
        </div>

        {/* 表头工具栏 */}
        <div className="flex items-center justify-between pt-1 pb-1">
             <div className="flex items-center gap-2">
                <Checkbox 
                    id="select-all"
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleToggleAllDocs(!!checked)}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label htmlFor="select-all" className="text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors">
                    全选
                </label>
             </div>
             {/* 可以放置排序或其他小工具 */}
        </div>
      </div>
      
      {/* 列表内容区 */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-popover/40 backdrop-blur-sm z-10">
            <div className="relative">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-primary rounded-full"/>
                </div>
            </div>
            <span className="text-xs font-medium text-muted-foreground">正在加载文档...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">加载失败</p>
            <p className="text-xs text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-7 text-xs">
                重试
            </Button>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto">
            <div className="p-3 space-y-2.5 pb-14">
              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs">未找到相关文档</span>
                </div>
              ) : (
                paginatedDocuments.map((doc) => (
                  <DocumentItem 
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedDoc?.id === doc.id}
                    isChecked={selectedIds.includes(doc.id)}
                    onSelect={onSelect}
                    onToggleSelect={onToggleSelect}
                    onViewDocument={onViewDocument}
                  />
                ))
              )}
            </div>
            {totalPages > 1 && (
              <div className="sticky bottom-0 left-0 right-0 bg-popover/80 backdrop-blur-sm border-t border-border/40 px-3 py-2">
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p)}>
                        {p}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部：分页 - 移除 */}
    </div>
  )
});

// 单独抽离 Item 组件，配合 memo 减少不必要的重渲染
const DocumentItem = memo(function DocumentItem({ 
    doc, 
    isSelected, 
    isChecked, 
    onSelect, 
    onToggleSelect, 
    onViewDocument
}: {
    doc: Document;
    isSelected: boolean;
    isChecked: boolean;
    onSelect: (doc: Document) => void;
    onToggleSelect: (id: string) => void;
    onViewDocument: (doc: Document) => void;
}) {
    return (
        <div
            onClick={() => onSelect(doc)}
            className={cn(
            "group relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none",
            isSelected 
                ? "bg-card border-primary shadow-sm ring-1 ring-primary/20 z-10" 
                : "bg-card border-border/10 shadow-sm hover:border-primary/30 hover:shadow-md"
            )}
        >
            {/* 选中时的左侧指示条 */}
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-in slide-in-from-left-1 duration-200" />
            )}

            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()} className="pt-1 pl-1">
                <Checkbox 
                    checked={isChecked}
                    onCheckedChange={() => onToggleSelect(doc.id)}
                    className={cn(
                        "h-4 w-4 transition-all data-[state=checked]:bg-primary data-[state=checked]:border-primary", 
                        !isSelected && !isChecked ? "opacity-30 group-hover:opacity-100" : "opacity-100"
                    )}
                />
            </div>

            {/* 图标 */}
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm border",
                isSelected 
                    ? "bg-gradient-to-br from-primary/10 to-primary/5 text-primary border-primary/20" 
                    : "bg-card text-muted-foreground border-border/30 group-hover:border-primary/20 group-hover:text-primary/80 group-hover:shadow-md"
            )}>
                {/* 根据文件类型显示不同图标，这里暂时统一用 FileText，可扩展 */}
                <FileText className="w-5 h-5" strokeWidth={1.5} />
            </div>

            <div className="flex-1 min-w-0 space-y-2 pt-1 pr-2">
                {/* 标题 */}
                <div className="flex items-center justify-start min-w-0">
                    <span className={cn(
                        "block max-w-full text-sm font-bold leading-snug break-words whitespace-normal transition-colors",
                        isSelected ? "text-primary" : "text-foreground"
                    )}>
                        {doc.customName ? `${doc.customName}.docx` : doc.name}
                    </span>
                </div>

                {/* 信息行：大小、页数、状态 */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0 font-medium",
                        isSelected ? "bg-primary/5 border-primary/20 text-primary" : "bg-secondary/40 border-border/50"
                    )}>
                        <FileType className="w-3.5 h-3.5 opacity-70" />
                        {doc.size || '未知'}
                    </span>
                    {doc.pages > 0 && (
                        <span className="flex items-center gap-1.5 bg-secondary/40 px-2 py-0.5 rounded-md border border-border/50 shrink-0 font-medium">
                            <ImageIcon className="w-3.5 h-3.5 opacity-70" />
                            {doc.pages} 页
                        </span>
                    )}
                    <div className="ml-auto">
                        <StatusBadge status={doc.status} />
                    </div>
                </div>
            </div>

            {/* 状态角标 - 移除绝对定位，改为流式布局 */}
            {/* <div className="absolute right-3 top-3">
                <StatusBadge status={doc.status} minimal />
            </div> */}
            
            
            {/* 操作按钮浮层 - 仅选中或 Hover 时显示 */}
            <div className={cn(
                "absolute right-2 bottom-2 flex items-center gap-1 transition-all duration-200",
                isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
            )}>
                <Button
                    variant="ghost" 
                    size="icon"
                    className={cn(
                        "w-7 h-7 rounded-full shadow-sm border",
                        isSelected 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" 
                            : "bg-popover text-muted-foreground hover:text-primary hover:border-primary/30"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewDocument(doc);
                    }}
                    title="查看文档"
                >
                    <ArrowRight className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    )
}, (prev, next) => {
    // 自定义比较函数，减少不必要的渲染
    // 只有当选中状态、勾选状态、数据本身变化时才重渲染
    return (
        prev.isSelected === next.isSelected &&
        prev.isChecked === next.isChecked &&
        prev.doc === next.doc
    );
});

function StatusBadge({ status, minimal = false }: { status: string, minimal?: boolean }) {
  if (minimal) {
    switch (status) {
        case "completed":
            return <div className="w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-100" title="已完成" />;
        case "processing":
            return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse ring-2 ring-blue-100" title="处理中" />;
        case "failed":
            return <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100" title="失败" />;
        default:
            return <div className="w-2 h-2 rounded-full bg-slate-300 ring-2 ring-slate-100" title="等待中" />;
    }
  }

  switch (status) {
    case "completed":
      return <Badge variant="outline" className="h-6 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40 px-2.5 py-0 gap-1.5 font-semibold shadow-sm"><CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />完成</Badge>;
    case "processing":
      return <Badge variant="outline" className="h-6 text-[11px] bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/40 px-2.5 py-0 gap-1.5 font-semibold shadow-sm"><Clock className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-indigo-300" />处理中</Badge>;
    case "failed":
        return <Badge variant="outline" className="h-6 text-[11px] bg-rose-50 text-red-700 border-red-200/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40 px-2.5 py-0 gap-1.5 font-semibold shadow-sm"><AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-rose-300" />失败</Badge>;
    default:
      return <Badge variant="outline" className="h-6 text-[11px] bg-secondary text-muted-foreground border-border/50 dark:bg-secondary/20 px-2.5 py-0 gap-1.5 font-medium"><Zap className="w-3.5 h-3.5 text-muted-foreground" />等待</Badge>;
  }
}
