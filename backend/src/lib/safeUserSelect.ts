import { Prisma } from '@prisma/client';

/**
 * The only User fields that may ever be returned through an API response.
 * Never include password, failedLoginAttempts, lockedUntil, verification
 * tokens or other internals. Use this for every User relation in a Prisma
 * `include`/`select` instead of `true` or an ad-hoc field list.
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect;
