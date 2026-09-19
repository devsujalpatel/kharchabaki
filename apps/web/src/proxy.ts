import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    try {
      const cookie = request.headers.get("cookie");

      const response = await fetch(`${API_URL}/api/v1/me`, {
        method: "GET",
        headers: cookie
          ? {
              Cookie: cookie,
            }
          : {},
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.redirect(new URL("/auth/signin", request.url));
      }

      return NextResponse.next();
    } catch (error) {
      console.error("ME FETCH FAILED:", error);

      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
