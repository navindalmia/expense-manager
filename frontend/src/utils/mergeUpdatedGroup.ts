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
    return { ...g, ...updated, totalAmount, userPersonalTotal };
  });
}
