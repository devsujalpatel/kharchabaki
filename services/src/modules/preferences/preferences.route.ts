import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../database/client.js';
import { user } from '../../database/schema.js';
import { parseInput } from '../transactions/transaction.schema.js';
import { ApiError } from '../../utils/api-error.js';

const schema = z
  .object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .refine(
        (code) => Intl.supportedValuesOf('currency').includes(code),
        'Unsupported currency',
      )
      .optional(),
    theme: z
      .enum(['light', 'dark', 'ocean', 'forest', 'sunset', 'rose'])
      .optional(),
  })
  .refine(
    (value) => value.currency || value.theme,
    'Choose a currency or theme',
  );
export const preferencesRouter = Router();
preferencesRouter.get('/preferences', async (request, response) => {
  const [data] = await db
    .select({ currency: user.currency, theme: user.theme })
    .from(user)
    .where(eq(user.id, request.auth!.id));
  if (!data) throw new ApiError(404, 'User not found');
  response.json({ success: true, message: 'Preferences fetched', data });
});
preferencesRouter.patch('/preferences', async (request, response) => {
  const input = parseInput(schema, request.body);
  const [data] = await db
    .update(user)
    .set(input)
    .where(eq(user.id, request.auth!.id))
    .returning({ currency: user.currency, theme: user.theme });
  if (!data) throw new ApiError(404, 'User not found');
  response.json({ success: true, message: 'Preferences saved', data });
});
