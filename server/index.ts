import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, isStripeConfigured } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { startOnboardingScheduler } from "./onboarding-scheduler";
import { startNotificationScheduler } from "./notification-scheduler";
import { startProbationScheduler } from "./probation-scheduler";
import { startFmPpmScheduler } from "./fm-ppm-scheduler";

// Global safety nets: keep the production server alive when a background task
// (scheduler interval, async route, webhook handler, etc.) rejects or throws
// outside an Express handler. Without these, Node terminates the process on an
// unhandled rejection/exception, causing brief crash-and-restart outages.
process.on("unhandledRejection", (reason: any) => {
  console.error(
    "[process] Unhandled promise rejection (kept alive):",
    reason instanceof Error ? reason.stack || reason.message : reason,
  );
});
process.on("uncaughtException", (err: any) => {
  console.error(
    "[process] Uncaught exception (kept alive):",
    err instanceof Error ? err.stack || err.message : err,
  );
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("DATABASE_URL not set, skipping Stripe init");
    return;
  }

  if (!isStripeConfigured()) {
    console.log(
      "Stripe keys not set — skipping Stripe sync (optional for local dev). Add STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY to .env to enable billing.",
    );
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    try {
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log(`Stripe webhook configured: ${result?.webhook?.url || "pending"}`);
    } catch (webhookErr: any) {
      console.log("Stripe webhook setup deferred:", webhookErr.message);
    }

    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: any) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

initStripe().catch(err => console.error("Stripe init failed:", err));

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing signature" });

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (endpointSecret) {
          const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as any;
            const tenantId = session.metadata?.tenantId;
            const addonKey = session.metadata?.addonKey;
            if (tenantId && addonKey && session.payment_status === "paid") {
              const { pool } = await import("./db");
              const existing = await pool.query(
                "SELECT id FROM tenant_addons WHERE tenant_id = $1 AND addon_key = $2",
                [tenantId, addonKey]
              );
              const subscriptionId = session.subscription || null;
              const customerId = session.customer || null;
              const userId = session.metadata?.userId || null;
              if (existing.rows.length > 0) {
                await pool.query(
                  "UPDATE tenant_addons SET status = 'active', purchased_at = NOW(), stripe_subscription_id = COALESCE($3, stripe_subscription_id), stripe_customer_id = COALESCE($4, stripe_customer_id), purchased_by_user_id = $5, updated_at = NOW() WHERE tenant_id = $1 AND addon_key = $2",
                  [tenantId, addonKey, subscriptionId, customerId, userId]
                );
              } else {
                await pool.query(
                  "INSERT INTO tenant_addons (tenant_id, addon_key, addon_name, status, stripe_product_id, stripe_subscription_id, stripe_customer_id, purchased_at, purchased_by_user_id) VALUES ($1, $2, $3, 'active', $4, $5, $6, NOW(), $7)",
                  [tenantId, addonKey, addonKey, null, subscriptionId, customerId, userId]
                );
              }
              console.log(`Webhook: Activated add-on '${addonKey}' for tenant ${tenantId}`);
            }
          }
        }
      } catch (webhookAddonErr: any) {
        console.error("Webhook addon activation error (non-fatal):", webhookAddonErr.message);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_bank_changes (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        requested_by_user_id VARCHAR NOT NULL REFERENCES users(id),
        account_name TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        sort_code TEXT NOT NULL,
        account_number TEXT NOT NULL,
        building_society_ref TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by_user_id VARCHAR REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    log("Ensured pending_bank_changes table exists");
  } catch (e) {
    log("Could not create pending_bank_changes table: " + (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_email_settings (
        id serial PRIMARY KEY,
        tenant_id integer NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        provider text NOT NULL DEFAULT 'smtp',
        from_name text,
        from_email text,
        reply_to_email text,
        smtp_host text,
        smtp_port integer DEFAULT 587,
        smtp_secure boolean NOT NULL DEFAULT false,
        smtp_user text,
        smtp_password_encrypted text,
        resend_api_key_encrypted text,
        last_tested_at timestamp,
        last_test_status text,
        last_error text,
        updated_by varchar(255),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);
    log("Ensured tenant_email_settings table exists");
  } catch (e) {
    log("Could not create tenant_email_settings table: " + (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employment_reference_tokens (
        id serial PRIMARY KEY,
        token varchar(64) NOT NULL UNIQUE,
        tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL,
        employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        employment_history_id integer NOT NULL REFERENCES employment_history(id) ON DELETE CASCADE,
        expires_at timestamp NOT NULL,
        used_at timestamp,
        information_confirmed boolean,
        details_if_different text,
        attitude text,
        time_keeping text,
        time_off text,
        reason_for_leaving text,
        would_reemploy text,
        referee_print_name text,
        referee_company text,
        referee_position text,
        referee_signature text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);
    log("Ensured employment_reference_tokens table exists");
  } catch (e) {
    log("Could not create employment_reference_tokens table: " + (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personal_reference_tokens (
        id serial PRIMARY KEY,
        token varchar(64) NOT NULL UNIQUE,
        tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL,
        employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        reference_id integer NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
        expires_at timestamp NOT NULL,
        used_at timestamp,
        information_confirmed boolean,
        details_if_different text,
        character_assessment text,
        trustworthy text,
        aware_of_concerns text,
        concerns_details text,
        would_recommend text,
        referee_print_name text,
        referee_occupation text,
        referee_address text,
        referee_signature text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_personal_ref_tokens_token ON personal_reference_tokens (token)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_personal_ref_tokens_ref ON personal_reference_tokens (reference_id)
    `);
    log("Ensured personal_reference_tokens table exists");
  } catch (e) {
    log("Could not create personal_reference_tokens table: " + (e as Error).message);
  }

  try {
    await pool.query(`
      ALTER TABLE personal_reference_tokens
        ADD COLUMN IF NOT EXISTS illegal_activity text,
        ADD COLUMN IF NOT EXISTS honest_person text,
        ADD COLUMN IF NOT EXISTS polite_conduct text,
        ADD COLUMN IF NOT EXISTS able_to_work_in_team text,
        ADD COLUMN IF NOT EXISTS trustworthy_and_loyal text,
        ADD COLUMN IF NOT EXISTS good_choice_for_position text,
        ADD COLUMN IF NOT EXISTS reason_if_no text
    `);
    log("Ensured personal_reference_tokens Y/N question columns exist");
  } catch (e) {
    log("Could not add personal_reference_tokens Y/N columns: " + (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vetting_packet_tokens (
        id serial PRIMARY KEY,
        token varchar(64) NOT NULL UNIQUE,
        tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL,
        employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        recipient_email text NOT NULL,
        document_codes jsonb NOT NULL,
        expires_at timestamp NOT NULL,
        created_by varchar(255) REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);
    log("Ensured vetting_packet_tokens table exists");
  } catch (e) {
    log("Could not create vetting_packet_tokens table: " + (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_vetting_form_tokens (
        id serial PRIMARY KEY,
        token varchar(64) NOT NULL UNIQUE,
        tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL,
        employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        recipient_email text NOT NULL,
        expires_at timestamp NOT NULL,
        last_saved_at timestamp,
        submitted_at timestamp,
        form_data jsonb,
        equal_ops_acknowledged_at timestamp,
        zero_hours_acknowledged_at timestamp,
        code_of_conduct_acknowledged_at timestamp,
        created_by varchar(255) REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);
    log("Ensured employee_vetting_form_tokens table exists");
  } catch (e) {
    log("Could not create employee_vetting_form_tokens table: " + (e as Error).message);
  }

  try {
    await pool.query("UPDATE users SET role = 'admin' WHERE username = 'testadmin' AND role != 'admin'");
    log("Ensured testadmin has admin role");
  } catch (e) {
    log("Could not update testadmin role: " + (e as Error).message);
  }

  try {
    const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM role_permissions");
    if (parseInt(rows[0].cnt) === 0) {
      log("Seeding default role permissions...");
      const defaults: Record<string, string[]> = {
        tenant_admin: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:recruitment","screen:vetting","screen:compliance","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:audit-trail","screen:data-import","screen:company-profile","screen:compliance-settings","screen:settings","screen:addons","screen:clients","screen:sites","screen:payroll","screen:leave-requests","screen:absences"],
        ceo: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:recruitment","screen:vetting","screen:compliance","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:audit-trail","screen:company-profile","screen:compliance-settings","screen:addons","screen:clients","screen:sites","screen:payroll","screen:leave-requests","screen:absences"],
        operations_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:employees","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:company-profile","screen:compliance-settings","screen:addons","screen:clients","screen:sites","screen:leave-requests","screen:absences"],
        regional_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:employees","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:company-profile","screen:clients","screen:sites","screen:leave-requests","screen:absences"],
        admin: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:recruitment","screen:vetting","screen:compliance","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:audit-trail","screen:data-import","screen:company-profile","screen:compliance-settings","screen:settings","screen:clients","screen:sites","screen:leave-requests","screen:absences"],
        controller: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:employees","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:clients","screen:sites"],
        scheduler: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:employees","screen:scheduling","screen:timesheets","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:clients","screen:sites"],
        hr_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:recruitment","screen:vetting","screen:compliance","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:data-import","screen:compliance-settings","screen:clients","screen:sites","screen:leave-requests","screen:absences"],
        compliance_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:vetting","screen:compliance","screen:supplier-hmrc-audit","screen:reports","screen:compliance-settings","screen:clients","screen:sites"],
        accountant: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:payroll"],
        payroll_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:employees","screen:supplier-timesheets","screen:finance","screen:self-billing","screen:self-billing-audit","screen:supplier-hmrc-audit","screen:reports","screen:payroll"],
        training_manager: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:admin-onboarding","screen:employees","screen:compliance"],
        supplier: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:disputes","screen:supplier-portal","screen:my-officers","screen:supplier-timesheets-portal","screen:supplier-invoices","screen:supplier-documents","screen:supplier-policies","screen:self-billing-agreement"],
        employee: ["screen:dashboard","screen:communications","screen:privacy-settings","screen:onboarding","screen:my-shifts","screen:my-documents","screen:my-profile","screen:my-pay"],
      };
      const allPerms = [
        "screen:dashboard","screen:communications","screen:privacy-settings","screen:onboarding","screen:admin-onboarding","screen:employees","screen:recruitment","screen:vetting","screen:compliance","screen:scheduling","screen:timesheets","screen:control-room","screen:deployment-map","screen:ai-scheduling","screen:ai-analytics","screen:suppliers","screen:supplier-timesheets","screen:disputes","screen:finance","screen:self-billing","screen:self-billing-audit","screen:reports","screen:audit-trail","screen:data-import","screen:company-profile","screen:compliance-settings","screen:settings","screen:supplier-portal","screen:my-officers","screen:supplier-timesheets-portal","screen:supplier-invoices","screen:supplier-documents","screen:supplier-policies","screen:self-billing-agreement","screen:my-shifts","screen:my-documents","screen:my-profile","screen:addons","screen:supplier-audit-portal","screen:supplier-hmrc-audit","screen:clients","screen:sites","screen:payroll","screen:my-pay","screen:leave-requests","screen:absences"
      ];
      const values: string[] = [];
      const params: any[] = [];
      let idx = 1;
      for (const [role, perms] of Object.entries(defaults)) {
        for (const perm of allPerms) {
          values.push(`($${idx++}, $${idx++}, $${idx++})`);
          params.push(role, perm, perms.includes(perm));
        }
      }
      await pool.query(`INSERT INTO role_permissions (role, permission_key, enabled) VALUES ${values.join(",")}`, params);
      log(`Seeded ${params.length / 3} role permissions`);
    } else {
      const newPerms: Record<string, string[]> = {
        "screen:payroll": ["tenant_admin","ceo","accountant","payroll_manager"],
        "screen:my-pay": ["employee"],
        "screen:leave-requests": ["tenant_admin","ceo","operations_manager","regional_manager","admin","hr_manager"],
        "screen:absences": ["tenant_admin","ceo","operations_manager","regional_manager","admin","hr_manager"],
      };
      const allRoles = ["tenant_admin","ceo","operations_manager","regional_manager","admin","controller","scheduler","hr_manager","compliance_manager","accountant","payroll_manager","training_manager","supplier","employee"];
      for (const [perm, enabledRoles] of Object.entries(newPerms)) {
        const { rows: existing } = await pool.query(
          "SELECT COUNT(*) as cnt FROM role_permissions WHERE permission_key = $1", [perm]
        );
        if (parseInt(existing[0].cnt) === 0) {
          const insertVals: string[] = [];
          const insertParams: any[] = [];
          let pi = 1;
          for (const role of allRoles) {
            insertVals.push(`($${pi++}, $${pi++}, $${pi++})`);
            insertParams.push(role, perm, enabledRoles.includes(role));
          }
          await pool.query(`INSERT INTO role_permissions (role, permission_key, enabled) VALUES ${insertVals.join(",")}`, insertParams);
          log(`Added permission ${perm} for ${enabledRoles.length} roles`);
        }
      }
    }
  } catch (e) {
    log("Could not seed role permissions: " + (e as Error).message);
  }

  try {
    const repairResult = await pool.query(
      `UPDATE invoices i
       SET total_hours = sub.computed_hours
       FROM (
         SELECT invoice_id, COALESCE(SUM(hours::numeric), 0)::numeric(10,2) AS computed_hours
         FROM invoice_line_items
         GROUP BY invoice_id
       ) sub
       WHERE i.id = sub.invoice_id
         AND ABS(COALESCE(i.total_hours::numeric, 0) - sub.computed_hours) > 0.001`
    );
    if (repairResult.rowCount && repairResult.rowCount > 0) {
      log(`Data repair: corrected total_hours for ${repairResult.rowCount} invoice(s)`);
    }
  } catch (e) {
    log("Could not run invoice total_hours repair: " + (e as Error).message);
  }

  await registerRoutes(httpServer, app);

  try {
    const { storage } = await import("./storage");
    await storage.backfillDefaultOfficerTypesForAllTenants();
    log("Officer types: default types ensured for all tenants");
  } catch (e) {
    log("Officer types backfill skipped: " + (e as Error).message);
  }

  const appBaseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : `http://localhost:${process.env.PORT || 5000}`;
  startOnboardingScheduler(appBaseUrl);
  startNotificationScheduler();
  startProbationScheduler();
  startFmPpmScheduler();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
      ...(process.env.NODE_ENV === "production" ? { reusePort: true } : {}),
    },
    async () => {
      log(`serving at http://${host}:${port}`);
      try {
        const { initializeEmailPolling } = await import("./email-command-service");
        await initializeEmailPolling();
      } catch (err: any) {
        console.error("[EmailCommand] Failed to initialize email polling on startup:", err.message);
      }
      try {
        const { initializeXeroSync } = await import("./xero-service");
        await initializeXeroSync();
      } catch (err: any) {
        console.error("[Xero] Failed to initialize Xero sync on startup:", err.message);
      }
    },
  );
})();
