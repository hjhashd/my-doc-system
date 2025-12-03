import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export interface PDFViewerProps {
  pdfUrl: string;
  fileName: string;
  className?: string;
}

export const PDFViewer = ({ pdfUrl, fileName, className = '' }: PDFViewerProps) => {
  
  return (
    <Card 
      className={`h-full overflow-hidden transition-all duration-300 
        rounded-xl shadow-md border-2 border-primary/20
        ${className}`}
    >
      {/* 明亮的蓝色标题栏 - 恢复水彩风格 */}
      <div className="h-12 px-4 bg-gradient-to-r from-blue-100/80 via-blue-50/50 to-blue-100/80 border-b border-blue-200/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <div className="p-1.5 bg-red-100 rounded-md text-red-600 border border-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <span className="truncate max-w-[200px] md:max-w-[300px]">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-700 border border-blue-200 rounded-full font-medium">PDF 预览</span>
          <span className="text-xs text-slate-600 font-medium">（PDF文件不支持直接编辑，请切换到编辑视图进行修改）</span>
        </div>
      </div>
      <CardContent className="flex-1 p-0 relative bg-card">
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0"
          title={`PDF Preview - ${fileName}`}
          // 移除sandbox属性以确保PDF在所有浏览器中正常显示
        />
      </CardContent>
    </Card>
  );
};
