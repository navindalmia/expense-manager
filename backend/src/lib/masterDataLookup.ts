/**
 * Master Data Lookup
 *
 * Shared "find or reactivate" resolution for user-owned master data rows
 * (Label, Theme). Creating a row whose name (case-insensitive) matches an
 * existing one never inserts a duplicate:
 *   - a matching ACTIVE row (global or the user's own) is returned as-is;
 *   - a matching DISABLED row owned by the user is reactivated;
 *   - otherwise a new row is created.
 * Neither matched case is an error -- the caller sees a normal "create".
 */

export interface MasterDataRow {
  id: number;
  isActive: boolean;
}

export interface MasterDataOperations<T extends MasterDataRow> {
  /** Active row with this name visible to the user (global or own). */
  findActiveVisible: () => Promise<T | null>;
  /** Disabled row with this name owned by the user. */
  findOwnDisabled: () => Promise<T | null>;
  reactivate: (id: number) => Promise<T>;
  create: () => Promise<T>;
}

export async function findOrReactivate<T extends MasterDataRow>(
  ops: MasterDataOperations<T>
): Promise<T> {
  const active = await ops.findActiveVisible();
  if (active) {
    return active;
  }

  const disabled = await ops.findOwnDisabled();
  if (disabled) {
    return ops.reactivate(disabled.id);
  }

  return ops.create();
}
