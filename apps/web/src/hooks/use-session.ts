"use client";
import { useAppSession } from "@/components/providers/session-provider";
export function useSession() {
  return useAppSession();
}
