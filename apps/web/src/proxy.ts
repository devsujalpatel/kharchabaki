import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname === "/auth/signin" || pathname === "/auth/signup";

  const isProtectedRoute = pathname.startsWith("/dashboard");

  // Only check auth for routes we care about
  if (!isAuthRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  let isAuthenticated = false;

  try {
    const response = await fetch(`${API_URL}/api/v1/me`, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();

      isAuthenticated = data.success !== false && !!data?.data?.session;
    }
  } catch {
    isAuthenticated = false;
  }

  // Logged-in user trying to access signin/signup
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Logged-out user trying to access dashboard
  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/signin", "/auth/signup"],
};
