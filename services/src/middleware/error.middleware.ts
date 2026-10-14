import { ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../types/common.types.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  const parserError =
    error instanceof SyntaxError && 'status' in error && error.status === 400;
  const clientErrorStatus =
    typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number' && error.status >= 400 && error.status < 500
      ? error.status
      : typeof error === 'object' && error !== null && 'statusCode' in error &&
          typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : undefined;
  const statusCode =
    error instanceof ApiError ? error.statusCode : clientErrorStatus ?? 500;
  const message =
    error instanceof ApiError
      ? error.message
      : parserError
        ? 'Invalid request body'
        : statusCode < 500
          ? 'Invalid request'
          : 'An unexpected error occurred.';

  if (!(error instanceof ApiError) && statusCode >= 500) {
    console.error('Unhandled request error.', {
      method: request.method,
      path: request.originalUrl,
      error,
    });
  }

  response.status(statusCode).json({
    success: false,
    message,
  } satisfies ApiResponse<never>);
};
