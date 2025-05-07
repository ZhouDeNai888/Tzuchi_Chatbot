// src/app/api/login/route.ts

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Login failed' },
        { status: response.status }
      );
    }

    // Set HTTP cookie for token
    const cookieOptions = [
      `access_token=${data.access_token}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Strict'
    ];

    // Set expiry if provided
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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
