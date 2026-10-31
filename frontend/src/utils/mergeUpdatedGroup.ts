import type { Group } from '../services/groupService';

/**
 * Update payload from PATCH /groups/:id. It omits the computed totals that
 * GET /groups adds, so those must be carried over from the existing list item.
 */
export type GroupUpdateResult = Omit<Group, 'totalAmount' | 'userPersonalTotal'> &
  Partial<Pick<Group, 'totalAmount' | 'userPersonalTotal'>>;

/**
 * Replace the edited group in the list, keeping fields the update response lacks.
 * Always returns a new array so FlatList re-renders.
 */
export function mergeUpdatedGroup(groups: Group[], updated: GroupUpdateResult): Group[] {
  return groups.map((g: Group): Group => {
    if (g.id !== updated.id) return g;
    // An explicit undefined must not wipe the totals the list item already has.
    const totalAmount: number = updated.totalAmount ?? g.totalAmount;
    const userPersonalTotal: number = updated.userPersonalTotal ?? g.userPersonalTotal;
    // Add/remove-member responses carry a fresh `members` array but no `_count`;
    // derive the member count from it so the Home card is not stale (#143).
    const memberCount: number = Array.isArray(updated.members)
      ? updated.members.length
      : (updated._count?.members ?? g._count?.members ?? 0);
    const _count: Group['_count'] = {
      ...g._count,
      ...updated._count,
      members: memberCount,
    };
    return { ...g, ...updated, totalAmount, userPersonalTotal, _count };
  });
}
