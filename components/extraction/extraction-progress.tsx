import React from "react"
import { Clock } from "lucide-react"

interface ExtractionProgressProps {
  progress: number
  statusText: string
  isVisible: boolean
  type: 'schema' | 'extraction'
  startTime: number | null
}

export function ExtractionProgress({
  progress,
  statusText,
  isVisible,
  type,
  startTime
}: ExtractionProgressProps) {
  const [elapsedTime, setElapsedTime] = React.useState<string>("00:00")

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVisible && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0')
        const seconds = (diff % 60).toString().padStart(2, '0')
        setElapsedTime(`${minutes}:${seconds}`)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isVisible, startTime])

  if (!isVisible) return null

  const colorClass = type === 'schema' ? 'green' : 'blue'
  const title = type === 'schema' ? '生成Schema进度' : '抽取信息进度'
  const progressColor = type === 'schema' ? 'bg-green-600' : 'bg-blue-600'
  const textColor = type === 'schema' ? 'text-green-700' : 'text-blue-700'

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80 animate-in slide-in-from-bottom-5">
       <div className="flex justify-between text-sm mb-2">
          <span className={`${textColor} font-medium`}>{title}</span>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground text-xs tabular-nums">{elapsedTime}</span>
            <span className={textColor}>{progress}%</span>
          </div>
       </div>
       <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
          <div 
            className={`${progressColor} h-2.5 rounded-full transition-all duration-300 ease-out`} 
            style={{ width: `${progress}%` }}
          ></div>
       </div>
       <div className="text-xs text-muted-foreground truncate">
         {statusText}
       </div>
    </div>
  )
}