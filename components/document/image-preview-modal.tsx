"use client"

import React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { XIcon, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react"
import { ContentDetailItem } from "@/types/document"

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  imageItem: ContentDetailItem | null
}

export function ImagePreviewModal({ isOpen, onClose, imageItem }: ImagePreviewModalProps) {
  const [scale, setScale] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
  }

  const handleDownload = () => {
    if (imageItem?.imageUrl) {
      const link = document.createElement('a')
      link.href = imageItem.imageUrl
      link.download = `image-${imageItem.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  React.useEffect(() => {
    if (isOpen) {
      handleReset()
    }
  }, [isOpen])

  if (!imageItem) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col" showCloseButton={false}>
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold">图片预览</h3>
              <span className="text-sm text-muted-foreground">
                第 {imageItem.page} 页 • 置信度 {(imageItem.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={scale >= 3}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!imageItem.imageUrl}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto bg-muted/20 p-4 flex items-center justify-center">
            <div className="relative">
              {imageItem.imageUrl ? (
                <img
                  src={imageItem.imageUrl}
                  alt={`图片 ${imageItem.id}`}
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-12 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
                  <div className="text-muted-foreground mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <p className="text-muted-foreground">暂无图片数据</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                缩放: {Math.round(scale * 100)}% • 旋转: {rotation}°
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                重置视图
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}