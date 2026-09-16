import { z } from 'zod';

export const addBalanceSchema = z.object({
  amount: z.number().nonnegative(),
});
