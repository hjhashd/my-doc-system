"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Type, Grid3X3, FileImage, Filter, Copy, Eye, Download, ImageIcon } from "lucide-react"
import { ContentDetailItem, DocumentDetails } from "@/types/document"

interface ContentTabProps {
  details: DocumentDetails | null;
  loading: boolean;
}

export function ContentTab({ details, loading }: ContentTabProps) {
  const [contentType, setContentType] = useState("all")

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">正在提取文档内容...</div>
  if (!details) return <div className="p-8 text-center text-muted-foreground">暂无内容详情，请选择已完成的文档</div>

  const showText = contentType === "all" || contentType === "text"
  const showTables = contentType === "all" || contentType === "tables"
  const showImages = contentType === "all" || contentType === "images"

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
      {/* 筛选栏 */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-border/50 shadow-sm mb-4">
        <div className="flex items-center space-x-2 px-2">
          <Filter className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">内容筛选</Label>
        </div>
        <Select value={contentType} onValueChange={setContentType}>
          <SelectTrigger className="w-40 bg-background h-9 text-sm border border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部内容</SelectItem>
            <SelectItem value="text">文本内容</SelectItem>
            <SelectItem value="tables">表格数据</SelectItem>
            <SelectItem value="images">图片内容</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[550px] pr-4">
        <div className="space-y-6 pb-10">
          
          {/* Text Section */}
          {showText && details.text?.length > 0 && (
            <Section title="文本内容" count={details.text.length} icon={Type} color="text-blue-500">
              {details.text.map((item) => (
                <ContentCard key={item.id} type="text" item={item} />
              ))}
            </Section>
          )}

          {/* Tables Section */}
          {showTables && details.tables?.length > 0 && (
            <Section title="表格数据" count={details.tables.length} icon={Grid3X3} color="text-purple-500">
               {details.tables.map((item) => (
                <ContentCard key={item.id} type="table" item={item} />
              ))}
            </Section>
          )}

          {/* Images Section */}
          {showImages && details.images?.length > 0 && (
            <Section title="图片内容" count={details.images.length} icon={FileImage} color="text-orange-500">
               {details.images.map((item) => (
                <ContentCard key={item.id} type="image" item={item} />
              ))}
            </Section>
          )}
          
          {/* Empty State */}
          {(!details.text?.length && !details.tables?.length && !details.images?.length) && (
             <div className="text-center py-10 text-muted-foreground">
                该文档未提取到有效内容
             </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// 辅助组件：分节标题
function Section({ title, count, icon: Icon, color, children }: any) {
  return (
    <div className="mb-6">
      <h4 className="font-semibold mb-3 flex items-center text-base uppercase tracking-wide">
        <Icon className={`w-5 h-5 mr-2 ${color}`} />
        {title} <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-bold">{count}</span>
      </h4>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

// 辅助组件：通用内容卡片
function ContentCard({ type, item }: { type: 'text'|'table'|'image', item: ContentDetailItem }) {
  const getBadgeColor = () => {
    switch(type) {
      case 'text': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'table': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'image': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-primary/10 text-primary border-primary/200';
    }
  }
  
  return (
    <Card className="border border-border/80 hover:border-primary shadow-md transition-all group">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 pb-2 border-b border-border/20">
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className={`${getBadgeColor()} font-medium`}>
              {type === 'text' ? '文本' : type === 'table' ? '表格' : '图片'}
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              第 {item.page} 页 • 置信度 {(item.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="opacity-60 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/5">
               {type === 'text' ? <Copy className="w-4 h-4" /> : 
                type === 'table' ? <Eye className="w-4 h-4" /> : 
                <Download className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Body based on Type */}
        {type === 'text' && (
           <p className="text-base leading-relaxed text-foreground font-normal whitespace-pre-wrap">
             {item.content || "暂无文本内容"}
           </p>
        )}

        {type === 'table' && (
          <div className="text-sm border rounded-md bg-muted/20 p-3 text-center text-foreground border-border/30">
             {/* 这里可以放一个简略的表格缩略图或者 JSON 数据预览 */}
             表格数据预览 (行: {item.rows || 0}, 列: {item.columns || 0})
          </div>
        )}

        {type === 'image' && (
           <div className="flex items-center justify-center p-8 bg-muted/20 border border-dashed rounded-lg border-border/40">
             <div className="text-center">
               <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
               <span className="text-sm text-muted-foreground uppercase tracking-wide font-medium">图片预览</span>
             </div>
           </div>
        )}
      </CardContent>
    </Card>
  )
}