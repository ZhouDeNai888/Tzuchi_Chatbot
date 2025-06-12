import { NextResponse, NextRequest } from 'next/server';

const API_BASE_URL = 'http://ai_server:8000';

export async function PUT(
    request: NextRequest,
) {
    try {
        const token = request.cookies.get('access_token')?.value;
        const id = request.nextUrl.pathname.split('/').pop();
        if (!id) {
            return NextResponse.json(
                { error: 'Permission ID is required' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
        }

        const body = await request.json();

        const response = await fetch(`${API_BASE_URL}/api/permissions/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to update permission' },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, ...data });
    } catch (error) {
        console.error('Update permission error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
) {
    try {
        const token = request.cookies.get('access_token')?.value;
        const id = request.nextUrl.pathname.split('/').pop();
        if (!id) {
            return NextResponse.json(
                { error: 'Permission ID is required' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json({ error: 'No authentication token' }, { status: 401 });
        }

        const response = await fetch(`${API_BASE_URL}/api/permissions/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // If the backend returns no content on successful deletion
        if (response.status === 204) {
            return NextResponse.json({ success: true }, { status: 200 });
        }

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to delete permission' },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, ...data });
    } catch (error) {
        console.error('Delete permission error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}