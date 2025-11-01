
// Utility: remove undefined fields so Prisma won't throw validation errors
export function cleanData<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}
