"use client"

import { useEffect, useState } from "react"
import { Clock, Loader2, Brain, Zap, CheckCircle } from "lucide-react"

interface ProcessingIndicatorProps {
  isProcessing: boolean;
  startTime: number | null;
  stage?: "schema" | "extraction" | "general";
  title?: string;
  description?: string;
}

export function ProcessingIndicator({ 
  isProcessing, 
  startTime, 
  stage = "general",
  title,
  description 
}: ProcessingIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("00:00")
  const [pulseIntensity, setPulseIntensity] = useState<number>(1)

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0')
        const seconds = (diff % 60).toString().padStart(2, '0')
        setElapsedTime(`${minutes}:${seconds}`)
        
        // 随着时间增加，脉冲强度增加，表示处理时间较长
        if (diff > 30) {
          setPulseIntensity(2)
        } else if (diff > 60) {
          setPulseIntensity(3)
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isProcessing, startTime])

  if (!isProcessing) return null

  const getStageInfo = () => {
    switch (stage) {
      case "schema":
        return {
          icon: <Brain className="w-5 h-5" />,
          title: title || "正在生成Schema",
          description: description || "AI正在分析文档结构，识别实体分类与字段..."
        }
      case "extraction":
        return {
          icon: <Zap className="w-5 h-5" />,
          title: title || "正在抽取信息",
          description: description || "AI正在从文档中智能提取关键字段信息..."
        }
      default:
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          title: title || "正在处理",
          description: description || "请稍候，正在处理您的请求..."
        }
    }
  }

  const stageInfo = getStageInfo()

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl border max-w-md w-full p-6 transform transition-all">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* 动画图标 */}
          <div className={`relative ${pulseIntensity >= 2 ? 'animate-pulse' : ''}`}>
            <div className={`w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ${pulseIntensity >= 3 ? 'animate-bounce' : ''}`}>
              <div className="text-primary">
                {stageInfo.icon}
              </div>
            </div>
            {/* 脉冲环 */}
            <span className={`absolute inset-0 rounded-full bg-primary/20 ${pulseIntensity >= 2 ? 'animate-ping' : ''}`}></span>
          </div>
          
          {/* 标题和描述 */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">{stageInfo.title}</h3>
            <p className="text-muted-foreground text-sm">{stageInfo.description}</p>
          </div>
          
          {/* 进度指示器 */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '70%' }}></div>
          </div>
          
          {/* 时间显示 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-full">
            <Clock className="w-4 h-4" />
            <span className="font-mono tabular-nums">{elapsedTime}</span>
          </div>
          
          {/* 提示信息 */}
          {pulseIntensity >= 2 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-full">
              处理时间较长，请耐心等待...
            </div>
          )}
          
          {pulseIntensity >= 3 && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 rounded-full">
              复杂文档处理中，AI正在深度分析...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 小型处理指示器，用于页面内显示
export function MiniProcessingIndicator({ 
  isProcessing, 
  startTime 
}: { 
  isProcessing: boolean; 
  startTime: number | null;
}) {
  const [elapsedTime, setElapsedTime] = useState<string>("00:00")

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0')
        const seconds = (diff % 60).toString().padStart(2, '0')
        setElapsedTime(`${minutes}:${seconds}`)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isProcessing, startTime])

  if (!isProcessing) return null

  return (
    <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg border border-primary/20 animate-pulse">
      <div className="relative">
        <div className="w-2 h-2 rounded-full bg-primary"></div>
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping"></div>
      </div>
      <Clock className="w-4 h-4" />
      <span className="font-medium text-sm tabular-nums">{elapsedTime}</span>
    </div>
  )
}