import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentUserId = searchParams.get('agentUserId');
  const taskId = searchParams.get('taskId');

  if (!agentUserId || !taskId) {
    return NextResponse.json({ error: 'Missing agentUserId or taskId' }, { status: 400 });
  }

  // 根据 docker-compose 挂载路径: - /home/cqj/my-doc-system-uploads/save:/app/public/save
  // Next.js 容器内的路径应该是 /app/public/save
  const baseSavePath = path.join(process.cwd(), 'public', 'save');
  const taskPath = path.join(baseSavePath, agentUserId, taskId);

  const images: any[] = [];
  const tables: any[] = [];

  try {
    if (!fs.existsSync(taskPath)) {
        return NextResponse.json({ images: [], tables: [] });
    }

    // 1. 检查 task_id 根目录下的 img 和 table
    const rootImgDir = path.join(taskPath, 'img');
    const rootTableDir = path.join(taskPath, 'table');

    if (fs.existsSync(rootImgDir)) {
        const files = fs.readdirSync(rootImgDir);
        files.forEach(file => {
            if (file.toLowerCase().endsWith('.png')) {
                images.push({
                    name: file,
                    url: `/save/${agentUserId}/${taskId}/img/${file}`,
                    fileName: '资源'
                });
            }
        });
    }

    if (fs.existsSync(rootTableDir)) {
        const files = fs.readdirSync(rootTableDir);
        files.forEach(file => {
            if (file.toLowerCase().endsWith('.xlsx')) {
                tables.push({
                    name: file,
                    url: `/save/${agentUserId}/${taskId}/table/${file}`,
                    fileName: '资源'
                });
            }
        });
    }

    // 2. 如果根目录没找到，或者为了兼容性，检查子目录 (类似之前 python 的逻辑)
    // 只有当 images 和 tables 都为空时才去深搜，或者您可以选择总是合并
    // 这里为了保险起见，如果根目录有东西就返回根目录的，否则找子目录
    
    if (images.length === 0 && tables.length === 0) {
        const subDirs = fs.readdirSync(taskPath, { withFileTypes: true });
        subDirs.forEach(dirent => {
            if (dirent.isDirectory() && dirent.name !== 'img' && dirent.name !== 'table') {
                const subPath = path.join(taskPath, dirent.name);
                const subImgDir = path.join(subPath, 'img');
                const subTableDir = path.join(subPath, 'table');

                if (fs.existsSync(subImgDir)) {
                    const files = fs.readdirSync(subImgDir);
                    files.forEach(file => {
                        if (file.toLowerCase().endsWith('.png')) {
                            images.push({
                                name: file,
                                url: `/save/${agentUserId}/${taskId}/${dirent.name}/img/${file}`,
                                fileName: dirent.name
                            });
                        }
                    });
                }

                if (fs.existsSync(subTableDir)) {
                    const files = fs.readdirSync(subTableDir);
                    files.forEach(file => {
                        if (file.toLowerCase().endsWith('.xlsx')) {
                            tables.push({
                                name: file,
                                url: `/save/${agentUserId}/${taskId}/${dirent.name}/table/${file}`,
                                fileName: dirent.name
                            });
                        }
                    });
                }
            }
        });
    }

    return NextResponse.json({ images, tables });

  } catch (error) {
    console.error('Error reading resources:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
