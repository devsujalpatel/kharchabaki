import { Request, Response } from 'express';
import { db } from '../../database/client.js';
import { user } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '../../types/common.types.js';
import { ApiError } from '../../utils/api-error.js';
import { addBalanceSchema } from './balance.schema.js';

export const getBalance = async (request: Request, response: Response) => {
  const userId = request.auth!.id;

  const userBalance = await db
    .select({
      balance: user.balance,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userBalance[0]) {
    throw new ApiError(404, 'user not found');
  }

  const body: ApiResponse<{
    balance: number;
  }> = {
    success: true,
    message: 'Balance fetched successfully',
    data: {
      balance: Number(userBalance[0].balance),
    },
  };

  return response.status(200).json(body);
};

export const addBalance = async (request: Request, response: Response) => {
  const userId = request.auth!.id;

  const { amount } = addBalanceSchema.parse(request.body);

  await db
    .update(user)
    .set({
      balance: amount.toFixed(2),
    })
    .where(eq(user.id, userId));

  const body: ApiResponse<{
    balance: number;
  }> = {
    success: true,
    message: 'Balance added successfully',
    data: {
      balance: amount,
    },
  };

  return response.status(200).json(body);
};
