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

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type CreateLoanInput = {
  amount: string;
  dueDate: string;
  interest: string;
};

export async function getTakenLoans(): Promise<ApiResponse<TakenLoan[]>> {
  const response = await api("/api/v1/loans/taken");

  if (!response.ok) {
    throw new Error("Failed to load borrowed loans");
  }

  return response.json();
}

export async function getGivenLoans(): Promise<ApiResponse<GivenLoan[]>> {
  const response = await api("/api/v1/loans/given");

  if (!response.ok) {
    throw new Error("Failed to load given loans");
  }

  return response.json();
}

export async function createTakenLoan(
  data: CreateLoanInput & {
    borrowedFrom: string;
  }
): Promise<ApiResponse<TakenLoan>> {
  const response = await api("/api/v1/loans/taken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create loan");
  }

  return response.json();
}

export async function createGivenLoan(
  data: CreateLoanInput & {
    borrowerName: string;
  }
): Promise<ApiResponse<GivenLoan>> {
  const response = await api("/api/v1/loans/given", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create loan");
  }

  return response.json();
}

export async function recordTakenLoanPayment({
  loanId,
  amount,
}: {
  loanId: string;
  amount: string;
}): Promise<ApiResponse<LoanPayment>> {
  const response = await api(`/api/v1/loans/taken/${loanId}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    throw new Error("Failed to record payment");
  }

  return response.json();
}

export async function recordGivenLoanPayment({
  loanId,
  amount,
}: {
  loanId: string;
  amount: string;
}): Promise<ApiResponse<LoanPayment>> {
  const response = await api(`/api/v1/loans/given/${loanId}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    throw new Error("Failed to record payment");
  }

  return response.json();
}
