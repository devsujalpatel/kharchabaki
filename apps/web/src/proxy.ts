import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname === "/auth/signin" || pathname === "/auth/signup";

  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (!isAuthRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/me`, {
      method: "GET",
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    const data = response.ok ? await response.json() : null;

    const isAuthenticated =
      response.ok && data?.success !== false && !!data?.data?.session;

    if (isAuthenticated && isAuthRoute) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isAuthenticated && isProtectedRoute) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  } catch (error) {
    console.error("Auth check failed:", error);

    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/signin", "/auth/signup"],
};
