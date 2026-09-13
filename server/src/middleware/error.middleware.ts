import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Something went wrong. Please try again.";

  if (!isAppError) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: isAppError ? err.code : "INTERNAL_ERROR",
    },
  });
}
