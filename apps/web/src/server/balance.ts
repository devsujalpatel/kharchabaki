"use server";
import { api } from "@/lib/api";

type Data = {
  balance: number;
};

type Balance = {
  success: boolean;
  message: string;
  data: Data;
};

export async function balanceQuery(): Promise<Balance> {
  return api<Balance>("/balance");
}

export async function addBalance(amount: number): Promise<Balance> {
  return api<Balance>("/balance", {
    method: "POST",
    body: JSON.stringify({
      amount,
    }),
  });
}
