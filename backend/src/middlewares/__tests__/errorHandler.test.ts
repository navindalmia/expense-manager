/**
 * Error Handler Middleware Tests
 *
 * Security: verifies the handler fails closed -- unexpected errors return
 * a generic message and never leak internal error detail (stack traces,
 * raw error messages) to the response (OWASP A10 / security misconfiguration).
 */

import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../errorHandler';
import { AppError } from '../../errors/AppError';
import i18next from '../../utils/i18n';

describe('errorHandler', () => {
  beforeAll(async () => {
    // i18next initializes asynchronously (loads translation files from
    // disk); wait for it so translated messages are available.
    if (!i18next.isInitialized) {
      await new Promise<void>((resolve) => i18next.on('initialized', () => resolve()));
    }
  });

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusCode: number;
  let jsonData: any;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    statusCode = 200;
    jsonData = null;

    req = {};
    res = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
    };
    next = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('maps a thrown AppError to its declared status code and translated message', () => {
    const error = new AppError('GENERAL.INTERNAL_SERVER_ERROR', 409, 'SOME_CODE', { field: 'x' });

    errorHandler(error, req as Request, res as Response, next);

    expect(statusCode).toBe(409);
    expect(jsonData.code).toBe('SOME_CODE');
    expect(jsonData.error).toBe('Internal Server Error.');
    expect(jsonData.details).toEqual({ field: 'x' });
  });

  it('defaults code to null when AppError has none', () => {
    const error = new AppError('GENERAL.INTERNAL_SERVER_ERROR', 400);

    errorHandler(error, req as Request, res as Response, next);

    expect(jsonData.code).toBeNull();
    expect(jsonData.details).toBeNull();
  });

  it('returns a generic 500 for a non-AppError exception, never leaking the raw message', () => {
    const error = new Error('column "ssn" does not exist in table users');

    errorHandler(error, req as Request, res as Response, next);

    expect(statusCode).toBe(500);
    expect(jsonData.code).toBe('INTERNAL_SERVER_ERROR');
    expect(jsonData.error).not.toContain('ssn');
    expect(jsonData.error).not.toContain('column');
    expect(jsonData).not.toHaveProperty('stack');
  });

  it('does not call next() -- it is a terminal error handler', () => {
    errorHandler(new Error('boom'), req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
  });
});
