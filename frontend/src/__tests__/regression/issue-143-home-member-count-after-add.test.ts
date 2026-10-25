/**
 * Regression test for issue #143.
 *
 * ROOT CAUSE: POST /groups/:id/members/email (and member removal) return the
 * group with a fresh `members` array but no `_count`. Home merges that
 * response into its list with mergeUpdatedGroup, which spread the old item and
 * kept the stale `_count.members`, so the card showed the old member count
 * until the next full reload. Fix: derive `_count.members` from `members`
 * whenever the update carries a members array.
 */

import { describe, it, expect } from 'vitest';
import { mergeUpdatedGroup, type GroupUpdateResult } from '../../utils/mergeUpdatedGroup';
import type { Group } from '../../services/groupService';

const member = (id: number): Group['members'][number] => ({ id, name: `M${id}`, email: `m${id}@x.com` });

const listItem: Group = {
  id: 1,
  name: 'Trip',
  currency: { id: 1, code: 'USD', label: 'US Dollar' },
  totalAmount: 10,
  userPersonalTotal: 5,
  createdBy: member(1),
  members: [member(1), member(2)],
  _count: { expenses: 4, members: 2 },
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

// Shape returned by the add/remove member endpoints: no _count.
function addMemberResponse(members: Group['members']): GroupUpdateResult {
  const { _count: _omitted, totalAmount: _t, userPersonalTotal: _u, ...rest } = listItem;
  return { ...rest, members } as unknown as GroupUpdateResult;
}

describe('issue #143: Home member count after add/remove member', () => {
  it('should increase _count.members when a member is added', () => {
    const result = mergeUpdatedGroup([listItem], addMemberResponse([member(1), member(2), member(3)]));
    expect(result[0]._count.members).toBe(3);
  });

  it('should decrease _count.members when a member is removed', () => {
    const result = mergeUpdatedGroup([listItem], addMemberResponse([member(1)]));
    expect(result[0]._count.members).toBe(1);
  });

  it('should keep _count.expenses, which the update response does not carry', () => {
    const result = mergeUpdatedGroup([listItem], addMemberResponse([member(1), member(2), member(3)]));
    expect(result[0]._count.expenses).toBe(4);
  });

  it('should keep the existing count when the response has no members array', () => {
    const { members: _m, ...noMembers } = addMemberResponse([]);
    const result = mergeUpdatedGroup([listItem], noMembers as unknown as GroupUpdateResult);
    expect(result[0]._count.members).toBe(2);
  });
});
