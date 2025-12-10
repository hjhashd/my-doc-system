import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import http from "@/lib/http"
import { feedback } from "@/lib/feedback"
import { Document } from "@/types/document"

export function useDocumentList() {
  const searchParams = useSearchParams()
  const [documents, setDocuments] = useState<Document[]>([])
  const [listLoading, setListLoading] = useState<boolean>(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchDocuments = useCallback(async (currentSelectedDoc?: Document | null, onSelectFirst?: (doc: Document) => void) => {
    try {
      setListLoading(true)
      setListError(null)
      const agentUserId = searchParams.get('agentUserId') || undefined
      
      const res: any = await http.get('/api/document/list', {
        params: agentUserId ? { agentUserId } : undefined
      })
      
      if (res && res.ok && Array.isArray(res.data)) {
        // 确保 customName 和 physicalName 正确传入
        setDocuments(res.data)
        
        // 如果没有选中的文档且列表不为空，自动选择第一个
        if (!currentSelectedDoc && res.data.length > 0 && onSelectFirst) {
           onSelectFirst(res.data[0]);
        }

        if (res.data.length === 0) {
          feedback.info('暂无文档')
        }
      } else {
        setDocuments([])
        const errorMsg = res?.message || '无法加载文档列表'
        setListError(errorMsg)
        feedback.error(errorMsg)
      }
    } catch (e: any) {
      setDocuments([])
      setListError('加载文档列表失败')
      feedback.error('加载文档列表失败')
    } finally {
      setListLoading(false)
    }
  }, [searchParams])

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(documents.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  return {
    documents,
    listLoading,
    listError,
    selectedIds,
    fetchDocuments,
    handleToggleSelect,
    handleToggleAll,
    setDocuments // 暴露 setDocuments 以便在解析完成后更新状态等特殊需求
  }
}
