// app/api/extraction/schema/generate/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define base paths for different environments
const IS_DOCKER = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';

// 定义映射关系
const DOCKER_DATA_PATH = '/app/data';
const HOST_DATA_PATH = '/root/zzp/langextract-main/zzpextract';

const DOCKER_UPLOAD_PATH = '/app/public/upload';
const HOST_UPLOAD_PATH = '/home/cqj/my-doc-system-uploads/upload';

// Python Backend URLs
const PYTHON_SCHEMA_URL = 'http://host.docker.internal:31456'; // 生成 Schema 用
const PYTHON_EXTRACT_URL = 'http://host.docker.internal:16326'; // 提取数据用

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { 
      task_id, 
      status, 
      agentUserId, 
      content_file, 
      schema_map_file 
    } = body;

    if (!task_id || !content_file) {
      console.error('Missing required parameters:', { task_id, content_file });
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // --- 关键修复：路径翻译 ---
    // 如果前端传来的是容器路径 (/app/data)，告诉 Python 时要翻译成宿主机路径 (/root/zzp...)
    if (schema_map_file && schema_map_file.startsWith(DOCKER_DATA_PATH)) {
        schema_map_file = schema_map_file.replace(DOCKER_DATA_PATH, HOST_DATA_PATH);
    }
    
    // 处理上传文件的路径 (防止 Python 找不到源文件)
    if (content_file && content_file.startsWith(DOCKER_UPLOAD_PATH)) {
        content_file = content_file.replace(DOCKER_UPLOAD_PATH, HOST_UPLOAD_PATH);
    }

    // Call Python Backend API: generate_Attribute
    // This API analyzes the document and generates a schema (JSON structure)
    const pythonEndpoint = `${PYTHON_SCHEMA_URL}/generate_Attribute/`;

    console.log(`Calling Python Backend (Generate Schema): ${pythonEndpoint} with payload:`, {
      task_id,
      status,
      agentUserId,
      content_file,
      schema_map_file
    });

    const response = await fetch(pythonEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id,
        status,
        agentUserId,
        content_file,
        schema_map_file
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Python Backend Error (${response.status}):`, errorText);
      console.error('Request payload:', {
        task_id,
        status,
        agentUserId,
        content_file,
        schema_map_file
      });
      return NextResponse.json({ error: `Backend failed: ${errorText}` }, { status: response.status });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Schema generation started',
      jobId: task_id
    });

  } catch (error) {
    console.error('Error starting schema generation:', error);
    return NextResponse.json({ error: 'Failed to start schema generation' }, { status: 500 });
  }
}
