import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('path') || ''
    if (!raw) {
      return NextResponse.json({ ok: false, message: '缺少参数: path' }, { status: 400 })
    }

    const BASE_PREFIX_A = '/my-doc-system-uploads/save'
    const BASE_PREFIX_B = '/home/cqj/my-doc-system-uploads/save'
    const CONTAINER_PREFIX = '/app/public/save'

    let absPath = raw.trim()
    
    // 自动将宿主机路径映射到容器路径
    if (absPath.startsWith(BASE_PREFIX_A)) {
      // /my-doc-system-uploads/save/... -> /app/public/save/...
      absPath = absPath.replace(BASE_PREFIX_A, CONTAINER_PREFIX)
    } else if (absPath.startsWith(BASE_PREFIX_B)) {
      // /home/cqj/my-doc-system-uploads/save/... -> /app/public/save/...
      absPath = absPath.replace(BASE_PREFIX_B, CONTAINER_PREFIX)
    } else if (absPath.startsWith(CONTAINER_PREFIX)) {
       // 已经是容器路径，不做处理
    } else {
       // 尝试自动补全
       absPath = path.join(CONTAINER_PREFIX, absPath)
    }

    // 处理 URL 编码问题，确保中文文件名能被正确识别
    absPath = decodeURIComponent(absPath)


    const normalized = path.normalize(absPath)
    const allowedBase = CONTAINER_PREFIX

    console.log('[ImageProxy] Request:', {
      original: raw,
      absPath,
      normalized,
      exists: fs.existsSync(normalized)
    })

    if (!normalized.startsWith(allowedBase)) {
      console.error('[ImageProxy] Invalid path:', normalized, 'Allowed:', allowedBase)
      return NextResponse.json({ ok: false, message: '非法路径' }, { status: 400 })
    }

    try {
        await fs.promises.access(normalized, fs.constants.R_OK)
    } catch (accessErr) {
        console.error('[ImageProxy] File access failed:', normalized, accessErr)
        return NextResponse.json({ ok: false, message: '文件不存在 or 无法访问' }, { status: 404 })
    }

    const buf = await fs.promises.readFile(normalized)
    const ct = getContentType(normalized)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=60'
      }
    })
  } catch (err: any) {
    console.error('[ImageProxy] Unexpected error:', err)
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 })
  }
}

