"use server";
import { api } from "@/lib/api";

type Data = {
  service: string;
  status: string;
  timestamp: string;
};

type Health = {
  success: boolean;
  message: string;
  data: Data;
};

export async function healthQuery(): Promise<Health> {
  return api<Health>("/health");
}
