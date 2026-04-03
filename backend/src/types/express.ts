/**
 * Express Request Type Extensions
 * 
 * Extends Express Request with custom user property for JWT authentication
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
      };
    }
  }
}

export {};
