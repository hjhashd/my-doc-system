"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, RefreshCw, Zap, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Document } from "@/types/document"
import { cn } from "@/lib/utils" // 假设你有这个 shadcn 的工具函数

interface DocumentListProps {
  documents: Document[];
  selectedDoc: Document | null;
  loading: boolean;
  error: string | null;
  onSelect: (doc: Document) => void;
  onRefresh: () => void;
}

export function DocumentList({
  documents,
  selectedDoc,
  loading,
  error,
  onSelect,
  onRefresh
}: DocumentListProps) {
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 mr-2" />;
      case "processing": return <Clock className="w-4 h-4 mr-2" />;
      default: return <Zap className="w-4 h-4 mr-2" />;
    }
  };

  const getStatusButtonText = (status: string) => {
    switch (status) {
      case "completed": return "已完成";
      case "processing": return "处理中";
      default: return "开始解析";
    }
  };

  return (
    <Card className="lg:col-span-1 h-full flex flex-col border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">解析队列</CardTitle>
        <CardDescription>待处理和已完成的文档</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <Button 
            className="w-full shadow-sm" 
            variant={selectedDoc?.status === "completed" ? "outline" : "default"}
            disabled={!selectedDoc || selectedDoc.status === "processing"}
            onClick={() => console.log("Action triggered for:", selectedDoc?.name)}
          >
            {selectedDoc ? getStatusIcon(selectedDoc.status) : <Zap className="w-4 h-4 mr-2" />}
            {selectedDoc ? getStatusButtonText(selectedDoc.status) : "请选择文档"}
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin text-primary" />
            <span className="text-sm">加载队列中...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 text-sm p-4 text-center">
             <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
            {error}
            <Button variant="link" onClick={onRefresh} className="mt-2 text-red-600">重试</Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-2 pb-4">
              {documents.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground/60 bg-muted/20">
                  暂无文档数据
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onSelect(doc)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all duration-200 group relative",
                      selectedDoc?.id === doc.id 
                        ? "border-primary/50 bg-primary/5 shadow-sm" 
                        : "border-transparent hover:bg-muted/50 hover:border-border/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={cn(
                          "p-1.5 rounded-md",
                          selectedDoc?.id === doc.id ? "bg-background" : "bg-muted"
                        )}>
                           <FileText className="w-4 h-4 text-primary/80" />
                        </div>
                        <span className="text-sm font-medium truncate pr-2">{doc.name}</span>
                      </div>
                      <Badge
                        variant={doc.status === "completed" ? "default" : "secondary"}
                        className={cn("shrink-0", doc.status === "completed" && "bg-green-600 hover:bg-green-700")}
                      >
                        {doc.status === "completed" ? "已完成" : doc.status === "processing" ? "处理中" : "等待中"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pl-9">
                      <span>{doc.type} • {doc.pages}页</span>
                      <span className="opacity-70">{doc.uploadDate}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}