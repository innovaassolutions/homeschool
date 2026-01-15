import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Route not found'
  });
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};