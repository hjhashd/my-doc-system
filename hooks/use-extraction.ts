"use client"

import { feedback } from "@/lib/feedback"

interface ExtractionHandlerProps {
  document: any;
  schemaData: Record<string, any>;
  taskId: string;
  onSchemaDataChange: (schemaData: Record<string, any>) => void;
  onProcessingChange: (processing: boolean) => void;
  onStartTimeChange: (startTime: number | null) => void;
  onProgressChange?: (progress: number) => void;
  onStatusTextChange?: (statusText: string) => void;
}

export function useExtraction({
  document,
  schemaData,
  taskId,
  onSchemaDataChange,
  onProcessingChange,
  onStartTimeChange,
  onProgressChange,
  onStatusTextChange
}: ExtractionHandlerProps) {

  const handleSaveSchema = async () => {
    if (!document) {
      feedback.error("请先选择一个文档")
      return
    }

    onProcessingChange(true)
    onStartTimeChange(Date.now())
    onProgressChange?.(0)
    onStatusTextChange?.("正在初始化信息抽取...")
    
    try {
      const agentUserId = 123; 
      const currentTaskId = taskId || document.id;
      const physicalName = document.physicalName || document.name;
      
      // Step 1: 保存逻辑
      onStatusTextChange?.("正在保存Schema...")
      const resSaveSchema = await fetch('/api/debug/check-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          schemaData: schemaData
        })
      })
      
      if (!resSaveSchema.ok) throw new Error('Failed to save schema data')
      const saveResult = await resSaveSchema.json()
      if (!saveResult.success) throw new Error('Failed to save schema data')
      
      feedback.info("Schema已保存，开始智能抽取...")
      onStatusTextChange?.("Schema已保存，正在启动智能抽取...")
      
      // Step 2: 启动抽取
      const contentFileHostPath = `/home/cqj/my-doc-system-uploads/save/${agentUserId}/${currentTaskId}/${physicalName}`;
      const schemaFileHostPath = `/root/zzp/langextract-main/zzpextract/extractenti_json/${agentUserId}/${currentTaskId}.json`;
      const outputJsonDirHost = "/root/zzp/langextract-main/zzpextract/output"; 

      onStatusTextChange?.("正在发送抽取请求...")
      const resExtract = await fetch('/api/extraction/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          status: 0,
          agentUserId: agentUserId,
          content: contentFileHostPath, 
          schema_map: schemaFileHostPath, 
          output_json_file: outputJsonDirHost
        })
      })

      if (!resExtract.ok) throw new Error('Failed to start extraction')
      
      feedback.success("AI 正在读取文档...")
      onStatusTextChange?.("AI正在读取文档并抽取信息...")

      // Step 3: 轮询结果
      let attempts = 0;
      const maxAttempts = 60; // 增加轮询次数从20到60
      
      const intervalId = setInterval(async () => {
        attempts++;
        const progress = Math.min(Math.floor((attempts / maxAttempts) * 90), 90) // 最多到90%，完成时设为100%
        onProgressChange?.(progress)
        onStatusTextChange?.(`正在检查抽取结果... (尝试 ${attempts}/${maxAttempts})`)
        
        try {
          const res = await fetch(`/api/extraction/schema?taskId=${currentTaskId}&type=result`);
          
          if (res.status === 404) return;

          if (res.ok) {
            const resultData = await res.json();
            if (resultData && Object.keys(resultData).length > 0) {
              clearInterval(intervalId);
              onSchemaDataChange(resultData);
              onProcessingChange(false);
              onStartTimeChange(null);
              onProgressChange?.(100)
              onStatusTextChange?.("信息抽取完成")
              feedback.success("🎉 提取完成！数据已更新");
              return;
            }
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            onProcessingChange(false);
            onStartTimeChange(null);
            onStatusTextChange?.("信息抽取超时")
            feedback.error("提取时间较长，请稍后刷新页面查看");
          }
        } catch (e) {
          console.error("轮询出错", e);
          onStatusTextChange?.("检查抽取结果时出错，正在重试...")
        }
      }, 5000); // 增加轮询间隔从3000到5000

    } catch (error) {
      console.error("Error in handleSaveSchema:", error)
      onStatusTextChange?.("信息抽取失败")
      feedback.error(`抽取任务启动失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      onProcessingChange(false)
      onStartTimeChange(null)
    }
  }

  return {
    handleSaveSchema
  }
}