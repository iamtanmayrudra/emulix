import { AuthFailure, isValidEmail, normalizeEmail } from "./service";
import { verifyPassword } from "./password";
import type { AuthStore, UserRecord } from "./store";

export type ProfileChanges = { name?: unknown; email?: unknown; password?: unknown };

export type ProfileDeps = {
  store: AuthStore;
  /** Sends a fresh verification link to the address on the account. */
  resendVerification: (userId: string) => Promise<void>;
};

/**
 * Lets a signed-in person change their own name and email address. A new email address needs the current password,
 * and the new address has to be confirmed again before the account counts as verified.
 */
export async function updateOwnProfile(deps: ProfileDeps, user: UserRecord, changes: ProfileChanges): Promise<UserRecord> {
  const patch: Partial<UserRecord> = {};

  if (changes.name !== undefined) {
    const name = typeof changes.name === "string" ? changes.name.trim() : "";
    if (name.length < 1 || name.length > 80) throw new AuthFailure("invalid_input", "Enter a name between 1 and 80 characters.");
    if (name !== user.name) patch.name = name;
  }

  let emailChanged = false;
  if (changes.email !== undefined) {
    const email = typeof changes.email === "string" ? normalizeEmail(changes.email) : "";
    // Only a real change is checked. An address that is already on the account is left alone, even if it is not in email form.
    if (email !== user.email) {
      if (!isValidEmail(email)) throw new AuthFailure("invalid_input", "Enter a valid email address.");
      if (typeof changes.password !== "string" || changes.password.length === 0) {
        throw new AuthFailure("invalid_credentials", "Enter your current password to change your email address.");
      }
      if (!(await verifyPassword(changes.password, user.passwordHash))) {
        throw new AuthFailure("invalid_credentials", "That password is not correct.");
      }
      if (await deps.store.findUserByEmail(email)) {
        throw new AuthFailure("invalid_input", "That email address is already in use.");
      }
      if (!(await deps.store.reassignEmail(user.id, email))) {
        throw new AuthFailure("invalid_input", "That email address is already in use.");
      }
      emailChanged = true;
    }
  }

  if (Object.keys(patch).length > 0) await deps.store.updateUser(user.id, patch);
  if (emailChanged) {
    // The new address has to prove it works before the account counts as verified.
    await deps.store.updateUser(user.id, { emailVerifiedAt: null });
    await deps.resendVerification(user.id);
  }

  const updated = await deps.store.findUserById(user.id);
  if (!updated) throw new AuthFailure("invalid_input", "Your account could not be found.");
  return updated;
}
