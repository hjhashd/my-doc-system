import React from "react"
import { LayoutGrid, Trash2, Zap, RefreshCw, Loader2, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Document } from "@/types/document"

interface HeaderProps {
  selectedIds: string[]
  selectedDoc: Document | null
  listLoading: boolean
  isSmartParsing: boolean
  isParsing: boolean
  onRefresh: () => void
  onSmartParse: () => void
  onParse: () => void
}

export function Header({
  selectedIds,
  selectedDoc,
  listLoading,
  isSmartParsing,
  isParsing,
  onRefresh,
  onSmartParse,
  onParse
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between shrink-0 bg-popover/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm">
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
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={listLoading} className="bg-popover/60 hover:bg-popover border-border/60 shadow-sm">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                刷新列表
              </Button>
              
              {/* 智能解析按钮 */}
              <Button 
                size="sm" 
                variant="outline" 
                className={`shadow-md transition-all ${isSmartParsing ? 'bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                onClick={onSmartParse} 
                disabled={!selectedDoc}
              >
                {isSmartParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    停止解析
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5 mr-2" />
                    智能解析
                  </>
                )}
              </Button>

              {/* 普通解析按钮 */}
              <Button 
                size="sm" 
                className={`shadow-md transition-all ${isParsing ? 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                onClick={onParse}
                disabled={!selectedDoc}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    停止解析
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-2" />
                    一键解析
                  </>
                )}
              </Button>
           </div>
        )}
      </div>
    </div>
  )
}
