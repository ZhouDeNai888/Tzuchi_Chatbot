import { NextResponse, NextRequest } from "next/server";

const API_BASE_URL = "http://ai_server:8000";

export async function GET(request: NextRequest) {
  try {
    // Extract API key from request header or URL path
    const headerApiKey = request.headers.get("x-api-key");
    const pathApiKey = request.nextUrl.pathname.split("/").pop();

    // Use header API key if available, otherwise use path API key
    const api_key = headerApiKey || pathApiKey;

    if (!api_key) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    // Make request to backend API to get agent configuration
    const response = await fetch(
      `${API_BASE_URL}/api/agents/config/${api_key}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": api_key, // Add API key to header
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to get agent configuration" },
        { status: response.status }
      );
    }

    // // Add CORS headers for public access
    // const headers = new Headers({
    //     'Access-Control-Allow-Origin': '*',
    //     'Access-Control-Allow-Methods': 'GET, OPTIONS',
    //     'Access-Control-Allow-Headers': 'Content-Type',
    //     'Cache-Control': 'no-cache, no-store, must-revalidate',
    // });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get agent configuration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
