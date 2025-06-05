import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('access_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
        }

        const parts = request.nextUrl.pathname.split('/');
        const id = parts[parts.length - 2];
        const url = `${API_BASE_URL}/api/knowledge-bases/${id}/documents`;

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
                { error: data.detail || 'Failed to get documents' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get documents error:', error);
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

        const parts = request.nextUrl.pathname.split('/');
        const id = parts[parts.length - 2];
        const body = await request.formData();

        const response = await fetch(`${API_BASE_URL}/api/knowledge-bases/${id}/documents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: body,
            duplex: 'half' as any,
        } as any);

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to create document' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Create document error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}