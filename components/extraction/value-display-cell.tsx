"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Copy, 
  Maximize2, 
  Check 
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { feedback } from "@/lib/feedback"

interface ValueDisplayCellProps {
  value: any;
}

export function ValueDisplayCell({ value }: ValueDisplayCellProps) {
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
          feedback.success("内容已复制")
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => {
          console.error('复制失败:', err)
          // 降级方案：使用传统方法
          fallbackCopyToClipboard(stringValue)
          setCopied(true)
          feedback.success("内容已复制")
          setTimeout(() => setCopied(false), 2000)
        })
    } else {
      // 降级方案：使用传统方法
      fallbackCopyToClipboard(stringValue)
      setCopied(true)
      feedback.success("内容已复制")
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