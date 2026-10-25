/**
 * Issue #151 regression: GET /api/expenses (getAllExpenses) used
 * `include: { paidBy: true, splitWith: true }`, returning full User rows
 * (password hash, lockout fields) to API clients. Every User relation must use
 * an explicit safe select.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');
jest.mock('../../utils/logger');

const FORBIDDEN_FIELDS: string[] = ['password', 'failedLoginAttempts', 'lockedUntil'];
const USER_RELATION_TRUE = /\b(paidBy|splitWith|createdBy|members|user):\s*true\b/;

function collectTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : collectTsFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** Remove `_count: { select: { ... } }` blocks, where `members: true` is a harmless count. */
function stripCountBlocks(source: string): string {
  return source.replace(/_count:\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
}

describe('issue #151: User relations never expose sensitive fields', () => {
  it('should select only safe fields for paidBy and splitWith in getAllExpenses', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

    await expenseService.getAllExpenses(1);

    const args = (prisma.expense.findMany as jest.Mock).mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    for (const relation of ['paidBy', 'splitWith']) {
      const rel = args.include[relation];
      expect(rel).not.toBe(true);
      const select = (rel as { select?: Record<string, boolean> }).select;
      expect(select).toBeDefined();
      for (const field of FORBIDDEN_FIELDS) {
        expect(select).not.toHaveProperty(field);
      }
    }
  });

  it('should never use an unscoped User relation include in service or controller code', () => {
    const roots = ['services', 'controllers', 'routes'].map((d) => path.join(__dirname, '../..', d));
    const offenders: string[] = [];
    for (const file of roots.flatMap(collectTsFiles)) {
      stripCountBlocks(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        if (USER_RELATION_TRUE.test(line)) offenders.push(`${path.basename(file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
