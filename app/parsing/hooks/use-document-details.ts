import { useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import http from "@/lib/http"
import { Document, DocumentDetails, DocumentStatistics } from "@/types/document"

export function useDocumentDetails(selectedDoc: Document | null, isParsing: boolean, parsingProgress: number) {
  const searchParams = useSearchParams()
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)
  const [docStatistics, setDocStatistics] = useState<DocumentStatistics | null>(null)
  const [statisticsLoading, setStatisticsLoading] = useState<boolean>(false)
  const prevDocIdRef = useRef<string | null>(null)

  const fetchDocumentDetails = useCallback(async (doc: Document, showLoader: boolean = true) => {
    if (!doc || !doc.id) return
    try {
      if (showLoader) setDetailsLoading(true)
      const agentUserId = searchParams.get('agentUserId') || '123'
      const fileName = doc.physicalName || doc.name
      const url = `/api/pipeline/result?agentUserId=${agentUserId}&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`
      const resultRes: any = await http.get(url)
      if (resultRes && resultRes.ok) {
        const blocks = Array.isArray(resultRes.data) ? resultRes.data : (resultRes.data?.blocks || [])
        const converted: DocumentDetails = { text: [], tables: [], images: [] }
        if (Array.isArray(blocks)) {
          converted.text = blocks.filter((item: any) => {
            const c = item.content || ''
            if (c.startsWith('📊 点击编辑关联表格') || c.startsWith('📊 点击编辑表格')) return false
            if (c.includes('🖼️ 点击查看高清原图') || c.includes('🖼️ 点击查看图片')) return false
            return item.content || item.heading_title
          }).map((item: any, index: number) => ({
            id: item.block_id || `text-${index}`,
            type: 'text',
            content: item.content || item.heading_title || '',
            page: 1,
            confidence: 0.9,
            metadata: {
              heading_level: item.heading_level,
              heading_title: item.heading_title,
              heading_meta: item.heading_meta,
              char_start: item.char_start,
              char_end: item.char_end,
              line_start: item.line_start,
              line_end: item.line_end
            }
          }))
          converted.tables = blocks.filter((item: any) => {
            const c = item.content || ''
            return c.startsWith('📊 点击编辑关联表格') || c.startsWith('📊 点击编辑表格')
          }).map((item: any, index: number) => {
            let fullPath = ''
            let name = item.heading_title || `表格 ${index + 1}`
            const agentId = agentUserId
            if ((item.content || '').includes('{{#T#:')) {
              const m = (item.content || '').match(/\{\{#T#:(.*?)\}\}/)
              if (m && m[1]) {
                const f = m[1]
                fullPath = f.includes('/') ? f : `table/${f}`
                if (!name || name.startsWith('表格')) name = f
              }
            } else {
              const tableMatch = (item.content || '').match(/点击编辑关联表格\s*(\d+)/)
              const tableId = tableMatch ? tableMatch[1] : (index + 1).toString()
              const pdfLocMatch = (item.content || '').match(/\[#PDF-LOC:(\d+)#\]/)
              const pdfLoc = pdfLocMatch ? (parseInt(pdfLocMatch[1]) - 1).toString() : '0'
              const base = doc.physicalName ? doc.physicalName.replace('_res.docx', '').replace('.docx', '') : doc.name.replace('.docx', '')
              const tableFile = `${base}_${pdfLoc}_table_${tableId}.xlsx`
              fullPath = `table/${tableFile}`
            }
            const relKey = `/save/${agentId}/${doc.id}/${fullPath}`
            if (name && /^\d+\.\d+\.?\s*/.test(name)) name = name.replace(/^\d+\.\d+\.?\s*/, '')
            return {
              id: item.block_id || `table-${index}`,
              type: 'table',
              content: name,
              page: 1,
              confidence: 0.9,
              metadata: {
                heading_level: item.heading_level,
                heading_title: item.heading_title,
                heading_meta: item.heading_meta,
                char_start: item.char_start,
                char_end: item.char_end,
                line_start: item.line_start,
                line_end: item.line_end,
                table_path: fullPath,
                original_name: item.heading_title || name,
                relative_key: relKey
              }
            }
          })
          converted.images = blocks.filter((item: any) => {
            const c = item.content || ''
            return c.includes('🖼️ 点击查看高清原图') || c.includes('🖼️ 点击查看图片')
          }).map((item: any, index: number) => {
            let url = ''
            let name = item.heading_title || `图片 ${index + 1}`
            let pdfLoc = '0'
            const agentId = agentUserId
            if ((item.content || '').includes('{{#I#:')) {
              const m = (item.content || '').match(/\{\{#I#:(.*?)\}\}/)
              if (m && m[1]) {
                const f = m[1]
                url = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentId}/${doc.id}/img/${f}`
                if (!name || name.startsWith('图片')) name = f
              }
            } else {
              const pdfLocMatch = (item.content || '').match(/\[#PDF-LOC:(\d+)#\]/)
              pdfLoc = pdfLocMatch ? pdfLocMatch[1] : (index + 1).toString()
              url = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentId}/${doc.id}/img/XA_certificate_${pdfLoc}_layout_det_res_1.png`
              if (!name) name = `图片 ${pdfLoc}`
            }
            return {
              id: item.block_id || `image-${index}`,
              type: 'image',
              content: name,
              page: 1,
              confidence: 0.9,
              imageUrl: url,
              metadata: {
                heading_level: item.heading_level,
                heading_title: item.heading_title,
                heading_meta: item.heading_meta,
                char_start: item.char_start,
                char_end: item.char_end,
                line_start: item.line_start,
                line_end: item.line_end,
                pdf_loc: pdfLoc
              }
            }
          })
        }
        setDocDetails(converted)
      }
    } finally {
      if (showLoader) setDetailsLoading(false)
    }
  }, [searchParams])

  // 2. 获取文档统计信息
  const fetchStatistics = async (doc: Document) => {
    if (!doc) return;
    
    try {
      setStatisticsLoading(true);
      setDocStatistics(null);

      // 优先从 doc 对象中直接获取（如果后端列表接口已经返回了）
      // 如果有 statistics 字段，直接使用
      if (doc.statistics) {
         console.log("从文档列表直接获取完整概览数据:", doc.statistics);
         setDocStatistics(doc.statistics);
         setStatisticsLoading(false);
         return;
      }

      // 兼容旧逻辑：检查 elements
      if (doc.elements && (doc.elements.text > 0 || doc.elements.tables > 0 || doc.elements.images > 0)) {
         console.log("从文档列表直接获取部分概览数据:", doc.elements);
         setDocStatistics({
             text_blocks_count: doc.elements.text,
             tables_count: doc.elements.tables,
             images_count: doc.elements.images,
             total_pages: doc.pages,
             file_size_kb: 0 // 默认为 0，UI 层会 fallback 到 doc.size
         });
         setStatisticsLoading(false);
         return;
      }
      
      const res = await http.post('/api/pipeline/statistics', {
        agentUserId: searchParams.get('agentUserId') || '123',
        taskId: doc.id,
        fileName: doc.physicalName || doc.name
      });
      
      if (res.ok && res.statistics) {
        console.log("获取到的概览数据:", res.statistics);
        setDocStatistics(res.statistics);
      } else {
        console.error("获取统计信息失败:", res.message);
      }
    } catch (e) {
      console.error("获取概览失败", e);
    } finally {
      setStatisticsLoading(false);
    }
  };

  // 监听 selectedDoc 变化，获取统计信息和详情
  useEffect(() => {
    if (!selectedDoc) return
    const idChanged = prevDocIdRef.current !== selectedDoc.id
    prevDocIdRef.current = selectedDoc.id
    fetchStatistics(selectedDoc)
    if (idChanged) setDocDetails(null)
  }, [selectedDoc, fetchStatistics])

  // 监听解析状态变化，解析完成后重新获取统计信息
  useEffect(() => {
    // 如果解析刚刚完成 (进度变回0或停止解析)，再获取一次最新数据
    if (!isParsing && selectedDoc && parsingProgress === 0) {
      fetchStatistics(selectedDoc)
    }
  }, [isParsing, selectedDoc, parsingProgress])

  return {
    docDetails,
    setDocDetails, // 暴露给 parsing hook 更新
    detailsLoading,
    docStatistics,
    setDocStatistics, // 添加setDocStatistics到返回对象
    statisticsLoading,
    fetchDocumentDetails,
    fetchStatistics
  }
}
