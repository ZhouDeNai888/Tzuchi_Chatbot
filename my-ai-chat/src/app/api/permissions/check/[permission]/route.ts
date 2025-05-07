import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    // Get user_id from query params if present
    const userId = request.nextUrl.searchParams.get('user_id');
    const permission = request.nextUrl.pathname.split('/').pop();
    let url = `${API_BASE_URL}/api/permissions/check/${permission}`;
    if (userId) {
      url += `?user_id=${userId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to check permission' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Check permission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}