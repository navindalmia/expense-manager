/**
 * Jest setup file for backend tests
 * - Configure test environment
 * - Mock Prisma client globally
 */

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    expense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
