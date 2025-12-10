import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, RotateCw, RotateCcw, Maximize } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  url: string;
  alt: string;
}

export function ImagePreview({ url, alt }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.1));
  };

  const handleRotateCw = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleRotateCcw = () => {
    setRotation(prev => (prev - 90 + 360) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.min(Math.max(prev + delta, 0.1), 5));
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-slate-100 rounded-lg overflow-hidden border shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 p-2 bg-white border-b z-10 shadow-sm shrink-0">
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="缩小">
          <ZoomOut className="w-4 h-4 text-slate-600" />
        </Button>
        <span className="text-xs text-slate-500 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="放大">
          <ZoomIn className="w-4 h-4 text-slate-600" />
        </Button>
        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
        <Button variant="ghost" size="icon" onClick={handleRotateCcw} title="向左旋转">
          <RotateCcw className="w-4 h-4 text-slate-600" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleRotateCw} title="向右旋转">
          <RotateCw className="w-4 h-4 text-slate-600" />
        </Button>
        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
        <Button variant="ghost" size="icon" onClick={handleReset} title="重置">
          <Maximize className="w-4 h-4 text-slate-600" />
        </Button>
      </div>

      {/* Image Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto relative flex items-center justify-center bg-slate-50/50 ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            width: scale > 1 ? `${scale * 100}%` : '100%',
            height: scale > 1 ? `${scale * 100}%` : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="relative p-4"
        >
          <img 
            ref={imageRef}
            src={url} 
            alt={alt} 
            className="select-none shadow-lg rounded-sm transition-transform duration-200 ease-out"
            draggable={false}
            style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
            }}
          />
        </div>
        
        {/* Hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-xs rounded-full pointer-events-none backdrop-blur-sm whitespace-nowrap z-20">
          {scale > 1 ? '按住拖动 · ' : ''}Ctrl+滚轮缩放
        </div>
      </div>
    </div>
  );
}
