import React from "react"

interface ParsingProgressProps {
  progress: number
  statusText: string
  isVisible: boolean
  type: 'smart' | 'normal'
}

export function ParsingProgress({
  progress,
  statusText,
  isVisible,
  type
}: ParsingProgressProps) {
  if (!isVisible) return null

  const colorClass = type === 'smart' ? 'green' : 'blue'
  const title = type === 'smart' ? '智能解析进度' : '解析进度'

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80 animate-in slide-in-from-bottom-5">
       <div className="flex justify-between text-sm mb-2">
          <span className={`text-${colorClass}-700 font-medium`}>{title}</span>
          <span className={`text-${colorClass}-700`}>{progress}%</span>
       </div>
       <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
          <div 
            className={`bg-${colorClass}-600 h-2.5 rounded-full transition-all duration-300 ease-out`} 
            style={{ width: `${progress}%` }}
          ></div>
       </div>
       <div className="text-xs text-muted-foreground truncate">
         {statusText}
       </div>
    </div>
  )
}
