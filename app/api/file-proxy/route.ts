import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePathParam = searchParams.get('path');
  
  if (!filePathParam) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }
  
  try {
    // 允许的路径前缀
    const allowedPrefixes = ['/my-doc-system-uploads/', '/save/', '/public/save/'];
    
    // 安全检查：确保路径以允许的前缀开头
    const isAllowed = allowedPrefixes.some(prefix => filePathParam.startsWith(prefix));
    
    if (!isAllowed) {
      console.error(`Access denied for path: ${filePathParam}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // 构建完整的文件路径
    // 注意：Docker 容器中，/my-doc-system-uploads 映射到项目根目录下的某个位置
    // 或者直接使用绝对路径
    
    let fullPath = '';
    
    // 处理路径映射
    if (filePathParam.startsWith('/my-doc-system-uploads/')) {
        // 修正路径映射：将虚拟路径 /my-doc-system-uploads 映射到物理路径 /home/cqj/my-doc-system-uploads
        // 注意：这里硬编码了 /home/cqj 前缀，这在当前环境中是正确的，但在其他环境中可能需要调整
        // 更好的做法是使用环境变量，但为了快速修复，我们先这样处理
        const relativePath = filePathParam.replace('/my-doc-system-uploads', '');
        fullPath = path.join('/home/cqj/my-doc-system-uploads', relativePath);
        
        // 兼容性处理：如果物理路径不存在，尝试 process.cwd() 下的 public 目录 (开发环境常见配置)
        if (!fs.existsSync(fullPath)) {
             const publicPath = path.join(process.cwd(), 'public', relativePath);
             if (fs.existsSync(publicPath)) {
                 fullPath = publicPath;
             }
        }
    } else {
        // 其他路径处理
         fullPath = path.join(process.cwd(), filePathParam.startsWith('/') ? filePathParam.slice(1) : filePathParam);
    }

    console.log(`File proxy request: ${filePathParam} -> ${fullPath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // 读取文件
    const fileBuffer = fs.readFileSync(fullPath);
    
    // 获取文件扩展名以确定MIME类型
    const ext = path.extname(fullPath).toLowerCase().slice(1);
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case 'xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
        case 'pdf':
        contentType = 'application/pdf';
        break;
    }
    
    // 尝试读取元数据映射
    const metaPath = '/home/cqj/my-doc-system-uploads/metadata/file-names.json';
    let downloadName = path.basename(fullPath);
    
    if (fs.existsSync(metaPath)) {
        try {
            const metaContent = fs.readFileSync(metaPath, 'utf-8');
            const metaJson = JSON.parse(metaContent);
            const relativeKey = filePathParam.replace('/my-doc-system-uploads', '');
            
            // 查找完全匹配或基本名匹配
            if (metaJson.files && metaJson.files[relativeKey]) {
                const meta = metaJson.files[relativeKey];
                if (meta.displayName) {
                    // 保持原始扩展名
                    const originalExt = path.extname(fullPath);
                    const newName = meta.displayName.endsWith(originalExt) 
                        ? meta.displayName 
                        : `${meta.displayName}${originalExt}`;
                    downloadName = newName;
                }
            }
        } catch (e) {
            console.error('Error reading metadata:', e);
        }
    }
    
    // 返回文件数据
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
