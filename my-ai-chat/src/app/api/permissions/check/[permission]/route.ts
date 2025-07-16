import { NextResponse, NextRequest } from "next/server";

const API_BASE_URL = "http://ai_server:8000";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "No authentication token" },
        { status: 401 }
      );
    }

    // Get user_id from query params if present
    const userId = request.nextUrl.searchParams.get("user_id");
    const permission = request.nextUrl.pathname.split("/").pop();

    // Add timestamp to URL to prevent caching on backend
    const timestamp = Date.now();
    let url = `${API_BASE_URL}/api/permissions/check/${permission}?t=${timestamp}`;

    if (userId) {
      url += `&user_id=${userId}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to check permission" },
        { status: response.status }
      );
    }

    // Return with anti-caching headers
    const headers = new Headers({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error("Check permission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
