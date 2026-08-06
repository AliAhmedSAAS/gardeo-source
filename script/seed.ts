import "dotenv/config";
import { storage } from "../server/storage";
import bcrypt from "bcryptjs";

const TEST_USERS = [
  {
    username: "testadmin",
    email: "testadmin@gardeosmart.local",
    password: "password123",
    firstName: "Test",
    lastName: "Admin",
    role: "hr_manager" as const,
  },
  {
    username: "testemployee",
    email: "testemployee@gardeosmart.local",
    password: "password123",
    firstName: "Test",
    lastName: "Employee",
    role: "employee" as const,
  },
];

async function seed() {
  console.log("Seeding database...");

  let tenant = await storage.getTenant(1);
  if (!tenant) {
    tenant = await storage.createTenant({
      name: "Default Organisation",
      slug: "default",
      industry: "security",
    });
    console.log("Created default tenant:", tenant.name);
  }

  for (const u of TEST_USERS) {
    const existing = await storage.getUserByUsername(u.username);
    if (existing) {
      console.log("User already exists:", u.username);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await storage.createUser({
      username: u.username,
      email: u.email,
      password: hashed,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      tenantId: tenant.id,
    });
    await storage.createEmployee({ userId: user.id, tenantId: tenant.id });
    await storage.createOnboarding({
      userId: user.id,
      tenantId: tenant.id,
      status: "in_progress",
      currentStep: 1,
    });
    console.log("Created user:", u.username, "(" + u.role + ")");
  }

  console.log("Seed complete. You can login with testadmin / password123 or testemployee / password123");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
