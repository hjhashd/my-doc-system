import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import http from "@/lib/http"
import { feedback } from "@/lib/feedback"
import { Document, DocumentDetails } from "@/types/document"

export function useParsing(
  fetchDocuments: (doc?: Document | null, onSelectFirst?: (doc: Document) => void) => Promise<void>,
  setDocDetails: (details: any) => void,
  setDocStatistics?: (statistics: DocumentStatistics | null) => void,
  setIsSmartParsingCompleted?: (completed: boolean) => void // 新增：智能解析完成状态设置函数
) {
  const searchParams = useSearchParams()
  
  // === 智能解析状态 ===
  const [isSmartParsing, setIsSmartParsing] = useState(false)
  const [smartParsingProgress, setSmartParsingProgress] = useState(0)
  const [smartParsingStatusText, setSmartParsingStatusText] = useState("")
  const smartTimerRef = useRef<NodeJS.Timeout | null>(null) 
  const smartStartTimeRef = useRef<number | null>(null) // 记录智能解析开始时间
  
  // === 普通解析状态 ===
  const [isParsing, setIsParsing] = useState(false)
  const [parsingProgress, setParsingProgress] = useState(0)
  const [parsingStatusText, setParsingStatusText] = useState("")
  const parseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const parseStartTimeRef = useRef<number | null>(null) // 记录普通解析开始时间

  // 清理函数：组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (smartTimerRef.current) clearInterval(smartTimerRef.current)
      if (parseTimerRef.current) clearInterval(parseTimerRef.current)
    }
  }, [])

  // 核心逻辑：智能解析
  const handleRunSmartParsing = async (doc: Document) => {
    if (!doc) return

    // 停止逻辑
    if (isSmartParsing) {
        if (smartTimerRef.current) clearInterval(smartTimerRef.current)
        setIsSmartParsing(false)
        setSmartParsingStatusText("已手动停止解析")
        feedback.info('已手动停止智能解析')
        return
    }

    try {
      setIsSmartParsing(true)
      setSmartParsingProgress(0)
      setSmartParsingStatusText("正在检查文档是否已解析...")
      smartStartTimeRef.current = Date.now() // 记录开始时间
      // 解析开始时清空当前详情，避免未完成数据展示导致页面卡顿
      try { setDocDetails && setDocDetails({ text: [], tables: [], images: [] }) } catch {}
      feedback.loading('正在启动智能解析...')
      
      const fileName = doc.physicalName || doc.name
      const agentUserId = searchParams.get('agentUserId') || '123'
      
      // 提交任务
      console.log("提交智能解析任务:", { taskId: doc.id, fileName })
      const runRes = await http.post('/api/pipeline/run_check', { 
        agentUserId, 
        taskId: doc.id, 
        fileName 
      })

      if (!runRes.ok) throw new Error(runRes.message || '提交失败')

      const queryId = runRes.query_id
      setSmartParsingStatusText(`任务已提交，ID: ${queryId}`)
      feedback.dismiss()
      feedback.info(`任务已提交，正在处理中...`)

      // 开始轮询
      smartTimerRef.current = setInterval(async () => {
        try {
          const statusRes: any = await http.get(`/api/pipeline/status?query_id=${queryId}`)
          
          if (statusRes.ok) {
            const { status, percent, message } = statusRes
            setSmartParsingProgress(percent)
            setSmartParsingStatusText(message || `处理中 ${percent}%`)

            // === 成功 ===
            if (status === 'success') {
              if (smartTimerRef.current) clearInterval(smartTimerRef.current)
              
              // 计算处理时间
              const processingTime = smartStartTimeRef.current 
                ? Math.round((Date.now() - smartStartTimeRef.current) / 1000) 
                : 0;
              
              setSmartParsingStatusText("解析完成，正在获取结果...")
              feedback.success('智能解析完成')
              
              // 获取结果
              try {
                  const resultUrl = `/api/pipeline/result?agentUserId=${agentUserId}&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`
                  const resultRes: any = await http.get(resultUrl)
                  
                  if (resultRes.ok) {
                      setIsSmartParsing(false)
                      const parsedData = resultRes.data
                      
                      // 解析成功后，刷新文档列表以获取最新的 metadata (包含 customName 等)
                      fetchDocuments();
                        
                      // 处理智能解析结果 - 混合所有类型
                      const convertedDetails: DocumentDetails = {
                        text: [],
                        tables: [],
                        images: []
                      };
                      
                      // 处理blocks数据
                      if (parsedData && Array.isArray(parsedData)) {
                        // 处理文本数据
                        convertedDetails.text = parsedData.filter((item: any) => 
                        item.content && 
                        !item.content.includes('🖼️ 点击查看高清原图') && !item.content.startsWith('📊 点击编辑关联表格') &&
                        !item.content.includes('🖼️ 点击查看图片') && !item.content.startsWith('📊 点击编辑表格')
                      ).map((item: any, index: number) => ({
                          id: item.block_id || `text-${index}`,
                          type: 'text',
                          content: item.content || item.heading_title || '',
                          page: 1, // 默认页码
                          confidence: 0.9, // 默认置信度
                          metadata: {
                            heading_level: item.heading_level,
                            heading_title: item.heading_title,
                            heading_meta: item.heading_meta,
                            char_start: item.char_start,
                            char_end: item.char_end,
                            line_start: item.line_start,
                            line_end: item.line_end
                          }
                        }));

                        // 处理表格数据
                        convertedDetails.tables = parsedData.filter((item: any) => 
                          item.content && (item.content.startsWith('📊 点击编辑关联表格') || item.content.startsWith('📊 点击编辑表格'))
                        ).map((item: any, index: number) => {
                          // 提取表格信息
                          let tablePath = '';
                          let displayName = item.heading_title || `表格 ${index + 1}`;
                          let relativeKey = '';
                          const agentUserId = searchParams.get('agentUserId') || '123';
                          
                          // 兼容新旧两种格式
                          if (item.content.includes('{{#T#:')) {
                              // 新格式: 📊 点击编辑表格 (XA_certificate_0_table_1.xlsx){{#T#:XA_certificate_0_table_1.xlsx}}
                              const match = item.content.match(/\{\{#T#:(.*?)\}\}/);
                              if (match && match[1]) {
                                  const fileName = match[1];
                                  tablePath = `table/${fileName}`;
                                  // 如果有标题，优先使用标题，否则使用文件名
                                  if (!displayName || displayName.startsWith('表格')) {
                                      displayName = fileName;
                                  }
                              }
                          } else {
                              // 旧格式: 📊 点击编辑关联表格 1 (Excel) \n[#PDF-LOC:1#]
                              const tableMatch = item.content.match(/点击编辑关联表格\s*(\d+)/);
                              const tableId = tableMatch ? tableMatch[1] : (index + 1).toString();
                              
                              // 提取PDF页码位置信息
                              const pdfLocMatch = item.content.match(/\[#PDF-LOC:(\d+)#\]/);
                              const pdfLoc = pdfLocMatch ? (parseInt(pdfLocMatch[1]) - 1).toString() : '0';

                              const baseName = doc.physicalName ? doc.physicalName.replace('_res.docx', '').replace('.docx', '') : doc.name.replace('.docx', '');
                              tablePath = `table/${baseName}_${pdfLoc}_table_${tableId}.xlsx`;
                          }
                          
                          // 构建相对路径 key
                          relativeKey = `/save/${agentUserId}/${doc.id}/${tablePath}`;
                          
                          // 去掉标题前面的编号部分（如"1.1."）
                          if (displayName && displayName.match(/^\d+\.\d+\.?\s*/)) {
                            displayName = displayName.replace(/^\d+\.\d+\.?\s*/, '');
                          }

                          return {
                            id: item.block_id || `table-${index}`,
                            type: 'table',
                            content: displayName, // 使用自定义名称
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
                              table_path: tablePath, // 存储表格路径
                              original_name: item.heading_title || displayName, // 使用heading_title作为原始名称
                              relative_key: relativeKey // 保存 key 用于更新
                            }
                          };
                        });
                        
                        // 处理图片数据
                        convertedDetails.images = parsedData.filter((item: any) => 
                          item.content && (item.content.includes('🖼️ 点击查看高清原图') || item.content.includes('🖼️ 点击查看图片'))
                        ).map((item: any, index: number) => {
                          let imageUrl = '';
                          let displayName = item.heading_title || `图片 ${index + 1}`;
                          let pdfLoc = '0';
                          
                          // 兼容新旧两种格式
                          if (item.content.includes('{{#I#:')) {
                              // 新格式: 🖼️ 点击查看图片 (XA_certificate_1_layout_det_res_1.png){{#I#:XA_certificate_1_layout_det_res_1.png}}
                              const match = item.content.match(/\{\{#I#:(.*?)\}\}/);
                              if (match && match[1]) {
                                  const fileName = match[1];
                                  // 修正图片路径，确保指向 img 子目录
                                  imageUrl = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${doc.id}/img/${fileName}`;
                                  
                                  if (!displayName || displayName.startsWith('图片')) {
                                      displayName = fileName;
                                  }
                              }
                          } else {
                              // 旧格式: 🖼️ 点击查看高清原图 (Image) \n[#PDF-LOC:2#]
                              // 从content中提取PDF位置信息
                              const pdfLocMatch = item.content.match(/\[#PDF-LOC:(\d+)#\]/);
                              pdfLoc = pdfLocMatch ? pdfLocMatch[1] : (index + 1).toString();
                              
                              // 构建图片URL - 使用图片代理API
                              imageUrl = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${doc.id}/img/XA_certificate_${pdfLoc}_layout_det_res_1.png`;
                              
                              if (!displayName) {
                                  displayName = `图片 ${pdfLoc}`;
                              }
                          }
                          
                          return {
                            id: item.block_id || `image-${index}`,
                            type: 'image',
                            content: displayName,
                            page: 1, // 默认页码
                            confidence: 0.9, // 默认置信度
                            imageUrl: imageUrl,
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
                          };
                        });
                      }
                      
                      setDocDetails(convertedDetails);
                      setSmartParsingStatusText("智能解析成功！数据已加载")
                      
                      // 设置智能解析完成状态
                      if (setIsSmartParsingCompleted) {
                        setIsSmartParsingCompleted(true);
                      }
                      
                      // 更新文档统计信息中的处理时间
                      try {
                        // 获取当前文档列表
                        const documentsResponse = await http.get('/api/document/list');
                        if (documentsResponse.ok && documentsResponse.documents) {
                          const updatedDoc = documentsResponse.documents.find((d: any) => d.id === doc.id);
                          if (updatedDoc && updatedDoc.statistics) {
                            // 更新统计信息中的处理时间
                            const updatedStatistics = {
                              ...updatedDoc.statistics,
                              processing_time_seconds: processingTime
                            };
                            
                            // 使用传入的setDocStatistics函数更新统计信息
                            if (setDocStatistics) {
                              setDocStatistics(updatedStatistics);
                            }
                            
                            console.log(`智能解析完成，处理时间: ${processingTime}秒`);
                          }
                        }
                      } catch (err) {
                        console.error('更新处理时间失败:', err);
                      }
                      
                      feedback.success("数据加载完成")
                  } else {
                      setSmartParsingStatusText("解析成功但获取文件失败")
                      feedback.error("解析成功但获取文件失败")
                  }
              } catch (fetchErr) {
                  console.error("获取结果出错:", fetchErr)
                  setSmartParsingStatusText("获取结果出错")
                  feedback.error("获取结果出错")
              }

            // === 失败 ===
            } else if (status === 'failed' || status === 'error') {
              if (smartTimerRef.current) clearInterval(smartTimerRef.current)
              setIsSmartParsing(false)
              setSmartParsingStatusText(`解析失败: ${message}`)
              feedback.error(`解析失败: ${message}`)
            }
          }
        } catch (err) {
          console.error("轮询出错:", err)
        }
      }, 2000)

    } catch (error: any) {
      console.error("智能解析请求出错:", error)
      setIsSmartParsing(false)
      setSmartParsingStatusText(`请求出错: ${error.message}`)
    }
  }

  // 核心逻辑：普通解析
  const handleRunParsing = async (doc: Document) => {
    if (!doc) return
    
    // 停止逻辑
    if (isParsing) {
        if (parseTimerRef.current) clearInterval(parseTimerRef.current)
        setIsParsing(false)
        setParsingStatusText("已手动停止解析")
        return
    }

    try {
      setIsParsing(true)
      setParsingProgress(0)
      setParsingStatusText("正在提交解析任务...")
      parseStartTimeRef.current = Date.now() // 记录开始时间
      // 普通解析开始时也清空当前详情
      try { setDocDetails && setDocDetails({ text: [], tables: [], images: [] }) } catch {}
      
      const fileName = doc.physicalName || doc.name
      const agentUserId = searchParams.get('agentUserId') || '123'
      
      console.log("提交解析任务:", { taskId: doc.id, fileName })
      const runRes = await http.post('/api/pipeline/run', { 
        agentUserId, 
        taskId: doc.id, 
        fileName
      })

      if (!runRes.ok) throw new Error(runRes.message || '提交失败')

      const queryId = runRes.query_id
      setParsingStatusText("任务提交成功，开始处理...")
      
      // 开始轮询
      parseTimerRef.current = setInterval(async () => {
        try {
          const statusRes: any = await http.get(`/api/pipeline/status?query_id=${queryId}`)
          
          if (statusRes.ok) {
            const { status, percent, message } = statusRes
            setParsingProgress(percent)
            setParsingStatusText(message || `处理中 ${percent}%`)

            if (status === 'success') {
              if (parseTimerRef.current) clearInterval(parseTimerRef.current)
              
              // 计算处理时间
              const processingTime = parseStartTimeRef.current 
                ? Math.round((Date.now() - parseStartTimeRef.current) / 1000) 
                : 0;
              
              setParsingStatusText("解析完成，正在获取结果...")
              
              try {
                const resultRes: any = await http.get(`/api/pipeline/result?agentUserId=${agentUserId}&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`)
                
                if (resultRes.ok) {
                  setIsParsing(false)
                  setParsingStatusText("解析成功！")
                  
                  // 解析成功后，刷新文档列表以获取最新的 metadata (包含 customName 等)
                  fetchDocuments();

                  // 处理普通解析结果
                  const parsedData = resultRes.data
                  const convertedDetails: DocumentDetails = {
                    text: [],
                    tables: [],
                    images: []
                  }
                  
                  if (parsedData && Array.isArray(parsedData)) {
                    // 处理文本数据
                    convertedDetails.text = parsedData.filter((item: any) => 
                      item.content && !item.content.includes('🖼️ 点击查看高清原图') && !item.content.startsWith('📊 点击编辑关联表格')
                    ).map((item: any, index: number) => ({
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
                    }));

                    // 处理表格数据
                    convertedDetails.tables = parsedData.filter((item: any) => 
                      item.content && item.content.startsWith('📊 点击编辑关联表格')
                    ).map((item: any, index: number) => {
                      let fullTablePath = '';
                      let displayName = item.heading_title || `表格 ${index + 1}`;
                      
                      // 兼容新旧两种格式
                      if (item.content.includes('{{#T#:')) {
                          // 新格式
                          const match = item.content.match(/\{\{#T#:(.*?)\}\}/);
                          if (match && match[1]) {
                              const fileName = match[1];
                              if (fileName.includes('/')) {
                                  fullTablePath = fileName;
                              } else {
                                  fullTablePath = `table/${fileName}`;
                              }
                              
                              if (!displayName || displayName.startsWith('表格')) {
                                  displayName = fileName;
                              }
                          }
                      } else {
                          // 旧格式
                          const tableMatch = item.content.match(/点击编辑关联表格\s*(\d+)/);
                          const tableId = tableMatch ? tableMatch[1] : (index + 1).toString();
                          
                          const pdfLocMatch = item.content.match(/\[#PDF-LOC:(\d+)#\]/);
                          const pdfLoc = pdfLocMatch ? (parseInt(pdfLocMatch[1]) - 1).toString() : '0';

                          const baseName = doc.physicalName ? doc.physicalName.replace('_res.docx', '').replace('.docx', '') : doc.name.replace('.docx', '');
                          const tablePath = `${baseName}_${pdfLoc}_table_${tableId}.xlsx`;
                          fullTablePath = `table/${tablePath}`;
                      }

                      const agentUserId = searchParams.get('agentUserId') || '123';
                      const relativeKey = `/save/${agentUserId}/${doc.id}/${fullTablePath}`;
                      
                      if (displayName && displayName.match(/^\d+\.\d+\.?\s*/)) {
                        displayName = displayName.replace(/^\d+\.\d+\.?\s*/, '');
                      }
                      
                      return {
                        id: item.block_id || `table-${index}`,
                        type: 'table',
                        content: displayName,
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
                          table_path: fullTablePath,
                          original_name: item.heading_title || displayName,
                          relative_key: relativeKey
                        }
                      };
                    });
                    
                    // 处理图片数据
                    convertedDetails.images = parsedData.filter((item: any) => 
                      item.content && (item.content.includes('🖼️ 点击查看高清原图') || item.content.includes('🖼️ 点击查看图片'))
                    ).map((item: any, index: number) => {
                      let imageUrl = '';
                      let displayName = item.heading_title || `图片 ${index + 1}`;
                      let pdfLoc = '0';
                      const agentUserId = searchParams.get('agentUserId') || '123';

                      if (item.content.includes('{{#I#:')) {
                          const match = item.content.match(/\{\{#I#:(.*?)\}\}/);
                          if (match && match[1]) {
                              const fileName = match[1];
                              imageUrl = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${doc.id}/img/${fileName}`;
                              
                              if (!displayName || displayName.startsWith('图片')) {
                                  displayName = fileName;
                              }
                          }
                      } else {
                          const pdfLocMatch = item.content.match(/\[#PDF-LOC:(\d+)#\]/);
                          pdfLoc = pdfLocMatch ? pdfLocMatch[1] : (index + 1).toString();
                          imageUrl = `/api/image-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${doc.id}/img/XA_certificate_${pdfLoc}_layout_det_res_1.png`;
                          
                          if (!displayName) {
                              displayName = `图片 ${pdfLoc}`;
                          }
                      }
                      
                      return {
                        id: item.block_id || `image-${index}`,
                        type: 'image',
                        content: displayName,
                        page: 1, 
                        confidence: 0.9, 
                        imageUrl: imageUrl,
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
                      };
                    });
                  } else {
                    // 兼容旧格式数据
                    convertedDetails.text = parsedData
                      .filter((item: any) => item.type === 'text' || (!item.type && typeof item.content === 'string'))
                      .map((item: any) => ({
                        id: item.id || `text-${Date.now()}-${Math.random()}`,
                        type: 'text',
                        content: item.content || '',
                        page: item.page || 1,
                        confidence: item.confidence || 0.9,
                        metadata: {
                          heading: item.heading || '',
                          heading_level: item.heading_level || 0,
                          position: item.position || { x: 0, y: 0, width: 0, height: 0 }
                        }
                      }))
                      
                    convertedDetails.tables = parsedData
                      .filter((item: any) => item.type === 'table')
                      .map((item: any) => ({
                        id: item.id || `table-${Date.now()}-${Math.random()}`,
                        type: 'table',
                        content: item.content || '',
                        page: item.page || 1,
                        confidence: item.confidence || 0.9,
                        metadata: {
                          rows: item.rows || 0,
                          columns: item.columns || 0,
                          position: item.position || { x: 0, y: 0, width: 0, height: 0 }
                        }
                      }))
                      
                    convertedDetails.images = parsedData
                      .filter((item: any) => item.type === 'image')
                      .map((item: any) => ({
                        id: item.id || `image-${Date.now()}-${Math.random()}`,
                        type: 'image',
                        content: item.content || '',
                        page: item.page || 1,
                        confidence: item.confidence || 0.9,
                        imageUrl: item.image_url || item.url || '',
                        metadata: {
                          width: item.width || 0,
                          height: item.height || 0,
                          format: item.format || 'unknown',
                          position: item.position || { x: 0, y: 0, width: 0, height: 0 }
                        }
                      }))
                  }
                  
                  setDocDetails(convertedDetails)
                } else {
                  setParsingStatusText("解析成功但获取文件失败")
                }
              } catch (fetchErr) {
                setParsingStatusText("获取结果出错")
              }
            } else if (status === 'failed' || status === 'error') {
              if (parseTimerRef.current) clearInterval(parseTimerRef.current)
              setIsParsing(false)
              setParsingStatusText(`解析失败: ${message}`)
            }
          }
        } catch (err) {
          console.error("轮询出错:", err)
        }
      }, 2000)
      
      fetchDocuments()
    } catch (error: any) {
      setIsParsing(false)
      setParsingStatusText(`请求出错: ${error.message}`)
    }
  };

  return {
    isSmartParsing,
    smartParsingProgress,
    smartParsingStatusText,
    handleRunSmartParsing,
    isParsing,
    parsingProgress,
    parsingStatusText,
    handleRunParsing
  }
}
