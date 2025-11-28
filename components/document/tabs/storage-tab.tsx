"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Database, CheckCircle2, AlertCircle, Loader2, FileJson, Server } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Document } from "@/types/document"
import http from "@/lib/http"
import { useSearchParams } from "next/navigation"

interface StorageTabProps {
  doc: Document | null
}

export function StorageTab({ doc }: StorageTabProps) {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // 获取JSON文件名用于显示
  const getJsonFileName = () => {
    if (!doc) return "未找到源文件";
    
    // 从文档详情中获取表格数据
    const tables = doc.details?.tables || []
    if (tables.length === 0) {
      // 如果没有表格数据，回退到原始方法
      const baseName = doc.physicalName ? doc.physicalName.replace(/\.[^/.]+$/, "") : doc.name.replace(/\.[^/.]+$/, "")
      return `${baseName}_tables_with_heading.json`
    }

    // 获取第一个表格的路径信息来构建JSON文件名
    const firstTable = tables[0]
    const tablePath = firstTable.metadata?.table_path
    
    if (!tablePath) {
      // 如果无法获取表格路径，回退到原始方法
      const baseName = doc.physicalName ? doc.physicalName.replace(/\.[^/.]+$/, "") : doc.name.replace(/\.[^/.]+$/, "")
      return `${baseName}_tables_with_heading.json`
    }

    // 从表格路径中提取基础信息
    const pathParts = tablePath.split('/')
    const fileNameWithExt = pathParts[pathParts.length - 1]
    const fileNameWithoutExt = fileNameWithExt.replace(/\.[^/.]+$/, "")
    
    // 构建JSON文件名: 去除最后的_table_1部分，然后添加_tables_with_heading.json
    const baseFileName = fileNameWithoutExt.replace(/_table_\d+$/, '')
    return `${baseFileName}_tables_with_heading.json`
  }

  const handleImport = async () => {
    if (!doc) return
    
    setIsLoading(true)
    setResult(null)
    setError(null)

    const agentUserId = searchParams.get('agentUserId') || '123'
    
    try {
      // 直接使用动态生成的JSON文件名，不进行额外的检查
      const jsonFileName = getJsonFileName()
      console.log("构建的JSON文件名:", jsonFileName)

      // 调用 Next.js 中间层 API
      const res: any = await http.post('/api/storage/run', {
        agentUserId,
        taskId: doc.id,
        fileName: jsonFileName
      })

      if (res.ok && res.status === 1) {
        setResult(res)
      } else {
        setError(res.message || "入库失败，后端未返回详细错误")
        setResult(res) // 保留部分日志供排查
      }
    } catch (err: any) {
      console.error("入库请求错误:", err)
      setError(err.message || "网络请求失败，请检查后端服务是否启动")
    } finally {
      setIsLoading(false)
    }
  }

  if (!doc) return <div className="p-10 text-center text-muted-foreground">请先选择一个文档</div>

  return (
    <div className="p-6 space-y-6 h-full overflow-auto animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            数据入库
          </CardTitle>
          <CardDescription>
            将解析后的结构化表格数据导入到业务数据库 (MySQL)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* 操作区 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
             <div className="space-y-1">
                <div className="text-sm font-medium flex items-center gap-2">
                   <FileJson className="w-4 h-4 text-blue-500" />
                   待入库源文件
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                   {getJsonFileName()}
                </div>
             </div>

             <Button 
               onClick={handleImport} 
               disabled={isLoading || doc.status !== 'completed'}
               className="w-full sm:w-auto min-w-[140px]"
             >
               {isLoading ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   正在入库...
                 </>
               ) : (
                 <>
                   <Server className="mr-2 h-4 w-4" />
                   开始入库
                 </>
               )}
             </Button>
          </div>

          {/* 结果反馈 */}
          {error && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>入库失败</AlertTitle>
              <AlertDescription className="mt-2 font-mono text-xs break-all">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {result && result.ok && (
            <Alert className="border-green-200 bg-green-50 text-green-800 animate-in slide-in-from-top-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>入库成功</AlertTitle>
              <AlertDescription>
                成功导入 <strong>{result.imported_count}</strong> 条数据记录。
              </AlertDescription>
            </Alert>
          )}

          {/* 执行日志 */}
          {result && result.log && result.log.length > 0 && (
            <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">后端执行日志</div>
                <ScrollArea className="h-48 rounded-md border bg-slate-950 text-slate-50 p-4 font-mono text-xs">
                    {result.log.map((line: string, i: number) => (
                        <div key={i} className="mb-1 border-l-2 border-transparent hover:border-slate-700 pl-1">
                            <span className="opacity-50 mr-2">{i + 1}.</span>
                            {line}
                        </div>
                    ))}
                </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}