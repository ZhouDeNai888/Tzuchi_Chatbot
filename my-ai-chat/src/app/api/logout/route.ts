// src/app/api/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  // Create cookie clearing options for both cookies
  const commonOptions = [
    "Path=/",
    "HttpOnly",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=0",
  ].filter(Boolean);

  // Clear access_token cookie
  const accessTokenCookie = ["access_token=", ...commonOptions].join("; ");

<<<<<<< Updated upstream
    // Clear access_token_js cookie
    // const accessTokenJsCookie = ['access_token_js=', ...commonOptions].join('; ');
=======
  // Clear access_token_js cookie
  const accessTokenJsCookie = ["access_token_js=", ...commonOptions].join("; ");
>>>>>>> Stashed changes

  console.log("Clearing cookies with options:", commonOptions);

<<<<<<< Updated upstream
    const headers = new Headers();
    headers.append('Set-Cookie', accessTokenCookie);
    // headers.append('Set-Cookie', accessTokenJsCookie);
=======
  const headers = new Headers();
  headers.append("Set-Cookie", accessTokenCookie);
  headers.append("Set-Cookie", accessTokenJsCookie);
>>>>>>> Stashed changes

  return NextResponse.json({ success: true }, { status: 200, headers });
}
