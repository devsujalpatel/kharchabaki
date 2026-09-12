import express from 'express';
import cors from 'cors';
import { ApiResponse } from './types/common.types.js';
import { API_PREFIX } from './config/constans.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  const body: ApiResponse<never> = {
    success: true,
    message: 'kharchabaki.in API is running',
  };
  res.status(200).json(body);
});

app.use(API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
