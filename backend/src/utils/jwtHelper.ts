/**
 * JWT Helper Utilities
 * 
 * Handles token generation, verification, and error management
 */

import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface TokenPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 * @param userId User ID to encode in token
 * @returns Signed JWT token
 */
export function generateToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET as string,
    { expiresIn: '24h' } as SignOptions
  );
}

/**
 * Verify and decode a JWT token
 * @param token JWT token string
 * @returns Decoded token payload with userId
 * @throws Error if token is invalid, expired, or malformed
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not yet valid');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Decode token without verification (use with caution)
 * @param token JWT token string
 * @returns Decoded token payload
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as TokenPayload | null;
  } catch {
    return null;
  }
}
