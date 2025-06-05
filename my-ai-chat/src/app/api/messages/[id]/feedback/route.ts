import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    const api_key = request.headers.get('x-api-key') || 'Unknown';
    if (!token && !api_key) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    // Extract message ID from URL path
    const messageId = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-api-key': api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to submit feedback' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Submit feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}