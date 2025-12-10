"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Type, Grid3X3, FileImage, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react"
import { Document, DocumentStatistics } from "@/types/document"

interface OverviewTabProps {
  doc: Document | null;
  isParsing?: boolean;
  parsingProgress?: number;
  parsingStatusText?: string;
  statistics?: DocumentStatistics | null;
  statisticsLoading?: boolean;
  // 新增：是否已完成智能解析
  isSmartParsingCompleted?: boolean;
}

export function OverviewTab({ 
  doc, 
  isParsing = false, 
  parsingProgress = 0, 
  parsingStatusText = "",
  statistics = null,
  statisticsLoading = false,
  isSmartParsingCompleted = false
}: OverviewTabProps) {
  if (!doc) return <div className="text-center py-10 text-muted-foreground">请先选择一个文档</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-300 ease-out">
      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
        {statisticsLoading ? (
          <div className="col-span-2 md:col-span-3 flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">加载统计信息中...</span>
          </div>
        ) : statistics ? (
          <>
            <StatsCard icon={Type} color="blue" label="文本块" value={statistics.text_blocks_count} />
            <StatsCard icon={Grid3X3} color="purple" label="表格" value={statistics.tables_count} />
            <StatsCard icon={FileImage} color="orange" label="图片" value={statistics.images_count} />
          </>
        ) : (
          <>
            <StatsCard icon={Type} color="blue" label="文本块" value={doc.elements.text} />
            <StatsCard icon={Grid3X3} color="purple" label="表格" value={doc.elements.tables} />
            <StatsCard icon={FileImage} color="orange" label="图片" value={doc.elements.images} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 文档信息 */}
        <Card className="shadow-md border border-border/80 hover:shadow-lg transition-all">
          <CardContent className="p-5">
            <h4 className="font-semibold mb-4 text-xs text-primary uppercase tracking-wider">文档信息</h4>
            <div className="space-y-3 text-sm">
              <InfoRow label="总页数" value={statistics ? statistics.total_pages : doc.pages} />
              <InfoRow label="文件大小" value={statistics ? `${statistics.file_size_kb} KB` : doc.size} />
              <InfoRow label="上传日期" value={doc.uploadDate} />
            </div>
          </CardContent>
        </Card>

        {/* 处理状态 */}
        <Card className="shadow-md border border-border/80 hover:shadow-lg transition-all">
          <CardContent className="p-5">
            <h4 className="font-semibold mb-4 text-xs text-primary uppercase tracking-wider">处理状态</h4>
            <div className="flex items-center space-x-3 mb-4 mt-2">
              {isParsing ? (
                <Clock className="w-8 h-8 text-blue-500 animate-pulse" />
              ) : doc.status === "completed" ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : doc.status === "processing" ? (
                <Clock className="w-8 h-8 text-blue-500 animate-pulse" />
              ) : (
                <AlertCircle className="w-8 h-8 text-orange-500" />
              )}
              <div>
                <div className="text-lg font-bold capitalize">
                  {isParsing ? "正在处理" : doc.status === "completed" ? "解析完成" : doc.status === "processing" ? "正在处理" : "等待处理"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isParsing ? parsingStatusText : 
                   (statistics && statistics.processing_time_seconds && isSmartParsingCompleted) ? 
                     `耗时: ${statistics.processing_time_seconds}s` : 
                     doc.status === "completed" ? "处理完成" : "等待处理"}
                </div>
              </div>
            </div>
            <Progress value={isParsing ? parsingProgress : doc.status === "completed" ? 100 : 45} className="h-3 bg-background border border-border/30" />
          </CardContent>
        </Card>

        {/* 统计 */}
        <Card className="shadow-md border border-border/80 hover:shadow-lg transition-all">
          <CardContent className="p-5">
            <h4 className="font-semibold mb-4 text-xs text-primary uppercase tracking-wider">质量统计</h4>
            <div className="space-y-3 text-sm">
              <InfoRow label="文本识别率" value="98.5%" />
              <InfoRow label="结构还原度" value="95.2%" />
              <InfoRow label="异常项" value="0" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatsCard({ icon: Icon, color, label, value }: any) {
  const colorStyles: any = {
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
  }
  
  return (
    <Card className="bg-white border shadow-md hover:shadow-lg transition-all cursor-default">
      <CardContent className="p-6 flex flex-col items-center text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${colorStyles[color]} shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-1 font-medium">{label}</p>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="font-bold text-foreground">{value || '-'}</span>
    </div>
  )
}
