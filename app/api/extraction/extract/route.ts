// app/api/extraction/extract/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 【修改 1】定义宿主机上的 output 输出根目录
// 对应你 curl 里的 "/root/zzp/langextract-main/zzpextract/output"
const HOST_OUTPUT_PATH = '/root/zzp/langextract-main/zzpextract/output';

// 定义容器内的 output 目录 (用于 Node.js 检查是否存在，假设映射关系还是 /app/data 对应 /zzpextract)
const DOCKER_OUTPUT_PATH = '/app/data/output';

// 定义映射关系
const DOCKER_BASE_PATH = '/app/data';
const HOST_BASE_PATH = '/root/zzp/langextract-main/zzpextract';

const DOCKER_UPLOAD_PATH = '/app/public/upload';
const HOST_UPLOAD_PATH = '/home/cqj/my-doc-system-uploads/upload';

// Python 服务地址 (提取服务端口 16326)
const PYTHON_EXTRACT_URL = 'http://host.docker.internal:16326';

// 暂时写死的用户ID
const USER_ID = '123';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { 
      task_id, 
      status, 
      agentUserId, 
      content,      // In ExtJSONllm_api, this is 'content', but likely means content_file path
      schema_map,   // Path to the schema file we just saved
    } = body;

    if (!task_id || !content || !schema_map) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 【修改 2】构建传给 Python 的路径
    // 关键点：直接传根目录 HOST_OUTPUT_PATH，不要在这里 path.join(USER_ID)
    // Python 的代码逻辑是：os.path.join(output_base_dir, str(report.agentUserId))
    // 所以我们这里只传 base 即可。
    const outputDirHost = HOST_OUTPUT_PATH;

    // (可选) 确保容器内能看到这个目录，方便后续读文件
    const outputDirDocker = path.join(DOCKER_OUTPUT_PATH, USER_ID);
    if (!fs.existsSync(outputDirDocker)) {
        // 注意：这里创建的是带 USER_ID 的目录，为了给 Python "铺路" 或者 Node 自己用
        fs.mkdirSync(outputDirDocker, { recursive: true });
    }

    // --- 关键修复：路径翻译 ---
    // 如果前端传来的是容器路径 (/app/data)，告诉 Python 时要翻译成宿主机路径 (/root/zzp...)
    if (schema_map && schema_map.startsWith(DOCKER_BASE_PATH)) {
        schema_map = schema_map.replace(DOCKER_BASE_PATH, HOST_BASE_PATH);
    }
    
    // 处理上传文件的路径 (防止 Python 找不到源文件)
    if (content && content.startsWith(DOCKER_UPLOAD_PATH)) {
        content = content.replace(DOCKER_UPLOAD_PATH, HOST_UPLOAD_PATH);
    }

    // --- 修改点2：确保容器内目录存在 (可选，但推荐) ---
    // 虽然 Python 会创建，但 Node 最好也确认一下权限或存在性
    // (这部分代码已移到上面，与输出目录构建逻辑合并)

    // 调用 Python
    const pythonEndpoint = `${PYTHON_EXTRACT_URL}/extract_Attribute/`;

    console.log(`Calling Python Backend (Extract): ${pythonEndpoint} with payload:`, {
      task_id,
      status,
      agentUserId: parseInt(USER_ID),
      content_file: content,
      schema_map_forEnti_file: schema_map,
      output_json_file: outputDirHost
    });

    // 发送请求
    const response = await fetch(pythonEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id,
        status,
        agentUserId: parseInt(USER_ID),
        
        // --- 修改开始：字段名映射 ---
        // 左边是 Python 需要的名字，右边是你当前的变量名
        content_file: content,
        schema_map_forEnti_file: schema_map,
        // --- 修改结束 ---

        // 【修改 3】使用新的输出路径
        output_json_file: outputDirHost
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Python Backend Error (${response.status}):`, errorText);
      return NextResponse.json({ error: `Backend failed: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({ 
      success: true, 
      message: 'Extraction started successfully',
      jobId: task_id,
      backendResponse: data
    });

  } catch (error) {
    console.error('Error starting extraction:', error);
    return NextResponse.json({ error: 'Failed to start extraction' }, { status: 500 });
  }
}
