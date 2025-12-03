import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 容器内的抽取结果存放根目录（通过Docker卷挂载到宿主机）
const EXTRACTION_BASE_PATH = '/app/data/extractenti_json';
const USER_ID = '123';

export async function POST(request: Request) {
  try {
    const { task_id, schemaData } = await request.json();

    if (!task_id) {
      return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
    }

    // 1. 拼接完整路径
    // 结果: /app/data/extractenti_json/123/{task_id}.json
    const targetPath = path.join(EXTRACTION_BASE_PATH, USER_ID, `${task_id}.json`);
    
    // 2. 检查目录是否存在，如果不存在则创建
    const userDir = path.join(EXTRACTION_BASE_PATH, USER_ID);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
      console.log(`[Debug] Created directory: ${userDir}`);
    }

    // 3. 将页面上的 JSON 内容保存到文件
    if (schemaData) {
      try {
        fs.writeFileSync(targetPath, JSON.stringify(schemaData, null, 2), 'utf8');
        console.log(`[Debug Save] Saved schema data to: ${targetPath}`);
      } catch (writeError) {
        console.error(`[Debug] Failed to write file: ${writeError}`);
        throw writeError;
      }
    }

    // 4. 检查文件是否保存成功
    const exists = fs.existsSync(targetPath);
    let fileSize = 0;
    if (exists) {
      const stats = fs.statSync(targetPath);
      fileSize = stats.size;
    }

    console.log(`[Debug Check] Path: ${targetPath}, Exists: ${exists}, Size: ${fileSize}`);

    return NextResponse.json({ 
      success: true, 
      data: { 
        taskId: task_id, 
        fullPath: targetPath, 
        hostPath: `/root/zzp/langextract-main/zzpextract/extractenti_json/123/${task_id}.json`,
        exists: exists, 
        fileSize: fileSize, 
        userId: USER_ID, 
        message: exists 
            ? (fileSize > 0 ? "✅ 文件已成功保存，可以查看内容！" : "⚠️ 文件已保存但为空！") 
            : "❌ 文件保存失败！" 
      } 
    });

  } catch (error) {
    console.error(`[Debug Error] ${error}`);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}