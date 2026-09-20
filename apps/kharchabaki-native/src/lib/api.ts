// lib/api.ts

import { authClient } from "@/lib/auth-client";

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  const cookie = await authClient.getCookie();

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  return fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
    credentials: "omit",
  });
}
