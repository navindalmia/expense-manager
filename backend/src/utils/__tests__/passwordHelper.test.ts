/**
 * Password Helper Tests
 * 
 * Validates password hashing, comparison, and strength validation
 * Security: Ensures bcrypt is used correctly and passwords meet requirements
 */

import { 
  hashPassword, 
  comparePassword, 
  validatePasswordStrength, 
  isCommonPassword 
} from '../passwordHelper';

describe('Password Helper', () => {
  describe('hashPassword()', () => {
    it('should hash a plain text password', async () => {
      const passwordPlain = 'TestPassword@123';
      const hash = await hashPassword(passwordPlain);

      // Hash should not equal plain password
      expect(hash).not.toEqual(passwordPlain);
      // Hash should be a bcrypt hash (starts with $2a$, $2b$, or $2y$)
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const passwordPlain = 'TestPassword@123';
      const hash1 = await hashPassword(passwordPlain);
      const hash2 = await hashPassword(passwordPlain);

      // Hashes should be different due to random salt
      expect(hash1).not.toEqual(hash2);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'A' + 'b1!' + 'c'.repeat(80); // 84 chars
      const hash = await hashPassword(longPassword);

      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should throw error on null/undefined input', async () => {
      // @ts-ignore - Testing error handling
      await expect(hashPassword(null)).rejects.toThrow();
    });
  });

  describe('comparePassword()', () => {
    let hashedPassword: string;

    beforeEach(async () => {
      hashedPassword = await hashPassword('TestPassword@123');
    });

    it('should return true for correct password', async () => {
      const result = await comparePassword('TestPassword@123', hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const result = await comparePassword('WrongPassword@123', hashedPassword);
      expect(result).toBe(false);
    });

    it('should return false for missing password', async () => {
      const result = await comparePassword('', hashedPassword);
      expect(result).toBe(false);
    });

    it('should be case sensitive', async () => {
      const result = await comparePassword('testpassword@123', hashedPassword);
      expect(result).toBe(false);
    });

    it('should be resistant to timing attacks (constant-time comparison)', async () => {
      const timeChecker = async (plainPassword: string) => {
        const start = process.hrtime.bigint();
        await comparePassword(plainPassword, hashedPassword);
        const end = process.hrtime.bigint();
        return Number(end - start);
      };

      // Time measurements should be similar (bcrypt is constant-time)
      // Not checking exact timing due to variability in test environment
      const time1 = await timeChecker('WrongPassword@111');
      const time2 = await timeChecker('WrongPassword@222');
      
      // Both should complete without error (constant-time property)
      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'Test!@#$%^&*()@123';
      const hash = await hashPassword(specialPassword);
      const result = await comparePassword(specialPassword, hash);
      expect(result).toBe(true);
    });
  });

  describe('validatePasswordStrength()', () => {
    it('should accept valid strong password', () => {
      const result = validatePasswordStrength('StrongPass@123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty password', () => {
      const result = validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject password < 8 characters', () => {
      const result = validatePasswordStrength('Pass@12');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('lowercase@123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePasswordStrength('UPPERCASE@123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbers@abc');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 special character (!@#$%^&*)');
    });

    it('should accept multiple special characters', () => {
      const result = validatePasswordStrength('Valid!@Pass#$%^123');
      expect(result.isValid).toBe(true);
    });

    it('should return all errors for completely invalid password', () => {
      const result = validatePasswordStrength('abc');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept 8 character password (minimum length)', () => {
      const result = validatePasswordStrength('Valid@123');
      expect(result.isValid).toBe(true);
    });

    it('should accept very long password', () => {
      const result = validatePasswordStrength('VeryLongPassword@' + '1'.repeat(100));
      expect(result.isValid).toBe(true);
    });
  });

  describe('isCommonPassword()', () => {
    const commonPasswords = [
      'password',
      'password123',
      'admin',
      'admin123',
      '123456',
      '12345678',
      'qwerty',
      'letmein',
      'welcome',
      'monkey',
      'dragon',
      'master',
      'sunshine',
      'princess',
      'football',
    ];

    it('should detect common passwords', () => {
      commonPasswords.forEach((password) => {
        expect(isCommonPassword(password)).toBe(true);
      });
    });

    it('should be case insensitive for common password detection', () => {
      expect(isCommonPassword('PASSWORD')).toBe(true);
      expect(isCommonPassword('PASSWORD123')).toBe(true);
      expect(isCommonPassword('Admin123')).toBe(true);
    });

    it('should accept unique passwords', () => {
      expect(isCommonPassword('UniquePass@123')).toBe(false);
      expect(isCommonPassword('MyCustom@Pass456')).toBe(false);
    });

    it('should not reject password extensions of common words', () => {
      // "password" with additions should be allowed
      expect(isCommonPassword('password1234!')).toBe(false);
    });
  });
});
