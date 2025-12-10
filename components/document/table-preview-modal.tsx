import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Edit3, X } from "lucide-react"
import { ExcelPreview } from "@/app/pdf-ocr-editor/components/ExcelPreview"
import { cn } from "@/lib/utils"

interface TablePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  tableUrl: string
  tableName: string
  onEdit?: () => void
}

export function TablePreviewModal({ 
  isOpen, 
  onClose, 
  tableUrl, 
  tableName,
  onEdit
}: TablePreviewModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[90vw] sm:max-w-[800px] p-0 flex flex-col gap-0 border-l shadow-2xl overflow-hidden" side="right" hideClose={true}>
        <SheetHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0 space-y-0 bg-white">
          <div className="flex flex-col gap-1 overflow-hidden pr-4">
            <SheetTitle className="text-base font-medium truncate flex items-center gap-2">
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-100 whitespace-nowrap">表格预览</span>
              <span className="truncate" title={tableName}>{tableName}</span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              预览表格内容
            </SheetDescription>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit} className="h-8 text-xs gap-1.5 shadow-sm">
                <Edit3 className="w-3.5 h-3.5" />
                编辑表格
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0 rounded-full opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
              <span className="sr-only">关闭</span>
            </Button>
          </div>
        </SheetHeader>
        
        <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden relative">
          {tableUrl ? (
            <ExcelPreview url={tableUrl} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              无法加载表格预览
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
