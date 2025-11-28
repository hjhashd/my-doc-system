"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import http from "@/lib/http"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, Zap, Trash2, LayoutGrid, List, Brain, Loader2 } from "lucide-react"

import { DocumentList } from "@/components/document/document-list"
import { OverviewTab } from "@/components/document/tabs/overview-tab"
import { ContentTab } from "@/components/document/tabs/content-tab"
import { ExportTab } from "@/components/document/tabs/export-tab"
import { StorageTab } from "@/components/document/tabs/storage-tab"
import { Document, DocumentDetails, DocumentStatistics } from "@/types/document"

export default function DocumentParsingInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // === 基础数据状态 ===
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const [listLoading, setListLoading] = useState<boolean>(true)
  const [listError, setListError] = useState<string | null>(null)
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)
  const [docStatistics, setDocStatistics] = useState<DocumentStatistics | null>(null)
  const [statisticsLoading, setStatisticsLoading] = useState<boolean>(false)
  
  // === 智能解析状态 ===
  const [isSmartParsing, setIsSmartParsing] = useState(false)
  const [smartParsingProgress, setSmartParsingProgress] = useState(0)
  const [smartParsingStatusText, setSmartParsingStatusText] = useState("")
  const smartTimerRef = useRef<NodeJS.Timeout | null>(null) // 用于真正停止轮询
  
  // === 普通解析状态 ===
  const [isParsing, setIsParsing] = useState(false)
  const [parsingProgress, setParsingProgress] = useState(0)
  const [parsingStatusText, setParsingStatusText] = useState("")
  const parseTimerRef = useRef<NodeJS.Timeout | null>(null) // 用于真正停止轮询

  // 清理函数：组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (smartTimerRef.current) clearInterval(smartTimerRef.current)
      if (parseTimerRef.current) clearInterval(parseTimerRef.current)
    }
  }, [])

  // 监听 selectedDoc 变化，获取统计信息
  useEffect(() => {
    if (selectedDoc) {
      fetchStatistics(selectedDoc)
    }
  }, [selectedDoc])
  
  // 监听解析状态变化，解析完成后重新获取统计信息
  useEffect(() => {
    // 如果解析刚刚完成 (进度变回0或停止解析)，再获取一次最新数据
    if (!isParsing && selectedDoc && parsingProgress === 0) {
      fetchStatistics(selectedDoc)
    }
  }, [isParsing, selectedDoc, parsingProgress])

  // 1. 获取文档列表
  const fetchDocuments = useCallback(async () => {
    try {
      setListLoading(true)
      setListError(null)
      const agentUserId = searchParams.get('agentUserId') || undefined
      
      const res: any = await http.get('/api/document/list', {
        params: agentUserId ? { agentUserId } : undefined
      })
      
      if (res && res.ok && Array.isArray(res.data)) {
        setDocuments(res.data)
        // 使用函数式更新来避免依赖 selectedDoc
        setSelectedDoc(prev => {
            if (!prev && res.data.length > 0) return res.data[0];
            return prev;
        });
      } else {
        setDocuments([])
        setListError(res?.message || '无法加载文档列表')
      }
    } catch (e: any) {
      setDocuments([])
      setListError('加载文档列表失败')
    } finally {
      setListLoading(false)
    }
  }, [searchParams]) // 移除 selectedDoc 依赖

  // 2. 获取文档详情 (模拟或实际请求)
  const fetchDocumentDetails = useCallback(async (docId: string) => {
    if (!docId) return;
    try {
      setDetailsLoading(true);
      setDocDetails(null); 
      // 这里可以替换为真实的后端请求
      await new Promise(r => setTimeout(r, 600));
      setDocDetails({ text: [], tables: [], images: [] }); 
    } catch (error) {
      console.error(error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // 2.1 获取文档统计信息
  const fetchStatistics = async (doc: Document) => {
    if (!doc) return;
    
    try {
      setStatisticsLoading(true);
      setDocStatistics(null);
      
      const res = await http.post('/api/pipeline/statistics', {
        agentUserId: searchParams.get('agentUserId') || '123',
        taskId: doc.id,
        fileName: doc.name // 或者 doc.physicalName
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

  // 3. 列表选择逻辑
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

  // 4. 跳转查看/编辑逻辑
  const handleViewDocument = (doc: Document) => {
    const agentUserId = searchParams.get('agentUserId') || '';
    const query = new URLSearchParams({
        fileName: doc.name,
        docName: doc.name,
        taskId: doc.id, 
        mode: 'edit'
    });

    if (agentUserId) {
        query.append('agentUserId', agentUserId);
    }

    router.push(`/pdf-ocr-editor?${query.toString()}`);
  };

  // 5. 核心逻辑：智能解析 (含停止功能)
  const handleRunSmartParsing = async (doc: Document) => {
    if (!doc) return

    // 停止逻辑：如果正在运行，则点击变为停止
    if (isSmartParsing) {
        if (smartTimerRef.current) clearInterval(smartTimerRef.current)
        setIsSmartParsing(false)
        setSmartParsingStatusText("已手动停止解析")
        return
    }

    try {
      setIsSmartParsing(true)
      setSmartParsingProgress(0)
      setSmartParsingStatusText("正在检查文档是否已解析...")
      
      const fileName = doc.physicalName || doc.name
      const agentUserId = searchParams.get('agentUserId') || '123'
      
      // 5.1 提交任务
      console.log("提交智能解析任务:", { taskId: doc.id, fileName })
      const runRes = await http.post('/api/pipeline/run_check', { 
        agentUserId, 
        taskId: doc.id, 
        fileName 
      })

      if (!runRes.ok) throw new Error(runRes.message || '提交失败')

      const queryId = runRes.query_id
      setSmartParsingStatusText(`任务已提交，ID: ${queryId}`)

      // 5.2 开始轮询
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
              setSmartParsingStatusText("解析完成，正在获取结果...")
              
              // 5.3 获取结果
              try {
                  const resultUrl = `/api/pipeline/result?agentUserId=${agentUserId}&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`
                  const resultRes: any = await http.get(resultUrl)
                  
                  if (resultRes.ok) {
                      setIsSmartParsing(false)
                      const parsedData = resultRes.data
                        
                      // 处理智能解析结果 - 混合所有类型
                      const convertedDetails: DocumentDetails = {
                        text: [],
                        tables: [],
                        images: []
                      };
                      
                      // 处理blocks数据，提取图片信息
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
                  } else {
                      setSmartParsingStatusText("解析成功但获取文件失败")
                  }
              } catch (fetchErr) {
                  console.error("获取结果出错:", fetchErr)
                  setSmartParsingStatusText("获取结果出错")
              }

            // === 失败 ===
            } else if (status === 'failed' || status === 'error') {
              if (smartTimerRef.current) clearInterval(smartTimerRef.current)
              setIsSmartParsing(false)
              setSmartParsingStatusText(`解析失败: ${message}`)
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

  // 6. 核心逻辑：普通解析 (含停止功能)
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
              setParsingStatusText("解析完成，正在获取结果...")
              
              try {
                const resultRes: any = await http.get(`/api/pipeline/result?agentUserId=${agentUserId}&taskId=${doc.id}&fileName=${encodeURIComponent(fileName)}`)
                
                if (resultRes.ok) {
                  setIsParsing(false)
                  setParsingStatusText("解析成功！")
                  
                  // 处理普通解析结果 - 转换数据结构
                  const parsedData = resultRes.data
                  const convertedDetails: DocumentDetails = {
                    text: [],
                    tables: [],
                    images: []
                  }
                  
                  // 根据解析结果转换数据结构
                  if (parsedData && Array.isArray(parsedData)) {
                    // 处理文本数据
                    convertedDetails.text = parsedData.filter((item: any) => 
                      item.content && !item.content.includes('🖼️ 点击查看高清原图') && !item.content.startsWith('📊 点击编辑关联表格')
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
                      item.content && item.content.startsWith('📊 点击编辑关联表格')
                    ).map((item: any, index: number) => {
                      // 兼容新旧两种格式
                      if (item.content.includes('{{#T#:')) {
                          // 新格式: 📊 点击编辑表格 (XA_certificate_0_table_1.xlsx){{#T#:XA_certificate_0_table_1.xlsx}}
                          const match = item.content.match(/\{\{#T#:(.*?)\}\}/);
                          if (match && match[1]) {
                              const fileName = match[1];
                              // 注意：普通解析的表格通常在 table 子目录下，但新格式可能不同
                              // 假设新格式也遵循 table/ 目录结构，或者根据实际情况调整
                              // 如果 fileName 已经包含了路径分隔符，则不加 table/
                              if (fileName.includes('/')) {
                                  fullTablePath = fileName;
                              } else {
                                  fullTablePath = `table/${fileName}`;
                              }
                              
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
                          const tablePath = `${baseName}_${pdfLoc}_table_${tableId}.xlsx`;
                          fullTablePath = `table/${tablePath}`;
                      }

                      // 构建相对路径 key (用于匹配 metadata)
                      const agentUserId = searchParams.get('agentUserId') || '123';
                      const relativeKey = `/save/${agentUserId}/${doc.id}/${fullTablePath}`;
                      
                      // 去掉标题前面的编号部分（如"1.1."）
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
                          original_name: item.heading_title || displayName, // 使用heading_title作为原始名称
                          relative_key: relativeKey
                        }
                      };
                    });
                    
                    // 处理图片数据 - 从content中提取PDF位置信息并匹配图片文件
                    convertedDetails.images = parsedData.filter((item: any) => 
                      item.content && (item.content.includes('🖼️ 点击查看高清原图') || item.content.includes('🖼️ 点击查看图片'))
                    ).map((item: any, index: number) => {
                      let imageUrl = '';
                      let displayName = item.heading_title || `图片 ${index + 1}`;
                      let pdfLoc = '0';
                      const agentUserId = searchParams.get('agentUserId') || '123';

                      // 兼容新旧两种格式
                      if (item.content.includes('{{#I#:')) {
                          // 新格式: 🖼️ 点击查看图片 (XA_certificate_1_layout_det_res_1.png){{#I#:XA_certificate_1_layout_det_res_1.png}}
                          const match = item.content.match(/\{\{#I#:(.*?)\}\}/);
                          if (match && match[1]) {
                              const fileName = match[1];
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
                  } else {
                    // 兼容旧格式数据
                    convertedDetails.text = parsedData
                      .filter(item => item.type === 'text' || (!item.type && typeof item.content === 'string'))
                      .map(item => ({
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
                      .filter(item => item.type === 'table')
                      .map(item => ({
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
                      .filter(item => item.type === 'image')
                      .map(item => ({
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
                  
                  // 更新文档详情
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

  const handleOneClickSmartParse = () => {
    if (selectedDoc) handleRunSmartParsing(selectedDoc)
  };

  const handleOneClickParse = () => {
    if (selectedDoc) handleRunParsing(selectedDoc)
  };

  // === 元数据状态 ===
  // const [fileNames, setFileNames] = useState<Record<string, any>>({})

  // 0. 获取文件元数据
  // const fetchFileMetadata = useCallback(async () => {
  //   try {
  //     const res: any = await http.get('/api/metadata/file-names')
  //     if (res && res.files) {
  //       setFileNames(res.files)
  //     }
  //   } catch (e) {
  //     console.error('获取文件元数据失败', e)
  //   }
  // }, [])

  // 更新单个文件的元数据
  // const updateFileMetadata = async (filePath: string, displayName: string, fileType: string = 'xlsx') => {
  //   try {
  //     // 乐观更新本地状态
  //     setFileNames(prev => ({
  //       ...prev,
  //       [filePath]: { displayName, fileType, updatedAt: new Date().toISOString() }
  //     }))

  //     // 发送请求
  //     await http.post('/api/metadata/file-names', {
  //       filePath,
  //       displayName,
  //       fileType
  //     })
  //   } catch (e) {
  //     console.error('更新文件元数据失败', e)
  //   }
  // }

  // 初始化加载
  useEffect(() => { 
    fetchDocuments() 
  }, [fetchDocuments])

  // 1. 获取文档列表监听选中变动，加载详情
  useEffect(() => {
    if (selectedDoc && selectedDoc.status === 'completed') {
       fetchDocumentDetails(selectedDoc.id);
    } else {
       setDocDetails(null);
    }
  }, [selectedDoc, fetchDocumentDetails]);

  return (
    // UI：保持 Page.tsx 原有的风格
    <div className="p-4 md:p-6 space-y-4 min-h-[calc(100vh-64px)] flex flex-col">
      
      {/* Header: 玻璃拟态效果 */}
      <div className="flex items-center justify-between shrink-0 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            文档解析工作台
          </h1>
          <p className="text-muted-foreground text-xs mt-1 ml-8">智能视觉解析技术 • 多类型内容识别</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedIds.length > 0 ? (
             <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <span className="text-xs font-medium text-primary mr-2">已选 {selectedIds.length} 项</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs shadow-sm">
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  删除
                </Button>
                <Button size="sm" className="h-7 text-xs shadow-sm bg-primary hover:bg-primary/90">
                  <Zap className="w-3 h-3 mr-1.5" />
                  批量解析
                </Button>
             </div>
          ) : (
             <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={listLoading} className="bg-white/50 hover:bg-white border-border/60 shadow-sm">
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                  刷新列表
                </Button>
                
                {/* 智能解析按钮：状态根据 isSmartParsing 变化 */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className={`shadow-md transition-all ${isSmartParsing ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                  onClick={handleOneClickSmartParse} 
                  disabled={!selectedDoc}
                >
                  {isSmartParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      停止解析
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5 mr-2" />
                      智能解析
                    </>
                  )}
                </Button>

                {/* 普通解析按钮：状态根据 isParsing 变化 */}
                <Button 
                  size="sm" 
                  className={`shadow-md transition-all ${isParsing ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-primary hover:bg-primary/90 text-white'}`}
                  onClick={handleOneClickParse}
                  disabled={!selectedDoc}
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      停止解析
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 mr-2" />
                      一键解析
                    </>
                  )}
                </Button>
             </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* Left: Queue - Responsive Width */}
        <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col shrink-0 min-h-[400px] lg:min-h-0">
          <DocumentList 
            documents={documents}
            selectedDoc={selectedDoc}
            loading={listLoading}
            error={listError}
            onSelect={setSelectedDoc}
            onRefresh={fetchDocuments}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onViewDocument={handleViewDocument}
            onSmartParse={handleRunSmartParsing}
            isSmartParsing={isSmartParsing}
          />
        </div>

        {/* Right: Details Tabs - Flexible Width */}
        <Card className="flex-1 shadow-sm border border-border/60 flex flex-col min-h-[600px] lg:min-h-0 bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-0 shrink-0 border-b border-border/40 bg-muted/20 pt-4 px-6">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <List className="w-4 h-4" />
                    解析详情
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 ml-6">
                    {selectedDoc ? `当前查看: ${selectedDoc.name}` : '请从左侧选择文档查看详情'}
                  </CardDescription>
               </div>
            </div>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 h-auto gap-6">
                {['overview', 'content', 'export', 'storage'].map(tab => (
                  <TabsTrigger 
                    key={tab}
                    value={tab} 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3 pt-2 text-sm data-[state=active]:text-primary px-0 font-medium transition-all hover:text-primary/80"
                  >
                    {{
                      overview: '概览',
                      content: '内容分类',
                      export: '导出',
                      storage: '入库'
                    }[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <div className="flex-1 bg-transparent pt-4"> 
                <TabsContent value="overview" className="mt-0 pr-2 pb-4">
                  <OverviewTab 
                    doc={selectedDoc} 
                    isParsing={isParsing || isSmartParsing}
                    parsingProgress={isParsing ? parsingProgress : smartParsingProgress}
                    parsingStatusText={isParsing ? parsingStatusText : smartParsingStatusText}
                    statistics={docStatistics}
                    statisticsLoading={statisticsLoading}
                  />
                </TabsContent>

                <TabsContent value="content" className="mt-0">
                  <ContentTab 
                    details={docDetails} 
                    loading={detailsLoading} 
                    onTableClick={(tablePath) => {
                      if (!selectedDoc) return;
                      const agentUserId = searchParams.get('agentUserId') || '123';
                      
                      // 构造跳转 URL
                      // 1. 获取物理文件名 (例如 XA_certificate_res.docx)
                      const physicalFileName = selectedDoc.physicalName || selectedDoc.name;
                      
                      // 2. 从 tablePath 中提取纯文件名 (例如 XA_certificate_1.xlsx)
                      const tableFileName = tablePath.split('/').pop() || '';
                      
                      // 3. 直接使用原始文件名，不再使用自定义名称
                      const displayName = tableFileName;
                      
                      // 4. 构造回调 URL，用于保存编辑后的内容
                      // 必须传递 subDir=table，以确保保存到正确的 table 子目录
                      // 注意：这里我们复用 pdf-ocr-editor 的逻辑，将 agentUserId 和 taskId 传递给 excel-editor
                      
                      const query = new URLSearchParams({
                        docUrl: `/api/file-proxy?path=/my-doc-system-uploads/save/${agentUserId}/${selectedDoc.id}/${tablePath}`,
                        docName: displayName, // 使用原始文件名
                        agentUserId: agentUserId,
                        taskId: selectedDoc.id,
                        tableDir: 'table',
                        subDir: 'table' // 明确指定子目录
                      });
                      
                      // 使用 window.open 在新标签页打开，避免覆盖当前页面
                      window.open(`/excel-editor?${query.toString()}`, '_blank');
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="export" className="mt-0 pr-2 pb-4">
                  <ExportTab 
                    doc={selectedDoc}
                    details={docDetails}
                    loading={detailsLoading}
                  />
                </TabsContent>

                <TabsContent value="storage" className="mt-0 h-full overflow-auto pr-2 pb-4">
                    <StorageTab doc={selectedDoc} />
                </TabsContent>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
          </CardContent>
        </Card>
      </div>
      
      {/* 智能解析进度条 - 浮窗 */}
      {isSmartParsing && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80 animate-in slide-in-from-bottom-5">
           <div className="flex justify-between text-sm mb-2">
              <span className="text-green-700 font-medium">智能解析进度</span>
              <span className="text-green-700">{smartParsingProgress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
              <div className="bg-green-500 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${smartParsingProgress}%` }}></div>
           </div>
           <div className="text-xs text-muted-foreground truncate">
             {smartParsingStatusText}
           </div>
        </div>
      )}
      
      {/* 普通解析进度条 - 浮窗 */}
      {isParsing && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50 w-80 animate-in slide-in-from-bottom-5">
           <div className="flex justify-between text-sm mb-2">
              <span className="text-blue-700 font-medium">解析进度</span>
              <span className="text-blue-700">{parsingProgress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${parsingProgress}%` }}></div>
           </div>
           <div className="text-xs text-muted-foreground truncate">
             {parsingStatusText}
           </div>
        </div>
      )}
    </div>
  )
}
