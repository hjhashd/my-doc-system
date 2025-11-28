import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { ok: false, message: 'Missing file path parameter' },
        { status: 400 }
      );
    }
    
    // Security check - ensure the path is within allowed directories
    const allowedPaths = ['/tmp/output/', '/home/cqj/my-doc-system/'];
    const isAllowed = allowedPaths.some(allowedPath => 
      filePath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      return NextResponse.json(
        { ok: false, message: 'Access to this file path is not allowed' },
        { status: 403 }
      );
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { ok: false, message: 'File not found' },
        { status: 404 }
      );
    }
    
    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(fileContent);
      return NextResponse.json({ ok: true, data: jsonData });
    } catch (parseError) {
      // If not valid JSON, return as text
      return NextResponse.json({ ok: true, data: fileContent });
    }
  } catch (error: any) {
    console.error('File content API error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}