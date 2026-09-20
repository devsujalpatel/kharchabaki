"use server";
import { cookies } from "next/headers";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const API_URL = `${BASE_URL}/api/v1`;

export async function api<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
      ...options?.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
