
import { NextRequest, NextResponse } from 'next/server';

const EXTRACT_API_URL = process.env.EXTRACT_API_URL || 'http://localhost:16326';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Construct the payload expected by the Python API
    const payload = {
      task_id: body.taskId || Date.now().toString(),
      status: 0,
      agentUserId: parseInt(body.agentUserId || '123'),
      content: body.content || '',
      schema_map: body.schemaMap || '{}',
      output_json_file: body.outputJsonFile || '/tmp/output',
    };

    const response = await fetch(`${EXTRACT_API_URL}/extract_Attribute/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { ok: false, message: `Backend API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
