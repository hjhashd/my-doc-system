"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  ImageIcon,
  Eye,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  FileImage,
  Grid3X3,
  Type,
  Filter,
  Copy,
  ExternalLink,
  Database,
  ArrowRight,
  History,
  MoreHorizontal
} from "lucide-react"

// 类型定义
interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: 'completed' | 'processing' | 'pending';
  size: string;
  pages: number;
  elements: {
    text: number;
    tables: number;
    images: number;
  };
}

const mockDocuments: Document[] = [
  {
    id: "1",
    name: "财务报告_2024Q1.pdf",
    type: "PDF",
    uploadDate: "2023-11-15",
    status: "completed",
    size: "2.4MB",
    pages: 24,
    elements: {
      text: 45,
      tables: 8,
      images: 12,
    },
  },
  {
    id: "2",
    name: "合同文档_供应商协议.docx",
    type: "DOCX",
    uploadDate: "2023-11-14",
    status: "processing",
    size: "1.2MB",
    pages: 15,
    elements: {
      text: 23,
      tables: 5,
      images: 2,
    },
  },
  {
    id: "3",
    name: "技术规格书.xlsx",
    type: "XLSX",
    uploadDate: "2023-11-13",
    status: "pending",
    size: "0.8MB",
    pages: 5,
    elements: {
      text: 0,
      tables: 0,
      images: 0,
    },
  },
]

const mockContentDetails = {
  text: [
    {
      id: "t1",
      type: "heading",
      content: "第一季度财务概览",
      page: 1,
      position: { x: 120, y: 80, width: 300, height: 40 },
      confidence: 0.98,
      fontSize: 18,
      fontWeight: "bold",
      language: "zh-CN",
    },
    {
      id: "t2",
      type: "paragraph",
      content: "本季度公司营收达到1.2亿元，同比增长15.3%，主要得益于核心产品销售的强劲表现...",
      page: 1,
      position: { x: 120, y: 140, width: 450, height: 120 },
      confidence: 0.94,
      fontSize: 12,
      fontWeight: "normal",
      language: "zh-CN",
    },
    {
      id: "t3",
      type: "footnote",
      content: "数据来源：财务部门统计",
      page: 1,
      position: { x: 120, y: 720, width: 200, height: 20 },
      confidence: 0.91,
      fontSize: 10,
      fontWeight: "normal",
      language: "zh-CN",
    },
  ],
  tables: [
    {
      id: "tb1",
      title: "季度收入明细表",
      page: 2,
      position: { x: 80, y: 200, width: 500, height: 300 },
      confidence: 0.96,
      rows: 12,
      columns: 5,
      headers: ["项目", "Q1收入", "Q4收入", "同比增长", "占比"],
      data: [
        ["产品A", "3000万", "2800万", "7.1%", "25%"],
        ["产品B", "4500万", "4200万", "7.1%", "37.5%"],
        ["服务收入", "2700万", "2400万", "12.5%", "22.5%"],
      ],
      hasHeader: true,
      tableType: "financial",
    },
    {
      id: "tb2",
      title: "成本分析表",
      page: 3,
      position: { x: 80, y: 150, width: 480, height: 250 },
      confidence: 0.93,
      rows: 8,
      columns: 4,
      headers: ["成本类型", "金额", "占比", "变化"],
      data: [
        ["人工成本", "2800万", "35%", "+5.2%"],
        ["材料成本", "3200万", "40%", "+8.1%"],
        ["运营成本", "2000万", "25%", "+2.3%"],
      ],
      hasHeader: true,
      tableType: "cost_analysis",
    },
  ],

  images: [
    {
      id: "i1",
      title: "营收趋势图",
      page: 2,
      position: { x: 100, y: 400, width: 400, height: 250 },
      confidence: 0.95,
      type: "chart",
      format: "PNG",
      resolution: "300dpi",
      colors: ["#3b82f6", "#ef4444", "#10b981"],
      hasText: true,
      description: "显示过去四个季度的营收变化趋势",
    },
    {
      id: "i2",
      title: "组织架构图",
      page: 8,
      position: { x: 80, y: 200, width: 500, height: 350 },
      confidence: 0.91,
      type: "diagram",
      format: "PNG",
      resolution: "300dpi",
      colors: ["#6366f1", "#8b5cf6", "#06b6d4"],
      hasText: true,
      description: "公司组织架构和部门关系图",
    },
    {
      id: "i3",
      title: "产品照片",
      page: 12,
      position: { x: 200, y: 300, width: 300, height: 200 },
      confidence: 0.89,
      type: "photo",
      format: "JPEG",
      resolution: "150dpi",
      colors: ["#f59e0b", "#84cc16", "#ec4899"],
      hasText: false,
      description: "主要产品的实物照片展示",
    },
  ],
}

