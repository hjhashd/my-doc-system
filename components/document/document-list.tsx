"use client"

import React, { memo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area" // 注意：这里不再需要 Card 组件
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Zap, 
  FileText,
  ArrowRight, // 换个更简洁的箭头
  AlertCircle,
  Search
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
  onViewDocument
}: DocumentListProps) {
  
  const isAllSelected = documents.length > 0 && selectedIds.length === documents.length;

  return (
    <div className="flex flex-col h-full">
      {/* 列表头部：搜索与全选 */}
      <div className="p-4 border-b border-border/40 space-y-3 bg-muted/10">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground/80">解析队列 ({documents.length})</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
        </div>
        
        {/* 简单的搜索框装饰，增加专业感 */}
        <div className="relative">
            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="h-8 pl-7 text-xs bg-white/50 border-border/50" placeholder="搜索文档..." />
        </div>

        <div className="flex items-center gap-2 pt-1">
             <Checkbox 
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={(checked) => onToggleAll(!!checked)}
                className="h-3.5 w-3.5"
             />
             <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                全选所有文档
             </label>
        </div>
      </div>
      
      {/* 列表内容区 */}
      <div className="flex-1 min-h-0 bg-muted/10">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary/40" />
            <span className="text-xs">加载中...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive text-xs">
            {error}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {documents.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground/40 text-xs">暂无文档</div>
              ) : (
                documents.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const isChecked = selectedIds.includes(doc.id);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => onSelect(doc)}
                      className={cn(
                        "group relative flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer select-none",
                        // 选中状态：白底 + 阴影 + 蓝色边框
                        isSelected 
                          ? "bg-white border-primary/60 shadow-sm z-10" 
                          : "bg-transparent border-transparent hover:bg-white/60 hover:border-border/40"
                      )}
                    >
                      {/* Checkbox (阻止冒泡) */}
                      <div onClick={(e) => e.stopPropagation()} className="pt-1">
                        <Checkbox 
                          checked={isChecked}
                          onCheckedChange={() => onToggleSelect(doc.id)}
                          className={cn("h-4 w-4 transition-opacity", !isSelected && !isChecked ? "opacity-40 group-hover:opacity-100" : "opacity-100")}
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        {/* 标题 */}
                        <div className="flex items-center justify-between">
                             <span className={cn(
                                 "text-sm font-medium truncate transition-colors max-w-[140px]",
                                 isSelected ? "text-primary" : "text-foreground/80"
                             )}>
                                 {doc.name}
                             </span>
                        </div>

                        {/* 状态行 */}
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                <FileText className="w-3 h-3" />
                                <span>{doc.pages}页</span>
                            </div>
                            <StatusBadge status={doc.status} />
                        </div>
                      </div>
                      
                      {/* 只有选中时才显示的“进入箭头”，或者hover时显示 */}
                      <Button
                        variant="ghost" 
                        size="icon"
                        className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full",
                            isSelected ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-50"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDocument(doc);
                        }}
                      >
                         <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
});

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" />完成</span>;
    case "processing":
      return <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 animate-spin" />处理中</span>;
    default:
      return <span className="text-[10px] text-gray-500 font-medium flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />等待</span>;
  }
}