import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/token/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Token refresh failed' },
        { status: response.status }
      );
    }

    // Set HTTP cookie for new token
    const cookieOptions = [
      `access_token=${data.access_token}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Strict'
    ];

    if (data.expires_at) {
      cookieOptions.push(`Expires=${new Date(data.expires_at * 1000).toUTCString()}`);
    }

    const headers = new Headers({
      'Set-Cookie': cookieOptions.join('; ')
    });

    return NextResponse.json(
      { 
        success: true,
        access_token: data.access_token,
        expires_at: data.expires_at
      },
      {
        status: 200,
        headers
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}