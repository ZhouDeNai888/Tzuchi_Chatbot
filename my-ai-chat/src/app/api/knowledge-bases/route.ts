import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    // Get query parameters if any
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('department_id');
    const userId = searchParams.get('user_id');

    // Build URL with query parameters
    let url = `${API_BASE_URL}/api/knowledge-bases`;
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (userId) params.append('user_id', userId);
    if (params.toString()) url += `?${params.toString()}`;

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
        { error: data.detail || 'Failed to get knowledge bases' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get knowledge bases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/api/knowledge-bases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to create knowledge base' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create knowledge base error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}