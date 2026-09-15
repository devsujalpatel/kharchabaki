import { Router } from 'express';
import { getUserSession } from './auth.controller.js';

export const authRouter = Router();

authRouter.get('/me', getUserSession);
