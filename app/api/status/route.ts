
import { NextRequest, NextResponse } from 'next/server';

const EXTRACT_API_URL = process.env.EXTRACT_API_URL || 'http://localhost:16326';
const GENERATE_API_URL = process.env.GENERATE_API_URL || 'http://localhost:31456';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const type = url.searchParams.get('type') || 'extract'; // 'extract' or 'generate'

    if (!taskId) {
      return NextResponse.json(
        { ok: false, message: 'Missing taskId parameter' },
        { status: 400 }
      );
    }

    const apiUrl = type === 'extract' ? EXTRACT_API_URL : GENERATE_API_URL;
    const response = await fetch(`${apiUrl}/report_status/${taskId}`);

    if (!response.ok) {
        // If 404, it might mean the task is not found on that server
        if (response.status === 404) {
             return NextResponse.json(
                { ok: false, message: 'Task not found' },
                { status: 404 }
            );
        }
      const errorData = await response.text();
      return NextResponse.json(
        { ok: false, message: `Backend API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
