/**
 * Password Helper Utilities
 * 
 * Secure password hashing, comparison, and validation
 */

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare plain text password with hashed password
 * Constant-time comparison to prevent timing attacks
 * @param plainPassword Plain text password to check
 * @param hashedPassword Hashed password from database
 * @returns True if passwords match
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    // On error, always return false (security)
    return false;
  }
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*)
 * 
 * @param password Password to validate
 * @returns { isValid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least 1 special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if password is in common weak passwords list
 * @param password Password to check
 * @returns True if password is weak
 */
export function isCommonPassword(password: string): boolean {
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

  const lowerPassword = password.toLowerCase();
  return commonPasswords.includes(lowerPassword);
}
