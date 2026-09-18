import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import {
  givenLoan,
  givenLoanPayment,
  loanPayment,
  takenLoan,
  user,
} from '../../database/schema.js';
import { ApiError } from '../../utils/api-error.js';

type CreateTakenLoanInput = {
  amount: string;
  borrowedFrom: string;
  dueDate: Date;
  interest: string;
};

type CreateGivenLoanInput = {
  amount: string;
  borrowerName: string;
  dueDate: Date;
  interest: string;
};

type CreatePaymentInput = {
  amount: string;
  paidAt?: Date;
};

const totalWithInterest = (amount: string, interest: string) => {
  const principalInPaise = Math.round(Number(amount) * 100);
  const interestInBasisPoints = Math.round(Number(interest) * 100);
  const totalInPaise = Math.round(
    (principalInPaise * (10_000 + interestInBasisPoints)) / 10_000,
  );

  return (totalInPaise / 100).toFixed(2);
};

const ensureSufficientBalance = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  amount: string,
) => {
  const [currentUser] = await tx
    .select({ balance: user.balance })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!currentUser) {
    throw new ApiError(404, 'User not found');
  }

  if (Number(currentUser.balance) < Number(amount)) {
    throw new ApiError(400, 'Insufficient balance');
  }
};

export const createTakenLoan = async (
  userId: string,
  data: CreateTakenLoanInput,
) => {
  const totalAmount = totalWithInterest(data.amount, data.interest);

  return db.transaction(async (tx) => {
    const [loan] = await tx
      .insert(takenLoan)
      .values({
        userId,
        amount: data.amount,
        borrowedFrom: data.borrowedFrom,
        dueDate: data.dueDate,
        interest: data.interest,
        totalAmount,
      })
      .returning();

    if (!loan) {
      throw new Error('Failed to create taken loan');
    }

    await tx
      .update(user)
      .set({ balance: sql`${user.balance} + ${data.amount}` })
      .where(eq(user.id, userId));

    return loan;
  });
};

export const createGivenLoan = async (
  userId: string,
  data: CreateGivenLoanInput,
) => {
  const totalAmount = totalWithInterest(data.amount, data.interest);

  return db.transaction(async (tx) => {
    await ensureSufficientBalance(tx, userId, data.amount);

    const [loan] = await tx
      .insert(givenLoan)
      .values({
        userId,
        amount: data.amount,
        borrowerName: data.borrowerName,
        dueDate: data.dueDate,
        interest: data.interest,
        totalAmount,
      })
      .returning();

    if (!loan) {
      throw new Error('Failed to create given loan');
    }

    await tx
      .update(user)
      .set({ balance: sql`${user.balance} - ${data.amount}` })
      .where(eq(user.id, userId));

    return loan;
  });
};

export const getTakenLoans = async (userId: string) =>
  db.query.takenLoan.findMany({
    where: eq(takenLoan.userId, userId),
    with: { payments: true },
    orderBy: [desc(takenLoan.createdAt)],
  });

export const getGivenLoans = async (userId: string) =>
  db.query.givenLoan.findMany({
    where: eq(givenLoan.userId, userId),
    with: { payments: true },
    orderBy: [desc(givenLoan.createdAt)],
  });

export const createTakenLoanPayment = async (
  userId: string,
  loanId: string,
  data: CreatePaymentInput,
) =>
  db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(takenLoan)
      .where(and(eq(takenLoan.id, loanId), eq(takenLoan.userId, userId)))
      .limit(1);

    if (!loan) {
      throw new ApiError(404, 'Taken loan not found');
    }

    const remainingAmount = Number(loan.totalAmount) - Number(loan.paidAmount);
    if (loan.status === 'paid' || Number(data.amount) > remainingAmount) {
      throw new ApiError(400, 'Payment exceeds the outstanding amount');
    }

    await ensureSufficientBalance(tx, userId, data.amount);

    const paidAmount = (Number(loan.paidAmount) + Number(data.amount)).toFixed(2);
    const status = Number(paidAmount) >= Number(loan.totalAmount) ? 'paid' : 'active';

    const [payment] = await tx
      .insert(loanPayment)
      .values({ loanId, amount: data.amount, paidAt: data.paidAt })
      .returning();

    await tx
      .update(takenLoan)
      .set({ paidAmount, status })
      .where(eq(takenLoan.id, loanId));

    await tx
      .update(user)
      .set({ balance: sql`${user.balance} - ${data.amount}` })
      .where(eq(user.id, userId));

    return payment;
  });

export const createGivenLoanPayment = async (
  userId: string,
  loanId: string,
  data: CreatePaymentInput,
) =>
  db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(givenLoan)
      .where(and(eq(givenLoan.id, loanId), eq(givenLoan.userId, userId)))
      .limit(1);

    if (!loan) {
      throw new ApiError(404, 'Given loan not found');
    }

    const remainingAmount = Number(loan.totalAmount) - Number(loan.paidAmount);
    if (loan.status === 'paid' || Number(data.amount) > remainingAmount) {
      throw new ApiError(400, 'Payment exceeds the outstanding amount');
    }

    const paidAmount = (Number(loan.paidAmount) + Number(data.amount)).toFixed(2);
    const status = Number(paidAmount) >= Number(loan.totalAmount) ? 'paid' : 'active';

    const [payment] = await tx
      .insert(givenLoanPayment)
      .values({ loanId, amount: data.amount, paidAt: data.paidAt })
      .returning();

    await tx
      .update(givenLoan)
      .set({ paidAmount, status })
      .where(eq(givenLoan.id, loanId));

    await tx
      .update(user)
      .set({ balance: sql`${user.balance} + ${data.amount}` })
      .where(eq(user.id, userId));

    return payment;
  });
