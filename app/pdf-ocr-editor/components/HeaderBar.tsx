"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ChevronLeft,
  Layout,
  PanelLeft,
  PanelRight,
  ArrowRight
} from "lucide-react"

type ViewMode = 'split' | 'pdf' | 'editor'

interface HeaderBarProps {
  fileName: string
  isPdfFile: boolean
  viewMode: ViewMode
  onChangeViewMode: (mode: ViewMode) => void
}

export function HeaderBar({ fileName, isPdfFile, viewMode, onChangeViewMode }: HeaderBarProps) {
  return (
    <header className="h-16 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-secondary rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm md:text-base max-w-[300px] truncate">
              {fileName}
            </span>
            <Badge variant="outline" className="font-normal text-[10px] h-5 px-1.5 bg-secondary/50 text-muted-foreground border-border">
              {isPdfFile ? 'PDF' : 'DOCX'}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
            自动保存已启用
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex bg-secondary/50 p-1 rounded-lg border border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('split')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
          >
            <Layout className="w-3.5 h-3.5" />
            分屏
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('pdf')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'pdf' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            预览
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('editor')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'editor' ? 'bg-white text-primary shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            编辑
          </Button>
        </div>
        <Separator orientation="vertical" className="h-6 hidden md:block" />
        <Button className="h-9 gap-2 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
          下一步
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}

