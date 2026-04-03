/**
 * Authentication Validation Schemas
 * 
 * Zod schemas for signup and login requests
 */

import { z } from 'zod';
import { validatePasswordStrength, isCommonPassword } from '../utils/passwordHelper';

/**
 * Schema for user signup/registration
 */
export const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .refine(
      (email) => !email.includes('..'), // Prevent email like user..name@example.com
      'Invalid email format'
    ),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .refine(
      (password: string) => {
        const validation = validatePasswordStrength(password);
        return validation.isValid;
      },
      'Password does not meet strength requirements'
    )
    .refine(
      (password) => !isCommonPassword(password),
      'Password is too common. Please choose a stronger password'
    ),
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(
      /^[a-zA-Z\s'-]+$/,
      'Name can only contain letters, spaces, hyphens, and apostrophes'
    ),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for user login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validate signup input
 * @param data Signup request data
 * @returns Validated signup data
 * @throws Error if validation fails
 */
export function validateSignup(data: unknown): SignupInput {
  return signupSchema.parse(data);
}

/**
 * Validate login input
 * @param data Login request data
 * @returns Validated login data
 * @throws Error if validation fails
 */
export function validateLogin(data: unknown): LoginInput {
  return loginSchema.parse(data);
}
