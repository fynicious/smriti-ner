import { NextResponse } from 'next/server';

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(400, message, 'BAD_REQUEST');
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, message, 'RATE_LIMITED');
  }
}

/**
 * Standardizes API error responses without leaking internal stack traces or secrets.
 */
export function handleApiError(error: unknown, context = 'API') {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof Error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message, code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message, code: 'FORBIDDEN' }, { status: 403 });
    }
    console.error(`[${context}] Unhandled Error:`, error.message);
  } else {
    console.error(`[${context}] Unknown Error`);
  }

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
