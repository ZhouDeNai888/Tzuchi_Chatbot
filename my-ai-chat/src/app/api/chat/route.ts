import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    const body = await request.json();
    const isStream = body.stream === true;
    console.log('isStream:', isStream);

    // Forward the request to the AI server
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('response:', response);

    

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Failed to get chat completion' },
        { status: response.status }
      );
    }

    if (isStream) {
        const encoder = new TextEncoder();
        const reader = response.body?.getReader();

        console.log('reader:', reader);

        if (!reader) {
        throw new Error('Upstream response has no readable stream');
        }

        const stream = new ReadableStream({
        async start(controller) {
            // ส่ง comment line เพื่อบังคับให้ headers flush (เปิด stream เร็ว)
            controller.enqueue(encoder.encode(':\n\n'));

            while (true) {
            const { done, value } = await reader.read();

            console.log('done:', done);
            console.log('value:', value);
            if (done) break;

            // ส่ง chunk ทันทีที่ได้
            controller.enqueue(value);
            }

            controller.close();
        }
        });

        return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked',
            'X-Accel-Buffering': 'no', // สำหรับ Nginx
        },
        });
    }


    // For non-streaming responses, return the JSON directly
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}