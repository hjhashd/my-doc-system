// app/api/extraction/schema/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 容器内的基础数据路径
const BASE_PATH = '/app/data';
const USER_ID = '123';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const type = searchParams.get('type'); // 'generated', 'saved', 'result', or null

    if (!taskId) {
      return NextResponse.json({ error: 'TaskId required' }, { status: 400 });
    }

    let filePath = '';
    
    if (type === 'result') {
        // 1. 提取结果 - 先尝试标准路径，如果没有，尝试其他可能的位置
        const standardPath = path.join(BASE_PATH, 'output', USER_ID, `${taskId}.json`);
        const altPath1 = path.join(BASE_PATH, 'output', `${taskId}.json`);
        const altPath2 = path.join(BASE_PATH, 'output', `final_result${taskId}.json`);
        
        if (fs.existsSync(standardPath)) {
            filePath = standardPath;
            console.log(`[SchemaAPI] Found result at standard path: ${filePath}`);
        } else if (fs.existsSync(altPath1)) {
            filePath = altPath1;
            console.log(`[SchemaAPI] Found result at alt path 1: ${filePath}`);
        } else if (fs.existsSync(altPath2)) {
            filePath = altPath2;
            console.log(`[SchemaAPI] Found result at alt path 2: ${filePath}`);
        } else {
            // 记录所有可能的路径，方便调试
            console.log(`[SchemaAPI] Result file not found. Checked paths:`);
            console.log(`  - Standard: ${standardPath}`);
            console.log(`  - Alt 1: ${altPath1}`);
            console.log(`  - Alt 2: ${altPath2}`);
            return NextResponse.json({ found: false }, { status: 404 });
        }
    } else if (type === 'generated') {
        // 2. 初始生成的 Schema
        filePath = path.join(BASE_PATH, 'generater_json', USER_ID, `${taskId}.json`);
    } else if (type === 'saved') {
        // 3. 用户保存的 Schema
        filePath = path.join(BASE_PATH, 'extractenti_json', USER_ID, `${taskId}.json`);
    } else {
        // 4. 默认行为 (智能查找)
        // 优先找用户保存的，如果没有，找初始生成的
        const savedPath = path.join(BASE_PATH, 'extractenti_json', USER_ID, `${taskId}.json`);
        const generatedPath = path.join(BASE_PATH, 'generater_json', USER_ID, `${taskId}.json`);
        
        if (fs.existsSync(savedPath)) {
            filePath = savedPath;
            // console.log(`[SchemaAPI] Auto-detected saved schema: ${filePath}`);
        } else {
            filePath = generatedPath;
            // console.log(`[SchemaAPI] Auto-detected generated schema: ${filePath}`);
        }
    }

    // console.log(`[SchemaAPI] Request type=${type}, taskId=${taskId}`);
    // console.log(`[SchemaAPI] Target path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      // console.log(`[SchemaAPI] File not found: ${filePath}`);
      return NextResponse.json({ found: false }, { status: 404 });
    }

    // console.log(`[SchemaAPI] File found, returning content`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(fileContent));

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
