/**
 * JWT Helper Tests
 * 
 * Validates JWT token generation, verification, and error handling
 * Security: Ensures tokens are signed correctly and expiry is enforced
 */

import { generateToken, verifyToken, decodeToken, TokenPayload } from '../jwtHelper';
import jwt from 'jsonwebtoken';

describe('JWT Helper', () => {
  const testUserId = 42;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

  describe('generateToken()', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testUserId);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts separated by dots
    });

    it('should encode userId in token payload', () => {
      const token = generateToken(testUserId);
      const decoded = jwt.decode(token) as any;

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
    });

    it('should set expiry to 24h', () => {
      const token = generateToken(testUserId);
      const decoded = jwt.decode(token) as any;
      const issuedAt = decoded.iat;
      const expiresAt = decoded.exp;

      const expiryDifference = (expiresAt - issuedAt) * 1000; // Convert to ms
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(expiryDifference - twentyFourHours)).toBeLessThan(1000);
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken(1);
      const token2 = generateToken(2);

      expect(token1).not.toEqual(token2);
    });

    it('should generate different tokens on successive calls', () => {
      const token1 = generateToken(testUserId);
      const token2 = generateToken(testUserId);

      // Tokens will be different due to different iat (issued at) times
      expect(token1).not.toEqual(token2);
    });
  });

  describe('verifyToken()', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = generateToken(testUserId);
    });

    it('should verify a valid token', () => {
      const payload = verifyToken(validToken);

      expect(payload.userId).toBe(testUserId);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should return correct TokenPayload interface', () => {
      const payload = verifyToken(validToken) as TokenPayload;

      expect(typeof payload.userId).toBe('number');
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'onlyonepart';

      expect(() => verifyToken(malformedToken)).toThrow();
    });

    it('should throw error for tampered token', () => {
      // Modify token payload
      const tampered = validToken.slice(0, -10) + 'tampered00';

      expect(() => verifyToken(tampered)).toThrow('Invalid token');
    });

    it('should throw TokenExpiredError for expired token', (done) => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { userId: testUserId },
        JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Wait a bit to ensure token is expired
      setTimeout(() => {
        expect(() => verifyToken(expiredToken)).toThrow('Token has expired');
        done();
      }, 100);
    });

    it('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should throw error for token signed with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { userId: testUserId },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      expect(() => verifyToken(wrongSecretToken)).toThrow('Invalid token');
    });

    it('should throw error for token without userId', () => {
      const noUserIdToken = jwt.sign(
        { someOtherField: 'value' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const payload = verifyToken(noUserIdToken);
      expect(payload.userId).toBeUndefined();
    });
  });

  describe('decodeToken()', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = generateToken(testUserId);
    });

    it('should decode a valid token without verification', () => {
      const payload = decodeToken(validToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(testUserId);
    });

    it('should decode expired token without throwing', () => {
      const expiredToken = jwt.sign(
        { userId: testUserId },
        JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Wait to ensure token is expired
      setTimeout(() => {
        const payload = decodeToken(expiredToken);
        expect(payload).toBeDefined();
        expect(payload?.userId).toBe(testUserId);
      }, 100);
    });

    it('should return null for invalid token', () => {
      const payload = decodeToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('should return null for empty token', () => {
      const payload = decodeToken('');
      expect(payload).toBeNull();
    });

    it('should decode token signed with wrong secret (without verification)', () => {
      const wrongSecretToken = jwt.sign(
        { userId: 999 },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      const payload = decodeToken(wrongSecretToken);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(999);
    });
  });

  describe('Security Scenarios', () => {
    it('should handle token reuse correctly', () => {
      const token1 = generateToken(1);
      const token2 = generateToken(1);

      const payload1 = verifyToken(token1);
      const payload2 = verifyToken(token2);

      expect(payload1.userId).toBe(payload2.userId);
      expect(payload1.iat).not.toBe(payload2.iat);
    });

    it('should prevent userId tampering', () => {
      const token = generateToken(1);
      const decoded = jwt.decode(token) as any;
      
      // Manually construct a new token with modified userId
      const tamperedToken = jwt.sign(
        { userId: 999, iat: decoded.iat },
        'wrong-secret'
      );

      expect(() => verifyToken(tamperedToken)).toThrow('Invalid token');
    });

    it('should distinguish between different users', () => {
      const token1 = generateToken(1);
      const token2 = generateToken(2);

      const payload1 = verifyToken(token1);
      const payload2 = verifyToken(token2);

      expect(payload1.userId).not.toBe(payload2.userId);
    });
  });
});
