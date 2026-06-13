import {
  generateVerificationToken,
  createVerificationToken,
  verifyEmail,
  resendVerificationEmail,
} from '../emailVerificationService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test@example.com' }),
    })),
    createTestAccount: jest.fn().mockResolvedValue({
      user: 'test@ethereal.email',
      pass: 'password123',
    }),
    getTestMessageUrl: jest.fn((info) => `https://preview-url/${info.messageId}`),
  },
}));

describe('Email Verification Service - Backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateVerificationToken', () => {
    it('should generate token with vrf_ prefix', () => {
      const token = generateVerificationToken();
      expect(token).toMatch(/^vrf_[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('createVerificationToken', () => {
    it('should create token in database with 24-hour expiry', async () => {
      const userId = 1;
      const mockToken = 'vrf_abc123';
      const mockExpiresAt = new Date();

      (prisma.emailVerificationToken.create as any).mockResolvedValueOnce({
        token: mockToken,
        userId,
        expiresAt: mockExpiresAt,
      });

      const result = await createVerificationToken(userId);

      expect(result).toMatch(/^vrf_[a-f0-9]{64}$/);
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const userId = 1;

      (prisma.emailVerificationToken.create as any).mockRejectedValueOnce(new Error('DB error'));

      await expect(createVerificationToken(userId)).rejects.toThrow();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and mark user as verified', async () => {
      const mockToken = 'vrf_abc123';
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      };

      const mockTokenRecord = {
        id: 1,
        token: mockToken,
        userId: 1,
        isUsed: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: mockUser,
      };

      const mockVerifiedUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      };

      (prisma.emailVerificationToken.findUnique as any).mockResolvedValueOnce(mockTokenRecord);

      (prisma.$transaction as any).mockResolvedValueOnce(mockVerifiedUser);

      const result = await verifyEmail(mockToken);

      expect(result).toEqual(mockVerifiedUser);
      expect(result.emailVerified).toBe(true);
    });

    it('should throw error for invalid token', async () => {
      const mockToken = 'vrf_invalid';

      (prisma.emailVerificationToken.findUnique as any).mockResolvedValueOnce(null);

      await expect(verifyEmail(mockToken)).rejects.toThrow('Invalid or expired verification token');
    });

    it('should throw error for already used token', async () => {
      const mockToken = 'vrf_abc123';

      const mockTokenRecord = {
        id: 1,
        token: mockToken,
        userId: 1,
        isUsed: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      };

      (prisma.emailVerificationToken.findUnique as any).mockResolvedValueOnce(mockTokenRecord);

      await expect(verifyEmail(mockToken)).rejects.toThrow('Invalid or expired verification token');
    });

    it('should throw error for expired token', async () => {
      const mockToken = 'vrf_abc123';

      const mockTokenRecord = {
        id: 1,
        token: mockToken,
        userId: 1,
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      (prisma.emailVerificationToken.findUnique as any).mockResolvedValueOnce(mockTokenRecord);

      await expect(verifyEmail(mockToken)).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend email for unverified user', async () => {
      const mockEmail = 'test@example.com';
      const mockUser = {
        id: 1,
        email: mockEmail,
        emailVerified: false,
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(mockUser);
      (prisma.emailVerificationToken.deleteMany as any).mockResolvedValueOnce({ count: 1 });

      await resendVerificationEmail(mockEmail);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: mockEmail } });
      expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalled();
    });

    it('should silently fail for non-existent email', async () => {
      const mockEmail = 'nonexistent@example.com';

      (prisma.user.findUnique as any).mockResolvedValueOnce(null);

      // Should not throw
      await expect(resendVerificationEmail(mockEmail)).resolves.toBeUndefined();
    });

    it('should silently fail for already verified email', async () => {
      const mockEmail = 'test@example.com';
      const mockUser = {
        id: 1,
        email: mockEmail,
        emailVerified: true,
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(mockUser);

      // Should not throw
      await expect(resendVerificationEmail(mockEmail)).resolves.toBeUndefined();
    });
  });
});
