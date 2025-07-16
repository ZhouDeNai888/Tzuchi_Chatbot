import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = "http://ai_server:8000";

interface ShareAgentRequest {
  agent_id: number;
  name: string;
  description?: string;
  allowed_origins?: string;
  usage_limit?: number | null;
  expires_at?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "No authentication token" },
        { status: 401 }
      );
    }

    // Parse the request body
    const requestData = await request.json();

    // Prepare data for backend API
    const shareAgentData: ShareAgentRequest = {
      agent_id: requestData.agent_id,
      name: requestData.name,
      description: requestData.description,
      allowed_origins: requestData.allowed_origins,
      usage_limit: requestData.usage_limit,
      expires_at: requestData.expires_at,
    };

    // Make request to backend API
    const response = await fetch(`${API_BASE_URL}/api/agents/share`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shareAgentData),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to share agent" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Share agent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
