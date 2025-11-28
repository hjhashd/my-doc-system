"use client"

import React, { memo, useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area" 
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Zap, 
  FileText,
  ArrowRight,
  Search,
  FileType,
  Image as ImageIcon
} from "lucide-react"
import { Document } from "@/types/document"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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

const ITEMS_PER_PAGE = 10;

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
  

  // 过滤文档
  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

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
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/50">
      {/* 列表头部：搜索与操作 */}
      <div className="p-3 border-b border-border/40 space-y-3 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"/>
              文档列表 
              <span className="text-xs font-normal text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-md">
                {filteredDocuments.length}
              </span>
            </h2>
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-primary hover:bg-primary/5" onClick={onRefresh} disabled={loading}>
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
               </Button>
            </div>
        </div>
        
        {/* 搜索框 - 优化视觉 */}
        <div className="relative group">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" 
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
                <label htmlFor="select-all" className="text-xs text-slate-500 font-medium cursor-pointer select-none hover:text-slate-800 transition-colors">
                    全选
                </label>
             </div>
             {/* 可以放置排序或其他小工具 */}
        </div>
      </div>
      
      {/* 列表内容区 */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-white/50 backdrop-blur-sm z-10">
            <div className="relative">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-primary rounded-full"/>
                </div>
            </div>
            <span className="text-xs font-medium text-slate-500">正在加载文档...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-slate-800 mb-1">加载失败</p>
            <p className="text-xs text-slate-500 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-7 text-xs">
                重试
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full min-h-0">
            <div className="p-3 space-y-2.5 pb-14">
              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-5 h-5 text-slate-300" />
                    </div>
                    <span className="text-xs">未找到相关文档</span>
                </div>
              ) : (
                filteredDocuments.map((doc) => (
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
          </ScrollArea>
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
            // 选中状态：更明显的视觉反馈
            isSelected 
                ? "bg-white border-primary shadow-sm ring-1 ring-primary/20 z-10" 
                : "bg-white border-transparent shadow-sm hover:border-primary/30 hover:shadow-md"
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
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                isSelected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500 group-hover:bg-primary/5 group-hover:text-primary/70"
            )}>
                {/* 根据文件类型显示不同图标，这里暂时统一用 FileText，可扩展 */}
                <FileText className="w-5 h-5" strokeWidth={1.5} />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5 pt-0.5 pr-2">
                {/* 标题 */}
            <div className="flex items-center justify-between">
                        <span className={cn(
                            "text-sm font-medium leading-snug break-words whitespace-normal transition-colors",
                            isSelected ? "text-primary" : "text-slate-700"
                        )}>
                            {doc.name}
                        </span>
                </div>

                {/* 信息行：大小、页数、状态 */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                        <FileType className="w-3 h-3" />
                        {doc.size || '0 KB'}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                        <ImageIcon className="w-3 h-3" />
                        {doc.pages} 页
                    </span>
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
                            ? "bg-primary text-white hover:bg-primary/90 border-primary" 
                            : "bg-white text-slate-500 hover:text-primary hover:border-primary/30"
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
      return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200 px-1.5 py-0 gap-1 font-normal"><CheckCircle className="w-2.5 h-2.5" />完成</Badge>;
    case "processing":
      return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 px-1.5 py-0 gap-1 font-normal"><Clock className="w-2.5 h-2.5 animate-spin" />处理中</Badge>;
    case "failed":
        return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 px-1.5 py-0 gap-1 font-normal"><AlertCircle className="w-2.5 h-2.5" />失败</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 px-1.5 py-0 gap-1 font-normal"><Zap className="w-2.5 h-2.5" />等待</Badge>;
  }
}

function AlertCircle({ className }: { className?: string }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}
