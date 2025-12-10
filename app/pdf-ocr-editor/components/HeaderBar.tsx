"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ChevronLeft,
  Layout,
  PanelLeft,
  PanelRight,
  ArrowRight,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = 'split' | 'pdf' | 'editor'

interface HeaderBarProps {
  fileName: string
  isPdfFile: boolean
  viewMode: ViewMode
  onChangeViewMode: (mode: ViewMode) => void
  onNextClick?: () => void
  elapsedTime?: string | null
}

export function HeaderBar({ fileName, isPdfFile, viewMode, onChangeViewMode, onNextClick, elapsedTime }: HeaderBarProps) {
  return (
    <header 
      className={cn(
        "h-16 px-6 flex items-center justify-between bg-gradient-to-r from-blue-100/90 via-blue-200/40 to-blue-100/90 backdrop-blur-md border-b border-blue-200/50 fixed top-0 left-0 right-0 z-20 shrink-0 shadow-sm"
      )}
    >
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-blue-200/50 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-blue-900" />
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-950 text-sm md:text-base max-w-[200px] md:max-w-[300px] truncate">
              {fileName}
            </span>
            <Badge variant="outline" className="font-normal text-[10px] h-5 px-1.5 bg-blue-200/50 text-blue-800 border-blue-300">
              {isPdfFile ? 'PDF' : 'DOCX'}
            </Badge>
            
            {/* 集成耗时显示 */}
            {elapsedTime && (
              <Badge variant="secondary" className="hidden sm:flex shadow-sm bg-green-50 text-green-700 border-green-200 h-5 px-2 text-[10px] items-center gap-1">
                <Clock className="w-3 h-3" />
                {elapsedTime}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              自动保存已启用
            </span>
            {/* 移动端显示的耗时 */}
             {elapsedTime && (
              <span className="sm:hidden text-[10px] text-green-600 font-medium">
                 {elapsedTime}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex bg-blue-50/50 p-1 rounded-lg border border-blue-200/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('split')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-blue-700 shadow-sm font-medium' : 'text-slate-600 hover:text-blue-900 hover:bg-blue-100/50'}`}
          >
            <Layout className="w-3.5 h-3.5" />
            分屏
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('pdf')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'pdf' ? 'bg-white text-blue-700 shadow-sm font-medium' : 'text-slate-600 hover:text-blue-900 hover:bg-blue-100/50'}`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            预览
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeViewMode('editor')}
            className={`h-8 px-3 text-xs gap-1.5 rounded-md transition-all ${viewMode === 'editor' ? 'bg-white text-blue-700 shadow-sm font-medium' : 'text-slate-600 hover:text-blue-900 hover:bg-blue-100/50'}`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            编辑
          </Button>
        </div>
        <Separator orientation="vertical" className="h-6 hidden md:block bg-blue-200" />
        <Button 
          className="h-9 gap-2 shadow-sm bg-blue-600 text-white hover:bg-blue-700 border border-blue-700"
          onClick={onNextClick}
        >
          下一步
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
