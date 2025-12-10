import React from "react"
import { DocumentList } from "@/components/document/document-list"
import { Document } from "@/types/document"

interface DocumentSidebarProps {
  documents: Document[]
  selectedDoc: Document | null
  loading: boolean
  error: string | null
  selectedIds: string[]
  onSelect: (doc: Document) => void
  onRefresh: () => void
  onToggleSelect: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onViewDocument: (doc: Document) => void
}

export function DocumentSidebar({
  documents,
  selectedDoc,
  loading,
  error,
  selectedIds,
  onSelect,
  onRefresh,
  onToggleSelect,
  onToggleAll,
  onViewDocument
}: DocumentSidebarProps) {
  return (
    <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col shrink-0 min-h-[400px] lg:min-h-0">
      <DocumentList 
        documents={documents}
        selectedDoc={selectedDoc}
        loading={loading}
        error={error}
        onSelect={onSelect}
        onRefresh={onRefresh}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleAll={onToggleAll}
        onViewDocument={onViewDocument}
      />
    </div>
  )
}
