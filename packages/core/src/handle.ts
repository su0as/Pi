/**
 * Handle rules — docs/CONTEXT.md section 5.1: "User handle creation on first sign-in (unique,
 * editable once per 30 days)."
 */

const HANDLE_EDIT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** `handleChangedAt` is null until the first edit (see packages/db's users.handle_changed_at
 * comment) — null always means "never changed," so always editable. */
export function canEditHandle(handleChangedAt: Date | null, now: Date = new Date()): boolean {
  if (!handleChangedAt) return true;
  return now.getTime() - handleChangedAt.getTime() >= HANDLE_EDIT_COOLDOWN_MS;
}

/** Null if never changed (nothing to count down from); otherwise when the cooldown lifts. */
export function nextHandleEditAt(handleChangedAt: Date | null): Date | null {
  if (!handleChangedAt) return null;
  return new Date(handleChangedAt.getTime() + HANDLE_EDIT_COOLDOWN_MS);
}

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

/** Turns a display name (or anything) into a handle-shaped base — not guaranteed unique; the
 * caller (which has DB access) appends a suffix on collision. Pure/no-IO on purpose, same
 * reasoning as the rest of packages/core. */
export function slugifyForHandle(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 15);
  return slug.length >= 3 ? slug : `user_${slug}`.slice(0, 15);
}
