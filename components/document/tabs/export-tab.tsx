"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, FileText, Table, Image, Code, FileSpreadsheet } from "lucide-react"
import { Document, DocumentDetails } from "@/types/document"
import http from "@/lib/http"
import { useSearchParams } from "next/navigation"

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

  // 处理内容类型选择
  const handleContentTypeChange = (type: keyof typeof selectedContentTypes) => {
    setSelectedContentTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  // 导出功能
  const handleExport = async () => {
    if (!doc || !details) {
      setExportStatus("请先选择文档并完成解析")
      return
    }

    // 检查是否至少选择了一种内容类型
    const hasSelectedContent = Object.values(selectedContentTypes).some(Boolean)
    if (!hasSelectedContent) {
      setExportStatus("请至少选择一种内容类型进行导出")
      return
    }

    try {
      setIsExporting(true)
      setExportStatus("正在准备导出...")

      const agentUserId = searchParams.get('agentUserId') || '123'
      const fileName = doc.physicalName || doc.name

      // 准备导出数据
      const exportData = {
        agentUserId,
        taskId: doc.id,
        fileName,
        format: exportFormat,
        contentTypes: selectedContentTypes,
        // 只包含选中的内容类型
        content: {
          text: selectedContentTypes.text ? details.text : [],
          tables: selectedContentTypes.tables ? details.tables : [],
          images: selectedContentTypes.images ? details.images : []
        }
      }

      // 调用导出API
      const response = await http.post('/api/document/export', exportData)
      
      if (response.ok) {
        setExportStatus("导出成功！")
        
        // 如果返回了下载链接，则触发下载
        if (response.data && response.data.downloadUrl) {
          const link = document.createElement('a')
          link.href = response.data.downloadUrl
          link.download = response.data.fileName || `${doc.name}_export.${exportFormat}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      } else {
        setExportStatus(`导出失败: ${response.message || '未知错误'}`)
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

  const stats = getContentStats()

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                导出设置
              </CardTitle>
              <CardDescription>
                选择导出格式和内容类型，将解析后的内容导出为不同格式的文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 导出格式选择 */}
              <div className="space-y-3">
                <Label className="text-base font-medium">导出格式</Label>
                <RadioGroup value={exportFormat} onValueChange={setExportFormat} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="word" id="word" />
                    <Label htmlFor="word" className="flex items-center cursor-pointer">
                      <FileText className="h-4 w-4 mr-1" />
                      Word
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="excel" id="excel" />
                    <Label htmlFor="excel" className="flex items-center cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      Excel
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="json" id="json" />
                    <Label htmlFor="json" className="flex items-center cursor-pointer">
                      <Code className="h-4 w-4 mr-1" />
                      JSON
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="markdown" id="markdown" />
                    <Label htmlFor="markdown" className="flex items-center cursor-pointer">
                      <FileText className="h-4 w-4 mr-1" />
                      Markdown
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 内容类型选择 */}
              <div className="space-y-3">
                <Label className="text-base font-medium">内容类型</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="text-content" 
                      checked={selectedContentTypes.text}
                      onCheckedChange={() => handleContentTypeChange('text')}
                    />
                    <Label htmlFor="text-content" className="flex items-center cursor-pointer">
                      <FileText className="h-4 w-4 mr-1" />
                      文本内容 ({stats.text})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="table-content" 
                      checked={selectedContentTypes.tables}
                      onCheckedChange={() => handleContentTypeChange('tables')}
                    />
                    <Label htmlFor="table-content" className="flex items-center cursor-pointer">
                      <Table className="h-4 w-4 mr-1" />
                      表格内容 ({stats.tables})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="image-content" 
                      checked={selectedContentTypes.images}
                      onCheckedChange={() => handleContentTypeChange('images')}
                    />
                    <Label htmlFor="image-content" className="flex items-center cursor-pointer">
                      <Image className="h-4 w-4 mr-1" />
                      图片内容 ({stats.images})
                    </Label>
                  </div>
                </div>
              </div>

              {/* 导出按钮和状态 */}
              <div className="pt-4 border-t">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <Button 
                    onClick={handleExport} 
                    disabled={isExporting}
                    className="w-full sm:w-auto"
                  >
                    {isExporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        导出中...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        开始导出
                      </>
                    )}
                  </Button>
                  
                  {exportStatus && (
                    <div className={`text-sm ${exportStatus.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
                      {exportStatus}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 内容预览 */}
          <Card>
            <CardHeader>
              <CardTitle>内容预览</CardTitle>
              <CardDescription>
                当前文档解析后的内容预览
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text" disabled={stats.text === 0}>
                    文本 ({stats.text})
                  </TabsTrigger>
                  <TabsTrigger value="tables" disabled={stats.tables === 0}>
                    表格 ({stats.tables})
                  </TabsTrigger>
                  <TabsTrigger value="images" disabled={stats.images === 0}>
                    图片 ({stats.images})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="mt-4">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {details.text.slice(0, 5).map((item, index) => (
                      <div key={item.id} className="p-2 border rounded text-sm">
                        <div className="font-medium mb-1">
                          {item.metadata?.heading_title || `文本段落 ${index + 1}`}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {item.content}
                        </div>
                      </div>
                    ))}
                    {details.text.length > 5 && (
                      <div className="text-center text-sm text-muted-foreground pt-2">
                        还有 {details.text.length - 5} 个文本段落...
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="tables" className="mt-4">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {details.tables.slice(0, 5).map((item, index) => (
                      <div key={item.id} className="p-2 border rounded text-sm">
                        <div className="font-medium mb-1">
                          {item.content || `表格 ${index + 1}`}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {item.metadata?.table_path || '无路径信息'}
                        </div>
                      </div>
                    ))}
                    {details.tables.length > 5 && (
                      <div className="text-center text-sm text-muted-foreground pt-2">
                        还有 {details.tables.length - 5} 个表格...
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="images" className="mt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                    {details.images.slice(0, 6).map((item, index) => (
                      <div key={item.id} className="border rounded overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.content || `图片 ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                            <Image className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="p-1 text-xs truncate">
                          {item.content || `图片 ${index + 1}`}
                        </div>
                      </div>
                    ))}
                    {details.images.length > 6 && (
                      <div className="col-span-full text-center text-sm text-muted-foreground pt-2">
                        还有 {details.images.length - 6} 张图片...
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}