import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookies, authorization header, or localStorage-backup cookie
    const token = request.cookies.get('access_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '')
    // request.cookies.get('access_token_js')?.value;

    console.log('Chat API token sources checked:', {
      cookiePresent: !!request.cookies.get('access_token')?.value,
      headerPresent: !!request.headers.get('authorization'),
      // backupPresent: !!request.cookies.get('access_token_js')?.value
    });
    const api_key = request.headers.get('x-api-key') || 'Unknown'
    console.log('API key from headers:', request.headers.get('x-api-key') || 'None');

    if (!token && !api_key) {
      console.error('No authentication token found in any source');
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    const body = await request.json();
    const isStream = body.stream === true;
    console.log('isStream:', isStream);
    console.log('Chat request headers:', Object.fromEntries(request.headers.entries()));

    // Forward the request to the AI server
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Unknown',
        'Accept': request.headers.get('accept') || '*/*',
        'Origin': request.headers.get('origin') || request.headers.get('host') || 'Unknown',
        'x-api-key': api_key,
      },
      body: JSON.stringify(body),
    });

    console.log('AI server response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { detail: errorText };
      }
      console.error('Chat API error:', { status: response.status, error });
      return NextResponse.json(
        { error: error.detail || 'Failed to get chat completion' },
        { status: response.status }
      );
    }

    if (isStream) {
      const encoder = new TextEncoder();
      const reader = response.body?.getReader();

      console.log('Stream reader initialized:', !!reader);

      if (!reader) {
        throw new Error('Upstream response has no readable stream');
      }

      const stream = new ReadableStream({
        async start(controller) {
          // Send comment line to force headers flush (open stream quickly)
          controller.enqueue(encoder.encode('{"answer_chunk":""}\n\n'));

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              // Send chunk immediately when received
              controller.enqueue(value);
            }
          } catch (error) {
            console.error('Stream reading error:', error);
            // Try to send error message to client
            const errorMsg = encoder.encode(`data: {"error": "Stream reading error"}\n\n`);
            controller.enqueue(errorMsg);
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
          'X-Accel-Buffering': 'no', // For Nginx
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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