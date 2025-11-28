"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, FileText, Table, Image, Code, FileSpreadsheet, Eye, FileOutput, ChevronLeft, ChevronRight } from "lucide-react"
import { Document, DocumentDetails } from "@/types/document"
import http from "@/lib/http"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"

interface ExportTabProps {
  doc: Document | null
  details: DocumentDetails | null
  loading: boolean
}

export function ExportTab({ doc, details, loading }: ExportTabProps) {
  const searchParams = useSearchParams()
  const [exportFormat, setExportFormat] = useState("word")
  const [selectedContentTypes, setSelectedContentTypes] = useState({
    text: true,
    tables: true,
    images: true
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState("")
  const [customFileName, setCustomFileName] = useState("")
  const [selectedItem, setSelectedItem] = useState<{
    type: 'text' | 'tables' | 'images'
    index: number
    name: string
  } | null>(null)
  // 添加图片分页状态
  const [imagePage, setImagePage] = useState(1)
  const imagesPerPage = 8 // 每页显示的图片数量

  // 处理内容类型选择
  const handleContentTypeChange = (type: keyof typeof selectedContentTypes) => {
    setSelectedContentTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  // 处理选择特定项目
  const handleSelectItem = (type: 'text' | 'tables' | 'images', index: number, name: string) => {
    setSelectedItem({ type, index, name })
    
    // 自动填充文件名
    const sanitizeFileName = (n: string) => {
      const s = n.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim()
      return s || '未命名'
    }
    setCustomFileName(sanitizeFileName(name))
    
    // 根据内容类型自动设置导出格式
    if (type === 'tables') {
      setExportFormat('excel')
    } else if (type === 'images') {
      setExportFormat('image')
    } else {
      setExportFormat('word')
    }
  }

  // 导出功能
  const handleExport = async () => {
    if (!doc || !details) {
      setExportStatus("请先选择文档并完成解析")
      return
    }

    // 检查是否选择了特定项目
    if (!selectedItem) {
      setExportStatus("请选择要导出的内容")
      return
    }

    try {
      setIsExporting(true)
      setExportStatus("正在准备导出...")

      const agentUserId = searchParams.get('agentUserId') || '123'
      // 使用自定义文件名或默认文件名
      const fileName = customFileName || (doc.physicalName || doc.name).replace(/\.[^/.]+$/, "")

      // 准备导出数据 - 只包含选中的项目
      const exportData = {
        agentUserId,
        taskId: doc.id,
        fileName: fileName,
        format: exportFormat,
        // 只导出选中的单个项目
        contentTypes: {
          [selectedItem.type]: true,
          text: selectedItem.type === 'text',
          tables: selectedItem.type === 'tables',
          images: selectedItem.type === 'images'
        },
        content: {
          text: selectedItem.type === 'text' ? [details.text[selectedItem.index]] : [],
          tables: selectedItem.type === 'tables' ? [details.tables[selectedItem.index]] : [],
          images: selectedItem.type === 'images' ? [details.images[selectedItem.index]] : []
        }
      }

      // 调用导出API
      const response: any = await http.post('/api/document/export', exportData)
      
      if (response && response.ok) {
        setExportStatus("导出成功！")
        
        // 如果返回了下载链接，则触发下载
        if (response.data && response.data.downloadUrl) {
          const link = document.createElement('a')
          link.href = response.data.downloadUrl
          // 确保下载的文件名与用户自定义的一致
          const getDownloadExtension = () => {
            if (exportFormat === 'excel') return 'xlsx'
            if (exportFormat === 'word') return 'docx'
            if (exportFormat === 'image') {
              const img = details?.images[selectedItem!.index]
              if (img?.imageUrl) {
                try {
                  const u = new URL(img.imageUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
                  const p = u.searchParams.get('path') || ''
                  const m = p.match(/\.(png|jpg|jpeg)$/i)
                  if (m) return m[1].toLowerCase()
                } catch {}
              }
              return 'png'
            }
            return exportFormat
          }
          const extension = getDownloadExtension()
          link.download = `${fileName}.${extension}`;
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      } else {
        setExportStatus(`导出失败: ${(response && response.message) || '未知错误'}`)
      }
    } catch (error: any) {
      console.error("导出出错:", error)
      setExportStatus(`导出出错: ${error.message || '网络错误'}`)
    } finally {
      setIsExporting(false)
    }
  }

  // 获取内容统计
  const getContentStats = () => {
    if (!details) return { text: 0, tables: 0, images: 0 }
    
    return {
      text: details.text.length,
      tables: details.tables.length,
      images: details.images.length
    }
  }

  // 计算图片分页
  const getImagePageData = () => {
    if (!details) return { paginatedImages: [], totalPages: 0 }
    
    const totalPages = Math.ceil(details.images.length / imagesPerPage)
    const startIndex = (imagePage - 1) * imagesPerPage
    const endIndex = startIndex + imagesPerPage
    const paginatedImages = details.images.slice(startIndex, endIndex)
    
    return { paginatedImages, totalPages }
  }

  // 处理图片分页切换
  const handleImagePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= getImagePageData().totalPages) {
      setImagePage(newPage)
    }
  }

  // 分页组件
  const ImagePagination = ({ currentPage, totalPages }: { currentPage: number, totalPages: number }) => {
    if (totalPages <= 1) return null
    
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleImagePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => handleImagePageChange(page)}
              className="h-8 w-8 p-0 text-xs"
            >
              {page}
            </Button>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleImagePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  const stats = getContentStats()

  return (
    <div className="p-6 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>加载中...</p>
          </div>
        </div>
      ) : !doc ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>请先选择一个文档</p>
          </div>
        </div>
      ) : !details || (stats.text === 0 && stats.tables === 0 && stats.images === 0) ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>请先解析文档内容</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：导出设置 */}
          <Card className="border-border/60 shadow-sm h-fit">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/40">
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-primary" />
                导出配置
              </CardTitle>
              <CardDescription>
                自定义导出格式、内容范围及文件名称
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              {/* 文件名称设置 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                    <FileOutput className="w-3.5 h-3.5 text-muted-foreground" />
                    导出文件名
                </Label>
              <div className="flex items-center gap-2">
                  <Input 
                      placeholder="请选择要导出的内容" 
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="h-9 text-sm"
                      disabled={!selectedItem}
                  />
                  <div className="shrink-0 text-sm text-muted-foreground bg-muted/30 px-2 py-1.5 rounded border border-border/50">
                      .{(() => {
                        if (exportFormat === 'excel') return 'xlsx'
                        if (exportFormat === 'word') return 'docx'
                        if (exportFormat === 'image') {
                          const img = details?.images[selectedItem?.index || 0]
                          if (img?.imageUrl) {
                            try {
                              const u = new URL(img.imageUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
                              const p = u.searchParams.get('path') || ''
                              const m = p.match(/\.(png|jpg|jpeg)$/i)
                              if (m) return m[1].toLowerCase()
                            } catch {}
                          }
                          return 'png'
                        }
                        return exportFormat
                      })()}
                  </div>
              </div>
                <p className="text-xs text-muted-foreground">
                    {selectedItem ? `已选择: ${selectedItem.name}` : "请从右侧选择要导出的内容"}
                </p>
              </div>

              <div className="h-px bg-border/40 my-2" />

              {/* 导出按钮和状态 */}
              <div className="pt-4 mt-2">
                  <Button 
                    onClick={handleExport} 
                    disabled={isExporting || !selectedItem}
                    className="w-full shadow-md"
                    size="lg"
                  >
                    {isExporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        正在处理导出...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        立即导出文件
                      </>
                    )}
                  </Button>
                  
                  {exportStatus && (
                    <div className={`mt-3 text-center text-sm p-2 rounded ${exportStatus.includes('成功') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {exportStatus}
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* 右侧：内容预览 */}
          <Card className="border-border/60 shadow-sm flex flex-col">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/40 shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-primary" />
                选择导出内容
              </CardTitle>
              <CardDescription>
                点击选择要导出的单个内容（每次只能选择一份）
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col">
              <Tabs defaultValue="text" className="w-full flex flex-col">
                <div className="px-4 pt-3">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/40">
                    <TabsTrigger 
                      value="text" 
                      disabled={stats.text === 0} 
                      className="text-xs"
                      onClick={() => setImagePage(1)} // 切换标签时重置图片分页
                    >
                        文本 ({stats.text})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tables" 
                      disabled={stats.tables === 0} 
                      className="text-xs"
                      onClick={() => setImagePage(1)} // 切换标签时重置图片分页
                    >
                        表格 ({stats.tables})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="images" 
                      disabled={stats.images === 0} 
                      className="text-xs"
                    >
                        图片 ({stats.images})
                    </TabsTrigger>
                    </TabsList>
                </div>
                
                <div className="p-4">
                    <TabsContent value="text" className="mt-0 space-y-3">
                      {details.text.slice(0, 10).map((item, index) => (
                        <div 
                          key={item.id} 
                          className={`p-3 border rounded-lg bg-card text-sm transition-all cursor-pointer ${
                            selectedItem?.type === 'text' && selectedItem?.index === index 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border/40 hover:border-primary/30'
                          }`}
                          onClick={() => handleSelectItem('text', index, item.metadata?.heading_title || `文本段落 ${index + 1}`)}
                        >
                        <div className="font-medium mb-1.5 flex items-center gap-2 text-primary">
                             <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                            {item.metadata?.heading_title || `文本段落 ${index + 1}`}
                        </div>
                        <div className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                            {item.content}
                        </div>
                        </div>
                    ))}
                    {details.text.length > 10 && (
                        <div className="text-center text-xs text-muted-foreground py-2 bg-muted/20 rounded">
                        ... 还有 {details.text.length - 10} 个文本段落
                        </div>
                    )}
                    </TabsContent>
                    
                    <TabsContent value="tables" className="mt-0 space-y-3">
                    {details.tables.slice(0, 10).map((item, index) => (
                        <div 
                          key={item.id} 
                          className={`p-3 border rounded-lg bg-card text-sm transition-all cursor-pointer ${
                            selectedItem?.type === 'tables' && selectedItem?.index === index 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border/40 hover:border-primary/30'
                          }`}
                          onClick={() => handleSelectItem('tables', index, item.content || `表格 ${index + 1}`)}
                        >
                        <div className="font-medium mb-1.5 flex items-center gap-2 text-purple-600">
                             <Table className="w-3.5 h-3.5" />
                            {item.content || `表格 ${index + 1}`}
                        </div>
                        <div className="text-muted-foreground text-[10px] font-mono bg-muted/30 p-1.5 rounded truncate">
                            {item.metadata?.table_path || '无路径信息'}
                        </div>
                        </div>
                    ))}
                    {details.tables.length > 10 && (
                        <div className="text-center text-xs text-muted-foreground py-2 bg-muted/20 rounded">
                        ... 还有 {details.tables.length - 10} 个表格
                        </div>
                    )}
                    </TabsContent>
                    
                    <TabsContent value="images" className="mt-0">
                    <div className="grid grid-cols-2 gap-3">
                        {getImagePageData().paginatedImages.map((item, index) => {
                        // 计算在原始数组中的实际索引
                        const actualIndex = (imagePage - 1) * imagesPerPage + index;
                        return (
                        <div 
                            key={item.id} 
                            className={`border rounded-lg overflow-hidden bg-card transition-all cursor-pointer group ${
                            selectedItem?.type === 'images' && selectedItem?.index === actualIndex 
                                ? 'border-primary' 
                                : 'border-border/40 hover:border-primary/30'
                            }`}
                            onClick={() => handleSelectItem('images', actualIndex, item.content || `图片 ${actualIndex + 1}`)}
                        >
                            <div className="aspect-video bg-muted/20 flex items-center justify-center overflow-hidden relative">
                                {item.imageUrl ? (
                                <img 
                                    src={item.imageUrl} 
                                    alt={item.content || `图片 ${actualIndex + 1}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                ) : (
                                <Image className="h-6 w-6 text-muted-foreground/40" />
                                )}
                            </div>
                            <div className="p-2 text-[10px] truncate text-muted-foreground border-t border-border/20">
                            {item.content || `图片 ${actualIndex + 1}`}
                            </div>
                        </div>
                        )
                        })}
                    </div>
                    
                    {/* 图片分页控件 */}
                    <ImagePagination 
                        currentPage={imagePage} 
                        totalPages={getImagePageData().totalPages} 
                    />
                    
                    {/* 显示当前页信息 */}
                    {details.images.length > imagesPerPage && (
                        <div className="text-center text-xs text-muted-foreground py-2 bg-muted/20 rounded mt-2">
                        显示第 {((imagePage - 1) * imagesPerPage) + 1} - {Math.min(imagePage * imagesPerPage, details.images.length)} 张，共 {details.images.length} 张图片
                        </div>
                    )}
                    </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
