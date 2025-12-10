"use client"

import { useState, useEffect } from "react"
import { feedback } from "@/lib/feedback"

interface SchemaGenerationHandlerProps {
  document: any;
  onSchemaGenerated: (schemaData: Record<string, any>) => void;
  onProcessingChange: (processing: boolean) => void;
  onStartTimeChange: (startTime: number | null) => void;
  onProgressChange?: (progress: number) => void;
  onStatusTextChange?: (statusText: string) => void;
}

export function useSchemaGeneration({
  document,
  onSchemaGenerated,
  onProcessingChange,
  onStartTimeChange,
  onProgressChange,
  onStatusTextChange
}: SchemaGenerationHandlerProps) {
  const [taskId, setTaskId] = useState<string>("")

  const handleGenerateSchema = async (doc: any) => {
    onProcessingChange(true)
    onStartTimeChange(Date.now())
    onSchemaGenerated({}) // 清空现有数据
    onProgressChange?.(0)
    onStatusTextChange?.("正在初始化Schema生成...")
    
    try {
      const agentUserId = 123; 
      const currentTaskId = doc.id;
      const physicalName = doc.physicalName || doc.name;
      
      const contentFileHostPath = `/home/cqj/my-doc-system-uploads/save/${agentUserId}/${currentTaskId}/${physicalName}`;
      const outputJsonDirHost = "/root/zzp/langextract-main/zzpextract/generater_json"; 
      
      onStatusTextChange?.("正在发送Schema生成请求...")
      const res = await fetch('/api/extraction/schema/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          status: 0,
          agentUserId: agentUserId,
          content_file: contentFileHostPath,
          schema_map_file: outputJsonDirHost
        })
      })

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to start schema generation: ${errorData.error || 'Unknown error'}`);
      }
      
      feedback.info("正在分析文档生成Schema...")
      setTaskId(currentTaskId)

      let attempts = 0;
      const maxAttempts = 60; // 增加轮询次数从30到60
      
      const pollSchema = async () => {
        try {
          onStatusTextChange?.(`正在检查生成结果... (尝试 ${attempts}/${maxAttempts})`)
          const schemaRes = await fetch(`/api/extraction/schema?taskId=${currentTaskId}&type=generated`)
          if (schemaRes.ok) {
             const data = await schemaRes.json()
             if (Object.keys(data).length > 0) {
               onSchemaGenerated(data)
               onProgressChange?.(100)
               onStatusTextChange?.("Schema生成完成")
               feedback.success("Schema生成完毕")
               return true
             }
          }
        } catch (e) { 
          console.error(e) 
          onStatusTextChange?.("检查生成结果时出错，正在重试...")
        }
        return false
      }

      onStatusTextChange?.("等待Schema生成完成...")
      const interval = setInterval(async () => {
        attempts++;
        const progress = Math.min(Math.floor((attempts / maxAttempts) * 90), 90) // 最多到90%，完成时设为100%
        onProgressChange?.(progress)
        
        const success = await pollSchema();
        if (success || attempts >= maxAttempts) {
           clearInterval(interval)
           onProcessingChange(false)
           onStartTimeChange(null)
           if (!success) {
             onStatusTextChange?.("Schema生成超时")
             feedback.error("Schema生成超时，请重试")
           }
        }
      }, 3000) // 增加轮询间隔从2000到3000

    } catch (error) {
      console.error(error)
      onStatusTextChange?.("Schema生成失败")
      feedback.error("Schema生成失败")
      onProcessingChange(false)
      onStartTimeChange(null)
    }
  }

  return {
    handleGenerateSchema,
    taskId
  }
}