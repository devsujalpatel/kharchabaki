import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isAuthRoute =
    pathname === "/" ||
    pathname.startsWith("/auth/signin") ||
    pathname.startsWith("/auth/signup");

  // Don't waste an API request on unrelated routes
  if (!isProtectedRoute && !isAuthRoute) {
    return NextResponse.next();
  }

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

    const isAuthenticated = response.ok;

    // Protected route + not logged in
    if (isProtectedRoute && !isAuthenticated) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    // Auth pages / home + already logged in
    if (isAuthRoute && isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("ME FETCH FAILED:", error);

    // If we can't verify authentication, treat the user as logged out
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/",
    "/auth/signin",
    "/auth/signin/:path*",
    "/auth/signup",
    "/auth/signup/:path*",
    "/dashboard/:path*",
  ],
};
