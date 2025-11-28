"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Type, Grid3X3, FileImage, Filter, Copy, Eye, Download, ImageIcon, Layout, List as ListIcon, Grid, ChevronLeft, ChevronRight } from "lucide-react"
import { ContentDetailItem, DocumentDetails } from "@/types/document"
import { ImagePreviewModal } from "@/components/document/image-preview-modal"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

interface ContentTabProps {
  details: DocumentDetails | null;
  loading: boolean;
  onTableClick?: (tablePath: string) => void;
}

type ListStyle = 'professional' | 'compact';

export function ContentTab({ details, loading, onTableClick }: ContentTabProps) {
  const [contentType, setContentType] = useState("all")
  const [listStyle, setListStyle] = useState<ListStyle>("compact")
  const [selectedImage, setSelectedImage] = useState<ContentDetailItem | null>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  
  // 统一分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9 // 每页显示9个项目

  const handleImageClick = (imageItem: ContentDetailItem) => {
    setSelectedImage(imageItem)
    setIsImageModalOpen(true)
  }

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false)
    setSelectedImage(null)
  }

  // 获取筛选后的所有内容
  const getFilteredContent = () => {
    if (!details) return []
    
    let allItems: ContentDetailItem[] = []
    
    if (contentType === "all" || contentType === "text") {
      allItems = [...allItems, ...details.text.map(item => ({ ...item, itemType: 'text' }))]
    }
    
    if (contentType === "all" || contentType === "tables") {
      allItems = [...allItems, ...details.tables.map(item => ({ ...item, itemType: 'table' }))]
    }
    
    if (contentType === "all" || contentType === "images") {
      allItems = [...allItems, ...details.images.map(item => ({ ...item, itemType: 'image' }))]
    }
    
    return allItems
  }

  // 分页辅助函数
  const getPaginatedItems = (items: ContentDetailItem[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }

  const getTotalPages = (items: ContentDetailItem[]) => {
    return Math.ceil(items.length / itemsPerPage)
  }

  // 分页组件
  const PaginationControls = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }) => {
    if (totalPages <= 1) return null
    
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0 text-xs"
            >
              {page}
            </Button>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // 当内容类型改变时重置分页
  const handleContentTypeChange = (type: string) => {
    setContentType(type)
    setCurrentPage(1)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">正在提取文档内容...</div>
  if (!details) return <div className="p-8 text-center text-muted-foreground">暂无内容详情，请选择已完成的文档</div>

  // 获取筛选后的内容和分页数据
  const filteredContent = getFilteredContent()
  const paginatedContent = getPaginatedItems(filteredContent, currentPage)
  const totalPages = getTotalPages(filteredContent)

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
      {/* 筛选与样式栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 rounded-lg border border-border/50 shadow-sm mb-4 gap-4">
        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <div className="flex items-center space-x-2 px-2">
            <Filter className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">内容筛选</Label>
          </div>
          <Select value={contentType} onValueChange={handleContentTypeChange}>
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

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
           <Label className="text-xs text-muted-foreground mr-2 hidden sm:inline-block">列表样式</Label>
           <ToggleGroup type="single" value={listStyle} onValueChange={(v) => v && setListStyle(v as ListStyle)}>
              <ToggleGroupItem value="compact" aria-label="Compact" size="sm" className="h-8 w-8 p-0">
                <ListIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="professional" aria-label="Professional" size="sm" className="h-8 w-8 p-0">
                <Layout className="h-4 w-4" />
              </ToggleGroupItem>
           </ToggleGroup>
        </div>
      </div>

      <ScrollArea className="h-full pr-4">
        <div className="pb-10">
          {/* 内容统计 */}
          <div className="mb-4 text-sm text-muted-foreground">
            共找到 {filteredContent.length} 项内容
          </div>
          
          {/* 混合内容网格 */}
          {paginatedContent.length > 0 ? (
            <>
              <div className={cn(
                "grid gap-4",
                  listStyle === 'compact' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : 
                  "grid-cols-1 gap-4"
                )}>
                {paginatedContent.map((item) => (
                  <ContentCard 
                    key={`${item.itemType}-${item.id}`} 
                    type={item.itemType as 'text' | 'table' | 'image'} 
                    item={item} 
                    onImageClick={handleImageClick} 
                    onTableClick={onTableClick} 
                    style={listStyle} 
                  />
                ))}
              </div>
              
              {/* 统一分页控件 */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {contentType === "all" ? "该文档未提取到有效内容" : `未找到${contentType === "text" ? "文本" : contentType === "tables" ? "表格" : "图片"}内容`}
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Image Preview Modal */}
      <ImagePreviewModal 
        isOpen={isImageModalOpen}
        onClose={handleCloseImageModal}
        imageItem={selectedImage}
      />
    </div>
  )
}

// 辅助组件：分节标题
function Section({ title, count, icon: Icon, color, children, listStyle }: any) {
  const isCompact = listStyle === 'compact';
  return (
    <div className={cn("mb-6", isCompact && "mb-4")}>
      <h4 className={cn(
        "font-semibold flex items-center text-base uppercase tracking-wide",
        isCompact ? "mb-2 text-sm" : "mb-3"
      )}>
        <Icon className={`w-5 h-5 mr-2 ${color}`} />
        {title} <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-bold">{count}</span>
      </h4>
      <div>{children}</div>
    </div>
  )
}

// 辅助组件：通用内容卡片
function ContentCard({ type, item, onImageClick, onTableClick, style = 'compact' }: { 
  type: 'text'|'table'|'image', 
  item: ContentDetailItem & { itemType?: string },
  onImageClick?: (item: ContentDetailItem) => void,
  onTableClick?: (tablePath: string) => void,
  style?: 'professional' | 'compact'
}) {
  const getBadgeColor = () => {
    switch(type) {
      case 'text': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'table': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'image': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-primary/10 text-primary border-primary/200';
    }
  }

  // --- 样式配置 ---
  const styles = {
    professional: {
      card: "border-l-4 border-y border-r border-gray-200 hover:border-gray-300 rounded-sm bg-slate-50/50 hover:bg-white transition-colors",
      header: "mb-2 flex items-center justify-between bg-white/50 p-2 rounded",
      content: "p-4",
      textTitle: "text-base font-semibold text-slate-800 mb-1",
      textContent: "text-sm leading-relaxed text-slate-700 font-medium",
      meta: "mt-2 text-xs text-slate-500 font-mono"
    },
    compact: {
      card: "border border-border/60 hover:border-primary/60 shadow-none hover:shadow-sm rounded bg-card flex flex-col h-full",
      header: "mb-1 pb-1 border-b border-border/10 flex justify-between items-center",
      content: "p-2 flex-1 flex flex-col",
      textTitle: "text-sm font-bold truncate",
      textContent: "text-xs leading-snug line-clamp-3",
      meta: "mt-auto pt-1 text-[10px] text-muted-foreground"
    }
  }

  const currentStyle = styles[style];
  
  // Professional 样式特殊处理：左边框颜色
  const getBorderColorClass = () => {
    if (style !== 'professional') return '';
    switch(type) {
      case 'text': return 'border-l-blue-500';
      case 'table': return 'border-l-purple-500';
      case 'image': return 'border-l-orange-500';
      default: return 'border-l-primary';
    }
  }

  return (
    <Card className={cn(
      currentStyle.card, 
      getBorderColorClass(),
      "transition-all group duration-200"
    )}>
      <CardContent className={currentStyle.content}>
        {/* Header */}
        <div className={currentStyle.header}>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={cn(getBadgeColor(), style === 'compact' ? 'px-1 py-0 text-[10px] h-4' : 'font-medium')}>
              {type === 'text' ? '文本' : type === 'table' ? '表格' : '图片'}
            </Badge>
            <span className={cn("text-muted-foreground font-medium", style === 'compact' ? 'text-[10px]' : 'text-xs')}>
              P{item.page} • {(item.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="opacity-60 group-hover:opacity-100 transition-opacity flex gap-1">
             {/* Professional 模式下显示更明显的按钮 */}
            <Button variant="ghost" size="icon" className={cn("hover:bg-primary/5", style === 'compact' ? "h-6 w-6" : "h-8 w-8")}>
               {type === 'text' ? <Copy className={style === 'compact' ? "w-3 h-3" : "w-4 h-4"} /> : 
                type === 'table' ? <Eye className={style === 'compact' ? "w-3 h-3" : "w-4 h-4"} /> : 
                <Eye className={style === 'compact' ? "w-3 h-3" : "w-4 h-4"} />}
            </Button>
          </div>
        </div>

        {/* Body based on Type */}
        {type === 'text' && (
           <div className="flex-1">
             {item.metadata?.heading_title && (
                <h3 className={cn(currentStyle.textTitle, "truncate")}>
                    {item.metadata.heading_title}
                </h3>
             )}
             <p className={cn(currentStyle.textContent, "whitespace-pre-wrap", style !== 'compact' && "line-clamp-4")}>
               {item.content || "暂无文本内容"}
             </p>
             {style !== 'compact' && item.metadata && (
                <div className={currentStyle.meta}>
                    <span>行号: {item.metadata.line_start}-{item.metadata.line_end}</span>
                    {item.metadata.heading_level && (
                        <span className="ml-2">级别: {item.metadata.heading_level}</span>
                    )}
                </div>
             )}
           </div>
        )}

        {type === 'table' && (
          <div 
            className={cn(
              "rounded-md bg-muted/20 text-center text-foreground border-border/30 transition-colors flex-1 flex flex-col",
              style === 'compact' ? "text-xs p-1 border" : "text-sm border p-3",
              item.metadata?.table_path ? 'cursor-pointer hover:bg-muted/40 hover:border-primary/50' : ''
            )}
            onClick={() => {
              if (item.metadata?.table_path && onTableClick) {
                onTableClick(item.metadata.table_path);
              }
            }}
          >
             {item.content ? (
               <div className="flex flex-col items-center gap-2 flex-1">
                 <span className={cn(style === 'compact' ? 'line-clamp-2' : 'line-clamp-3')}>{item.content}</span>
                 {item.metadata?.table_path && (
                   <span className={cn("text-primary flex items-center gap-1", style === 'compact' ? "text-[10px]" : "text-xs")}>
                     <Eye className={style === 'compact' ? "w-2.5 h-2.5" : "w-3 h-3"} />
                     {style === 'compact' ? '查看' : '点击查看/编辑表格'}
                   </span>
                 )}
               </div>
             ) : (
               <div className="flex-1 flex items-center justify-center">
                 <span className="text-muted-foreground">暂无表格数据</span>
               </div>
             )}
          </div>
        )}

        {type === 'image' && (
           <div 
             className={cn(
               "bg-muted/20 border border-dashed rounded-lg border-border/40 cursor-pointer transition-all hover:border-primary/50 flex items-center justify-center flex-1",
               style === 'compact' ? "p-1 h-24" : "p-2",
               onImageClick ? 'hover:bg-muted/30' : ''
             )}
             onClick={() => onImageClick && onImageClick(item)}
           >
             {item.imageUrl ? (
               <div className="relative w-full h-full flex items-center justify-center">
                 <img 
                   src={item.imageUrl} 
                   alt={`图片 ${item.id}`}
                   className={cn("max-w-full object-contain rounded", style === 'compact' ? "max-h-20" : "max-h-32")}
                 />
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 rounded">
                   <Eye className={cn("text-white", style === 'compact' ? "w-4 h-4" : "w-8 h-8")} />
                 </div>
               </div>
             ) : (
               <div className={cn("text-center", style === 'compact' ? "p-2" : "p-4")}>
                 <ImageIcon className={cn("mx-auto text-muted-foreground/60", style === 'compact' ? "w-4 h-4 mb-1" : "w-8 h-8 mb-2")} />
                 {style !== 'compact' && <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">暂无图片数据</span>}
               </div>
             )}
           </div>
        )}
      </CardContent>
    </Card>
  )
}
