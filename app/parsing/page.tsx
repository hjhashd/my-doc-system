"use client"

import React, { useState, useEffect, startTransition } from "react"
import { Document } from "@/types/document"

// Hooks
import { useDocumentList } from "./hooks/use-document-list"
import { useDocumentDetails } from "./hooks/use-document-details"
import { useParsing } from "./hooks/use-parsing"

// Components
import { Header } from "./components/header"
import { DocumentSidebar } from "./components/document-sidebar"
import { DocumentDetailArea } from "./components/document-detail-area"
import { ParsingProgress } from "./components/parsing-progress"

export default function DocumentParsingInterface() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [isSmartParsingCompleted, setIsSmartParsingCompleted] = useState(false) // 新增：智能解析完成状态
  
  // 1. 文档列表逻辑
  const {
    documents,
    listLoading,
    listError,
    selectedIds,
    fetchDocuments,
    handleToggleSelect,
    handleToggleAll,
    setDocuments
  } = useDocumentList()

  const {
    docDetails,
    setDocDetails,
    detailsLoading,
    docStatistics,
    setDocStatistics, // 添加setDocStatistics
    statisticsLoading,
    fetchDocumentDetails,
    fetchStatistics
  } = useDocumentDetails(selectedDoc, false, 0) // 传入 false/0 暂时禁用内部的自动刷新

  // 3. 解析 Hook
  const {
    isSmartParsing,
    smartParsingProgress,
    smartParsingStatusText,
    handleRunSmartParsing,
    isParsing,
    parsingProgress,
    parsingStatusText,
    handleRunParsing
  } = useParsing(fetchDocuments, setDocDetails, setDocStatistics, setIsSmartParsingCompleted) // 传递setDocStatistics和setIsSmartParsingCompleted

  // 4. 补充副作用：监听解析状态变化，刷新统计
  // 这是原本 useDocumentDetails 内部的逻辑，现在移到 Page 以解耦
  useEffect(() => {
    if (!isParsing && !isSmartParsing && selectedDoc && (parsingProgress === 0 || smartParsingProgress === 0)) {
      // 只有在解析刚刚结束（或者从未开始）时才需要刷新。
      // 这里的逻辑稍微有点复杂，因为 progress 变回 0 可能意味着结束。
      // 原有逻辑：if (!isParsing && selectedDoc && parsingProgress === 0)
      // 简单起见，我们只在 isParsing/isSmartParsing 从 true 变为 false 时触发？
      // 或者直接复用 fetchStatistics。
      fetchStatistics(selectedDoc)
    }
  }, [isParsing, isSmartParsing, selectedDoc, parsingProgress, smartParsingProgress, fetchStatistics])

  // 初始化加载
  useEffect(() => { 
    // 自动选择第一个文档的逻辑已在 useDocumentList 中处理 (onSelectFirst)
    fetchDocuments(selectedDoc, (doc) => setSelectedDoc(doc)) 
  }, [fetchDocuments]) // 移除 selectedDoc 依赖，避免死循环

  // 处理文档选择
  const handleSelectDoc = (doc: Document) => {
    startTransition(() => {
      setSelectedDoc(doc)
      setIsSmartParsingCompleted(false) // 重置智能解析完成状态
    })
  }

  // 当文档列表刷新后，保证 selectedDoc 与最新列表项保持同步（含 customName 等）
  useEffect(() => {
    if (selectedDoc && documents && documents.length > 0) {
      const updated = documents.find(d => d.id === selectedDoc.id)
      if (updated) {
        setSelectedDoc(updated)
      }
    }
  }, [documents])

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-[calc(100vh-64px)] flex flex-col bg-background text-foreground">
      
      <Header 
        selectedIds={selectedIds}
        selectedDoc={selectedDoc}
        listLoading={listLoading}
        isSmartParsing={isSmartParsing}
        isParsing={isParsing}
        onRefresh={() => fetchDocuments(selectedDoc)}
        onSmartParse={() => selectedDoc && handleRunSmartParsing(selectedDoc)}
        onParse={() => selectedDoc && handleRunParsing(selectedDoc)}
      />

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 rounded-lg bg-card/40 dark:bg-input/25 border border-border/50">
        
        <DocumentSidebar 
          documents={documents}
          selectedDoc={selectedDoc}
          loading={listLoading}
          error={listError}
          selectedIds={selectedIds}
          onSelect={handleSelectDoc}
          onRefresh={() => fetchDocuments(selectedDoc)}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onViewDocument={(doc) => {
            const agentUserId = '123'; // TODO: Get from params
            const query = new URLSearchParams({
                fileName: doc.name,
                docName: doc.name,
                taskId: doc.id, 
                mode: 'edit',
                agentUserId
            });
            window.open(`/word-editor?${query.toString()}`, '_blank');
          }}
        />

        <DocumentDetailArea 
          selectedDoc={selectedDoc}
          docDetails={docDetails}
          detailsLoading={detailsLoading}
          docStatistics={docStatistics}
          statisticsLoading={statisticsLoading}
          isParsing={isParsing || isSmartParsing}
          parsingProgress={isParsing ? parsingProgress : smartParsingProgress}
          parsingStatusText={isParsing ? parsingStatusText : smartParsingStatusText}
          isSmartParsingCompleted={isSmartParsingCompleted}
        />
      </div>
      
      <ParsingProgress 
        progress={smartParsingProgress}
        statusText={smartParsingStatusText}
        isVisible={isSmartParsing}
        type="smart"
      />
      
      <ParsingProgress 
        progress={parsingProgress}
        statusText={parsingStatusText}
        isVisible={isParsing}
        type="normal"
      />
    </div>
  )
}
