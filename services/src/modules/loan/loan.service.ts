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

type TakenLoanInput = CreateTakenLoanInput;
type GivenLoanInput = CreateGivenLoanInput;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const toPaise = (amount: string | number) => Math.round(Number(amount) * 100);

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
    await lockOwner(tx, userId);
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
    await lockOwner(tx, userId);
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

const lockOwner = async (tx: Transaction, userId: string) => {
  const [owner] = await tx
    .select({ balance: user.balance })
    .from(user)
    .where(eq(user.id, userId))
    .for('update');

  if (!owner) throw new ApiError(404, 'User not found');
  return owner;
};

const statusFor = (paidAmount: string, totalAmount: string, dueDate: Date) =>
  toPaise(paidAmount) >= toPaise(totalAmount)
    ? 'paid'
    : dueDate.getTime() < Date.now()
      ? 'overdue'
      : 'active';

export const updateTakenLoan = async (
  userId: string,
  loanId: string,
  data: TakenLoanInput,
) =>
  db.transaction(async (tx) => {
    const owner = await lockOwner(tx, userId);
    const [previous] = await tx
      .select()
      .from(takenLoan)
      .where(and(eq(takenLoan.id, loanId), eq(takenLoan.userId, userId)))
      .for('update');
    if (!previous) throw new ApiError(404, 'Taken loan not found');

    const amount = Number(data.amount).toFixed(2);
    const interest = Number(data.interest).toFixed(2);
    const totalAmount = totalWithInterest(amount, interest);
    if (toPaise(totalAmount) < toPaise(previous.paidAmount))
      throw new ApiError(
        400,
        'Total amount cannot be less than payments already recorded',
      );

    const balance =
      toPaise(owner.balance) + toPaise(amount) - toPaise(previous.amount);
    if (balance < 0) throw new ApiError(400, 'Insufficient balance');
    const [updated] = await tx
      .update(takenLoan)
      .set({
        amount,
        borrowedFrom: data.borrowedFrom,
        dueDate: data.dueDate,
        interest,
        totalAmount,
        status: statusFor(previous.paidAmount, totalAmount, data.dueDate),
      })
      .where(and(eq(takenLoan.id, loanId), eq(takenLoan.userId, userId)))
      .returning();
    await tx
      .update(user)
      .set({ balance: (balance / 100).toFixed(2) })
      .where(eq(user.id, userId));
    return updated;
  });

export const updateGivenLoan = async (
  userId: string,
  loanId: string,
  data: GivenLoanInput,
) =>
  db.transaction(async (tx) => {
    const owner = await lockOwner(tx, userId);
    const [previous] = await tx
      .select()
      .from(givenLoan)
      .where(and(eq(givenLoan.id, loanId), eq(givenLoan.userId, userId)))
      .for('update');
    if (!previous) throw new ApiError(404, 'Given loan not found');

    const amount = Number(data.amount).toFixed(2);
    const interest = Number(data.interest).toFixed(2);
    const totalAmount = totalWithInterest(amount, interest);
    if (toPaise(totalAmount) < toPaise(previous.paidAmount))
      throw new ApiError(
        400,
        'Total amount cannot be less than payments already recorded',
      );

    const balance =
      toPaise(owner.balance) + toPaise(previous.amount) - toPaise(amount);
    if (balance < 0) throw new ApiError(400, 'Insufficient balance');
    const [updated] = await tx
      .update(givenLoan)
      .set({
        amount,
        borrowerName: data.borrowerName,
        dueDate: data.dueDate,
        interest,
        totalAmount,
        status: statusFor(previous.paidAmount, totalAmount, data.dueDate),
      })
      .where(and(eq(givenLoan.id, loanId), eq(givenLoan.userId, userId)))
      .returning();
    await tx
      .update(user)
      .set({ balance: (balance / 100).toFixed(2) })
      .where(eq(user.id, userId));
    return updated;
  });

export const deleteTakenLoan = async (userId: string, loanId: string) =>
  db.transaction(async (tx) => {
    const owner = await lockOwner(tx, userId);
    const [loan] = await tx
      .select()
      .from(takenLoan)
      .where(and(eq(takenLoan.id, loanId), eq(takenLoan.userId, userId)))
      .for('update');
    if (!loan) throw new ApiError(404, 'Taken loan not found');
    const [payments] = await tx
      .select({ total: sql<string>`coalesce(sum(${loanPayment.amount}), 0)` })
      .from(loanPayment)
      .where(eq(loanPayment.loanId, loanId));
    const balance =
      toPaise(owner.balance) -
      toPaise(loan.amount) +
      toPaise(payments?.total ?? 0);
    if (balance < 0)
      throw new ApiError(400, 'Insufficient balance to reverse this loan');
    await tx
      .update(user)
      .set({ balance: (balance / 100).toFixed(2) })
      .where(eq(user.id, userId));
    await tx
      .delete(takenLoan)
      .where(and(eq(takenLoan.id, loanId), eq(takenLoan.userId, userId)));
    return { id: loanId };
  });

export const deleteGivenLoan = async (userId: string, loanId: string) =>
  db.transaction(async (tx) => {
    const owner = await lockOwner(tx, userId);
    const [loan] = await tx
      .select()
      .from(givenLoan)
      .where(and(eq(givenLoan.id, loanId), eq(givenLoan.userId, userId)))
      .for('update');
    if (!loan) throw new ApiError(404, 'Given loan not found');
    const [payments] = await tx
      .select({
        total: sql<string>`coalesce(sum(${givenLoanPayment.amount}), 0)`,
      })
      .from(givenLoanPayment)
      .where(eq(givenLoanPayment.loanId, loanId));
    const balance =
      toPaise(owner.balance) +
      toPaise(loan.amount) -
      toPaise(payments?.total ?? 0);
    if (balance < 0)
      throw new ApiError(400, 'Insufficient balance to reverse this loan');
    await tx
      .update(user)
      .set({ balance: (balance / 100).toFixed(2) })
      .where(eq(user.id, userId));
    await tx
      .delete(givenLoan)
      .where(and(eq(givenLoan.id, loanId), eq(givenLoan.userId, userId)));
    return { id: loanId };
  });

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
    await lockOwner(tx, userId);
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

    const paidAmount = (Number(loan.paidAmount) + Number(data.amount)).toFixed(
      2,
    );
    const status =
      Number(paidAmount) >= Number(loan.totalAmount) ? 'paid' : 'active';

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
    await lockOwner(tx, userId);
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

    const paidAmount = (Number(loan.paidAmount) + Number(data.amount)).toFixed(
      2,
    );
    const status =
      Number(paidAmount) >= Number(loan.totalAmount) ? 'paid' : 'active';

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
