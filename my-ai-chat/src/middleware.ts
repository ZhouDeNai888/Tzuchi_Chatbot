import { NextRequest, NextResponse } from "next/server";

// Use actual wildcard or specific domains
const allowedOrigins = ["*"];

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export function middleware(request: NextRequest) {
  // Skip middleware for public resources
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/public") ||
    request.nextUrl.pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check the origin for CORS
  const origin = request.headers.get("origin") ?? "";
  // Use true wildcard instead of includes() check when using '*'
  const isAllowedOrigin =
    allowedOrigins[0] === "*" || allowedOrigins.includes(origin);

  // Handle preflighted requests (OPTIONS)
  const isPreflight = request.method === "OPTIONS";
  if (isPreflight) {
    const preflightHeaders = {
      "Access-Control-Allow-Origin":
        allowedOrigins[0] === "*" ? "*" : isAllowedOrigin ? origin : "",
      ...corsOptions,
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // Ensure that the `/api/embed.js` route is always accessible
  if (request.nextUrl.pathname === "/api/embed.js") {
    const res = applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  if (request.nextUrl.pathname === "/api/chat") {
    return applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
  }
  if (request.nextUrl.pathname === "/api/agents/config") {
    return applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
  }
  if (
    request.nextUrl.pathname.startsWith("/api/messages/") &&
    request.nextUrl.pathname.includes("/feedback")
  ) {
    return applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
  }
  if (request.nextUrl.pathname.startsWith("/api/contact-admin/")) {
    return applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
  }
  if (request.nextUrl.pathname.startsWith("/api/forgot-password/")) {
    return applyHeaders(NextResponse.next(), origin, isAllowedOrigin);
  }
  // Get access token from cookies or auth header
  const token =
    request.cookies.get("access_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  // Define public paths that don't require authentication
  const publicPaths = [
    "/login",
    "/register",
    "/api/token",
    "/api/login",
    "/api/register",
    "/api/embed.js",
    "/api/chat",
    "/api/logout",
    "/api/token/refresh",
    "/api/agents/config",
    "/api/messages/",
    "/api/contact-admin",
    "/api/forgot-password",
  ];

  const isPublicPath = publicPaths.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname === `${path}/` ||
      request.nextUrl.pathname.startsWith(`${path}?`) ||
      request.nextUrl.pathname.startsWith(`${path}/`)
  );

  // Define protected paths that require authentication
  const protectedPaths = [
    "/accounts",
    "/agent",
    "/departments",
    "/history",
    "/knowledge",
    "/profile",
    "/share",
  ];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Root path (homepage) requires auth
  const isRootPath = request.nextUrl.pathname === "/";

  // API paths (except public ones) require auth
  const isApiPath =
    request.nextUrl.pathname.startsWith("/api") &&
    !publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // Check for session storage flag in header
  // (for Next.js 15 compatibility - the client will include this header)
  const authSuccess = request.headers.get("x-auth-success");

  // Redirect to login if trying to access protected content without a token
  if (!token && (isProtectedPath || isRootPath || isApiPath)) {
    console.log("⚠️ Redirecting to login page due to missing token");
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Only redirect to home if explicitly on login page with valid token
  if (
    token &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/login/")
  ) {
    console.log(
      "✔️ Redirecting to home page due to existing token on login page"
    );
    let redirectPath = "/";

    // Check if there's a redirect param to go back to the original requested URL
    const url = new URL(request.url);
    const redirectParam = url.searchParams.get("redirect");
    if (redirectParam) {
      redirectPath = redirectParam;
    }

    // Add timestamp to prevent caching issues
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.append("t", Date.now().toString());

    // Clear the access token cookie
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("access_token");

    return response;
  }

  // Create a new response with no-cache headers
  const response = NextResponse.next();

  // Add cache control headers to prevent browser caching
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");

  // Apply CORS headers to the response for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }

    Object.entries(corsOptions).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

// Helper function to apply CORS headers to a response
function applyHeaders(
  response: NextResponse,
  origin: string,
  isAllowedOrigin: boolean
) {
  response.headers.set(
    "Access-Control-Allow-Origin",
    allowedOrigins[0] === "*" ? "*" : isAllowedOrigin ? origin : ""
  );

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except static files and assets
    "/((?!_next/static|_next/image|favicon\\.ico|public/).*)",
    "/api/:path*",
  ],
};
