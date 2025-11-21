"use client"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  AlertCircle,
  Maximize2,
  Minimize2,
  Loader2
} from "lucide-react"

interface PDFPreviewProps {
  fileUrl: string
  fileName: string
}

export function PDFPreview({ fileUrl, fileName }: PDFPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError("无法加载PDF文件，请检查文件是否有效")
  }

  const handleReload = () => {
    setIsLoading(true)
    setError(null)
    if (iframeRef.current) {
      iframeRef.current.src = fileUrl
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  useEffect(() => {
    if (iframeRef.current && fileUrl) {
      const pdfUrl = `${fileUrl}#zoom=${zoom}&rotation=${rotation}`
      iframeRef.current.src = pdfUrl
    }
  }, [fileUrl, zoom, rotation])

  return (
    <Card className={`h-full flex flex-col border-0 shadow-sm overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-xl ring-1 ring-border/50'}`}>
      <div className="h-12 px-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="p-1.5 bg-red-50 rounded-md text-red-600">
            <FileText className="w-4 h-4" />
          </div>
          <span className="truncate max-w-[200px] text-foreground" title={fileName}>PDF预览</span>
        </div>

        <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/50">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleZoomOut}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-mono w-10 text-center text-muted-foreground select-none">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleZoomIn}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-md" onClick={handleRotate}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {error && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleReload}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 p-0 relative bg-muted/30 overflow-hidden group">
        <div className="absolute inset-0 opacity-[0.4]" 
             style={{ 
               backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', 
               backgroundSize: '20px 20px' 
             }} 
        />

        <div className="relative w-full h-full overflow-auto flex items-center justify-center p-6">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">正在渲染文档...</p>
            </div>
          )}
          
          {error ? (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg shadow-sm border max-w-sm">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="font-medium text-foreground mb-1">预览失败</h3>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleReload} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-3 h-3" /> 重试
              </Button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={fileUrl}
              className="w-full h-full bg-white shadow-lg transition-all duration-300 ease-out rounded-sm border border-border/50"
              title={`PDF预览: ${fileName}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ 
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center top',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

