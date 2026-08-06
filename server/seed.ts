import { db } from "./db";
import { 
  users, employees, sites, shifts, suppliers, incidents, rateCards, invoices, invoiceLineItems,
  jobPostings, applicants, vettingRecords, emergencyContacts, bankDetails, auditLogs,
  tenants
} from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TENANT_SLUG = "guardian";

async function seed() {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG));
  if (!tenant) { console.error(`Tenant with slug '${TENANT_SLUG}' not found. Run onboarding first.`); process.exit(1); }
  const TENANT_ID = tenant.id;

  const tenantUsers = await db.select().from(users).where(eq(users.tenantId, TENANT_ID));
  const adminUser = tenantUsers.find(u => u.role === "tenant_admin" || u.role === "super_admin") || tenantUsers[0];
  if (!adminUser) { console.error("No users found for tenant."); process.exit(1); }
  const ADMIN_USER_ID = adminUser.id;
  console.log(`Using admin: ${adminUser.username} (${adminUser.role})`);

  const existingEmps = await db.select().from(employees).where(eq(employees.tenantId, TENANT_ID));
  if (existingEmps.length > 0) {
    console.log(`Tenant ${TENANT_ID} already has ${existingEmps.length} employees. Skipping seed to avoid duplicates.`);
    console.log("To re-seed, delete existing data first.");
    process.exit(0);
  }

  console.log(`Seeding database for tenant ${TENANT_ID} (${tenant.name})...`);
  const hashedPw = await bcrypt.hash("Password123!", 10);

  const roleUsers = [
    { username: "ops_manager", email: "ops@guardianfm.co.uk", firstName: "Richard", lastName: "Clarke", role: "operations_manager" as const },
    { username: "regional_mgr", email: "regional@guardianfm.co.uk", firstName: "Karen", lastName: "Mitchell", role: "regional_manager" as const },
    { username: "controller1", email: "controller@guardianfm.co.uk", firstName: "Mark", lastName: "Stevens", role: "controller" as const },
    { username: "scheduler1", email: "scheduler@guardianfm.co.uk", firstName: "Lisa", lastName: "Brown", role: "scheduler" as const },
    { username: "hr_manager1", email: "hr@guardianfm.co.uk", firstName: "Sarah", lastName: "Johnson", role: "hr_manager" as const },
    { username: "compliance_mgr", email: "compliance@guardianfm.co.uk", firstName: "David", lastName: "Williams", role: "compliance_manager" as const },
    { username: "accountant1", email: "accounts@guardianfm.co.uk", firstName: "Emma", lastName: "Taylor", role: "accountant" as const },
    { username: "payroll_mgr", email: "payroll@guardianfm.co.uk", firstName: "James", lastName: "Wilson", role: "payroll_manager" as const },
    { username: "training_mgr", email: "training@guardianfm.co.uk", firstName: "Rachel", lastName: "Davies", role: "training_manager" as const },
  ];

  const createdRoleUsers: string[] = [];
  for (const u of roleUsers) {
    const [created] = await db.insert(users).values({
      tenantId: TENANT_ID,
      username: u.username,
      email: u.email,
      password: hashedPw,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    }).returning();
    createdRoleUsers.push(created.id);
    console.log(`  Created user: ${u.username} (${u.role})`);
  }

  const employeeData = [
    { firstName: "Ahmed", lastName: "Khan", email: "ahmed.khan@guardianfm.co.uk", phone: "07712345678", dob: "1990-03-15", ni: "AB123456C", city: "London", postcode: "E1 6AN", sia: "0012345678901234", siaType: "Door Supervisor", siaExpiry: "2027-06-30", dbs: "DBS001234567", dbsDate: "2025-01-15", hourly: "14.50", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2024-01-10", firstAid: true, firstAidExpiry: "2027-01-10" },
    { firstName: "James", lastName: "O'Brien", email: "james.obrien@guardianfm.co.uk", phone: "07723456789", dob: "1988-07-22", ni: "CD234567E", city: "London", postcode: "SE1 9SG", sia: "0023456789012345", siaType: "Security Guard", siaExpiry: "2026-11-15", dbs: "DBS002345678", dbsDate: "2024-08-20", hourly: "13.50", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2023-06-01", firstAid: false, firstAidExpiry: null },
    { firstName: "Priya", lastName: "Patel", email: "priya.patel@guardianfm.co.uk", phone: "07734567890", dob: "1995-11-08", ni: "EF345678G", city: "London", postcode: "N1 9GU", sia: "0034567890123456", siaType: "Door Supervisor", siaExpiry: "2027-03-20", dbs: "DBS003456789", dbsDate: "2025-03-10", hourly: "15.00", jobTitle: "Senior Security Officer", dept: "Operations", empType: "full_time", startDate: "2022-09-15", firstAid: true, firstAidExpiry: "2026-09-15" },
    { firstName: "Michael", lastName: "Thompson", email: "michael.thompson@guardianfm.co.uk", phone: "07745678901", dob: "1985-02-14", ni: "GH456789I", city: "London", postcode: "SW1A 1AA", sia: "0045678901234567", siaType: "Close Protection", siaExpiry: "2027-08-12", dbs: "DBS004567890", dbsDate: "2025-05-01", hourly: "18.00", jobTitle: "Close Protection Officer", dept: "CP Division", empType: "full_time", startDate: "2021-03-01", firstAid: true, firstAidExpiry: "2027-03-01" },
    { firstName: "Sophie", lastName: "Williams", email: "sophie.williams@guardianfm.co.uk", phone: "07756789012", dob: "1992-06-30", ni: "IJ567890K", city: "London", postcode: "EC2A 1NT", sia: "0056789012345678", siaType: "Door Supervisor", siaExpiry: "2026-04-18", dbs: "DBS005678901", dbsDate: "2024-06-15", hourly: "14.00", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2024-02-01", firstAid: false, firstAidExpiry: null },
    { firstName: "Daniel", lastName: "Okafor", email: "daniel.okafor@guardianfm.co.uk", phone: "07767890123", dob: "1991-09-25", ni: "KL678901M", city: "London", postcode: "E14 5AB", sia: "0067890123456789", siaType: "Security Guard", siaExpiry: "2027-01-05", dbs: "DBS006789012", dbsDate: "2025-02-28", hourly: "14.50", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2023-11-20", firstAid: true, firstAidExpiry: "2026-11-20" },
    { firstName: "Charlotte", lastName: "Evans", email: "charlotte.evans@guardianfm.co.uk", phone: "07778901234", dob: "1993-12-01", ni: "MN789012O", city: "London", postcode: "W1D 3SE", sia: "0078901234567890", siaType: "Door Supervisor", siaExpiry: "2027-05-22", dbs: "DBS007890123", dbsDate: "2025-04-10", hourly: "15.50", jobTitle: "Site Supervisor", dept: "Operations", empType: "full_time", startDate: "2022-05-10", firstAid: true, firstAidExpiry: "2027-05-10" },
    { firstName: "Mohammed", lastName: "Ali", email: "mohammed.ali@guardianfm.co.uk", phone: "07789012345", dob: "1989-04-17", ni: "OP890123Q", city: "London", postcode: "NW1 2DB", sia: "0089012345678901", siaType: "Security Guard", siaExpiry: "2026-09-30", dbs: "DBS008901234", dbsDate: "2024-10-05", hourly: "13.50", jobTitle: "Security Officer", dept: "Operations", empType: "part_time", startDate: "2024-06-15", firstAid: false, firstAidExpiry: null },
    { firstName: "Rebecca", lastName: "Scott", email: "rebecca.scott@guardianfm.co.uk", phone: "07790123456", dob: "1994-08-09", ni: "QR901234S", city: "London", postcode: "SE10 8EW", sia: "0090123456789012", siaType: "CCTV Operator", siaExpiry: "2027-02-14", dbs: "DBS009012345", dbsDate: "2025-06-20", hourly: "16.00", jobTitle: "CCTV Operator", dept: "Control Room", empType: "full_time", startDate: "2023-01-08", firstAid: false, firstAidExpiry: null },
    { firstName: "Thomas", lastName: "Murphy", email: "thomas.murphy@guardianfm.co.uk", phone: "07701234567", dob: "1987-01-20", ni: "ST012345U", city: "London", postcode: "WC2N 5DU", sia: "0001234567890123", siaType: "Door Supervisor", siaExpiry: "2026-12-01", dbs: "DBS000123456", dbsDate: "2024-12-01", hourly: "14.50", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2022-11-01", firstAid: true, firstAidExpiry: "2026-06-01" },
    { firstName: "Fatima", lastName: "Hassan", email: "fatima.hassan@guardianfm.co.uk", phone: "07711234567", dob: "1996-05-12", ni: "UV123456W", city: "London", postcode: "E15 1XQ", sia: "0112345678901234", siaType: "Security Guard", siaExpiry: "2027-07-15", dbs: "DBS011234567", dbsDate: "2025-07-01", hourly: "13.00", jobTitle: "Security Officer", dept: "Operations", empType: "full_time", startDate: "2025-01-06", firstAid: false, firstAidExpiry: null },
    { firstName: "Ryan", lastName: "Hughes", email: "ryan.hughes@guardianfm.co.uk", phone: "07721234567", dob: "1990-10-28", ni: "WX234567Y", city: "London", postcode: "SW11 1JQ", sia: "0123456789012345", siaType: "Door Supervisor", siaExpiry: "2026-08-20", dbs: "DBS012345678", dbsDate: "2024-04-15", hourly: "15.00", jobTitle: "Senior Security Officer", dept: "Operations", empType: "full_time", startDate: "2021-08-01", firstAid: true, firstAidExpiry: "2027-08-01" },
  ];

  const empUserIds: string[] = [];
  const empIds: number[] = [];
  for (const e of employeeData) {
    const [empUser] = await db.insert(users).values({
      tenantId: TENANT_ID,
      username: e.email.split("@")[0].replace(/\./g, "_"),
      email: e.email,
      password: hashedPw,
      firstName: e.firstName,
      lastName: e.lastName,
      role: "employee",
      phone: e.phone,
    }).returning();
    empUserIds.push(empUser.id);

    const [emp] = await db.insert(employees).values({
      userId: empUser.id,
      tenantId: TENANT_ID,
      employeeNumber: `GFM${String(empIds.length + 1).padStart(4, "0")}`,
      dateOfBirth: e.dob,
      nationalInsurance: e.ni,
      city: e.city,
      postcode: e.postcode,
      country: "United Kingdom",
      startDate: e.startDate,
      jobTitle: e.jobTitle,
      department: e.dept,
      employmentType: e.empType,
      hourlyRate: e.hourly,
      siaLicenseNumber: e.sia,
      siaLicenseType: e.siaType,
      siaExpiryDate: e.siaExpiry,
      dbsCertificateNumber: e.dbs,
      dbsIssueDate: e.dbsDate,
      hasFirstAid: e.firstAid,
      firstAidExpiry: e.firstAidExpiry,
    }).returning();
    empIds.push(emp.id);
    console.log(`  Created employee: ${e.firstName} ${e.lastName} (${e.jobTitle})`);
  }

  for (let i = 0; i < empIds.length; i++) {
    await db.insert(emergencyContacts).values({
      employeeId: empIds[i],
      name: `Emergency Contact for ${employeeData[i].firstName}`,
      relationship: ["Spouse", "Parent", "Sibling", "Partner"][i % 4],
      phone: `0770${String(1000000 + i).slice(0, 7)}`,
      isPrimary: true,
    });
    await db.insert(bankDetails).values({
      employeeId: empIds[i],
      accountName: `${employeeData[i].firstName} ${employeeData[i].lastName}`,
      bankName: ["Barclays", "HSBC", "Lloyds", "NatWest", "Santander", "TSB"][i % 6],
      sortCode: `${String(10 + (i % 90)).padStart(2, "0")}-${String(20 + i).padStart(2, "0")}-${String(30 + i).padStart(2, "0")}`,
      accountNumber: String(10000000 + i * 1111),
    });
  }

  const siteData = [
    { name: "Westfield Stratford City", address: "Montfichet Road, Olympic Park", city: "London", postcode: "E20 1EJ", lat: "51.5435", lng: "-0.0033", client: "Westfield Corporation", clientContact: "Robert Green", clientEmail: "r.green@westfield.co.uk", clientPhone: "020 8221 7300", contractRef: "WF-2024-001" },
    { name: "Canary Wharf Estate", address: "One Canada Square", city: "London", postcode: "E14 5AB", lat: "51.5054", lng: "-0.0235", client: "Canary Wharf Group", clientContact: "Jennifer Walsh", clientEmail: "j.walsh@canarywharf.com", clientPhone: "020 7418 2000", contractRef: "CW-2024-015" },
    { name: "The Shard", address: "32 London Bridge Street", city: "London", postcode: "SE1 9SG", lat: "51.5045", lng: "-0.0865", client: "Sellar Property Group", clientContact: "Andrew Parker", clientEmail: "a.parker@sellar.com", clientPhone: "020 7940 1400", contractRef: "SH-2024-003" },
    { name: "King's Cross Station", address: "Euston Road", city: "London", postcode: "N1C 4QP", lat: "51.5320", lng: "-0.1240", client: "Network Rail", clientContact: "Simon Harper", clientEmail: "s.harper@networkrail.co.uk", clientPhone: "020 7557 8000", contractRef: "NR-2024-KX" },
    { name: "O2 Arena", address: "Peninsula Square", city: "London", postcode: "SE10 0DX", lat: "51.5030", lng: "0.0032", client: "AEG Europe", clientContact: "Michelle Adams", clientEmail: "m.adams@aegeurope.com", clientPhone: "020 8463 2000", contractRef: "O2-2024-008" },
    { name: "Battersea Power Station", address: "Circus Road West", city: "London", postcode: "SW11 8DD", lat: "51.4817", lng: "-0.1469", client: "Battersea Power Station Dev Co", clientContact: "Helen Price", clientEmail: "h.price@bps.co.uk", clientPhone: "020 7062 1870", contractRef: "BP-2024-012" },
    { name: "Heathrow Terminal 5", address: "Western Perimeter Road", city: "Hounslow", postcode: "TW6 2GA", lat: "51.4723", lng: "-0.4889", client: "Heathrow Airport Ltd", clientContact: "George Dixon", clientEmail: "g.dixon@heathrow.com", clientPhone: "0844 335 1801", contractRef: "HAL-2024-T5" },
    { name: "Wembley Stadium", address: "Olympic Way", city: "London", postcode: "HA9 0WS", lat: "51.5560", lng: "-0.2795", client: "The FA Group", clientContact: "Philip Morrison", clientEmail: "p.morrison@thefa.com", clientPhone: "0800 169 1966", contractRef: "WS-2024-020" },
    { name: "Liverpool Street Station", address: "Liverpool Street", city: "London", postcode: "EC2M 7QH", lat: "51.5178", lng: "-0.0830", client: "Network Rail", clientContact: "Barbara Lane", clientEmail: "b.lane@networkrail.co.uk", clientPhone: "020 7557 8100", contractRef: "NR-2024-LS" },
    { name: "Regent Street Retail", address: "Regent Street", city: "London", postcode: "W1B 5AH", lat: "51.5117", lng: "-0.1400", client: "The Crown Estate", clientContact: "Catherine Fox", clientEmail: "c.fox@thecrownestate.co.uk", clientPhone: "020 7851 5000", contractRef: "CE-2024-RS" },
  ];

  const siteIds: number[] = [];
  for (const s of siteData) {
    const [site] = await db.insert(sites).values({
      tenantId: TENANT_ID,
      name: s.name,
      address: s.address,
      city: s.city,
      postcode: s.postcode,
      latitude: s.lat,
      longitude: s.lng,
      clientName: s.client,
      clientContact: s.clientContact,
      clientEmail: s.clientEmail,
      clientPhone: s.clientPhone,
      contractRef: s.contractRef,
    }).returning();
    siteIds.push(site.id);
    console.log(`  Created site: ${s.name}`);
  }

  const supplierData = [
    { company: "Delta Force Security", contact: "Marcus Johnson", email: "marcus@deltaforce.co.uk", phone: "020 7946 0001", city: "London", postcode: "EC1A 1BB", vatNumber: "GB123456789", companyReg: "12345678", vatStatus: "vat_registered", type: "labour" as const, selfBilling: "active", bank: "Barclays", sortCode: "20-00-00", accNum: "12345678" },
    { company: "Shield Guard Services", contact: "Patricia Moore", email: "patricia@shieldguard.co.uk", phone: "020 7946 0002", city: "London", postcode: "SE1 7PB", vatNumber: "GB234567890", companyReg: "23456789", vatStatus: "vat_registered", type: "labour" as const, selfBilling: "active", bank: "HSBC", sortCode: "40-00-00", accNum: "23456789" },
    { company: "Celtic Security Solutions", contact: "Patrick O'Brien", email: "patrick@celticsecurity.co.uk", phone: "020 7946 0003", city: "Glasgow", postcode: "G1 1HD", vatNumber: "GB345678901", companyReg: "34567890", vatStatus: "vat_registered", type: "labour" as const, selfBilling: "active", bank: "RBS", sortCode: "83-00-00", accNum: "34567890" },
    { company: "Sentinel Uniforms Ltd", contact: "Alan Foster", email: "alan@sentineluniforms.co.uk", phone: "0121 496 0001", city: "Birmingham", postcode: "B1 1BB", vatNumber: "GB456789012", companyReg: "45678901", vatStatus: "vat_registered", type: "non_labour" as const, selfBilling: "none", bank: "Lloyds", sortCode: "30-00-00", accNum: "45678901" },
    { company: "SecureTech Systems", contact: "Diane Roberts", email: "diane@securetech.co.uk", phone: "0161 234 0001", city: "Manchester", postcode: "M1 1AD", vatNumber: null, companyReg: "56789012", vatStatus: "not_vat_registered", type: "non_labour" as const, selfBilling: "none", bank: "NatWest", sortCode: "60-00-00", accNum: "56789012" },
  ];

  const supplierIds: number[] = [];
  const supplierUserIds: string[] = [];
  for (const s of supplierData) {
    const suppUsername = s.company.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const [suppUser] = await db.insert(users).values({
      tenantId: TENANT_ID,
      username: `supplier_${suppUsername}`,
      email: s.email,
      password: hashedPw,
      firstName: s.contact.split(" ")[0],
      lastName: s.contact.split(" ").slice(1).join(" "),
      role: "supplier",
      phone: s.phone,
    }).returning();
    supplierUserIds.push(suppUser.id);

    const [supplier] = await db.insert(suppliers).values({
      tenantId: TENANT_ID,
      companyName: s.company,
      contactName: s.contact,
      email: s.email,
      phone: s.phone,
      city: s.city,
      postcode: s.postcode,
      vatNumber: s.vatNumber,
      vatStatus: s.vatStatus,
      companyRegNumber: s.companyReg,
      supplierType: s.type,
      status: "approved",
      bankName: s.bank,
      sortCode: s.sortCode,
      accountNumber: s.accNum,
      accountName: s.company,
      selfBillingAgreementStatus: s.selfBilling,
      selfBillingSignatoryName: s.selfBilling === "active" ? s.contact : null,
      selfBillingSignatoryPosition: s.selfBilling === "active" ? "Director" : null,
      selfBillingAcceptedAt: s.selfBilling === "active" ? new Date("2025-01-15") : null,
      selfBillingExpiryDate: s.selfBilling === "active" ? new Date("2027-01-15") : null,
      selfBillingAgreementRef: s.selfBilling === "active" ? `SB-${s.companyReg.slice(0,4)}-2025` : null,
      portalAccessEnabled: true,
      portalEmail: s.email,
      userId: suppUser.id,
      createdBy: ADMIN_USER_ID,
      approvedBy: ADMIN_USER_ID,
      approvedAt: new Date("2025-01-20"),
      submittedAt: new Date("2025-01-10"),
      submittedBy: suppUser.id,
    }).returning();
    supplierIds.push(supplier.id);
    console.log(`  Created supplier: ${s.company}`);
  }

  for (const suppId of supplierIds.slice(0, 3)) {
    await db.insert(rateCards).values({
      tenantId: TENANT_ID,
      supplierId: suppId,
      roleType: "Security Officer",
      hourlyRate: "14.50",
      overtimeRate: "19.00",
      effectiveFrom: "2025-01-01",
      createdBy: ADMIN_USER_ID,
    });
    await db.insert(rateCards).values({
      tenantId: TENANT_ID,
      supplierId: suppId,
      roleType: "Door Supervisor",
      hourlyRate: "16.00",
      overtimeRate: "21.00",
      effectiveFrom: "2025-01-01",
      createdBy: ADMIN_USER_ID,
    });
  }
  console.log("  Created rate cards for suppliers");

  const shiftEntries: any[] = [];
  const statuses = ["completed", "completed", "completed", "completed", "scheduled", "in_progress"] as const;
  const titles = ["Day Shift", "Night Shift", "Event Security", "Station Patrol", "Retail Security", "CCTV Monitoring"];

  for (let day = 1; day <= 28; day++) {
    const dateStr = `2026-02-${String(day).padStart(2, "0")}`;
    const dayOfWeek = new Date(2026, 1, day).getDay();
    if (dayOfWeek === 0) continue;

    for (let s = 0; s < siteIds.length; s++) {
      const empIdx = (day + s) % empIds.length;
      const isNight = s % 3 === 1;
      const isFuture = day > 22;
      const status = isFuture ? "scheduled" : statuses[Math.min(s % statuses.length, 3)];

      shiftEntries.push({
        tenantId: TENANT_ID,
        siteId: siteIds[s],
        employeeId: empIds[empIdx],
        supplierId: s < 3 ? supplierIds[s % 3] : null,
        title: titles[s % titles.length],
        date: dateStr,
        startTime: isNight ? "18:00" : "06:00",
        endTime: isNight ? "06:00" : "18:00",
        breakMinutes: 30,
        status,
        notes: isFuture ? null : `Shift completed normally at ${siteData[s].name}`,
        checkInTime: !isFuture && status === "completed" ? new Date(`2026-02-${String(day).padStart(2, "0")}T${isNight ? "17:55" : "05:55"}:00Z`) : null,
        checkOutTime: !isFuture && status === "completed" ? new Date(`2026-02-${String(day).padStart(2, "0")}T${isNight ? "06:05" : "18:05"}:00Z`) : null,
        supplierApprovalStatus: s < 3 ? (isFuture ? "pending" : "approved") : "pending",
        createdBy: ADMIN_USER_ID,
      });
    }
  }

  const BATCH = 50;
  for (let i = 0; i < shiftEntries.length; i += BATCH) {
    await db.insert(shifts).values(shiftEntries.slice(i, i + BATCH));
  }
  console.log(`  Created ${shiftEntries.length} shifts`);

  const incidentData = [
    { siteIdx: 0, title: "Shoplifter detained", description: "Male shoplifter detained at main entrance attempting to leave with concealed items. Police called and attended within 15 minutes.", severity: "medium" as const, status: "resolved" as const, resolution: "Suspect handed over to Metropolitan Police. Incident report filed with store management." },
    { siteIdx: 1, title: "Suspicious package - false alarm", description: "Unattended bag found in lobby of One Canada Square. Area cordoned off and evacuated per protocol.", severity: "high" as const, status: "closed" as const, resolution: "Package identified as belongings of a visiting contractor. All clear given after 45 minutes." },
    { siteIdx: 4, title: "Crowd surge at event entrance", description: "Large crowd surge at Gate 2 during concert entry. Additional officers deployed to manage flow.", severity: "high" as const, status: "resolved" as const, resolution: "Crowd managed with additional barriers. No injuries reported. Gate management procedures reviewed." },
    { siteIdx: 6, title: "Tailgating at staff entrance", description: "Individual attempted to tailgate through Terminal 5 staff entrance without valid ID. Stopped by security.", severity: "medium" as const, status: "resolved" as const, resolution: "Individual was a new starter without ID badge. Escorted to HR for badge issuance." },
    { siteIdx: 3, title: "Trespasser on platform", description: "Trespasser found on platform 9 after hours. Individual appeared confused/disoriented.", severity: "low" as const, status: "closed" as const, resolution: "Individual was a rough sleeper. BTP attended and individual moved to shelter." },
    { siteIdx: 7, title: "Fire alarm activation", description: "Fire alarm activated in South Stand hospitality area. Full evacuation initiated.", severity: "critical" as const, status: "closed" as const, resolution: "False alarm caused by catering steam. System reset. Catering team briefed on extractor use." },
    { siteIdx: 9, title: "Anti-social behaviour", description: "Group of 4 youths causing disturbance outside flagship store on Regent Street. Intimidating customers.", severity: "medium" as const, status: "investigating" as const },
    { siteIdx: 5, title: "Water leak in car park", description: "Water leak detected in basement car park level 2. Potential slip hazard.", severity: "low" as const, status: "reported" as const },
  ];

  for (const inc of incidentData) {
    await db.insert(incidents).values({
      tenantId: TENANT_ID,
      siteId: siteIds[inc.siteIdx],
      reportedBy: empUserIds[inc.siteIdx % empUserIds.length],
      title: inc.title,
      description: inc.description,
      severity: inc.severity,
      status: inc.status,
      resolution: inc.resolution || null,
      resolvedAt: inc.status === "resolved" || inc.status === "closed" ? new Date("2026-02-20") : null,
    });
  }
  console.log(`  Created ${incidentData.length} incidents`);

  const jobData = [
    { title: "Security Officer - Canary Wharf", description: "We are looking for a reliable SIA-licensed security officer to join our team at Canary Wharf Estate. Full-time position with rotating day/night shifts. Must have valid Door Supervisor licence.", location: "Canary Wharf, London E14", type: "Full-time", salary: "£28,000 - £32,000 per annum", requirements: "Valid SIA Door Supervisor licence, DBS check, Right to work in UK, Excellent communication skills" },
    { title: "CCTV Operator - Control Room", description: "Experienced CCTV operator needed for our central control room. Monitoring multiple sites across London. Training provided on systems.", location: "Central London", type: "Full-time", salary: "£30,000 - £34,000 per annum", requirements: "SIA CCTV licence, Experience with modern surveillance systems, Good attention to detail" },
    { title: "Night Security Officer - Heathrow", description: "Night security officers required for Heathrow Terminal 5. Aviation security experience preferred but not essential. Must be willing to undergo CTC clearance.", location: "Heathrow Airport, Hounslow", type: "Full-time", salary: "£32,000 - £36,000 per annum (inc. night premium)", requirements: "Valid SIA licence, CTC clearable, UK resident 5+ years" },
    { title: "Event Security Steward - Wembley", description: "Event security stewards needed for match days and concerts at Wembley Stadium. Flexible hours, great for those wanting weekend/evening work.", location: "Wembley Stadium, HA9", type: "Part-time", salary: "£14.00 - £17.50 per hour", requirements: "SIA licence (or willing to obtain), Good crowd management skills, Available weekends" },
    { title: "Site Supervisor - Battersea", description: "Experienced site supervisor to manage a team of 6 officers at Battersea Power Station development. Leadership experience essential.", location: "Battersea, London SW11", type: "Full-time", salary: "£35,000 - £40,000 per annum", requirements: "SIA licence, 3+ years supervisory experience, First Aid certificate, Team management skills" },
  ];

  const jobIds: number[] = [];
  for (const j of jobData) {
    const [job] = await db.insert(jobPostings).values({
      tenantId: TENANT_ID,
      title: j.title,
      description: j.description,
      location: j.location,
      employmentType: j.type,
      requirements: j.requirements,
      isActive: true,
      createdBy: ADMIN_USER_ID,
    }).returning();
    jobIds.push(job.id);
  }
  console.log(`  Created ${jobData.length} job postings`);

  const applicantData = [
    { jobIdx: 0, first: "Alex", last: "Turner", email: "alex.turner@gmail.com", phone: "07800111222", status: "screening" as const },
    { jobIdx: 0, first: "Zara", last: "Begum", email: "zara.begum@hotmail.com", phone: "07800222333", status: "interview" as const },
    { jobIdx: 0, first: "Chris", last: "Martin", email: "chris.martin@yahoo.com", phone: "07800333444", status: "applied" as const },
    { jobIdx: 1, first: "Olivia", last: "Chen", email: "olivia.chen@gmail.com", phone: "07800444555", status: "offer" as const },
    { jobIdx: 1, first: "Jake", last: "Robertson", email: "jake.robertson@outlook.com", phone: "07800555666", status: "screening" as const },
    { jobIdx: 2, first: "Nina", last: "Kowalski", email: "nina.k@gmail.com", phone: "07800666777", status: "interview" as const },
    { jobIdx: 3, first: "Lewis", last: "Grant", email: "lewis.grant@hotmail.com", phone: "07800777888", status: "applied" as const },
    { jobIdx: 3, first: "Amara", last: "Diallo", email: "amara.diallo@gmail.com", phone: "07800888999", status: "hired" as const },
    { jobIdx: 4, first: "Peter", last: "Novak", email: "peter.novak@outlook.com", phone: "07800999000", status: "screening" as const },
    { jobIdx: 4, first: "Hannah", last: "Brooks", email: "hannah.brooks@gmail.com", phone: "07800000111", status: "rejected" as const },
  ];

  for (const a of applicantData) {
    await db.insert(applicants).values({
      tenantId: TENANT_ID,
      jobPostingId: jobIds[a.jobIdx],
      firstName: a.first,
      lastName: a.last,
      email: a.email,
      phone: a.phone,
      status: a.status,
    });
  }
  console.log(`  Created ${applicantData.length} applicants`);

  const vettingTypes = ["dbs_check", "sia_verification", "identity_check", "reference_check", "right_to_work"];
  for (let i = 0; i < empIds.length; i++) {
    for (const checkType of vettingTypes) {
      const isPassed = Math.random() > 0.15;
      await db.insert(vettingRecords).values({
        tenantId: TENANT_ID,
        employeeId: empIds[i],
        checkType,
        status: isPassed ? "passed" : (Math.random() > 0.5 ? "in_progress" : "pending"),
        referenceNumber: isPassed ? `VET-${checkType.toUpperCase().slice(0,3)}-${String(1000 + i).slice(0,4)}` : null,
        requestedDate: "2025-01-15",
        completedDate: isPassed ? "2025-02-01" : null,
        expiryDate: isPassed && checkType !== "identity_check" ? "2028-02-01" : null,
        result: isPassed ? "Clear" : null,
        conductedBy: ADMIN_USER_ID,
      });
    }
  }
  console.log(`  Created vetting records for ${empIds.length} employees`);

  for (let suppIdx = 0; suppIdx < 3; suppIdx++) {
    const [inv] = await db.insert(invoices).values({
      tenantId: TENANT_ID,
      supplierId: supplierIds[suppIdx],
      invoiceNumber: `SB-2026-${String(suppIdx + 1).padStart(3, "0")}`,
      invoiceType: "self_billed",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      subtotal: "4500.00",
      vatRate: "20",
      vatAmount: "900.00",
      totalAmount: "5400.00",
      status: suppIdx === 0 ? "paid" : suppIdx === 1 ? "approved" : "pending",
      dueDate: "2026-02-28",
      issuedAt: new Date("2026-02-01"),
      createdBy: ADMIN_USER_ID,
    }).returning();

    await db.insert(invoiceLineItems).values([
      { invoiceId: inv.id, description: "Security Officer - Day Shifts (Jan 2026)", hours: "160.00", rate: "14.50", subtotal: "2320.00", vatRate: "20", vatAmount: "464.00", lineTotal: "2784.00" },
      { invoiceId: inv.id, description: "Security Officer - Night Shifts (Jan 2026)", hours: "80.00", rate: "16.00", subtotal: "1280.00", vatRate: "20", vatAmount: "256.00", lineTotal: "1536.00" },
      { invoiceId: inv.id, description: "Door Supervisor - Day Shifts (Jan 2026)", hours: "56.25", rate: "16.00", subtotal: "900.00", vatRate: "20", vatAmount: "180.00", lineTotal: "1080.00" },
    ]);
  }
  console.log("  Created 3 invoices with line items");

  await db.insert(auditLogs).values([
    { tenantId: TENANT_ID, userId: ADMIN_USER_ID, action: "login", entityType: "user", entityId: ADMIN_USER_ID, details: { ip: "192.168.1.100" } },
    { tenantId: TENANT_ID, userId: ADMIN_USER_ID, action: "create", entityType: "employee", entityId: String(empIds[0]), details: { name: "Ahmed Khan" } },
    { tenantId: TENANT_ID, userId: ADMIN_USER_ID, action: "approve", entityType: "supplier", entityId: String(supplierIds[0]), details: { company: "Delta Force Security" } },
    { tenantId: TENANT_ID, userId: ADMIN_USER_ID, action: "create", entityType: "shift", details: { count: shiftEntries.length } },
    { tenantId: TENANT_ID, userId: ADMIN_USER_ID, action: "generate_invoice", entityType: "invoice", details: { supplier: "Delta Force Security", period: "Jan 2026" } },
  ]);
  console.log("  Created audit log entries");

  console.log("\n=== Seed Complete ===");
  console.log(`Users: ${roleUsers.length + employeeData.length + supplierData.length} created`);
  console.log(`Employees: ${employeeData.length}`);
  console.log(`Sites: ${siteData.length}`);
  console.log(`Suppliers: ${supplierData.length}`);
  console.log(`Shifts: ${shiftEntries.length}`);
  console.log(`Incidents: ${incidentData.length}`);
  console.log(`Job Postings: ${jobData.length}`);
  console.log(`Applicants: ${applicantData.length}`);
  console.log(`\nAll passwords: Password123!`);
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
