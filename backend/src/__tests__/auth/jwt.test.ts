/**
 * JWT Utility Tests (10 tests)
 * 
 * Coverage:
 * - Token generation
 * - Token verification
 * - Token expiry
 * - Token tampering detection
 * - Error handling
 * - Token decoding (without verification)
 */

import * as jwt from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
  decodeToken,
  TokenPayload,
} from '../../utils/jwtHelper';

jest.mock('jsonwebtoken');

describe('JWT Utilities', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const userId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== TOKEN GENERATION ==========

  test('1. Should generate valid JWT token', () => {
    const token = 'valid.jwt.token';
    (jwt.sign as jest.Mock).mockReturnValue(token);

    const result = generateToken(userId);

    expect(result).toBe(token);
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId },
      JWT_SECRET,
      expect.objectContaining({
        expiresIn: '24h',
      })
    );
  });

  test('2. Should encode userId in token payload', () => {
    (jwt.sign as jest.Mock).mockReturnValue('token');

    generateToken(userId);

    const callArgs = (jwt.sign as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toEqual({ userId: 123 });
  });

  test('3. Should generate different tokens for different users', () => {
    (jwt.sign as jest.Mock)
      .mockReturnValueOnce('token1')
      .mockReturnValueOnce('token2');

    const token1 = generateToken(1);
    const token2 = generateToken(2);

    expect(token1).not.toBe(token2);
  });

  // ========== TOKEN VERIFICATION ==========

  test('4. Should verify valid token and return payload', () => {
    const payload: TokenPayload = {
      userId: 123,
      iat: 1234567890,
      exp: 1234571490,
    };

    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const result = verifyToken('valid.token');

    expect(result).toEqual(payload);
    expect(jwt.verify).toHaveBeenCalledWith('valid.token', JWT_SECRET);
  });

  test('5. Should throw error for expired token', () => {
    const expiredError = new jwt.TokenExpiredError('Token expired', 1234567890);
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw expiredError;
    });

    expect(() => verifyToken('expired.token')).toThrow('Token has expired');
  });

  test('6. Should throw error for tampered token (invalid signature)', () => {
    const jwtError = new jwt.JsonWebTokenError('invalid signature');
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw jwtError;
    });

    expect(() => verifyToken('tampered.token')).toThrow('Invalid token');
  });

  test('7. Should throw error for malformed token', () => {
    const parseError = new jwt.JsonWebTokenError('malformed');
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw parseError;
    });

    expect(() => verifyToken('malformed')).toThrow('Invalid token');
  });

  // ========== TOKEN DECODING (WITHOUT VERIFICATION) ==========

  test('8. Should decode token without verification', () => {
    const payload: TokenPayload = {
      userId: 456,
      iat: 1234567890,
      exp: 1234571490,
    };

    (jwt.decode as jest.Mock).mockReturnValue(payload);

    const result = decodeToken('some.token');

    expect(result).toEqual(payload);
    expect(jwt.decode).toHaveBeenCalledWith('some.token');
  });

  test('9. Should return null for invalid token on decode', () => {
    (jwt.decode as jest.Mock).mockReturnValue(null);

    const result = decodeToken('invalid.token');

    expect(result).toBeNull();
  });

  test('10. Should handle NotBeforeError (token not yet valid)', () => {
    const notBeforeError = new jwt.NotBeforeError('Token not yet valid', 1234567890);
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw notBeforeError;
    });

    expect(() => verifyToken('future.token')).toThrow('Token not yet valid');
  });
});
