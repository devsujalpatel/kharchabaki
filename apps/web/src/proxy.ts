import { NextRequest, NextResponse } from "next/server";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log("========== PROXY ==========");
  console.log("PATH:", pathname);
  console.log("COOKIE:", request.headers.get("cookie"));
  console.log("API URL:", API_URL);

  if (pathname.startsWith("/dashboard")) {
    console.log("CALLING ME...");

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

      console.log("ME STATUS:", response.status);

      const text = await response.text();

      console.log("ME RESPONSE:", text);

      if (!response.ok) {
        console.log("NOT AUTHENTICATED");
        return NextResponse.redirect(new URL("/auth/signin", request.url));
      }

      console.log("AUTHENTICATED");
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
