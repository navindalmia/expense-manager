/**
 * Password Helper Tests (14 tests)
 * 
 * Coverage:
 * - Password hashing with bcrypt
 * - Password comparison
 * - Password strength validation
 * - Common password detection
 * - Edge cases
 * - Error handling
 */

import bcrypt from 'bcrypt';
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  isCommonPassword,
} from '../../utils/passwordHelper';

jest.mock('bcrypt');

describe('Password Helper Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== PASSWORD HASHING ==========

  test('1. Should hash password using bcrypt', async () => {
    const plainPassword = 'SecurePass123!';
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/oia';

    (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

    const result = await hashPassword(plainPassword);

    expect(result).toBe(hashedPassword);
    expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
  });

  test('2. Should not expose plaintext password in hash', async () => {
    const plainPassword = 'MySecretPassword123!';
    const hashedPassword = '$2b$10$hashed';

    (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

    const result = await hashPassword(plainPassword);

    expect(result).not.toContain(plainPassword);
    expect(result).toBe(hashedPassword);
  });

  test('3. Should throw error on hashing failure', async () => {
    (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

    await expect(hashPassword('SomePass123!')).rejects.toThrow(
      'Failed to hash password'
    );
  });

  // ========== PASSWORD COMPARISON ==========

  test('4. Should return true for matching password', async () => {
    const plainPassword = 'SecurePass123!';
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/oia';

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await comparePassword(plainPassword, hashedPassword);

    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
  });

  test('5. Should return false for non-matching password', async () => {
    const plainPassword = 'WrongPassword123!';
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/oia';

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await comparePassword(plainPassword, hashedPassword);

    expect(result).toBe(false);
  });

  test('6. Should return false on comparison error (security)', async () => {
    (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Compare failed'));

    const result = await comparePassword('SomePass', 'hash');

    expect(result).toBe(false);
  });

  // ========== PASSWORD STRENGTH VALIDATION ==========

  test('7. Should validate strong password', () => {
    const result = validatePasswordStrength('SecurePass123!');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('8. Should reject password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Pass12!');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  test('9. Should reject password without uppercase letter', () => {
    const result = validatePasswordStrength('securepass123!');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least 1 uppercase letter'
    );
  });

  test('10. Should reject password without lowercase letter', () => {
    const result = validatePasswordStrength('SECUREPASS123!');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least 1 lowercase letter'
    );
  });

  test('11. Should reject password without number', () => {
    const result = validatePasswordStrength('SecurePass!');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least 1 number');
  });

  test('12. Should reject password without special character', () => {
    const result = validatePasswordStrength('SecurePass123');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least 1 special character (!@#$%^&*)'
    );
  });

  // ========== COMMON PASSWORD DETECTION ==========

  test('13. Should detect common weak password', () => {
    const commonPasswords = ['password', 'admin123', '123456', 'qwerty'];

    commonPasswords.forEach((pwd) => {
      const result = isCommonPassword(pwd);
      expect(result).toBe(true);
    });
  });

  test('14. Should accept non-common strong password', () => {
    const result = isCommonPassword('UniqueSecure123!');

    expect(result).toBe(false);
  });
});
