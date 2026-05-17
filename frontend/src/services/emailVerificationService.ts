/**
 * Email Verification Service
 * Handles communication with backend email verification endpoints
 */

import { http } from '../api/http';

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      email: string;
      name: string;
      emailVerified: boolean;
    };
  };
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

/**
 * Verify email with token from email link
 * @param token Verification token from email
 * @returns Verified user data
 */
export async function verifyEmailToken(token: string): Promise<VerifyEmailResponse> {
  const response = await http.post<VerifyEmailResponse>('/auth/verify-email', {
    token,
  });
  return response;
}

/**
 * Request new verification email
 * @param email User email address
 * @returns Generic success response (for security)
 */
export async function resendVerificationEmail(
  email: string
): Promise<ResendVerificationResponse> {
  const response = await http.post<ResendVerificationResponse>('/auth/resend-verification', {
    email,
  });
  return response;
}
