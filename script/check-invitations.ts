/**
 * One-off script to check why invitation link might not show.
 * Run: npx tsx script/check-invitations.ts
 * Requires: DATABASE_URL in .env
 */
import "dotenv/config";
import { db } from "../server/db";
import { suppliers, supplierInvitations } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const allSuppliers = await db.select({
    id: suppliers.id,
    companyName: suppliers.companyName,
    userId: suppliers.userId,
    portalAccessEnabled: suppliers.portalAccessEnabled,
  }).from(suppliers).orderBy(suppliers.id);

  console.log("\n=== Suppliers and invitation link visibility ===\n");
  console.log("Invitation link is shown when: no invitation row has accepted_at set (pending) AND latest invitation has a token.\n");

  for (const s of allSuppliers) {
    const invitations = await db.select({
      id: supplierInvitations.id,
      supplierId: supplierInvitations.supplierId,
      token: supplierInvitations.token,
      acceptedAt: supplierInvitations.acceptedAt,
      createdAt: supplierInvitations.createdAt,
      email: supplierInvitations.email,
    })
      .from(supplierInvitations)
      .where(eq(supplierInvitations.supplierId, s.id))
      .orderBy(desc(supplierInvitations.createdAt));

    const latest = invitations[0];
    const invitationAccepted = invitations.some((inv) => inv.acceptedAt != null);
    const hasToken = !!latest?.token;
    const wouldShowLink = !invitationAccepted && hasToken;

    console.log(`Supplier id=${s.id} "${s.companyName}"`);
    console.log(`  portal_access_enabled: ${s.portalAccessEnabled ?? false}`);
    console.log(`  any invitation accepted_at: ${invitationAccepted} (${invitations.filter((i) => i.acceptedAt).length} row(s) with acceptedAt)`);
    console.log(`  invitations: ${invitations.length} row(s)`);
    if (latest) {
      console.log(`  latest invitation: id=${latest.id}, token present: ${hasToken}, acceptedAt: ${latest.acceptedAt ?? "null"}, created: ${latest.createdAt}`);
    } else {
      console.log(`  latest invitation: none`);
    }
    console.log(`  => Would show invitation link in UI: ${wouldShowLink}`);
    if (!wouldShowLink) {
      if (invitationAccepted) console.log(`     Reason: Supplier has already accepted (an invitation has accepted_at set).`);
      else if (!latest) console.log(`     Reason: No invitation row. Send invitation first.`);
      else if (!hasToken) console.log(`     Reason: Latest invitation has no token (data issue).`);
    }
    console.log("");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
