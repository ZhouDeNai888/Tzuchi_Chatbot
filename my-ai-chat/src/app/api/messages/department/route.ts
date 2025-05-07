import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const departmentIds = searchParams.getAll('department_ids');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build URL with query parameters
    let url = `${API_BASE_URL}/api/messages/department`;
    const params = new URLSearchParams();
    departmentIds.forEach(id => params.append('department_ids', id));
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
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
        { error: data.detail || 'Failed to get department messages' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get department messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}