import { Router } from 'express';
import { getUserSession } from './auth.controller.js';
import { checkAuth } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/me', checkAuth, getUserSession);
