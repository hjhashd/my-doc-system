"use client"

import React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { XIcon, Copy, Check } from "lucide-react"
import { ContentDetailItem } from "@/types/document"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface TextPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  textItem: ContentDetailItem | null
}

// 通用的复制函数，带回退机制
export const copyToClipboard = async (text: string, onSuccess?: (method: string) => void) => {
  if (!text) {
    console.warn('Copy attempt with empty text');
    toast.warning("没有可复制的内容");
    return;
  }
  
  // 方法1: 尝试使用现代的 Clipboard API (writeText)
  try {
    if (navigator?.clipboard?.writeText) {
      console.log('Using Clipboard API (writeText) for copying');
      await navigator.clipboard.writeText(text);
      console.log('Clipboard API copy successful');
      onSuccess?.('clipboard');
      return;
    }
    console.log('Clipboard API writeText not available');
  } catch (err: unknown) {
      console.error('Clipboard API writeText failed:', (err as Error).message || 'Unknown error');
  }
  
  // 方法2: 尝试使用更现代的 Clipboard API (ClipboardItem)
  try {
    if (navigator?.clipboard?.write && window.ClipboardItem) {
      console.log('Trying Clipboard API with ClipboardItem');
      const blob = new Blob([text], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      console.log('ClipboardItem copy successful');
      onSuccess?.('clipboard-item');
      return;
    }
    console.log('ClipboardItem API not available');
  } catch (err: unknown) {
      console.error('ClipboardItem API failed:', (err as Error).message || 'Unknown error');
  }
  
  // 方法3: 回退到 document.execCommand
  try {
    console.log('Falling back to document.execCommand');
    
    // 创建一个安全的文本区域元素
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // --- 修改开始: 样式调整 ---
    textArea.style.position = "fixed";
    textArea.style.left = "50%"; // 放在屏幕中间，确保在视口内
    textArea.style.top = "50%";
    textArea.style.transform = "translate(-50%, -50%)";
    textArea.style.width = "1px"; // 极小尺寸，但不要为0
    textArea.style.height = "1px";
    textArea.style.opacity = "0.01"; // 不要完全透明，某些浏览器会忽略完全透明元素的复制
    textArea.style.pointerEvents = "auto"; // 允许由于脚本触发的事件
    textArea.style.zIndex = "99999"; // 【关键】必须比 Modal 的 z-index (通常是 50) 高
    
    // 设置属性
    // 注意：在某些iOS版本中，readonly可能会阻碍程序化选区，但在桌面端它是好的习惯
    // 这里我们移除 readonly 限制，但通过 CSS 隐藏它
    textArea.setAttribute('contenteditable', 'true');
    // --- 修改结束 ---

    // 添加到DOM
    document.body.appendChild(textArea);
    
    // 保存当前的选择状态
    const currentSelection = document.getSelection();
    let savedRange: Range | null = null;
    if (currentSelection && currentSelection.rangeCount > 0) {
      savedRange = currentSelection.getRangeAt(0);
    }
    
    try {
      textArea.focus({ preventScroll: true }); // 防止页面滚动
      textArea.select();
      
      // 针对 iOS 的额外处理
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      textArea.setSelectionRange(0, 999999); // iOS 兼容
    } catch (selectError: unknown) {
        console.error('Text selection error:', (selectError as Error).message);
    }
    
    // 执行复制命令
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (copyError: unknown) {
        console.error('execCommand error:', (copyError as Error).message);
    }
    
    // 恢复之前的选择状态
    if (currentSelection) {
      currentSelection.removeAllRanges();
      if (savedRange) {
        currentSelection.addRange(savedRange);
      }
    }
    
    // 清理DOM元素
    try {
      document.body.removeChild(textArea);
    } catch (removeError) {
       // Ignore
    }
    
    if (successful) {
      onSuccess?.('exec-command');
      return;
    } else {
      console.error('Fallback copy failed - execCommand returned false');
    }
  } catch (fallbackErr: unknown) {
      console.error('Fallback copy failed with exception:', (fallbackErr as Error).message || 'Unknown error');
  }
  
  // 所有方法都失败了，提供手动复制的提示
  toast.error("复制失败，请手动复制内容");
};

export function TextPreviewModal({ isOpen, onClose, textItem }: TextPreviewModalProps) {
  const [copied, setCopied] = React.useState(false)
  const [copyMethod, setCopyMethod] = React.useState<string>('')

  const handleCopy = () => {
    if (textItem?.content) {
      // 重置状态
      setCopyMethod('')
      
      // 复制内容并根据使用的方法提供不同的反馈
      copyToClipboard(textItem.content, (method = 'unknown') => {
        setCopyMethod(method)
        setCopied(true)
        
        // 根据不同的复制方法显示不同的成功消息
        let successMessage = "文本已复制到剪贴板"
        if (method === 'clipboard') {
          successMessage = "文本已通过现代剪贴板API复制"
        } else if (method === 'clipboard-item') {
          successMessage = "文本已通过ClipboardItem API复制"
        } else if (method === 'exec-command') {
          successMessage = "文本已通过兼容模式复制"
        }
        
        toast.success(successMessage)
        
        // 2秒后重置状态
        setTimeout(() => {
          setCopied(false)
          setCopyMethod('')
        }, 2000)
      })
    }
  }

  if (!textItem) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[60vw] w-full h-[70vh] p-0 overflow-hidden flex flex-col" showCloseButton={false}>
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold">文本详情</h3>
              <span className="text-sm text-muted-foreground">
                第 {textItem.page} 页 • 置信度 {(textItem.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2">{copied ? "已复制" : "复制文本"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Text Container */}
          <div className="flex-1 overflow-hidden p-6 bg-muted/10">
            <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                    {textItem.metadata?.heading_title && (
                        <h2 className="text-xl font-bold text-foreground">
                            {textItem.metadata.heading_title}
                        </h2>
                    )}
                    
                    <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap font-normal">
                        {textItem.content}
                    </div>
                    
                    {textItem.metadata && (
                        <div className="pt-6 mt-6 border-t border-border/40 grid grid-cols-2 gap-4 text-xs text-muted-foreground font-mono">
                            <div>
                                <span className="font-semibold">行号范围:</span> {textItem.metadata.line_start} - {textItem.metadata.line_end}
                            </div>
                            <div>
                                <span className="font-semibold">字符范围:</span> {textItem.metadata.char_start} - {textItem.metadata.char_end}
                            </div>
                            {textItem.metadata.heading_level && (
                                <div>
                                    <span className="font-semibold">标题级别:</span> H{textItem.metadata.heading_level}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
