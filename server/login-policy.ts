import { storage } from "./storage";
import type { User } from "@shared/schema";

/** Stored instead of a hash until the user sets a password through their invitation link. */
export const ONBOARDING_PASSWORD_PLACEHOLDER = "NEEDS_ONBOARDING";

/**
 * Account-level reasons a user with a correct password still may not sign in, or null.
 * Shared by every web and mobile login path so the rules cannot drift apart.
 */
export async function getLoginBlockReason(user: User): Promise<string | null> {
  if (user.isActive === false) return "Account is deactivated";
  if (user.password === ONBOARDING_PASSWORD_PLACEHOLDER) {
    return "Account setup is not complete. Use the link in your invitation email.";
  }
  if (user.role === "employee") {
    const employee = await storage.getEmployeeByUserId(user.id);
    if (!employee?.portalAccessEnabled) {
      return "Portal access is not enabled for this account. Contact your administrator.";
    }
  }
  return null;
}
