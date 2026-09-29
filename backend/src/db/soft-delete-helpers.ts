/**
 * Хелперы для soft-delete без extension — проще и надёжнее.
 */

export const NOT_DELETED = { deletedAt: null } as const;

export function softDeletePatch() {
  return { deletedAt: new Date() };
}

export function restorePatch() {
  return { deletedAt: null };
}