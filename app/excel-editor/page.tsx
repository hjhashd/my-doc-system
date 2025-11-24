"use client"

import { useSearchParams } from "next/navigation"
import { OnlyOfficeEditor } from "@/app/pdf-ocr-editor/components/OnlyOfficeEditor" // 复用现有的编辑器组件
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ExcelEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // 1. 获取 URL 参数
  const docUrl = searchParams.get('docUrl') || ""
  const docName = searchParams.get('docName') || "表格文档.xlsx"
  const agentUserId = searchParams.get('agentUserId') || ""
  const taskId = searchParams.get('taskId') || ""
  const tableDir = searchParams.get('tableDir') || "table"
  const subDir = searchParams.get('subDir') || tableDir

  // 2. 构造回调 URL (关键步骤)
  // 必须把 user id 和 task id 传给回调接口，这样保存时才能写入正确的目录
  // 注意：这里不需要 http 前缀，OnlyOfficeEditor 组件内部会自动处理
  const callbackUrl = `/api/onlyoffice-callback?fileName=${encodeURIComponent(docName)}&agentUserId=${agentUserId}&taskId=${taskId}&subDir=${encodeURIComponent(subDir)}&docType=spreadsheet`

  if (!docUrl) {
    return <div className="flex items-center justify-center h-screen">缺少文档 URL</div>
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 简单的顶部导航栏 */}
      <header className="h-12 border-b flex items-center px-4 bg-white shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => window.close()} // 如果是新标签页打开，点击返回关闭窗口
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          关闭 / 返回
        </Button>
        <span className="ml-4 font-medium text-sm">{docName}</span>
      </header>

      {/* 全屏编辑器区域 */}
      <main className="flex-1 overflow-hidden">
        <OnlyOfficeEditor
          docUrl={docUrl}
          docName={docName}
          callbackUrl={callbackUrl} // 传入带参数的回调地址
          containerId="excel-editor-container" // 唯一的 ID
        />
      </main>
    </div>
  )
}
