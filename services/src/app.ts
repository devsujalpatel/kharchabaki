import express from 'express';
import cors from 'cors';
import { ApiResponse } from './types/common.types.js';
import { API_PREFIX } from './config/constans.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { env } from './config/env.js';
import helmet from 'helmet';

export const app = express();

app.disable('x-powered-by');

const acceptedOrigins = ['http://localhost:3000'];

app.use(helmet());

app.use(
  cors({
    origin: acceptedOrigins, // Replace with your frontend's origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Specify allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  }),
);

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_request, response) => {
  const body: ApiResponse<never> = {
    success: true,
    message: 'kharchabaki.in API is running',
  };
  response.status(200).json(body);
});

app.use(API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
