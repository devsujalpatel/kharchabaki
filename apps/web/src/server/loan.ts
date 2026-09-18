"use server";

import { api } from "@/lib/api";

export type LoanStatus = "active" | "paid" | "overdue";

export type LoanPayment = {
  id: string;
  loanId: string;
  amount: string;
  paidAt: string;
  createdAt: string;
};

export type TakenLoan = {
  id: string;
  amount: string;
  paidAmount: string;
  totalAmount: string;
  interest: string;
  borrowedFrom: string;
  dueDate: string;
  status: LoanStatus;
  createdAt: string;
  payments: LoanPayment[];
};

export type GivenLoan = {
  id: string;
  amount: string;
  paidAmount: string;
  totalAmount: string;
  interest: string;
  borrowerName: string;
  dueDate: string;
  status: LoanStatus;
  createdAt: string;
  payments: LoanPayment[];
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type CreateLoanInput = {
  amount: string;
  dueDate: string;
  interest: string;
};

export async function getTakenLoans(): Promise<ApiResponse<TakenLoan[]>> {
  return api<ApiResponse<TakenLoan[]>>("/loans/taken");
}

export async function getGivenLoans(): Promise<ApiResponse<GivenLoan[]>> {
  return api<ApiResponse<GivenLoan[]>>("/loans/given");
}

export async function createTakenLoan(
  data: CreateLoanInput & { borrowedFrom: string },
): Promise<ApiResponse<TakenLoan>> {
  return api<ApiResponse<TakenLoan>>("/loans/taken", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createGivenLoan(
  data: CreateLoanInput & { borrowerName: string },
): Promise<ApiResponse<GivenLoan>> {
  return api<ApiResponse<GivenLoan>>("/loans/given", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function recordTakenLoanPayment({
  loanId,
  amount,
}: {
  loanId: string;
  amount: string;
}): Promise<ApiResponse<LoanPayment>> {
  return api<ApiResponse<LoanPayment>>(`/loans/taken/${loanId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function recordGivenLoanPayment({
  loanId,
  amount,
}: {
  loanId: string;
  amount: string;
}): Promise<ApiResponse<LoanPayment>> {
  return api<ApiResponse<LoanPayment>>(`/loans/given/${loanId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}
