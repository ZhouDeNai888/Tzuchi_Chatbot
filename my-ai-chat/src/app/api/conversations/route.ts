import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    const body = await request.json();

    // Ensure required fields are present
    if (!body.title || !body.department_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title and department_id' },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
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
        { error: data.detail || 'Failed to create conversation' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    // Get optional query parameters
    const departmentId = request.nextUrl.searchParams.get('department_id');
    let url = `${API_BASE_URL}/api/conversations`;
    
    if (departmentId) {
      url += `?department_id=${departmentId}`;
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
        { error: data.detail || 'Failed to get conversations' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}