export function DocumentParsingInterface() {
  const [selectedDoc, setSelectedDoc] = useState(mockDocuments[0])
  const [parsingMode, setParsingMode] = useState("auto")
  const [selectedContentType, setSelectedContentType] = useState("all")
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">文档解析</h1>
          <p className="text-muted-foreground">使用Dolphin视觉解析技术进行多类型内容识别和分类输出</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新队列
          </Button>
          <Button size="sm">
            <Zap className="w-4 h-4 mr-2" />
            批量解析
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Queue */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">解析队列</CardTitle>
            <CardDescription>待处理和已完成的文档</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDoc.id === doc.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{doc.name}</span>
                      </div>
                      <Badge
                        variant={
                          doc.status === "completed" ? "default" : doc.status === "processing" ? "secondary" : "outline"
                        }
                      >
                        {doc.status === "completed" ? "已完成" : doc.status === "processing" ? "处理中" : "等待中"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {doc.type} • {doc.pages}页
                      </span>
                      <span>{doc.uploadDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Parsing Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">解析详情</CardTitle>
            <CardDescription>多类型内容识别和分类输出结果</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="content">内容分类</TabsTrigger>
                <TabsTrigger value="export">导出</TabsTrigger>
                <TabsTrigger value="storage">入库</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* 优化点: 概览格子样式优化
                   去除有色背景，改为空白样式+阴影，更清爽且有层次感
                */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  <Card className="bg-background border shadow-sm hover:shadow-md transition-all cursor-default">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                        <Type className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-foreground">{selectedDoc.elements.text}</p>
                      <p className="text-sm text-muted-foreground mt-1">文本块</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-background border shadow-sm hover:shadow-md transition-all cursor-default">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                        <Grid3X3 className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-foreground">{selectedDoc.elements.tables}</p>
                      <p className="text-sm text-muted-foreground mt-1">表格</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background border shadow-sm hover:shadow-md transition-all cursor-default">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                        <FileImage className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-3xl font-bold text-foreground">{selectedDoc.elements.images}</p>
                      <p className="text-sm text-muted-foreground mt-1">图片</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wider">文档信息</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">总页数</span>
                          <span className="font-medium">{selectedDoc.pages}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">文件大小</span>
                          <span className="font-medium">{selectedDoc.size}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">上传日期</span>
                          <span className="font-medium">{selectedDoc.uploadDate}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wider">处理状态</h4>
                      <div className="flex items-center space-x-2 mb-4 mt-2">
                        {selectedDoc.status === "completed" ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : selectedDoc.status === "processing" ? (
                          <Clock className="w-6 h-6 text-blue-500" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-orange-500" />
                        )}
                        <span className="text-lg font-medium capitalize">
                          {selectedDoc.status === "completed"
                            ? "解析完成"
                            : selectedDoc.status === "processing"
                              ? "正在处理"
                              : "等待处理"}
                        </span>
                      </div>
                      <Progress value={selectedDoc.status === "completed" ? 100 : 45} className="h-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wider">详细统计</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">文本识别率</span>
                          <span className="font-medium">98.5%</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">结构还原</span>
                          <span className="font-medium">95.2%</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">处理耗时</span>
                          <span className="font-medium">12.5s</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <Label>内容类型筛选</Label>
                      </div>
                      <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                        <SelectTrigger className="w-40">
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

                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {/* 优化点: 内容分类字体优化
                       增加字体大小，加深颜色，增加可读性
                    */}
                    
                    {/* Text Content */}
                    {(selectedContentType === "all" || selectedContentType === "text") && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center text-base">
                          <Type className="w-4 h-4 mr-2 text-blue-500" />
                          文本内容 ({mockContentDetails.text.length})
                        </h4>
                        <div className="space-y-3">
                          {mockContentDetails.text.map((item) => (
                            <Card key={item.id} className="border-border/50 hover:border-blue-200 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      {item.type === "heading" ? "标题" : item.type === "paragraph" ? "段落" : "脚注"}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground font-medium">
                                      第{item.page}页 • 置信度 {(item.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-base mb-3 leading-relaxed text-foreground/90">{item.content}</p>
                                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                                  <span>
                                    字体: {item.fontSize}px • {item.fontWeight}
                                  </span>
                                  <span>
                                    坐标: ({item.position.x}, {item.position.y})
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Table Content */}
                    {(selectedContentType === "all" || selectedContentType === "tables") && (
                      <div className="mt-6">
                        <h4 className="font-semibold mb-3 flex items-center text-base">
                          <Grid3X3 className="w-4 h-4 mr-2 text-purple-500" />
                          表格数据 ({mockContentDetails.tables.length})
                        </h4>
                        <div className="space-y-3">
                          {mockContentDetails.tables.map((item) => (
                            <Card key={item.id} className="border-border/50 hover:border-purple-200 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      表格
                                    </Badge>
                                    <span className="text-sm text-muted-foreground font-medium">
                                      第{item.page}页 • {item.rows}行 × {item.columns}列
                                    </span>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="text-sm mb-3 border rounded-md overflow-hidden">
                                  <div className="grid grid-cols-3 text-sm">
                                    {item.headers.map((header, idx) => (
                                      <div key={idx} className="font-medium p-2 bg-muted/50 border-b border-r last:border-r-0 text-center">
                                        {header}
                                      </div>
                                    ))}
                                    {item.data.slice(0, 2).map((row, rowIdx) => (
                                      <>
                                        {row.map((cell, cellIdx) => (
                                          <div key={cellIdx} className="p-2 border-b border-r last:border-r-0 text-center text-muted-foreground">
                                            {cell}
                                          </div>
                                        ))}
                                      </>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                                  <span>
                                    表头: {item.title}
                                  </span>
                                  <span>
                                    尺寸: {item.position.width} × {item.position.height} px
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Image Content */}
                    {(selectedContentType === "all" || selectedContentType === "images") && (
                      <div className="mt-6">
                        <h4 className="font-semibold mb-3 flex items-center text-base">
                          <FileImage className="w-4 h-4 mr-2 text-orange-500" />
                          图片内容 ({mockContentDetails.images.length})
                        </h4>
                        <div className="space-y-3">
                          {mockContentDetails.images.map((item) => (
                            <Card key={item.id} className="border-border/50 hover:border-orange-200 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                      {item.type === "chart" ? "图表" : item.type === "diagram" ? "示意图" : "照片"}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground font-medium">
                                      第{item.page}页 • {item.format}
                                    </span>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center justify-center p-6 bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg mb-3">
                                  <div className="text-center">
                                    <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                                    <span className="text-xs text-muted-foreground">图片预览</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                                  <span className="truncate max-w-[200px]">
                                    描述: {item.description}
                                  </span>
                                  <span>
                                    分辨率: {item.resolution}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="export" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-primary" />
                        导出设置
                      </CardTitle>
                      <CardDescription>
                        配置文档导出的格式和内容
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="export-format">导出格式</Label>
                        <Select defaultValue="json">
                          <SelectTrigger id="export-format">
                            <SelectValue placeholder="选择导出格式" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="json">JSON (结构化数据)</SelectItem>
                            <SelectItem value="csv">CSV (表格数据)</SelectItem>
                            <SelectItem value="excel">Excel (分析报告)</SelectItem>
                            <SelectItem value="pdf">PDF (带标注)</SelectItem>
                            <SelectItem value="xml">XML (通用数据)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-2 block">包含内容</Label>
                        <div className="space-y-3 border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal cursor-pointer" htmlFor="inc-pos">包含位置坐标</Label>
                            <Switch id="inc-pos" defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal cursor-pointer" htmlFor="inc-conf">包含置信度分数</Label>
                            <Switch id="inc-conf" defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal cursor-pointer" htmlFor="inc-meta">包含元数据</Label>
                            <Switch id="inc-meta" defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal cursor-pointer" htmlFor="inc-orig">包含原始图片</Label>
                            <Switch id="inc-orig" />
                          </div>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Button className="w-full" size="lg">
                          <Download className="w-4 h-4 mr-2" />
                          导出解析结果
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* 优化点: 导出历史样式优化
                     去除淡绿色背景，改用更清晰的列表样式
                  */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-green-600" />
                            导出历史
                          </CardTitle>
                          <CardDescription>
                            查看和下载之前的导出记录
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-1">
                        {[
                          { title: "完整解析结果", format: "JSON", size: "2.4MB", date: "2023-11-15 14:32", icon: Database },
                          { title: "表格数据提取", format: "CSV", size: "45KB", date: "2023-11-15 10:15", icon: Grid3X3 },
                          { title: "文本内容纯净版", format: "TXT", size: "12KB", date: "2023-11-14 16:45", icon: FileText },
                          { title: "图片资源包", format: "ZIP", size: "15.2MB", date: "2023-11-14 16:40", icon: ImageIcon },
                        ].map((item, index) => (
                          <div key={index} className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-md bg-secondary/50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">{item.format}</Badge>
                                  <span>{item.size}</span>
                                  <span>•</span>
                                  <span>{item.date}</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-50">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      <Button variant="outline" className="w-full mt-6 text-muted-foreground hover:text-foreground">
                        查看更多历史
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="storage" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">入库配置</CardTitle>
                      <CardDescription>设置文档入库的基本信息</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doc-title">文档标题</Label>
                        <Input id="doc-title" placeholder="请输入文档标题" defaultValue={selectedDoc.name} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="doc-category">文档分类</Label>
                        <Select defaultValue="financial">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="financial">财务文档</SelectItem>
                            <SelectItem value="contract">合同文档</SelectItem>
                            <SelectItem value="technical">技术文档</SelectItem>
                            <SelectItem value="legal">法律文档</SelectItem>
                            <SelectItem value="other">其他文档</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="doc-tags">标签</Label>
                        <Input id="doc-tags" placeholder="输入标签，用逗号分隔" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="doc-desc">文档描述</Label>
                        <Textarea id="doc-desc" placeholder="请输入文档描述" rows={3} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">入库选项</CardTitle>
                      <CardDescription>选择需要入库的内容类型</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Type className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">文本内容</p>
                              <p className="text-xs text-muted-foreground">包含 {selectedDoc.elements.text} 个文本块</p>
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Grid3X3 className="w-4 h-4 text-purple-500" />
                            <div>
                              <p className="text-sm font-medium">表格数据</p>
                              <p className="text-xs text-muted-foreground">包含 {selectedDoc.elements.tables} 个表格</p>
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileImage className="w-4 h-4 text-orange-500" />
                            <div>
                              <p className="text-sm font-medium">图片内容</p>
                              <p className="text-xs text-muted-foreground">包含 {selectedDoc.elements.images} 个图片</p>
                            </div>
                          </div>
                          <Switch />
                        </div>
                      </div>
                      <Button className="w-full">
                        <Database className="w-4 h-4 mr-2" />
                        确认入库
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}