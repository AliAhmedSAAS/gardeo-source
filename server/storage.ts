import {
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type Employee, type InsertEmployee,
  type OnboardingRecord, type InsertOnboardingRecord,
  type EmergencyContact, type InsertEmergencyContact,
  type BankDetail, type InsertBankDetail,
  type PendingBankChange, type InsertPendingBankChange,
  type Document, type InsertDocument,
  type VettingRecord, type InsertVettingRecord,
  type AuditLog, type InsertAuditLog,
  type Reference, type InsertReference,
  type EmploymentHistory, type InsertEmploymentHistory,
  type Site, type InsertSite,
  type Shift, type InsertShift,
  type Incident, type InsertIncident,
  type Supplier, type InsertSupplier,
  type SupplierDocument, type InsertSupplierDocument,
  type SupplierDocumentAudit, type InsertSupplierDocumentAudit,
  type EmployeeInvitation, type InsertEmployeeInvitation,
  type SupplierInvitation, type InsertSupplierInvitation,
  type SupplierPendingChange, type InsertSupplierPendingChange,
  type SupplierLoginActivity, type InsertSupplierLoginActivity,
  type Notification, type InsertNotification,
  type SupplierFieldRequest, type InsertSupplierFieldRequest,
  type SupplierProfileChangeLog, type InsertSupplierProfileChangeLog,
  type PasswordResetToken, type InsertPasswordResetToken,
  type Invoice, type InsertInvoice,
  type InvoiceLineItem, type InsertInvoiceLineItem,
  type RateCard, type InsertRateCard,
  type Dispute, type InsertDispute,
  type DisputeMessage, type InsertDisputeMessage,
  type CreditNote, type InsertCreditNote,
  type DebitNote, type InsertDebitNote,
  type CreditNoteLineItem, type InsertCreditNoteLineItem,
  type DebitNoteLineItem, type InsertDebitNoteLineItem,
  type JobPosting, type InsertJobPosting,
  type Applicant, type InsertApplicant,
  type SupplierPolicy, type InsertSupplierPolicy,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type TenantInvitation, type InsertTenantInvitation,
  type DataConsent, type InsertDataConsent,
  type DataErasureRequest, type InsertDataErasureRequest,
  type AiDecision, type InsertAiDecision,
  type AiInsight, type InsertAiInsight,
  type Channel, type InsertChannel,
  type ChannelMember, type InsertChannelMember,
  type Message, type InsertMessage,
  type Broadcast, type InsertBroadcast,
  type BroadcastRead, type InsertBroadcastRead,
  type RolePermission, type InsertRolePermission,
  type PayrollRun, type InsertPayrollRun,
  type PayrollRunItem, type InsertPayrollRunItem,
  type SupplierAuditEvent, type InsertSupplierAuditEvent,
  type VatVerification, type InsertVatVerification,
  type RateCardHistory, type InsertRateCardHistory,
  type SyncConfiguration, type InsertSyncConfiguration,
  type SyncLog, type InsertSyncLog,
  users, tenants, employees, onboardingRecords,
  emergencyContacts, bankDetails, pendingBankChanges, documents,
  vettingRecords, auditLogs, references, employmentHistory,
  sites, shifts, incidents, suppliers,
  supplierDocuments, supplierDocumentAudit,
  employeeInvitations, supplierInvitations, supplierPendingChanges, supplierLoginActivity,
  notifications, supplierFieldRequests, supplierProfileChangeLog,
  passwordResetTokens,
  invoices, invoiceLineItems, rateCards,
  disputes, disputeMessages, creditNotes, debitNotes, creditNoteLineItems, debitNoteLineItems,
  jobPostings, applicants,
  supplierPolicies,
  subscriptionPlans, tenantInvitations,
  dataConsents, dataErasureRequests,
  aiDecisions, aiInsights,
  channels, channelMembers, messages, broadcasts, broadcastReads, pushSubscriptions,
  rolePermissions,
  payrollRuns, payrollRunItems,
  supplierAuditEvents, vatVerifications, rateCardHistory,
  type DocumentTemplate, type InsertDocumentTemplate,
  documentTemplates,
  type SupplierAgreementArchive, type InsertSupplierAgreementArchive,
  supplierAgreementArchives,
  syncConfigurations, syncLogs,
  type InvoiceNumberAuditLog, type InsertInvoiceNumberAuditLog,
  invoiceNumberAuditLog,
  type EmployeeAvailability, type InsertEmployeeAvailability,
  employeeAvailability,
  type ShiftTemplate, type InsertShiftTemplate,
  shiftTemplates,
  type OpsCheckItem, type InsertOpsCheckItem,
  opsCheckItems,
  type OpsCheck, type InsertOpsCheck,
  opsChecks,
  type TimeOffRequest, type InsertTimeOffRequest,
  timeOffRequests,
  mobilePushTokens,
  type AiLearningEvent, type InsertAiLearningEvent,
  aiLearningEvents,
  type InboxEmail, type InsertInboxEmail,
  inboxEmails,
  type EmailClassification, type InsertEmailClassification,
  emailClassifications,
  type ProposedAction, type InsertProposedAction,
  proposedActions,
  type EmailAutoApproveSetting, type InsertEmailAutoApproveSetting,
  emailAutoApproveSettings,
  type TenantEmailConnection, type InsertTenantEmailConnection,
  tenantEmailConnections,
  type TenantEmailSettings, type InsertTenantEmailSettings,
  tenantEmailSettings,
  type TenantOfficerType, type InsertTenantOfficerType,
  tenantOfficerTypes,
  type TenantXeroConnection, type InsertTenantXeroConnection,
  tenantXeroConnections,
  type XeroSyncRecord, type InsertXeroSyncRecord,
  xeroSyncRecords,
  type EmployeeImmigration, type InsertEmployeeImmigration,
  employeeImmigration,
  type LeaveEntitlement, type InsertLeaveEntitlement,
  leaveEntitlements,
  type ProbationRecord, type InsertProbationRecord,
  probationRecords,
  type HrCase, type InsertHrCase,
  type HrCaseEvent, type InsertHrCaseEvent,
  type HrCaseDocument, type InsertHrCaseDocument,
  hrCases, hrCaseEvents, hrCaseDocuments,
  type AbsenceRecord, type InsertAbsenceRecord,
  absenceRecords,
  type TrainingRecord, type InsertTrainingRecord,
  trainingRecords,
} from "@shared/schema";
import { DEFAULT_OFFICER_TYPES } from "@shared/defaultOfficerTypes";
import { db, pool } from "./db";
import { eq, and, desc, gte, lte, isNotNull, sql, inArray, asc } from "drizzle-orm";

async function nextCode(prefix: string, table: string, column: string, tenantId?: number | null): Promise<string> {
  let rows;
  if (tenantId) {
    const result = await pool.query(
      `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL AND tenant_id = $1 ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );
    rows = result.rows;
  } else {
    const result = await pool.query(
      `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL ORDER BY id DESC LIMIT 1`
    );
    rows = result.rows;
  }
  let n = 1;
  if (rows.length > 0 && rows[0][column]) {
    const m = rows[0][column].match(/(\d+)$/);
    if (m) n = parseInt(m[1]) + 1;
  }
  return `${prefix}${n.toString().padStart(5, "0")}`;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string, tenantId?: number): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId?: number): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  getUsersByUsername(username: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getTenant(id: number): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined>;

  getEmployee(id: number, tenantId?: number): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;

  getOnboardingRecord(id: number): Promise<OnboardingRecord | undefined>;
  getOnboardingByUserId(userId: string): Promise<OnboardingRecord | undefined>;
  getOnboardingsByTenant(tenantId: number): Promise<OnboardingRecord[]>;
  createOnboarding(record: InsertOnboardingRecord): Promise<OnboardingRecord>;
  updateOnboarding(id: number, data: Partial<InsertOnboardingRecord>): Promise<OnboardingRecord | undefined>;

  getEmergencyContacts(employeeId: number): Promise<EmergencyContact[]>;
  createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact>;
  updateEmergencyContact(id: number, data: Partial<InsertEmergencyContact>): Promise<EmergencyContact | undefined>;
  deleteEmergencyContact(id: number): Promise<void>;

  getBankDetails(employeeId: number): Promise<BankDetail | undefined>;
  createBankDetails(details: InsertBankDetail): Promise<BankDetail>;
  updateBankDetails(id: number, data: Partial<InsertBankDetail>): Promise<BankDetail | undefined>;

  createPendingBankChange(data: InsertPendingBankChange): Promise<PendingBankChange>;
  getPendingBankChange(id: number): Promise<PendingBankChange | undefined>;
  getPendingBankChangesForEmployee(employeeId: number): Promise<PendingBankChange[]>;
  getAllPendingBankChanges(tenantId?: number): Promise<PendingBankChange[]>;
  approvePendingBankChange(id: number, reviewedByUserId: string, note?: string): Promise<PendingBankChange | undefined>;
  rejectPendingBankChange(id: number, reviewedByUserId: string, note?: string): Promise<PendingBankChange | undefined>;

  getDocuments(employeeId: number): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  getVettingRecords(employeeId: number): Promise<VettingRecord[]>;
  getVettingRecordsByTenant(tenantId: number): Promise<VettingRecord[]>;
  createVettingRecord(record: InsertVettingRecord): Promise<VettingRecord>;
  updateVettingRecord(id: number, data: Partial<InsertVettingRecord>): Promise<VettingRecord | undefined>;

  getReferences(employeeId: number): Promise<Reference[]>;
  createReference(ref: InsertReference): Promise<Reference>;
  updateReference(id: number, data: Partial<InsertReference>): Promise<Reference | undefined>;
  deleteReference(id: number): Promise<void>;

  getEmploymentHistory(employeeId: number): Promise<EmploymentHistory[]>;
  createEmploymentHistory(history: InsertEmploymentHistory): Promise<EmploymentHistory>;
  updateEmploymentHistory(id: number, data: Partial<InsertEmploymentHistory>): Promise<EmploymentHistory | undefined>;
  deleteEmploymentHistory(id: number): Promise<void>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(tenantId: number): Promise<AuditLog[]>;

  getEmployeesByTenant(tenantId: number): Promise<Employee[]>;
  getEmployeesBySupplier(supplierId: number): Promise<Employee[]>;
  getUsersByTenant(tenantId: number): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getSite(id: number, tenantId?: number): Promise<Site | undefined>;
  getSitesByTenant(tenantId: number): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: number): Promise<void>;

  getShift(id: number, tenantId?: number): Promise<Shift | undefined>;
  getShiftsByTenant(tenantId: number): Promise<Shift[]>;
  getShiftsBySupplierId(supplierId: number): Promise<Shift[]>;
  getShiftsByEmployee(employeeId: number): Promise<Shift[]>;
  getShiftsByDate(tenantId: number, date: string): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  createShiftsBulk(shifts: InsertShift[]): Promise<Shift[]>;
  updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<void>;

  getIncident(id: number, tenantId?: number): Promise<Incident | undefined>;
  getIncidentsByTenant(tenantId: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: number, data: Partial<InsertIncident>): Promise<Incident | undefined>;

  getSupplier(id: number): Promise<Supplier | undefined>;
  getSupplierByUserId(userId: string): Promise<Supplier | undefined>;
  getSuppliersByTenant(tenantId: number): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;

  deleteSupplier(id: number): Promise<void>;
  getSupplierDocuments(supplierId: number): Promise<SupplierDocument[]>;
  getSupplierDocument(id: number): Promise<SupplierDocument | undefined>;
  createSupplierDocument(doc: InsertSupplierDocument): Promise<SupplierDocument>;
  updateSupplierDocument(id: number, data: Partial<Pick<SupplierDocument, "status" | "rejectionReason" | "reviewedBy" | "reviewedAt">>): Promise<SupplierDocument | undefined>;
  deleteSupplierDocument(id: number): Promise<void>;
  createSupplierDocumentAudit(entry: InsertSupplierDocumentAudit): Promise<SupplierDocumentAudit>;
  getSupplierDocumentAudit(documentId: number): Promise<SupplierDocumentAudit[]>;

  createEmployeeInvitation(invitation: InsertEmployeeInvitation): Promise<EmployeeInvitation>;
  getEmployeeInvitationByToken(token: string): Promise<EmployeeInvitation | undefined>;
  getLatestEmployeeInvitation(employeeId: number): Promise<EmployeeInvitation | undefined>;
  hasEmployeeAcceptedAnyInvitation(employeeId: number): Promise<boolean>;
  updateEmployeeInvitation(id: number, data: Partial<InsertEmployeeInvitation>): Promise<EmployeeInvitation | undefined>;

  createSupplierInvitation(invitation: InsertSupplierInvitation): Promise<SupplierInvitation>;
  getSupplierInvitationByToken(token: string): Promise<SupplierInvitation | undefined>;
  getLatestSupplierInvitation(supplierId: number): Promise<SupplierInvitation | undefined>;
  hasSupplierAcceptedAnyInvitation(supplierId: number): Promise<boolean>;
  updateSupplierInvitation(id: number, data: Partial<InsertSupplierInvitation>): Promise<SupplierInvitation | undefined>;

  createSupplierPendingChange(change: InsertSupplierPendingChange): Promise<SupplierPendingChange>;
  getSupplierPendingChanges(supplierId: number): Promise<SupplierPendingChange[]>;
  getSupplierPendingChange(id: number): Promise<SupplierPendingChange | undefined>;
  updateSupplierPendingChange(id: number, data: Partial<InsertSupplierPendingChange>): Promise<SupplierPendingChange | undefined>;

  createSupplierLoginActivity(activity: InsertSupplierLoginActivity): Promise<SupplierLoginActivity>;
  getSupplierLoginActivityBySupplierId(supplierId: number): Promise<SupplierLoginActivity[]>;
  getSupplierLoginCount(supplierId: number): Promise<number>;
  getSupplierLastLogin(supplierId: number): Promise<SupplierLoginActivity | undefined>;

  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsForUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  createSupplierFieldRequest(request: InsertSupplierFieldRequest): Promise<SupplierFieldRequest>;
  getSupplierFieldRequests(supplierId: number, options?: { pendingOnly?: boolean }): Promise<SupplierFieldRequest[]>;
  updateSupplierFieldRequest(id: number, data: Partial<Pick<SupplierFieldRequest, "completedAt">>): Promise<SupplierFieldRequest | undefined>;

  createSupplierProfileChangeLog(entry: InsertSupplierProfileChangeLog): Promise<SupplierProfileChangeLog>;
  getSupplierProfileChangeLog(supplierId: number, limit?: number): Promise<SupplierProfileChangeLog[]>;

  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetTokensByUserId(userId: string): Promise<void>;

  getInvoice(id: number, tenantId?: number): Promise<Invoice | undefined>;
  getInvoicesByTenant(tenantId: number): Promise<Invoice[]>;
  getInvoicesBySupplierId(supplierId: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]>;
  getInvoiceLineItemsByTenant(tenantId: number): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;

  getRateCardsBySupplier(supplierId: number): Promise<RateCard[]>;
  getRateCardsByTenant(tenantId: number): Promise<RateCard[]>;
  getRateCard(id: number): Promise<RateCard | undefined>;
  createRateCard(rateCard: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: number, data: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: number): Promise<void>;

  getDispute(id: number): Promise<Dispute | undefined>;
  getDisputesByTenant(tenantId: number): Promise<Dispute[]>;
  getDisputesBySupplier(supplierId: number): Promise<Dispute[]>;
  getDisputeByShift(shiftId: number): Promise<Dispute | undefined>;
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  updateDispute(id: number, data: Partial<InsertDispute>): Promise<Dispute | undefined>;

  getDisputeMessages(disputeId: number): Promise<DisputeMessage[]>;
  createDisputeMessage(message: InsertDisputeMessage): Promise<DisputeMessage>;

  getCreditNote(id: number): Promise<CreditNote | undefined>;
  getCreditNotesByTenant(tenantId: number): Promise<CreditNote[]>;
  createCreditNote(note: InsertCreditNote): Promise<CreditNote>;
  updateCreditNote(id: number, data: Partial<InsertCreditNote>): Promise<CreditNote | undefined>;

  getDebitNote(id: number): Promise<DebitNote | undefined>;
  getDebitNotesByTenant(tenantId: number): Promise<DebitNote[]>;
  createDebitNote(note: InsertDebitNote): Promise<DebitNote>;
  updateDebitNote(id: number, data: Partial<InsertDebitNote>): Promise<DebitNote | undefined>;

  getCreditNoteLineItems(creditNoteId: number): Promise<CreditNoteLineItem[]>;
  createCreditNoteLineItem(item: InsertCreditNoteLineItem): Promise<CreditNoteLineItem>;
  getDebitNoteLineItems(debitNoteId: number): Promise<DebitNoteLineItem[]>;
  createDebitNoteLineItem(item: InsertDebitNoteLineItem): Promise<DebitNoteLineItem>;

  getJobPosting(id: number): Promise<JobPosting | undefined>;
  getJobPostingsByTenant(tenantId: number): Promise<JobPosting[]>;
  createJobPosting(posting: InsertJobPosting): Promise<JobPosting>;
  updateJobPosting(id: number, data: Partial<InsertJobPosting>): Promise<JobPosting | undefined>;

  getApplicant(id: number): Promise<Applicant | undefined>;
  getApplicantsByJob(jobPostingId: number): Promise<Applicant[]>;
  getApplicantsByTenant(tenantId: number): Promise<Applicant[]>;
  createApplicant(applicant: InsertApplicant): Promise<Applicant>;
  updateApplicant(id: number, data: Partial<InsertApplicant>): Promise<Applicant | undefined>;

  getSupplierPolicies(supplierId: number): Promise<SupplierPolicy[]>;
  getSupplierPolicy(id: number): Promise<SupplierPolicy | undefined>;
  createSupplierPolicy(policy: InsertSupplierPolicy): Promise<SupplierPolicy>;
  updateSupplierPolicy(id: number, data: Partial<Pick<SupplierPolicy, "status" | "rejectionReason" | "reviewedBy" | "reviewedAt">>): Promise<SupplierPolicy | undefined>;

  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;

  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;

  createTenantInvitation(invitation: InsertTenantInvitation): Promise<TenantInvitation>;
  getTenantInvitationsByTenant(tenantId: number): Promise<TenantInvitation[]>;
  getTenantInvitationByToken(token: string): Promise<TenantInvitation | undefined>;
  updateTenantInvitation(id: number, data: Partial<InsertTenantInvitation>): Promise<TenantInvitation | undefined>;

  getDataConsents(userId: string): Promise<DataConsent[]>;
  createDataConsent(consent: InsertDataConsent): Promise<DataConsent>;
  updateDataConsent(id: number, data: Partial<InsertDataConsent>): Promise<DataConsent | undefined>;

  getDataErasureRequests(tenantId: number): Promise<DataErasureRequest[]>;
  getDataErasureRequest(id: number): Promise<DataErasureRequest | undefined>;
  getDataErasureRequestByUser(userId: string): Promise<DataErasureRequest | undefined>;
  createDataErasureRequest(request: InsertDataErasureRequest): Promise<DataErasureRequest>;
  updateDataErasureRequest(id: number, data: Partial<InsertDataErasureRequest>): Promise<DataErasureRequest | undefined>;

  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByTenant(tenantId: number): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined>;

  getChannelMembers(channelId: number): Promise<ChannelMember[]>;
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  removeChannelMember(channelId: number, userId: string): Promise<void>;
  updateChannelMemberLastRead(channelId: number, userId: string): Promise<void>;
  savePushSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void>;
  getPushSubscriptions(userId: string): Promise<any[]>;
  deletePushSubscription(endpoint: string): Promise<void>;
  deletePushSubscriptionForUser(endpoint: string, userId: string): Promise<void>;
  getUserChannels(userId: string, tenantId: number): Promise<Channel[]>;

  getMessages(channelId: number, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getBroadcastsByTenant(tenantId: number, limit?: number): Promise<Broadcast[]>;
  createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast>;
  getBroadcastReads(broadcastId: number): Promise<BroadcastRead[]>;
  createBroadcastRead(read: InsertBroadcastRead): Promise<BroadcastRead>;
  hasUserReadBroadcast(broadcastId: number, userId: string): Promise<boolean>;

  getRolePermissions(): Promise<RolePermission[]>;
  getRolePermissionsByRole(role: string): Promise<RolePermission[]>;
  setRolePermission(role: string, permissionKey: string, enabled: boolean): Promise<RolePermission>;
  bulkSetRolePermissions(permissions: { role: string; permissionKey: string; enabled: boolean }[]): Promise<void>;

  createSupplierAuditEvent(event: InsertSupplierAuditEvent): Promise<SupplierAuditEvent>;
  deleteSupplierAuditEventsBySupplierId(supplierId: number): Promise<void>;
  getSupplierAuditEvents(supplierId: number, options?: { eventType?: string; limit?: number; offset?: number }): Promise<SupplierAuditEvent[]>;
  getSupplierAuditEventsByTenant(tenantId: number, options?: { supplierId?: number; eventType?: string; limit?: number }): Promise<SupplierAuditEvent[]>;
  getInvoiceAuditTrail(invoiceId: number): Promise<SupplierAuditEvent[]>;

  createVatVerification(verification: InsertVatVerification): Promise<VatVerification>;
  getVatVerifications(supplierId: number): Promise<VatVerification[]>;

  createRateCardHistory(history: InsertRateCardHistory): Promise<RateCardHistory>;
  getRateCardHistoryBySupplier(supplierId: number): Promise<RateCardHistory[]>;

  getPayrollPendingShifts(tenantId: number): Promise<Shift[]>;
  approveShiftPayroll(shiftId: number, approvedBy: string): Promise<Shift | undefined>;
  rejectShiftPayroll(shiftId: number, reason: string): Promise<Shift | undefined>;
  createPayrollRun(run: InsertPayrollRun): Promise<PayrollRun>;
  getPayrollRuns(tenantId: number): Promise<PayrollRun[]>;
  getPayrollRun(id: number): Promise<PayrollRun | undefined>;
  updatePayrollRun(id: number, data: Partial<InsertPayrollRun>): Promise<PayrollRun | undefined>;
  getPayrollRunItems(payrollRunId: number): Promise<PayrollRunItem[]>;
  createPayrollRunItem(item: InsertPayrollRunItem): Promise<PayrollRunItem>;
  getEmployeePayHistory(employeeId: number): Promise<PayrollRunItem[]>;
  getApprovedShiftsForPayroll(tenantId: number, periodStart: string, periodEnd: string): Promise<Shift[]>;

  getDocumentTemplatesByTenant(tenantId: number, documentType?: string): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: number): Promise<DocumentTemplate | undefined>;
  getDefaultTemplate(tenantId: number, documentType: string): Promise<DocumentTemplate | undefined>;
  createDocumentTemplate(data: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: number, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined>;
  deleteDocumentTemplate(id: number): Promise<void>;
  setDefaultTemplate(tenantId: number, documentType: string, templateId: number): Promise<void>;

  createAgreementArchive(data: InsertSupplierAgreementArchive): Promise<SupplierAgreementArchive>;
  getAgreementArchives(supplierId: number): Promise<SupplierAgreementArchive[]>;
  getAgreementArchive(id: number): Promise<SupplierAgreementArchive | undefined>;

  getSyncConfigurations(tenantId: number): Promise<SyncConfiguration[]>;
  getSyncConfiguration(id: number): Promise<SyncConfiguration | undefined>;
  createSyncConfiguration(data: InsertSyncConfiguration): Promise<SyncConfiguration>;
  updateSyncConfiguration(id: number, data: Partial<InsertSyncConfiguration>): Promise<SyncConfiguration | undefined>;
  deleteSyncConfiguration(id: number): Promise<void>;

  getSyncLogs(tenantId: number, limit?: number): Promise<SyncLog[]>;
  getSyncLog(id: number): Promise<SyncLog | undefined>;
  createSyncLog(data: InsertSyncLog): Promise<SyncLog>;
  updateSyncLog(id: number, data: Partial<InsertSyncLog>): Promise<SyncLog | undefined>;

  createInvoiceNumberAuditLog(entry: InsertInvoiceNumberAuditLog): Promise<InvoiceNumberAuditLog>;
  getInvoiceNumberAuditLogsByTenant(tenantId: number): Promise<InvoiceNumberAuditLog[]>;
  getInvoiceNumberAuditLogByOldNumber(tenantId: number, oldNumber: string): Promise<InvoiceNumberAuditLog | undefined>;
  getMaxInvoiceSequence(tenantId: number, seriesPrefix: string): Promise<number>;

  getEmployeeAvailability(employeeId: number): Promise<EmployeeAvailability[]>;
  getAvailabilityByTenant(tenantId: number): Promise<EmployeeAvailability[]>;
  upsertEmployeeAvailability(data: InsertEmployeeAvailability): Promise<EmployeeAvailability>;
  deleteEmployeeAvailabilityDay(employeeId: number, dayOfWeek: number): Promise<void>;

  getShiftTemplates(tenantId: number): Promise<ShiftTemplate[]>;
  getShiftTemplate(id: number, tenantId?: number): Promise<ShiftTemplate | undefined>;
  createShiftTemplate(data: InsertShiftTemplate): Promise<ShiftTemplate>;
  updateShiftTemplate(id: number, data: Partial<InsertShiftTemplate>): Promise<ShiftTemplate | undefined>;
  deleteShiftTemplate(id: number): Promise<void>;

  getOpsCheckItems(tenantId: number): Promise<OpsCheckItem[]>;
  createOpsCheckItem(data: InsertOpsCheckItem): Promise<OpsCheckItem>;
  createOpsCheck(data: InsertOpsCheck): Promise<OpsCheck>;
  getOpsChecksForShift(shiftId: number): Promise<OpsCheck[]>;

  createTimeOffRequest(data: InsertTimeOffRequest): Promise<TimeOffRequest>;
  getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined>;
  getTimeOffRequestsByEmployee(employeeId: number): Promise<TimeOffRequest[]>;
  getTimeOffRequestsByTenant(tenantId: number, status?: string): Promise<TimeOffRequest[]>;
  approveTimeOffRequest(id: number, reviewedByUserId: string, note?: string): Promise<TimeOffRequest | undefined>;
  rejectTimeOffRequest(id: number, reviewedByUserId: string, note?: string): Promise<TimeOffRequest | undefined>;
  cancelTimeOffRequest(id: number): Promise<TimeOffRequest | undefined>;
  getApprovedTimeOffForDateRange(tenantId: number, startDate: string, endDate: string): Promise<TimeOffRequest[]>;

  saveMobilePushToken(userId: string, token: string, platform?: string): Promise<void>;
  getIncidentsByUser(userId: string): Promise<Incident[]>;

  createAiLearningEvent(event: InsertAiLearningEvent): Promise<AiLearningEvent>;
  updateAiLearningEvent(id: number, data: Partial<InsertAiLearningEvent>): Promise<AiLearningEvent | undefined>;
  getAiLearningEvents(tenantId: number, domain?: string, limit?: number): Promise<AiLearningEvent[]>;
  getAiLearningEventsByBatch(batchId: string): Promise<AiLearningEvent[]>;

  createInboxEmail(email: InsertInboxEmail): Promise<InboxEmail>;
  getInboxEmails(tenantId: number, limit?: number): Promise<InboxEmail[]>;
  getInboxEmail(id: number): Promise<InboxEmail | undefined>;
  updateInboxEmail(id: number, data: Partial<InsertInboxEmail>): Promise<InboxEmail | undefined>;
  getInboxEmailByOutlookId(outlookMessageId: string, tenantId: number): Promise<InboxEmail | undefined>;

  createEmailClassification(classification: InsertEmailClassification): Promise<EmailClassification>;
  getEmailClassification(emailId: number): Promise<EmailClassification | undefined>;
  getEmailClassificationsByTenant(tenantId: number, limit?: number): Promise<EmailClassification[]>;

  createProposedAction(action: InsertProposedAction): Promise<ProposedAction>;
  getProposedActions(tenantId: number, status?: string, limit?: number): Promise<ProposedAction[]>;
  getProposedActionsByEmail(emailId: number): Promise<ProposedAction[]>;
  getProposedAction(id: number): Promise<ProposedAction | undefined>;
  updateProposedAction(id: number, data: Partial<InsertProposedAction>): Promise<ProposedAction | undefined>;

  getEmailAutoApproveSettings(tenantId: number): Promise<EmailAutoApproveSetting[]>;
  upsertEmailAutoApproveSetting(tenantId: number, actionType: string, enabled: boolean, updatedBy: string): Promise<EmailAutoApproveSetting>;

  getTenantEmailConnection(tenantId: number): Promise<TenantEmailConnection | undefined>;
  upsertTenantEmailConnection(tenantId: number, data: Partial<InsertTenantEmailConnection>): Promise<TenantEmailConnection>;
  deleteTenantEmailConnection(tenantId: number): Promise<void>;
  getAllActiveEmailConnections(): Promise<TenantEmailConnection[]>;
  getTenantEmailSettings(tenantId: number): Promise<TenantEmailSettings | undefined>;
  upsertTenantEmailSettings(tenantId: number, data: Partial<InsertTenantEmailSettings>): Promise<TenantEmailSettings>;

  getTenantOfficerTypes(tenantId: number): Promise<TenantOfficerType[]>;
  ensureDefaultOfficerTypes(tenantId: number): Promise<TenantOfficerType[]>;
  createTenantOfficerType(tenantId: number, name: string): Promise<TenantOfficerType>;
  deleteTenantOfficerType(tenantId: number, id: number): Promise<boolean>;

  backfillDefaultOfficerTypesForAllTenants(): Promise<void>;

  getEmployeeImmigration(employeeId: number): Promise<EmployeeImmigration | undefined>;
  upsertEmployeeImmigration(employeeId: number, data: Partial<InsertEmployeeImmigration>): Promise<EmployeeImmigration>;

  getLeaveEntitlement(employeeId: number, year: number): Promise<LeaveEntitlement | undefined>;
  getLeaveEntitlementsByTenant(tenantId: number, year: number): Promise<LeaveEntitlement[]>;
  upsertLeaveEntitlement(data: InsertLeaveEntitlement): Promise<LeaveEntitlement>;
  getLeaveBalance(employeeId: number, tenantId: number, year: number): Promise<{ entitlement: number; carriedForward: number; adjustments: number; used: number; remaining: number }>;
  bulkYearEndCarryForward(tenantId: number, fromYear: number, capDays: number): Promise<{ processed: number; errors: number }>;

  getProbationRecordsByTenant(tenantId: number): Promise<ProbationRecord[]>;
  getProbationRecordByEmployee(employeeId: number, tenantId: number): Promise<ProbationRecord | undefined>;
  createProbationRecord(data: InsertProbationRecord): Promise<ProbationRecord>;
  updateProbationRecord(id: number, tenantId: number, data: Partial<InsertProbationRecord>): Promise<ProbationRecord | undefined>;
  getProbationsDueThisMonth(tenantId: number): Promise<ProbationRecord[]>;

  getHrCases(tenantId: number, filters?: { employeeId?: number; status?: string; caseType?: string }): Promise<HrCase[]>;
  getHrCase(id: number, tenantId?: number): Promise<HrCase | undefined>;
  createHrCase(data: InsertHrCase): Promise<HrCase>;
  updateHrCase(id: number, data: Partial<InsertHrCase>): Promise<HrCase | undefined>;
  deleteHrCase(id: number): Promise<void>;
  getHrCaseEvents(caseId: number): Promise<HrCaseEvent[]>;
  createHrCaseEvent(data: InsertHrCaseEvent): Promise<HrCaseEvent>;
  updateHrCaseEvent(id: number, caseId: number, notes: string): Promise<HrCaseEvent | undefined>;
  deleteHrCaseEvent(id: number, caseId: number): Promise<void>;
  getHrCaseDocuments(caseId: number): Promise<HrCaseDocument[]>;
  getHrCaseDocument(id: number): Promise<HrCaseDocument | undefined>;
  createHrCaseDocument(data: InsertHrCaseDocument): Promise<HrCaseDocument>;
  deleteHrCaseDocument(id: number, caseId: number): Promise<void>;
  getAbsencesByTenant(tenantId: number, filters?: { employeeId?: number; status?: string; absenceType?: string }): Promise<AbsenceRecord[]>;
  createAbsenceRecord(data: InsertAbsenceRecord): Promise<AbsenceRecord>;
  updateAbsenceRecord(id: number, tenantId: number, data: Partial<InsertAbsenceRecord>): Promise<AbsenceRecord | undefined>;
  getAbsencesByEmployee(employeeId: number): Promise<AbsenceRecord[]>;
  getBradfordFactor(employeeId: number): Promise<{ score: number; spells: number; totalDays: number; rating: "green" | "amber" | "red" }>;

  getTrainingRecordsByEmployee(employeeId: number): Promise<TrainingRecord[]>;
  getTrainingRecordsByEmployeeForTenant(employeeId: number, tenantId: number): Promise<TrainingRecord[]>;
  getTrainingRecordsByTenant(tenantId: number): Promise<TrainingRecord[]>;
  getTrainingRecord(id: number): Promise<TrainingRecord | undefined>;
  createTrainingRecord(data: InsertTrainingRecord): Promise<TrainingRecord>;
  updateTrainingRecord(id: number, data: Partial<InsertTrainingRecord>): Promise<TrainingRecord | undefined>;
  deleteTrainingRecord(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string, tenantId?: number): Promise<User | undefined> {
    if (tenantId !== undefined) {
      const [user] = await db.select().from(users).where(and(eq(users.username, username), eq(users.tenantId, tenantId)));
      return user;
    }
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string, tenantId?: number): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    if (tenantId !== undefined) {
      const [user] = await db.select().from(users).where(and(sql`lower(${users.email}) = ${normalized}`, eq(users.tenantId, tenantId)));
      return user;
    }
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`);
    return user;
  }

  async getUsersByEmail(email: string): Promise<User[]> {
    const normalized = email.trim().toLowerCase();
    return db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`);
  }

  async getUsersByUsername(username: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.username, username));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    await this.ensureDefaultOfficerTypes(created.id);
    return created;
  }

  async updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async getEmployee(id: number, tenantId?: number): Promise<Employee | undefined> {
    const conditions = [eq(employees.id, id)];
    if (tenantId !== undefined) conditions.push(eq(employees.tenantId, tenantId));
    const [employee] = await db.select().from(employees).where(and(...conditions));
    return employee;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
    return employee;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    if (!employee.employeeNumber) {
      employee.employeeNumber = await nextCode("EMP-", "employees", "employee_number", employee.tenantId);
    }
    const [created] = await db.insert(employees).values(employee).returning();
    return created;
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updated] = await db.update(employees).set({ ...data, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
    return updated;
  }

  async getOnboardingRecord(id: number): Promise<OnboardingRecord | undefined> {
    const [record] = await db.select().from(onboardingRecords).where(eq(onboardingRecords.id, id));
    return record;
  }

  async getOnboardingByUserId(userId: string): Promise<OnboardingRecord | undefined> {
    const [record] = await db.select().from(onboardingRecords).where(eq(onboardingRecords.userId, userId));
    return record;
  }

  async getOnboardingsByTenant(tenantId: number): Promise<OnboardingRecord[]> {
    return db.select().from(onboardingRecords).where(eq(onboardingRecords.tenantId, tenantId)).orderBy(desc(onboardingRecords.createdAt));
  }

  async createOnboarding(record: InsertOnboardingRecord): Promise<OnboardingRecord> {
    const [created] = await db.insert(onboardingRecords).values(record).returning();
    return created;
  }

  async updateOnboarding(id: number, data: Partial<InsertOnboardingRecord>): Promise<OnboardingRecord | undefined> {
    const [updated] = await db.update(onboardingRecords).set({ ...data, updatedAt: new Date() }).where(eq(onboardingRecords.id, id)).returning();
    return updated;
  }

  async getEmergencyContacts(employeeId: number): Promise<EmergencyContact[]> {
    return db.select().from(emergencyContacts).where(eq(emergencyContacts.employeeId, employeeId));
  }

  async createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact> {
    const [created] = await db.insert(emergencyContacts).values(contact).returning();
    return created;
  }

  async updateEmergencyContact(id: number, data: Partial<InsertEmergencyContact>): Promise<EmergencyContact | undefined> {
    const [updated] = await db.update(emergencyContacts).set(data).where(eq(emergencyContacts.id, id)).returning();
    return updated;
  }

  async deleteEmergencyContact(id: number): Promise<void> {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
  }

  async getBankDetails(employeeId: number): Promise<BankDetail | undefined> {
    const [detail] = await db.select().from(bankDetails).where(eq(bankDetails.employeeId, employeeId));
    return detail;
  }

  async createBankDetails(details: InsertBankDetail): Promise<BankDetail> {
    const [created] = await db.insert(bankDetails).values(details).returning();
    return created;
  }

  async updateBankDetails(id: number, data: Partial<InsertBankDetail>): Promise<BankDetail | undefined> {
    const [updated] = await db.update(bankDetails).set({ ...data, updatedAt: new Date() }).where(eq(bankDetails.id, id)).returning();
    return updated;
  }

  async createPendingBankChange(data: InsertPendingBankChange): Promise<PendingBankChange> {
    const [created] = await db.insert(pendingBankChanges).values(data).returning();
    return created;
  }

  async getPendingBankChange(id: number): Promise<PendingBankChange | undefined> {
    const [record] = await db.select().from(pendingBankChanges).where(eq(pendingBankChanges.id, id));
    return record;
  }

  async getPendingBankChangesForEmployee(employeeId: number): Promise<PendingBankChange[]> {
    return db.select().from(pendingBankChanges)
      .where(eq(pendingBankChanges.employeeId, employeeId))
      .orderBy(desc(pendingBankChanges.createdAt));
  }

  async getAllPendingBankChanges(tenantId?: number): Promise<PendingBankChange[]> {
    if (tenantId) {
      const { rows } = await pool.query(
        `SELECT pbc.* FROM pending_bank_changes pbc
         JOIN employees e ON e.id = pbc.employee_id
         WHERE e.tenant_id = $1
         ORDER BY pbc.created_at DESC`,
        [tenantId]
      );
      return rows as PendingBankChange[];
    }
    return db.select().from(pendingBankChanges).orderBy(desc(pendingBankChanges.createdAt));
  }

  async approvePendingBankChange(id: number, reviewedByUserId: string, note?: string): Promise<PendingBankChange | undefined> {
    const [change] = await db.select().from(pendingBankChanges).where(eq(pendingBankChanges.id, id));
    if (!change) return undefined;

    const [updated] = await db.update(pendingBankChanges)
      .set({ status: "approved", reviewedByUserId, reviewedAt: new Date(), reviewNote: note ?? null })
      .where(eq(pendingBankChanges.id, id))
      .returning();

    const existing = await this.getBankDetails(change.employeeId);
    const bankData = {
      employeeId: change.employeeId,
      accountName: change.accountName,
      bankName: change.bankName,
      sortCode: change.sortCode,
      accountNumber: change.accountNumber,
      buildingSocietyRef: change.buildingSocietyRef ?? undefined,
    };
    if (existing) {
      await this.updateBankDetails(existing.id, bankData);
    } else {
      await this.createBankDetails(bankData);
    }

    return updated;
  }

  async rejectPendingBankChange(id: number, reviewedByUserId: string, note?: string): Promise<PendingBankChange | undefined> {
    const [updated] = await db.update(pendingBankChanges)
      .set({ status: "rejected", reviewedByUserId, reviewedAt: new Date(), reviewNote: note ?? null })
      .where(eq(pendingBankChanges.id, id))
      .returning();
    return updated;
  }

  async getDocuments(employeeId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.employeeId, employeeId));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getVettingRecords(employeeId: number): Promise<VettingRecord[]> {
    return db.select().from(vettingRecords).where(eq(vettingRecords.employeeId, employeeId));
  }

  async getVettingRecordsByTenant(tenantId: number): Promise<VettingRecord[]> {
    return db.select().from(vettingRecords).where(eq(vettingRecords.tenantId, tenantId)).orderBy(desc(vettingRecords.createdAt));
  }

  async createVettingRecord(record: InsertVettingRecord): Promise<VettingRecord> {
    const [created] = await db.insert(vettingRecords).values(record).returning();
    return created;
  }

  async updateVettingRecord(id: number, data: Partial<InsertVettingRecord>): Promise<VettingRecord | undefined> {
    const [updated] = await db.update(vettingRecords).set({ ...data, updatedAt: new Date() }).where(eq(vettingRecords.id, id)).returning();
    return updated;
  }

  async getReferences(employeeId: number): Promise<Reference[]> {
    return db.select().from(references).where(eq(references.employeeId, employeeId));
  }

  async createReference(ref: InsertReference): Promise<Reference> {
    const [created] = await db.insert(references).values(ref).returning();
    return created;
  }

  async updateReference(id: number, data: Partial<InsertReference>): Promise<Reference | undefined> {
    const [updated] = await db.update(references).set(data).where(eq(references.id, id)).returning();
    return updated;
  }

  async deleteReference(id: number): Promise<void> {
    await db.delete(references).where(eq(references.id, id));
  }

  async getEmploymentHistory(employeeId: number): Promise<EmploymentHistory[]> {
    return db.select().from(employmentHistory).where(eq(employmentHistory.employeeId, employeeId)).orderBy(desc(employmentHistory.dateFrom));
  }

  async createEmploymentHistory(history: InsertEmploymentHistory): Promise<EmploymentHistory> {
    const [created] = await db.insert(employmentHistory).values(history).returning();
    return created;
  }

  async updateEmploymentHistory(id: number, data: Partial<InsertEmploymentHistory>): Promise<EmploymentHistory | undefined> {
    const [updated] = await db.update(employmentHistory).set(data).where(eq(employmentHistory.id, id)).returning();
    return updated;
  }

  async deleteEmploymentHistory(id: number): Promise<void> {
    await db.delete(employmentHistory).where(eq(employmentHistory.id, id));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(tenantId: number): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).orderBy(desc(auditLogs.createdAt));
  }

  async getEmployeesByTenant(tenantId: number): Promise<Employee[]> {
    return db.select().from(employees).where(eq(employees.tenantId, tenantId));
  }

  async getEmployeesBySupplier(supplierId: number): Promise<Employee[]> {
    return db.select().from(employees).where(eq(employees.supplierId, supplierId));
  }

  async getUsersByTenant(tenantId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  async getSite(id: number, tenantId?: number): Promise<Site | undefined> {
    const conditions = [eq(sites.id, id)];
    if (tenantId !== undefined) conditions.push(eq(sites.tenantId, tenantId));
    const [site] = await db.select().from(sites).where(and(...conditions));
    return site;
  }

  async getSitesByTenant(tenantId: number): Promise<Site[]> {
    return db.select().from(sites).where(eq(sites.tenantId, tenantId));
  }

  async createSite(site: InsertSite): Promise<Site> {
    if (!site.siteCode) {
      site.siteCode = await nextCode("SITE-", "sites", "site_code", site.tenantId);
    }
    const [created] = await db.insert(sites).values(site).returning();
    return created;
  }

  async updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [updated] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return updated;
  }

  async deleteSite(id: number): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  async getShift(id: number, tenantId?: number): Promise<Shift | undefined> {
    const conditions = [eq(shifts.id, id)];
    if (tenantId !== undefined) conditions.push(eq(shifts.tenantId, tenantId));
    const [shift] = await db.select().from(shifts).where(and(...conditions));
    return shift;
  }

  async getShiftsByTenant(tenantId: number): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.tenantId, tenantId)).orderBy(desc(shifts.date));
  }

  async getShiftsBySupplierId(supplierId: number): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.supplierId, supplierId)).orderBy(shifts.date);
  }

  async getShiftsByEmployee(employeeId: number): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.employeeId, employeeId)).orderBy(desc(shifts.date));
  }

  async getShiftsByDate(tenantId: number, date: string): Promise<Shift[]> {
    return db.select().from(shifts).where(and(eq(shifts.tenantId, tenantId), eq(shifts.date, date)));
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    if (!shift.shiftCode) {
      shift.shiftCode = await nextCode("SHF-", "shifts", "shift_code", shift.tenantId);
    }
    const [created] = await db.insert(shifts).values(shift).returning();
    return created;
  }

  async createShiftsBulk(shiftsData: InsertShift[]): Promise<Shift[]> {
    if (shiftsData.length === 0) return [];
    const tenantId = shiftsData[0].tenantId;
    const result = tenantId
      ? await pool.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(shift_code FROM '(\\d+)$') AS INTEGER)), 0) AS max_num FROM shifts WHERE shift_code IS NOT NULL AND tenant_id = $1`, [tenantId])
      : await pool.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(shift_code FROM '(\\d+)$') AS INTEGER)), 0) AS max_num FROM shifts WHERE shift_code IS NOT NULL`);
    let nextNum = (result.rows[0]?.max_num || 0) + 1;
    for (const s of shiftsData) {
      if (!s.shiftCode) {
        s.shiftCode = `SHF-${nextNum.toString().padStart(5, "0")}`;
        nextNum++;
      }
    }
    const batchSize = 100;
    const allCreated: Shift[] = [];
    for (let i = 0; i < shiftsData.length; i += batchSize) {
      const chunk = shiftsData.slice(i, i + batchSize);
      const created = await db.insert(shifts).values(chunk).returning();
      allCreated.push(...created);
    }
    return allCreated;
  }

  async updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined> {
    const [updated] = await db.update(shifts).set({ ...data, updatedAt: new Date() }).where(eq(shifts.id, id)).returning();
    return updated;
  }

  async deleteShift(id: number): Promise<void> {
    await db.delete(shifts).where(eq(shifts.id, id));
  }

  async getIncident(id: number, tenantId?: number): Promise<Incident | undefined> {
    const conditions = [eq(incidents.id, id)];
    if (tenantId !== undefined) conditions.push(eq(incidents.tenantId, tenantId));
    const [incident] = await db.select().from(incidents).where(and(...conditions));
    return incident;
  }

  async getIncidentsByTenant(tenantId: number): Promise<Incident[]> {
    return db.select().from(incidents).where(eq(incidents.tenantId, tenantId)).orderBy(desc(incidents.createdAt));
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    if (!incident.incidentRef) {
      incident.incidentRef = await nextCode("INC-", "incidents", "incident_ref", incident.tenantId);
    }
    const [created] = await db.insert(incidents).values(incident).returning();
    return created;
  }

  async updateIncident(id: number, data: Partial<InsertIncident>): Promise<Incident | undefined> {
    const [updated] = await db.update(incidents).set({ ...data, updatedAt: new Date() }).where(eq(incidents.id, id)).returning();
    return updated;
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async getSupplierByUserId(userId: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.userId, userId));
    return supplier;
  }

  async getSuppliersByTenant(tenantId: number): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.tenantId, tenantId)).orderBy(desc(suppliers.createdAt));
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    if (!supplier.supplierCode) {
      supplier.supplierCode = await nextCode("SUP-", "suppliers", "supplier_code", supplier.tenantId);
    }
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async getSupplierDocuments(supplierId: number): Promise<SupplierDocument[]> {
    return db.select().from(supplierDocuments).where(eq(supplierDocuments.supplierId, supplierId)).orderBy(desc(supplierDocuments.createdAt));
  }

  async getSupplierDocument(id: number): Promise<SupplierDocument | undefined> {
    const [doc] = await db.select().from(supplierDocuments).where(eq(supplierDocuments.id, id));
    return doc;
  }

  async createSupplierDocument(doc: InsertSupplierDocument): Promise<SupplierDocument> {
    const [created] = await db.insert(supplierDocuments).values(doc).returning();
    return created;
  }

  async updateSupplierDocument(id: number, data: Partial<Pick<SupplierDocument, "status" | "rejectionReason" | "reviewedBy" | "reviewedAt">>): Promise<SupplierDocument | undefined> {
    const [updated] = await db.update(supplierDocuments).set(data).where(eq(supplierDocuments.id, id)).returning();
    return updated;
  }

  async deleteSupplierDocument(id: number): Promise<void> {
    await db.delete(supplierDocuments).where(eq(supplierDocuments.id, id));
  }

  async createSupplierDocumentAudit(entry: InsertSupplierDocumentAudit): Promise<SupplierDocumentAudit> {
    const [created] = await db.insert(supplierDocumentAudit).values(entry).returning();
    return created;
  }

  async getSupplierDocumentAudit(documentId: number): Promise<SupplierDocumentAudit[]> {
    return db.select().from(supplierDocumentAudit).where(eq(supplierDocumentAudit.documentId, documentId)).orderBy(desc(supplierDocumentAudit.createdAt));
  }

  async createEmployeeInvitation(invitation: InsertEmployeeInvitation): Promise<EmployeeInvitation> {
    const [created] = await db.insert(employeeInvitations).values(invitation).returning();
    return created;
  }

  async getEmployeeInvitationByToken(token: string): Promise<EmployeeInvitation | undefined> {
    const [inv] = await db.select().from(employeeInvitations).where(eq(employeeInvitations.token, token));
    return inv;
  }

  async getLatestEmployeeInvitation(employeeId: number): Promise<EmployeeInvitation | undefined> {
    const list = await db.select().from(employeeInvitations).where(eq(employeeInvitations.employeeId, employeeId)).orderBy(desc(employeeInvitations.createdAt));
    return list[0];
  }

  async hasEmployeeAcceptedAnyInvitation(employeeId: number): Promise<boolean> {
    const list = await db.select({ id: employeeInvitations.id }).from(employeeInvitations).where(and(eq(employeeInvitations.employeeId, employeeId), isNotNull(employeeInvitations.acceptedAt))).limit(1);
    return list.length > 0;
  }

  async updateEmployeeInvitation(id: number, data: Partial<InsertEmployeeInvitation>): Promise<EmployeeInvitation | undefined> {
    const [updated] = await db.update(employeeInvitations).set(data).where(eq(employeeInvitations.id, id)).returning();
    return updated;
  }

  async createSupplierInvitation(invitation: InsertSupplierInvitation): Promise<SupplierInvitation> {
    const [created] = await db.insert(supplierInvitations).values(invitation).returning();
    return created;
  }

  async getSupplierInvitationByToken(token: string): Promise<SupplierInvitation | undefined> {
    const [inv] = await db.select().from(supplierInvitations).where(eq(supplierInvitations.token, token));
    return inv;
  }

  async getLatestSupplierInvitation(supplierId: number): Promise<SupplierInvitation | undefined> {
    const list = await db.select().from(supplierInvitations).where(eq(supplierInvitations.supplierId, supplierId)).orderBy(desc(supplierInvitations.createdAt));
    return list[0];
  }

  async hasSupplierAcceptedAnyInvitation(supplierId: number): Promise<boolean> {
    const list = await db.select({ id: supplierInvitations.id }).from(supplierInvitations).where(and(eq(supplierInvitations.supplierId, supplierId), isNotNull(supplierInvitations.acceptedAt))).limit(1);
    return list.length > 0;
  }

  async updateSupplierInvitation(id: number, data: Partial<InsertSupplierInvitation>): Promise<SupplierInvitation | undefined> {
    const [updated] = await db.update(supplierInvitations).set(data).where(eq(supplierInvitations.id, id)).returning();
    return updated;
  }

  async createSupplierPendingChange(change: InsertSupplierPendingChange): Promise<SupplierPendingChange> {
    const [created] = await db.insert(supplierPendingChanges).values(change).returning();
    return created;
  }

  async getSupplierPendingChanges(supplierId: number): Promise<SupplierPendingChange[]> {
    return db.select().from(supplierPendingChanges).where(eq(supplierPendingChanges.supplierId, supplierId)).orderBy(desc(supplierPendingChanges.createdAt));
  }

  async getSupplierPendingChange(id: number): Promise<SupplierPendingChange | undefined> {
    const [c] = await db.select().from(supplierPendingChanges).where(eq(supplierPendingChanges.id, id));
    return c;
  }

  async updateSupplierPendingChange(id: number, data: Partial<InsertSupplierPendingChange>): Promise<SupplierPendingChange | undefined> {
    const [updated] = await db.update(supplierPendingChanges).set(data).where(eq(supplierPendingChanges.id, id)).returning();
    return updated;
  }

  async createSupplierLoginActivity(activity: InsertSupplierLoginActivity): Promise<SupplierLoginActivity> {
    const [created] = await db.insert(supplierLoginActivity).values(activity).returning();
    return created;
  }

  async getSupplierLoginActivityBySupplierId(supplierId: number): Promise<SupplierLoginActivity[]> {
    return db.select().from(supplierLoginActivity).where(eq(supplierLoginActivity.supplierId, supplierId)).orderBy(desc(supplierLoginActivity.createdAt));
  }

  async getSupplierLoginCount(supplierId: number): Promise<number> {
    const list = await db.select().from(supplierLoginActivity).where(eq(supplierLoginActivity.supplierId, supplierId));
    return list.length;
  }

  async getSupplierLastLogin(supplierId: number): Promise<SupplierLoginActivity | undefined> {
    const list = await db.select().from(supplierLoginActivity).where(eq(supplierLoginActivity.supplierId, supplierId)).orderBy(desc(supplierLoginActivity.createdAt));
    return list[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [n] = await db.select().from(notifications).where(eq(notifications.id, id));
    return n;
  }

  async getNotificationsForUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]> {
    const limit = options?.limit ?? 50;
    const conditions = options?.unreadOnly
      ? and(eq(notifications.userId, userId), sql`${notifications.readAt} IS NULL`)
      : eq(notifications.userId, userId);
    return db.select().from(notifications).where(conditions).orderBy(desc(notifications.createdAt)).limit(limit);
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)).returning();
    return updated;
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const list = await db.select().from(notifications).where(and(eq(notifications.userId, userId), sql`${notifications.readAt} IS NULL`));
    return list.length;
  }

  async createSupplierFieldRequest(request: InsertSupplierFieldRequest): Promise<SupplierFieldRequest> {
    const [created] = await db.insert(supplierFieldRequests).values(request).returning();
    return created;
  }

  async getSupplierFieldRequests(supplierId: number, options?: { pendingOnly?: boolean }): Promise<SupplierFieldRequest[]> {
    const cond = options?.pendingOnly
      ? and(eq(supplierFieldRequests.supplierId, supplierId), sql`${supplierFieldRequests.completedAt} IS NULL`)
      : eq(supplierFieldRequests.supplierId, supplierId);
    return db.select().from(supplierFieldRequests).where(cond).orderBy(desc(supplierFieldRequests.createdAt));
  }

  async updateSupplierFieldRequest(id: number, data: Partial<Pick<SupplierFieldRequest, "completedAt">>): Promise<SupplierFieldRequest | undefined> {
    const [updated] = await db.update(supplierFieldRequests).set(data).where(eq(supplierFieldRequests.id, id)).returning();
    return updated;
  }

  async createSupplierProfileChangeLog(entry: InsertSupplierProfileChangeLog): Promise<SupplierProfileChangeLog> {
    const [created] = await db.insert(supplierProfileChangeLog).values(entry).returning();
    return created;
  }

  async getSupplierProfileChangeLog(supplierId: number, limitCount: number = 100): Promise<SupplierProfileChangeLog[]> {
    return db.select().from(supplierProfileChangeLog).where(eq(supplierProfileChangeLog.supplierId, supplierId)).orderBy(desc(supplierProfileChangeLog.createdAt)).limit(limitCount);
  }

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [created] = await db.insert(passwordResetTokens).values(token).returning();
    return created;
  }

  async getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined> {
    const [t] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return t;
  }

  async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }

  async getInvoice(id: number, tenantId?: number): Promise<Invoice | undefined> {
    const conditions = [eq(invoices.id, id)];
    if (tenantId !== undefined) conditions.push(eq(invoices.tenantId, tenantId));
    const [invoice] = await db.select().from(invoices).where(and(...conditions));
    return invoice;
  }

  async getInvoicesByTenant(tenantId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesBySupplierId(supplierId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.supplierId, supplierId)).orderBy(invoices.createdAt);
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]> {
    return db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async getInvoiceLineItemsByTenant(tenantId: number): Promise<InvoiceLineItem[]> {
    const tenantInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.tenantId, tenantId));
    const invoiceIds = tenantInvoices.map(i => i.id);
    if (invoiceIds.length === 0) return [];
    return db.select().from(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, invoiceIds));
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [created] = await db.insert(invoiceLineItems).values(item).returning();
    return created;
  }

  async getRateCardsBySupplier(supplierId: number): Promise<RateCard[]> {
    return db.select().from(rateCards).where(eq(rateCards.supplierId, supplierId)).orderBy(desc(rateCards.createdAt));
  }

  async getRateCardsByTenant(tenantId: number): Promise<RateCard[]> {
    return db.select().from(rateCards).where(eq(rateCards.tenantId, tenantId)).orderBy(desc(rateCards.createdAt));
  }

  async getRateCard(id: number): Promise<RateCard | undefined> {
    const [card] = await db.select().from(rateCards).where(eq(rateCards.id, id));
    return card;
  }

  async createRateCard(rateCard: InsertRateCard): Promise<RateCard> {
    const [created] = await db.insert(rateCards).values(rateCard).returning();
    return created;
  }

  async updateRateCard(id: number, data: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const [updated] = await db.update(rateCards).set(data).where(eq(rateCards.id, id)).returning();
    return updated;
  }

  async deleteRateCard(id: number): Promise<void> {
    await db.delete(rateCards).where(eq(rateCards.id, id));
  }

  async getDispute(id: number): Promise<Dispute | undefined> {
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id));
    return dispute;
  }

  async getDisputesByTenant(tenantId: number): Promise<Dispute[]> {
    return db.select().from(disputes).where(eq(disputes.tenantId, tenantId)).orderBy(desc(disputes.createdAt));
  }

  async getDisputesBySupplier(supplierId: number): Promise<Dispute[]> {
    return db.select().from(disputes).where(eq(disputes.supplierId, supplierId)).orderBy(desc(disputes.createdAt));
  }

  async getDisputeByShift(shiftId: number): Promise<Dispute | undefined> {
    const [dispute] = await db.select().from(disputes).where(eq(disputes.shiftId, shiftId));
    return dispute;
  }

  async createDispute(dispute: InsertDispute): Promise<Dispute> {
    const [created] = await db.insert(disputes).values(dispute).returning();
    return created;
  }

  async updateDispute(id: number, data: Partial<InsertDispute>): Promise<Dispute | undefined> {
    const [updated] = await db.update(disputes).set(data).where(eq(disputes.id, id)).returning();
    return updated;
  }

  async getDisputeMessages(disputeId: number): Promise<DisputeMessage[]> {
    return db.select().from(disputeMessages).where(eq(disputeMessages.disputeId, disputeId)).orderBy(disputeMessages.createdAt);
  }

  async createDisputeMessage(message: InsertDisputeMessage): Promise<DisputeMessage> {
    const [created] = await db.insert(disputeMessages).values(message).returning();
    return created;
  }

  async getCreditNote(id: number): Promise<CreditNote | undefined> {
    const [note] = await db.select().from(creditNotes).where(eq(creditNotes.id, id));
    return note;
  }

  async getCreditNotesByTenant(tenantId: number): Promise<CreditNote[]> {
    return db.select().from(creditNotes).where(eq(creditNotes.tenantId, tenantId)).orderBy(desc(creditNotes.createdAt));
  }

  async createCreditNote(note: InsertCreditNote): Promise<CreditNote> {
    const [created] = await db.insert(creditNotes).values(note).returning();
    return created;
  }

  async updateCreditNote(id: number, data: Partial<InsertCreditNote>): Promise<CreditNote | undefined> {
    const [updated] = await db.update(creditNotes).set(data).where(eq(creditNotes.id, id)).returning();
    return updated;
  }

  async getDebitNote(id: number): Promise<DebitNote | undefined> {
    const [note] = await db.select().from(debitNotes).where(eq(debitNotes.id, id));
    return note;
  }

  async getDebitNotesByTenant(tenantId: number): Promise<DebitNote[]> {
    return db.select().from(debitNotes).where(eq(debitNotes.tenantId, tenantId)).orderBy(desc(debitNotes.createdAt));
  }

  async createDebitNote(note: InsertDebitNote): Promise<DebitNote> {
    const [created] = await db.insert(debitNotes).values(note).returning();
    return created;
  }

  async updateDebitNote(id: number, data: Partial<InsertDebitNote>): Promise<DebitNote | undefined> {
    const [updated] = await db.update(debitNotes).set(data).where(eq(debitNotes.id, id)).returning();
    return updated;
  }

  async getCreditNoteLineItems(creditNoteId: number): Promise<CreditNoteLineItem[]> {
    return db.select().from(creditNoteLineItems).where(eq(creditNoteLineItems.creditNoteId, creditNoteId));
  }

  async createCreditNoteLineItem(item: InsertCreditNoteLineItem): Promise<CreditNoteLineItem> {
    const [created] = await db.insert(creditNoteLineItems).values(item).returning();
    return created;
  }

  async getDebitNoteLineItems(debitNoteId: number): Promise<DebitNoteLineItem[]> {
    return db.select().from(debitNoteLineItems).where(eq(debitNoteLineItems.debitNoteId, debitNoteId));
  }

  async createDebitNoteLineItem(item: InsertDebitNoteLineItem): Promise<DebitNoteLineItem> {
    const [created] = await db.insert(debitNoteLineItems).values(item).returning();
    return created;
  }

  async getJobPosting(id: number): Promise<JobPosting | undefined> {
    const [posting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return posting;
  }

  async getJobPostingsByTenant(tenantId: number): Promise<JobPosting[]> {
    return db.select().from(jobPostings).where(eq(jobPostings.tenantId, tenantId)).orderBy(desc(jobPostings.createdAt));
  }

  async createJobPosting(posting: InsertJobPosting): Promise<JobPosting> {
    if (!posting.jobRef) {
      posting.jobRef = await nextCode("JOB-", "job_postings", "job_ref", posting.tenantId);
    }
    const [created] = await db.insert(jobPostings).values(posting).returning();
    return created;
  }

  async updateJobPosting(id: number, data: Partial<InsertJobPosting>): Promise<JobPosting | undefined> {
    const [updated] = await db.update(jobPostings).set({ ...data, updatedAt: new Date() }).where(eq(jobPostings.id, id)).returning();
    return updated;
  }

  async getApplicant(id: number): Promise<Applicant | undefined> {
    const [applicant] = await db.select().from(applicants).where(eq(applicants.id, id));
    return applicant;
  }

  async getApplicantsByJob(jobPostingId: number): Promise<Applicant[]> {
    return db.select().from(applicants).where(eq(applicants.jobPostingId, jobPostingId)).orderBy(desc(applicants.createdAt));
  }

  async getApplicantsByTenant(tenantId: number): Promise<Applicant[]> {
    return db.select().from(applicants).where(eq(applicants.tenantId, tenantId)).orderBy(desc(applicants.createdAt));
  }

  async createApplicant(applicant: InsertApplicant): Promise<Applicant> {
    const [created] = await db.insert(applicants).values(applicant).returning();
    return created;
  }

  async updateApplicant(id: number, data: Partial<InsertApplicant>): Promise<Applicant | undefined> {
    const [updated] = await db.update(applicants).set({ ...data, updatedAt: new Date() }).where(eq(applicants.id, id)).returning();
    return updated;
  }

  async getSupplierPolicies(supplierId: number): Promise<SupplierPolicy[]> {
    return db.select().from(supplierPolicies).where(eq(supplierPolicies.supplierId, supplierId)).orderBy(desc(supplierPolicies.createdAt));
  }

  async getSupplierPolicy(id: number): Promise<SupplierPolicy | undefined> {
    const [policy] = await db.select().from(supplierPolicies).where(eq(supplierPolicies.id, id));
    return policy;
  }

  async createSupplierPolicy(policy: InsertSupplierPolicy): Promise<SupplierPolicy> {
    const [created] = await db.insert(supplierPolicies).values(policy).returning();
    return created;
  }

  async updateSupplierPolicy(id: number, data: Partial<Pick<SupplierPolicy, "status" | "rejectionReason" | "reviewedBy" | "reviewedAt">>): Promise<SupplierPolicy | undefined> {
    const [updated] = await db.update(supplierPolicies).set(data).where(eq(supplierPolicies.id, id)).returning();
    return updated;
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));
    return tenant;
  }

  async createTenantInvitation(invitation: InsertTenantInvitation): Promise<TenantInvitation> {
    const [created] = await db.insert(tenantInvitations).values(invitation).returning();
    return created;
  }

  async getTenantInvitationsByTenant(tenantId: number): Promise<TenantInvitation[]> {
    return db.select().from(tenantInvitations).where(eq(tenantInvitations.tenantId, tenantId)).orderBy(desc(tenantInvitations.createdAt));
  }

  async getTenantInvitationByToken(token: string): Promise<TenantInvitation | undefined> {
    const [inv] = await db.select().from(tenantInvitations).where(eq(tenantInvitations.token, token));
    return inv;
  }

  async updateTenantInvitation(id: number, data: Partial<InsertTenantInvitation>): Promise<TenantInvitation | undefined> {
    const [updated] = await db.update(tenantInvitations).set(data).where(eq(tenantInvitations.id, id)).returning();
    return updated;
  }

  async getDataConsents(userId: string): Promise<DataConsent[]> {
    return db.select().from(dataConsents).where(eq(dataConsents.userId, userId)).orderBy(desc(dataConsents.createdAt));
  }

  async createDataConsent(consent: InsertDataConsent): Promise<DataConsent> {
    const [created] = await db.insert(dataConsents).values(consent).returning();
    return created;
  }

  async updateDataConsent(id: number, data: Partial<InsertDataConsent>): Promise<DataConsent | undefined> {
    const [updated] = await db.update(dataConsents).set(data).where(eq(dataConsents.id, id)).returning();
    return updated;
  }

  async getDataErasureRequests(tenantId: number): Promise<DataErasureRequest[]> {
    return db.select().from(dataErasureRequests).where(eq(dataErasureRequests.tenantId, tenantId)).orderBy(desc(dataErasureRequests.createdAt));
  }

  async getDataErasureRequest(id: number): Promise<DataErasureRequest | undefined> {
    const [request] = await db.select().from(dataErasureRequests).where(eq(dataErasureRequests.id, id));
    return request;
  }

  async getDataErasureRequestByUser(userId: string): Promise<DataErasureRequest | undefined> {
    const [request] = await db.select().from(dataErasureRequests).where(and(eq(dataErasureRequests.userId, userId), eq(dataErasureRequests.status, "pending")));
    return request;
  }

  async createDataErasureRequest(request: InsertDataErasureRequest): Promise<DataErasureRequest> {
    const [created] = await db.insert(dataErasureRequests).values(request).returning();
    return created;
  }

  async updateDataErasureRequest(id: number, data: Partial<InsertDataErasureRequest>): Promise<DataErasureRequest | undefined> {
    const [updated] = await db.update(dataErasureRequests).set(data).where(eq(dataErasureRequests.id, id)).returning();
    return updated;
  }

  async getAiDecisions(tenantId: number, limit = 100): Promise<AiDecision[]> {
    return db.select().from(aiDecisions).where(eq(aiDecisions.tenantId, tenantId)).orderBy(desc(aiDecisions.createdAt)).limit(limit);
  }

  async getAiDecisionsByBatch(batchId: string): Promise<AiDecision[]> {
    return db.select().from(aiDecisions).where(eq(aiDecisions.batchId, batchId)).orderBy(desc(aiDecisions.createdAt));
  }

  async getAiDecisionsBySite(tenantId: number, siteId: number): Promise<AiDecision[]> {
    return db.select().from(aiDecisions).where(and(eq(aiDecisions.tenantId, tenantId), eq(aiDecisions.siteId, siteId))).orderBy(desc(aiDecisions.createdAt)).limit(50);
  }

  async createAiDecision(decision: InsertAiDecision): Promise<AiDecision> {
    const [created] = await db.insert(aiDecisions).values(decision).returning();
    return created;
  }

  async updateAiDecision(id: number, data: Partial<InsertAiDecision>): Promise<AiDecision | undefined> {
    const [updated] = await db.update(aiDecisions).set(data).where(eq(aiDecisions.id, id)).returning();
    return updated;
  }

  async getAiInsights(tenantId: number): Promise<AiInsight[]> {
    return db.select().from(aiInsights).where(and(eq(aiInsights.tenantId, tenantId), eq(aiInsights.isActive, true))).orderBy(desc(aiInsights.createdAt));
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    const [created] = await db.insert(aiInsights).values(insight).returning();
    return created;
  }

  async deactivateAiInsights(tenantId: number, insightType: string): Promise<void> {
    await db.update(aiInsights).set({ isActive: false }).where(and(eq(aiInsights.tenantId, tenantId), eq(aiInsights.insightType, insightType)));
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel;
  }

  async getChannelsByTenant(tenantId: number): Promise<Channel[]> {
    return db.select().from(channels).where(and(eq(channels.tenantId, tenantId), eq(channels.isArchived, false))).orderBy(desc(channels.createdAt));
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [created] = await db.insert(channels).values(channel).returning();
    return created;
  }

  async updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updated] = await db.update(channels).set(data).where(eq(channels.id, id)).returning();
    return updated;
  }

  async getChannelMembers(channelId: number): Promise<ChannelMember[]> {
    return db.select().from(channelMembers).where(eq(channelMembers.channelId, channelId));
  }

  async addChannelMember(member: InsertChannelMember): Promise<ChannelMember> {
    const [created] = await db.insert(channelMembers).values(member).returning();
    return created;
  }

  async removeChannelMember(channelId: number, userId: string): Promise<void> {
    await db.delete(channelMembers).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  async updateChannelMemberLastRead(channelId: number, userId: string): Promise<void> {
    await db.update(channelMembers).set({ lastReadAt: new Date() }).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  async savePushSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth });
  }

  async getPushSubscriptions(userId: string): Promise<any[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionForUser(endpoint: string, userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
  }

  async getUserChannels(userId: string, tenantId: number): Promise<Channel[]> {
    const memberships = await db.select().from(channelMembers).where(eq(channelMembers.userId, userId));
    const channelIds = memberships.map(m => m.channelId);
    if (channelIds.length === 0) return [];
    const allChannels = await db.select().from(channels).where(and(eq(channels.tenantId, tenantId), eq(channels.isArchived, false)));
    return allChannels.filter(c => channelIds.includes(c.id) || c.type === "broadcast");
  }

  async getMessages(channelId: number, limit = 100): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.channelId, channelId)).orderBy(desc(messages.createdAt)).limit(limit);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getBroadcastsByTenant(tenantId: number, limit = 50): Promise<Broadcast[]> {
    return db.select().from(broadcasts).where(eq(broadcasts.tenantId, tenantId)).orderBy(desc(broadcasts.createdAt)).limit(limit);
  }

  async createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast> {
    const [created] = await db.insert(broadcasts).values(broadcast).returning();
    return created;
  }

  async getBroadcastReads(broadcastId: number): Promise<BroadcastRead[]> {
    return db.select().from(broadcastReads).where(eq(broadcastReads.broadcastId, broadcastId));
  }

  async createBroadcastRead(read: InsertBroadcastRead): Promise<BroadcastRead> {
    const [created] = await db.insert(broadcastReads).values(read).returning();
    return created;
  }

  async hasUserReadBroadcast(broadcastId: number, userId: string): Promise<boolean> {
    const [read] = await db.select().from(broadcastReads).where(and(eq(broadcastReads.broadcastId, broadcastId), eq(broadcastReads.userId, userId)));
    return !!read;
  }

  async getRolePermissions(): Promise<RolePermission[]> {
    return db.select().from(rolePermissions);
  }

  async getRolePermissionsByRole(role: string): Promise<RolePermission[]> {
    return db.select().from(rolePermissions).where(eq(rolePermissions.role, role));
  }

  async setRolePermission(role: string, permissionKey: string, enabled: boolean): Promise<RolePermission> {
    const [existing] = await db.select().from(rolePermissions).where(and(eq(rolePermissions.role, role), eq(rolePermissions.permissionKey, permissionKey)));
    if (existing) {
      const [updated] = await db.update(rolePermissions).set({ enabled, updatedAt: new Date() }).where(eq(rolePermissions.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(rolePermissions).values({ role, permissionKey, enabled }).returning();
    return created;
  }

  async bulkSetRolePermissions(permissions: { role: string; permissionKey: string; enabled: boolean }[]): Promise<void> {
    for (const perm of permissions) {
      await this.setRolePermission(perm.role, perm.permissionKey, perm.enabled);
    }
  }

  async createSupplierAuditEvent(event: InsertSupplierAuditEvent): Promise<SupplierAuditEvent> {
    const [created] = await db.insert(supplierAuditEvents).values(event).returning();
    return created;
  }

  async deleteSupplierAuditEventsBySupplierId(supplierId: number): Promise<void> {
    await db.delete(supplierAuditEvents).where(eq(supplierAuditEvents.supplierId, supplierId));
  }

  async getSupplierAuditEvents(supplierId: number, options?: { eventType?: string; limit?: number; offset?: number }): Promise<SupplierAuditEvent[]> {
    const conditions = [eq(supplierAuditEvents.supplierId, supplierId)];
    if (options?.eventType) {
      conditions.push(eq(supplierAuditEvents.eventType, options.eventType as any));
    }
    let query = db.select().from(supplierAuditEvents).where(and(...conditions)).orderBy(desc(supplierAuditEvents.createdAt));
    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;
    return query;
  }

  async getSupplierAuditEventsByTenant(tenantId: number, options?: { supplierId?: number; eventType?: string; limit?: number }): Promise<SupplierAuditEvent[]> {
    const conditions = [eq(supplierAuditEvents.tenantId, tenantId)];
    if (options?.supplierId) {
      conditions.push(eq(supplierAuditEvents.supplierId, options.supplierId));
    }
    if (options?.eventType) {
      conditions.push(eq(supplierAuditEvents.eventType, options.eventType as any));
    }
    let query = db.select().from(supplierAuditEvents).where(and(...conditions)).orderBy(desc(supplierAuditEvents.createdAt));
    if (options?.limit) query = query.limit(options.limit) as any;
    return query;
  }

  async getInvoiceAuditTrail(invoiceId: number): Promise<SupplierAuditEvent[]> {
    return db.select().from(supplierAuditEvents)
      .where(and(
        eq(supplierAuditEvents.entityType, "invoice"),
        eq(supplierAuditEvents.entityId, String(invoiceId))
      ))
      .orderBy(supplierAuditEvents.createdAt);
  }

  async createVatVerification(verification: InsertVatVerification): Promise<VatVerification> {
    const [created] = await db.insert(vatVerifications).values(verification).returning();
    return created;
  }

  async getVatVerifications(supplierId: number): Promise<VatVerification[]> {
    return db.select().from(vatVerifications)
      .where(eq(vatVerifications.supplierId, supplierId))
      .orderBy(desc(vatVerifications.createdAt));
  }

  async createRateCardHistory(history: InsertRateCardHistory): Promise<RateCardHistory> {
    const [created] = await db.insert(rateCardHistory).values(history).returning();
    return created;
  }

  async getRateCardHistoryBySupplier(supplierId: number): Promise<RateCardHistory[]> {
    return db.select().from(rateCardHistory)
      .where(eq(rateCardHistory.supplierId, supplierId))
      .orderBy(desc(rateCardHistory.createdAt));
  }

  async getPayrollPendingShifts(tenantId: number): Promise<Shift[]> {
    return db.select().from(shifts).where(
      and(
        eq(shifts.tenantId, tenantId),
        inArray(shifts.status, ["completed", "verified"]),
        eq(shifts.payrollStatus, "pending")
      )
    ).orderBy(desc(shifts.date));
  }

  async approveShiftPayroll(shiftId: number, approvedBy: string): Promise<Shift | undefined> {
    const [updated] = await db.update(shifts).set({
      payrollStatus: "approved",
      payrollApprovedAt: new Date(),
      payrollApprovedBy: approvedBy,
      updatedAt: new Date(),
    }).where(eq(shifts.id, shiftId)).returning();
    return updated;
  }

  async rejectShiftPayroll(shiftId: number, reason: string): Promise<Shift | undefined> {
    const [updated] = await db.update(shifts).set({
      payrollStatus: "rejected",
      payrollRejectedReason: reason,
      updatedAt: new Date(),
    }).where(eq(shifts.id, shiftId)).returning();
    return updated;
  }

  async createPayrollRun(run: InsertPayrollRun): Promise<PayrollRun> {
    if (!run.runCode) {
      run.runCode = await nextCode("PAY-", "payroll_runs", "run_code", run.tenantId);
    }
    const [created] = await db.insert(payrollRuns).values(run).returning();
    return created;
  }

  async getPayrollRuns(tenantId: number): Promise<PayrollRun[]> {
    return db.select().from(payrollRuns)
      .where(eq(payrollRuns.tenantId, tenantId))
      .orderBy(desc(payrollRuns.createdAt));
  }

  async getPayrollRun(id: number): Promise<PayrollRun | undefined> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
    return run;
  }

  async updatePayrollRun(id: number, data: Partial<InsertPayrollRun>): Promise<PayrollRun | undefined> {
    const [updated] = await db.update(payrollRuns).set(data).where(eq(payrollRuns.id, id)).returning();
    return updated;
  }

  async getPayrollRunItems(payrollRunId: number): Promise<PayrollRunItem[]> {
    return db.select().from(payrollRunItems)
      .where(eq(payrollRunItems.payrollRunId, payrollRunId));
  }

  async createPayrollRunItem(item: InsertPayrollRunItem): Promise<PayrollRunItem> {
    const [created] = await db.insert(payrollRunItems).values(item).returning();
    return created;
  }

  async getEmployeePayHistory(employeeId: number): Promise<PayrollRunItem[]> {
    return db.select().from(payrollRunItems)
      .where(eq(payrollRunItems.employeeId, employeeId))
      .orderBy(desc(payrollRunItems.createdAt));
  }

  async getApprovedShiftsForPayroll(tenantId: number, periodStart: string, periodEnd: string): Promise<Shift[]> {
    return db.select().from(shifts).where(
      and(
        eq(shifts.tenantId, tenantId),
        inArray(shifts.status, ["completed", "verified"]),
        eq(shifts.payrollStatus, "approved"),
        gte(shifts.date, periodStart),
        lte(shifts.date, periodEnd)
      )
    ).orderBy(shifts.date);
  }

  async getDocumentTemplatesByTenant(tenantId: number, documentType?: string): Promise<DocumentTemplate[]> {
    if (documentType) {
      return db.select().from(documentTemplates).where(
        and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.documentType, documentType))
      ).orderBy(desc(documentTemplates.isDefault), documentTemplates.name);
    }
    return db.select().from(documentTemplates).where(eq(documentTemplates.tenantId, tenantId))
      .orderBy(desc(documentTemplates.isDefault), documentTemplates.name);
  }

  async getDocumentTemplate(id: number): Promise<DocumentTemplate | undefined> {
    const [t] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    return t;
  }

  async getDefaultTemplate(tenantId: number, documentType: string): Promise<DocumentTemplate | undefined> {
    const [t] = await db.select().from(documentTemplates).where(
      and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.documentType, documentType), eq(documentTemplates.isDefault, true))
    );
    return t;
  }

  async createDocumentTemplate(data: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [t] = await db.insert(documentTemplates).values(data).returning();
    return t;
  }

  async updateDocumentTemplate(id: number, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate | undefined> {
    const [t] = await db.update(documentTemplates).set({ ...data, updatedAt: new Date() }).where(eq(documentTemplates.id, id)).returning();
    return t;
  }

  async deleteDocumentTemplate(id: number): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  async setDefaultTemplate(tenantId: number, documentType: string, templateId: number): Promise<void> {
    await db.update(documentTemplates).set({ isDefault: false })
      .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.documentType, documentType)));
    await db.update(documentTemplates).set({ isDefault: true, updatedAt: new Date() })
      .where(eq(documentTemplates.id, templateId));
  }

  async createAgreementArchive(data: InsertSupplierAgreementArchive): Promise<SupplierAgreementArchive> {
    const [created] = await db.insert(supplierAgreementArchives).values(data).returning();
    return created;
  }

  async getAgreementArchives(supplierId: number): Promise<SupplierAgreementArchive[]> {
    return db.select().from(supplierAgreementArchives)
      .where(eq(supplierAgreementArchives.supplierId, supplierId))
      .orderBy(desc(supplierAgreementArchives.signedAt));
  }

  async getAgreementArchive(id: number): Promise<SupplierAgreementArchive | undefined> {
    const [archive] = await db.select().from(supplierAgreementArchives)
      .where(eq(supplierAgreementArchives.id, id));
    return archive;
  }

  async getSyncConfigurations(tenantId: number): Promise<SyncConfiguration[]> {
    return db.select().from(syncConfigurations)
      .where(eq(syncConfigurations.tenantId, tenantId))
      .orderBy(desc(syncConfigurations.createdAt));
  }

  async getSyncConfiguration(id: number): Promise<SyncConfiguration | undefined> {
    const [config] = await db.select().from(syncConfigurations)
      .where(eq(syncConfigurations.id, id));
    return config;
  }

  async createSyncConfiguration(data: InsertSyncConfiguration): Promise<SyncConfiguration> {
    const [created] = await db.insert(syncConfigurations).values(data).returning();
    return created;
  }

  async updateSyncConfiguration(id: number, data: Partial<InsertSyncConfiguration>): Promise<SyncConfiguration | undefined> {
    const [updated] = await db.update(syncConfigurations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(syncConfigurations.id, id)).returning();
    return updated;
  }

  async deleteSyncConfiguration(id: number): Promise<void> {
    await db.delete(syncLogs).where(eq(syncLogs.configId, id));
    await db.delete(syncConfigurations).where(eq(syncConfigurations.id, id));
  }

  async getSyncLogs(tenantId: number, limit = 50): Promise<SyncLog[]> {
    return db.select().from(syncLogs)
      .where(eq(syncLogs.tenantId, tenantId))
      .orderBy(desc(syncLogs.startedAt))
      .limit(limit);
  }

  async getSyncLog(id: number): Promise<SyncLog | undefined> {
    const [log] = await db.select().from(syncLogs)
      .where(eq(syncLogs.id, id));
    return log;
  }

  async createSyncLog(data: InsertSyncLog): Promise<SyncLog> {
    const [created] = await db.insert(syncLogs).values(data).returning();
    return created;
  }

  async updateSyncLog(id: number, data: Partial<InsertSyncLog>): Promise<SyncLog | undefined> {
    const [updated] = await db.update(syncLogs)
      .set(data)
      .where(eq(syncLogs.id, id)).returning();
    return updated;
  }

  async createInvoiceNumberAuditLog(entry: InsertInvoiceNumberAuditLog): Promise<InvoiceNumberAuditLog> {
    const [created] = await db.insert(invoiceNumberAuditLog).values(entry).returning();
    return created;
  }

  async getInvoiceNumberAuditLogsByTenant(tenantId: number): Promise<InvoiceNumberAuditLog[]> {
    return db.select().from(invoiceNumberAuditLog)
      .where(eq(invoiceNumberAuditLog.tenantId, tenantId))
      .orderBy(desc(invoiceNumberAuditLog.changedAt));
  }

  async getInvoiceNumberAuditLogByOldNumber(tenantId: number, oldNumber: string): Promise<InvoiceNumberAuditLog | undefined> {
    const [entry] = await db.select().from(invoiceNumberAuditLog)
      .where(and(eq(invoiceNumberAuditLog.tenantId, tenantId), eq(invoiceNumberAuditLog.oldNumber, oldNumber)));
    return entry;
  }

  async getMaxInvoiceSequence(tenantId: number, seriesPrefix: string): Promise<number> {
    const result = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)) as max_num FROM invoices WHERE tenant_id = $1 AND invoice_number LIKE $2`,
      [tenantId, seriesPrefix + '%']
    );
    return result.rows[0]?.max_num || 0;
  }

  async getEmployeeAvailability(employeeId: number): Promise<EmployeeAvailability[]> {
    return db.select().from(employeeAvailability).where(eq(employeeAvailability.employeeId, employeeId)).orderBy(employeeAvailability.dayOfWeek);
  }

  async getAvailabilityByTenant(tenantId: number): Promise<EmployeeAvailability[]> {
    return db.select().from(employeeAvailability).where(eq(employeeAvailability.tenantId, tenantId));
  }

  async upsertEmployeeAvailability(data: InsertEmployeeAvailability): Promise<EmployeeAvailability> {
    const existing = await db.select().from(employeeAvailability)
      .where(and(eq(employeeAvailability.employeeId, data.employeeId), eq(employeeAvailability.dayOfWeek, data.dayOfWeek)));
    if (existing.length > 0) {
      const [updated] = await db.update(employeeAvailability)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(employeeAvailability.employeeId, data.employeeId), eq(employeeAvailability.dayOfWeek, data.dayOfWeek)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(employeeAvailability).values(data).returning();
    return created;
  }

  async deleteEmployeeAvailabilityDay(employeeId: number, dayOfWeek: number): Promise<void> {
    await db.delete(employeeAvailability).where(and(eq(employeeAvailability.employeeId, employeeId), eq(employeeAvailability.dayOfWeek, dayOfWeek)));
  }

  async getShiftTemplates(tenantId: number): Promise<ShiftTemplate[]> {
    return db.select().from(shiftTemplates).where(and(eq(shiftTemplates.tenantId, tenantId), eq(shiftTemplates.isActive, true))).orderBy(shiftTemplates.name);
  }

  async getShiftTemplate(id: number, tenantId?: number): Promise<ShiftTemplate | undefined> {
    const conditions = [eq(shiftTemplates.id, id)];
    if (tenantId !== undefined) conditions.push(eq(shiftTemplates.tenantId, tenantId));
    const [template] = await db.select().from(shiftTemplates).where(and(...conditions));
    return template;
  }

  async createShiftTemplate(data: InsertShiftTemplate): Promise<ShiftTemplate> {
    const [created] = await db.insert(shiftTemplates).values(data).returning();
    return created;
  }

  async updateShiftTemplate(id: number, data: Partial<InsertShiftTemplate>): Promise<ShiftTemplate | undefined> {
    const [updated] = await db.update(shiftTemplates).set({ ...data, updatedAt: new Date() }).where(eq(shiftTemplates.id, id)).returning();
    return updated;
  }

  async deleteShiftTemplate(id: number): Promise<void> {
    await db.update(shiftTemplates).set({ isActive: false }).where(eq(shiftTemplates.id, id));
  }

  async getOpsCheckItems(tenantId: number): Promise<OpsCheckItem[]> {
    return db.select().from(opsCheckItems).where(and(eq(opsCheckItems.tenantId, tenantId), eq(opsCheckItems.isActive, true))).orderBy(opsCheckItems.sortOrder);
  }

  async createOpsCheckItem(data: InsertOpsCheckItem): Promise<OpsCheckItem> {
    const [created] = await db.insert(opsCheckItems).values(data).returning();
    return created;
  }

  async createOpsCheck(data: InsertOpsCheck): Promise<OpsCheck> {
    const [created] = await db.insert(opsChecks).values(data).returning();
    return created;
  }

  async getOpsChecksForShift(shiftId: number): Promise<OpsCheck[]> {
    return db.select().from(opsChecks).where(eq(opsChecks.shiftId, shiftId));
  }

  async createTimeOffRequest(data: InsertTimeOffRequest): Promise<TimeOffRequest> {
    const [created] = await db.insert(timeOffRequests).values(data).returning();
    return created;
  }

  async getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined> {
    const [record] = await db.select().from(timeOffRequests).where(eq(timeOffRequests.id, id));
    return record;
  }

  async getTimeOffRequestsByEmployee(employeeId: number): Promise<TimeOffRequest[]> {
    return db.select().from(timeOffRequests).where(eq(timeOffRequests.employeeId, employeeId)).orderBy(desc(timeOffRequests.createdAt));
  }

  async getTimeOffRequestsByTenant(tenantId: number, status?: string): Promise<TimeOffRequest[]> {
    const conditions = [eq(timeOffRequests.tenantId, tenantId)];
    if (status && status !== "all") {
      conditions.push(sql`${timeOffRequests.status} = ${status}`);
    }
    return db.select().from(timeOffRequests).where(and(...conditions)).orderBy(desc(timeOffRequests.createdAt));
  }

  async approveTimeOffRequest(id: number, reviewedByUserId: string, note?: string): Promise<TimeOffRequest | undefined> {
    const [updated] = await db.update(timeOffRequests)
      .set({ status: "approved", reviewedByUserId, reviewedAt: new Date(), reviewNote: note ?? null, updatedAt: new Date() })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async rejectTimeOffRequest(id: number, reviewedByUserId: string, note?: string): Promise<TimeOffRequest | undefined> {
    const [updated] = await db.update(timeOffRequests)
      .set({ status: "rejected", reviewedByUserId, reviewedAt: new Date(), reviewNote: note ?? null, updatedAt: new Date() })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async cancelTimeOffRequest(id: number): Promise<TimeOffRequest | undefined> {
    const [updated] = await db.update(timeOffRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async getApprovedTimeOffForDateRange(tenantId: number, startDate: string, endDate: string): Promise<TimeOffRequest[]> {
    return db.select().from(timeOffRequests).where(
      and(
        eq(timeOffRequests.tenantId, tenantId),
        sql`${timeOffRequests.status} = 'approved'`,
        sql`${timeOffRequests.startDate} <= ${endDate}`,
        sql`${timeOffRequests.endDate} >= ${startDate}`
      )
    );
  }
  async saveMobilePushToken(userId: string, token: string, platform?: string): Promise<void> {
    const existing = await db.select().from(mobilePushTokens).where(and(eq(mobilePushTokens.userId, userId), eq(mobilePushTokens.token, token)));
    if (existing.length > 0) return;
    await db.insert(mobilePushTokens).values({ userId, token, platform: platform || null });
  }

  async getIncidentsByUser(userId: string): Promise<Incident[]> {
    return db.select().from(incidents).where(eq(incidents.reportedBy, userId)).orderBy(desc(incidents.createdAt));
  }

  async createAiLearningEvent(event: InsertAiLearningEvent): Promise<AiLearningEvent> {
    const [created] = await db.insert(aiLearningEvents).values(event).returning();
    return created;
  }

  async updateAiLearningEvent(id: number, data: Partial<InsertAiLearningEvent>): Promise<AiLearningEvent | undefined> {
    const [updated] = await db.update(aiLearningEvents).set(data).where(eq(aiLearningEvents.id, id)).returning();
    return updated;
  }

  async getAiLearningEvents(tenantId: number, domain?: string, limit = 100): Promise<AiLearningEvent[]> {
    const conditions = [eq(aiLearningEvents.tenantId, tenantId)];
    if (domain) conditions.push(sql`${aiLearningEvents.domain} = ${domain}`);
    return db.select().from(aiLearningEvents).where(and(...conditions)).orderBy(desc(aiLearningEvents.createdAt)).limit(limit);
  }

  async getAiLearningEventsByBatch(batchId: string): Promise<AiLearningEvent[]> {
    return db.select().from(aiLearningEvents).where(eq(aiLearningEvents.batchId, batchId)).orderBy(desc(aiLearningEvents.createdAt));
  }

  async createInboxEmail(email: InsertInboxEmail): Promise<InboxEmail> {
    const [created] = await db.insert(inboxEmails).values(email).returning();
    return created;
  }

  async getInboxEmails(tenantId: number, limit = 50): Promise<InboxEmail[]> {
    return db.select().from(inboxEmails).where(eq(inboxEmails.tenantId, tenantId)).orderBy(desc(inboxEmails.receivedAt)).limit(limit);
  }

  async getInboxEmail(id: number): Promise<InboxEmail | undefined> {
    const [email] = await db.select().from(inboxEmails).where(eq(inboxEmails.id, id));
    return email;
  }

  async updateInboxEmail(id: number, data: Partial<InsertInboxEmail>): Promise<InboxEmail | undefined> {
    const [updated] = await db.update(inboxEmails).set(data).where(eq(inboxEmails.id, id)).returning();
    return updated;
  }

  async getInboxEmailByOutlookId(outlookMessageId: string, tenantId: number): Promise<InboxEmail | undefined> {
    const [email] = await db.select().from(inboxEmails).where(and(eq(inboxEmails.outlookMessageId, outlookMessageId), eq(inboxEmails.tenantId, tenantId)));
    return email;
  }

  async createEmailClassification(classification: InsertEmailClassification): Promise<EmailClassification> {
    const [created] = await db.insert(emailClassifications).values(classification).returning();
    return created;
  }

  async getEmailClassification(emailId: number): Promise<EmailClassification | undefined> {
    const [classification] = await db.select().from(emailClassifications).where(eq(emailClassifications.emailId, emailId));
    return classification;
  }

  async getEmailClassificationsByTenant(tenantId: number, limit = 50): Promise<EmailClassification[]> {
    return db.select().from(emailClassifications).where(eq(emailClassifications.tenantId, tenantId)).orderBy(desc(emailClassifications.createdAt)).limit(limit);
  }

  async createProposedAction(action: InsertProposedAction): Promise<ProposedAction> {
    const [created] = await db.insert(proposedActions).values(action).returning();
    return created;
  }

  async getProposedActions(tenantId: number, status?: string, limit = 50): Promise<ProposedAction[]> {
    const conditions = [eq(proposedActions.tenantId, tenantId)];
    if (status) conditions.push(sql`${proposedActions.status} = ${status}`);
    return db.select().from(proposedActions).where(and(...conditions)).orderBy(desc(proposedActions.createdAt)).limit(limit);
  }

  async getProposedActionsByEmail(emailId: number): Promise<ProposedAction[]> {
    return db.select().from(proposedActions).where(eq(proposedActions.emailId, emailId)).orderBy(desc(proposedActions.createdAt));
  }

  async getProposedAction(id: number): Promise<ProposedAction | undefined> {
    const [action] = await db.select().from(proposedActions).where(eq(proposedActions.id, id));
    return action;
  }

  async updateProposedAction(id: number, data: Partial<InsertProposedAction>): Promise<ProposedAction | undefined> {
    const [updated] = await db.update(proposedActions).set(data).where(eq(proposedActions.id, id)).returning();
    return updated;
  }

  async getEmailAutoApproveSettings(tenantId: number): Promise<EmailAutoApproveSetting[]> {
    return db.select().from(emailAutoApproveSettings).where(eq(emailAutoApproveSettings.tenantId, tenantId));
  }

  async upsertEmailAutoApproveSetting(tenantId: number, actionType: string, enabled: boolean, updatedBy: string): Promise<EmailAutoApproveSetting> {
    const [existing] = await db.select().from(emailAutoApproveSettings).where(and(eq(emailAutoApproveSettings.tenantId, tenantId), eq(emailAutoApproveSettings.actionType, actionType)));
    if (existing) {
      const [updated] = await db.update(emailAutoApproveSettings).set({ enabled, updatedBy, updatedAt: new Date() }).where(eq(emailAutoApproveSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(emailAutoApproveSettings).values({ tenantId, actionType, enabled, updatedBy }).returning();
    return created;
  }

  async getTenantEmailConnection(tenantId: number): Promise<TenantEmailConnection | undefined> {
    const [conn] = await db.select().from(tenantEmailConnections).where(eq(tenantEmailConnections.tenantId, tenantId));
    return conn;
  }

  async upsertTenantEmailConnection(tenantId: number, data: Partial<InsertTenantEmailConnection>): Promise<TenantEmailConnection> {
    const existing = await this.getTenantEmailConnection(tenantId);
    if (existing) {
      const [updated] = await db.update(tenantEmailConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tenantEmailConnections.tenantId, tenantId))
        .returning();
      return updated;
    }
    const insertData = {
      tenantId,
      clientId: data.clientId || "",
      clientSecret: data.clientSecret || "",
      azureTenantId: data.azureTenantId || "",
      ...data,
    };
    const [created] = await db.insert(tenantEmailConnections)
      .values(insertData)
      .returning();
    return created;
  }

  async deleteTenantEmailConnection(tenantId: number): Promise<void> {
    await db.delete(tenantEmailConnections).where(eq(tenantEmailConnections.tenantId, tenantId));
  }

  async getAllActiveEmailConnections(): Promise<TenantEmailConnection[]> {
    return db.select().from(tenantEmailConnections).where(
      and(
        eq(tenantEmailConnections.pollingEnabled, true),
        eq(tenantEmailConnections.connectionStatus, "connected")
      )
    );
  }

  async getTenantEmailSettings(tenantId: number): Promise<TenantEmailSettings | undefined> {
    const [row] = await db.select().from(tenantEmailSettings).where(eq(tenantEmailSettings.tenantId, tenantId));
    return row;
  }

  async upsertTenantEmailSettings(tenantId: number, data: Partial<InsertTenantEmailSettings>): Promise<TenantEmailSettings> {
    const existing = await this.getTenantEmailSettings(tenantId);
    if (existing) {
      const [updated] = await db.update(tenantEmailSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tenantEmailSettings.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tenantEmailSettings)
      .values({
        tenantId,
        enabled: data.enabled ?? false,
        provider: data.provider || "smtp",
        ...data,
      })
      .returning();
    return created;
  }

  async getTenantOfficerTypes(tenantId: number): Promise<TenantOfficerType[]> {
    return db.select().from(tenantOfficerTypes)
      .where(eq(tenantOfficerTypes.tenantId, tenantId))
      .orderBy(asc(tenantOfficerTypes.sortOrder), asc(tenantOfficerTypes.name));
  }

  async ensureDefaultOfficerTypes(tenantId: number): Promise<TenantOfficerType[]> {
    const existing = await this.getTenantOfficerTypes(tenantId);
    const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
    const missing = DEFAULT_OFFICER_TYPES.filter((name) => !existingNames.has(name.toLowerCase()));

    if (missing.length > 0) {
      const maxSort = existing.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0);
      const rows = missing.map((name, index) => ({
        tenantId,
        name,
        sortOrder: maxSort + index + 1,
      }));
      await db.insert(tenantOfficerTypes)
        .values(rows)
        .onConflictDoNothing({ target: [tenantOfficerTypes.tenantId, tenantOfficerTypes.name] });
    }

    return this.getTenantOfficerTypes(tenantId);
  }

  async backfillDefaultOfficerTypesForAllTenants(): Promise<void> {
    const allTenants = await this.getAllTenants();
    for (const tenant of allTenants) {
      await this.ensureDefaultOfficerTypes(tenant.id);
    }
  }

  async createTenantOfficerType(tenantId: number, name: string): Promise<TenantOfficerType> {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!normalized) throw new Error("Officer type name is required");

    const existing = await this.getTenantOfficerTypes(tenantId);
    const duplicate = existing.find((t) => t.name.toLowerCase() === normalized.toLowerCase());
    if (duplicate) return duplicate;

    const maxSort = existing.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0);
    const [created] = await db.insert(tenantOfficerTypes).values({
      tenantId,
      name: normalized,
      sortOrder: maxSort + 1,
    }).returning();
    return created;
  }

  async deleteTenantOfficerType(tenantId: number, id: number): Promise<boolean> {
    const result = await db.delete(tenantOfficerTypes)
      .where(and(eq(tenantOfficerTypes.id, id), eq(tenantOfficerTypes.tenantId, tenantId)))
      .returning({ id: tenantOfficerTypes.id });
    return result.length > 0;
  }

  async getEmployeeImmigration(employeeId: number): Promise<EmployeeImmigration | undefined> {
    const [record] = await db.select().from(employeeImmigration).where(eq(employeeImmigration.employeeId, employeeId));
    return record;
  }

  async upsertEmployeeImmigration(employeeId: number, data: Partial<InsertEmployeeImmigration>): Promise<EmployeeImmigration> {
    const existing = await this.getEmployeeImmigration(employeeId);
    if (existing) {
      const [updated] = await db.update(employeeImmigration)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeImmigration.employeeId, employeeId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(employeeImmigration)
      .values({ ...data, employeeId } satisfies typeof employeeImmigration.$inferInsert)
      .returning();
    return created;
  }

  async getLeaveEntitlement(employeeId: number, year: number): Promise<LeaveEntitlement | undefined> {
    const [record] = await db.select().from(leaveEntitlements)
      .where(and(eq(leaveEntitlements.employeeId, employeeId), eq(leaveEntitlements.year, year)));
    return record;
  }

  async getLeaveEntitlementsByTenant(tenantId: number, year: number): Promise<LeaveEntitlement[]> {
    return db.select().from(leaveEntitlements)
      .where(and(eq(leaveEntitlements.tenantId, tenantId), eq(leaveEntitlements.year, year)));
  }

  async upsertLeaveEntitlement(data: InsertLeaveEntitlement): Promise<LeaveEntitlement> {
    const existing = await this.getLeaveEntitlement(data.employeeId, data.year);
    if (existing) {
      const [updated] = await db.update(leaveEntitlements)
        .set({
          entitlementDays: data.entitlementDays,
          carriedForward: data.carriedForward,
          adjustmentDays: data.adjustmentDays,
          adjustmentReason: data.adjustmentReason,
        })
        .where(eq(leaveEntitlements.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(leaveEntitlements).values(data).returning();
    return created;
  }

  async getLeaveBalance(employeeId: number, tenantId: number, year: number): Promise<{ entitlement: number; carriedForward: number; adjustments: number; used: number; remaining: number }> {
    const tenant = await this.getTenant(tenantId);
    const defaultEntitlement = tenant?.defaultLeaveEntitlementDays ?? 28;

    const entitlementRecord = await this.getLeaveEntitlement(employeeId, year);
    const entitlement = entitlementRecord?.entitlementDays ?? defaultEntitlement;
    const carriedForward = entitlementRecord?.carriedForward ?? 0;
    const adjustments = entitlementRecord?.adjustmentDays ?? 0;

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const approvedRequests = await db.select().from(timeOffRequests).where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        sql`${timeOffRequests.status} = 'approved'`,
        sql`${timeOffRequests.leaveType} = 'annual_leave'`,
        sql`${timeOffRequests.endDate} >= ${yearStart}`,
        sql`${timeOffRequests.startDate} <= ${yearEnd}`
      )
    );

    const msPerDay = 86400000;
    const yearStartMs = new Date(yearStart).getTime();
    const yearEndMs = new Date(yearEnd).getTime();

    const used = approvedRequests.reduce((sum, r) => {
      const reqStart = new Date(r.startDate).getTime();
      const reqEnd = new Date(r.endDate).getTime();
      const totalCalendarDays = Math.round((reqEnd - reqStart) / msPerDay) + 1;
      if (totalCalendarDays <= 0) return sum + (r.totalDays || 0);
      const overlapStart = Math.max(reqStart, yearStartMs);
      const overlapEnd = Math.min(reqEnd, yearEndMs);
      const overlapDays = Math.round((overlapEnd - overlapStart) / msPerDay) + 1;
      if (overlapDays <= 0) return sum;
      const apportioned = Math.round(((r.totalDays || 0) * overlapDays) / totalCalendarDays);
      return sum + apportioned;
    }, 0);
    const remaining = entitlement + carriedForward + adjustments - used;

    return { entitlement, carriedForward, adjustments, used, remaining };
  }

  async bulkYearEndCarryForward(tenantId: number, fromYear: number, capDays: number): Promise<{ processed: number; errors: number }> {
    const toYear = fromYear + 1;
    const tenant = await this.getTenant(tenantId);
    const defaultEntitlement = tenant?.defaultLeaveEntitlementDays ?? 28;
    const employees = await this.getEmployeesByTenant(tenantId);

    let processed = 0;
    let errors = 0;

    for (const emp of employees) {
      try {
        const balance = await this.getLeaveBalance(emp.id, tenantId, fromYear);
        const unusedDays = Math.max(0, balance.remaining);
        const carryAmount = Math.min(unusedDays, capDays);

        const existingNext = await this.getLeaveEntitlement(emp.id, toYear);
        if (existingNext) {
          await db.update(leaveEntitlements)
            .set({ carriedForward: carryAmount })
            .where(eq(leaveEntitlements.id, existingNext.id));
        } else {
          await db.insert(leaveEntitlements).values({
            employeeId: emp.id,
            tenantId,
            year: toYear,
            entitlementDays: defaultEntitlement,
            carriedForward: carryAmount,
            adjustmentDays: 0,
            adjustmentReason: null,
          });
        }
        processed++;
      } catch {
        errors++;
      }
    }

    return { processed, errors };
  }

  async getProbationRecordsByTenant(tenantId: number): Promise<ProbationRecord[]> {
    return db.select().from(probationRecords)
      .where(eq(probationRecords.tenantId, tenantId))
      .orderBy(desc(probationRecords.reviewDate));
  }

  async getProbationRecordByEmployee(employeeId: number, tenantId: number): Promise<ProbationRecord | undefined> {
    const [record] = await db.select().from(probationRecords)
      .where(and(eq(probationRecords.employeeId, employeeId), eq(probationRecords.tenantId, tenantId)))
      .orderBy(desc(probationRecords.createdAt))
      .limit(1);
    return record;
  }

  async createProbationRecord(data: InsertProbationRecord): Promise<ProbationRecord> {
    const [record] = await db.insert(probationRecords).values(data).returning();
    return record;
  }

  async updateProbationRecord(id: number, tenantId: number, data: Partial<InsertProbationRecord>): Promise<ProbationRecord | undefined> {
    const [updated] = await db.update(probationRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(probationRecords.id, id), eq(probationRecords.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async getAbsencesByTenant(tenantId: number, filters?: { employeeId?: number; status?: string; absenceType?: string }): Promise<AbsenceRecord[]> {
    const conditions = [eq(absenceRecords.tenantId, tenantId)];
    if (filters?.employeeId) conditions.push(eq(absenceRecords.employeeId, filters.employeeId));
    if (filters?.status) conditions.push(eq(absenceRecords.status, filters.status as any));
    if (filters?.absenceType) conditions.push(eq(absenceRecords.absenceType, filters.absenceType as any));
    return db.select().from(absenceRecords).where(and(...conditions)).orderBy(desc(absenceRecords.startDate));
  }

  async createAbsenceRecord(data: InsertAbsenceRecord): Promise<AbsenceRecord> {
    const [record] = await db.insert(absenceRecords).values(data).returning();
    return record;
  }

  async updateAbsenceRecord(id: number, tenantId: number, data: Partial<InsertAbsenceRecord>): Promise<AbsenceRecord | undefined> {
    const [updated] = await db.update(absenceRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(absenceRecords.id, id), eq(absenceRecords.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async getProbationsDueThisMonth(tenantId: number): Promise<ProbationRecord[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const { pool } = await import("./db");
    const { rows } = await pool.query(
      `SELECT * FROM probation_records
       WHERE tenant_id = $1
         AND status IN ('active', 'extended')
         AND COALESCE(extended_review_date, review_date) >= $2
         AND COALESCE(extended_review_date, review_date) <= $3
       ORDER BY COALESCE(extended_review_date, review_date) ASC`,
      [tenantId, startOfMonth, endOfMonth]
    );
    return rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      tenantId: r.tenant_id,
      startDate: r.start_date,
      reviewDate: r.review_date,
      extendedReviewDate: r.extended_review_date,
      status: r.status,
      outcomeNotes: r.outcome_notes,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })) as ProbationRecord[];
  }

  async getHrCases(tenantId: number, filters?: { employeeId?: number; status?: string; caseType?: string }): Promise<HrCase[]> {
    const conditions = [eq(hrCases.tenantId, tenantId)];
    if (filters?.employeeId) conditions.push(eq(hrCases.employeeId, filters.employeeId));
    if (filters?.status) conditions.push(sql`${hrCases.status} = ${filters.status}`);
    if (filters?.caseType) conditions.push(sql`${hrCases.caseType} = ${filters.caseType}`);
    return db.select().from(hrCases).where(and(...conditions)).orderBy(desc(hrCases.createdAt));
  }

  async getHrCase(id: number, tenantId?: number): Promise<HrCase | undefined> {
    const conditions = [eq(hrCases.id, id)];
    if (tenantId) conditions.push(eq(hrCases.tenantId, tenantId));
    const [record] = await db.select().from(hrCases).where(and(...conditions));
    return record;
  }

  async createHrCase(data: InsertHrCase): Promise<HrCase> {
    const [created] = await db.insert(hrCases).values(data).returning();
    return created;
  }

  async updateHrCase(id: number, data: Partial<InsertHrCase>): Promise<HrCase | undefined> {
    const [updated] = await db.update(hrCases).set({ ...data, updatedAt: new Date() }).where(eq(hrCases.id, id)).returning();
    return updated;
  }

  async getHrCaseEvents(caseId: number): Promise<HrCaseEvent[]> {
    return db.select().from(hrCaseEvents).where(eq(hrCaseEvents.caseId, caseId)).orderBy(desc(hrCaseEvents.createdAt));
  }

  async createHrCaseEvent(data: InsertHrCaseEvent): Promise<HrCaseEvent> {
    const [created] = await db.insert(hrCaseEvents).values(data).returning();
    return created;
  }

  async deleteHrCase(id: number): Promise<void> {
    await db.delete(hrCaseEvents).where(eq(hrCaseEvents.caseId, id));
    await db.delete(hrCaseDocuments).where(eq(hrCaseDocuments.caseId, id));
    await db.delete(hrCases).where(eq(hrCases.id, id));
  }

  async updateHrCaseEvent(id: number, caseId: number, notes: string): Promise<HrCaseEvent | undefined> {
    const [updated] = await db.update(hrCaseEvents)
      .set({ notes })
      .where(and(eq(hrCaseEvents.id, id), eq(hrCaseEvents.caseId, caseId)))
      .returning();
    return updated;
  }

  async deleteHrCaseEvent(id: number, caseId: number): Promise<void> {
    await db.delete(hrCaseEvents).where(and(eq(hrCaseEvents.id, id), eq(hrCaseEvents.caseId, caseId)));
  }

  async getHrCaseDocuments(caseId: number): Promise<HrCaseDocument[]> {
    return db.select().from(hrCaseDocuments).where(eq(hrCaseDocuments.caseId, caseId)).orderBy(desc(hrCaseDocuments.createdAt));
  }

  async getHrCaseDocument(id: number): Promise<HrCaseDocument | undefined> {
    const [doc] = await db.select().from(hrCaseDocuments).where(eq(hrCaseDocuments.id, id));
    return doc;
  }

  async createHrCaseDocument(data: InsertHrCaseDocument): Promise<HrCaseDocument> {
    const [created] = await db.insert(hrCaseDocuments).values(data).returning();
    return created;
  }

  async deleteHrCaseDocument(id: number, caseId: number): Promise<void> {
    await db.delete(hrCaseDocuments).where(and(eq(hrCaseDocuments.id, id), eq(hrCaseDocuments.caseId, caseId)));
  }

  async getAbsencesByEmployee(employeeId: number): Promise<AbsenceRecord[]> {
    return db.select().from(absenceRecords)
      .where(eq(absenceRecords.employeeId, employeeId))
      .orderBy(desc(absenceRecords.startDate));
  }

  async getBradfordFactor(employeeId: number): Promise<{ score: number; spells: number; totalDays: number; rating: "green" | "amber" | "red" }> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const cutoffDate = twelveMonthsAgo.toISOString().split("T")[0];

    const records = await db.select().from(absenceRecords)
      .where(and(
        eq(absenceRecords.employeeId, employeeId),
        gte(absenceRecords.startDate, cutoffDate)
      ));

    const spells = records.length;
    const totalDays = records.reduce((sum, r) => sum + (r.totalDays ?? 0), 0);
    const score = spells * spells * totalDays;
    const rating: "green" | "amber" | "red" = score < 36 ? "green" : score <= 200 ? "amber" : "red";

    return { score, spells, totalDays, rating };
  }

  async getTrainingRecordsByEmployee(employeeId: number): Promise<TrainingRecord[]> {
    return db.select().from(trainingRecords)
      .where(eq(trainingRecords.employeeId, employeeId))
      .orderBy(desc(trainingRecords.createdAt));
  }

  async getTrainingRecordsByEmployeeForTenant(employeeId: number, tenantId: number): Promise<TrainingRecord[]> {
    return db.select().from(trainingRecords)
      .where(and(eq(trainingRecords.employeeId, employeeId), eq(trainingRecords.tenantId, tenantId)))
      .orderBy(desc(trainingRecords.createdAt));
  }

  async getTrainingRecordsByTenant(tenantId: number): Promise<TrainingRecord[]> {
    return db.select().from(trainingRecords)
      .where(eq(trainingRecords.tenantId, tenantId))
      .orderBy(desc(trainingRecords.createdAt));
  }

  async getTrainingRecord(id: number): Promise<TrainingRecord | undefined> {
    const [record] = await db.select().from(trainingRecords).where(eq(trainingRecords.id, id));
    return record;
  }

  async createTrainingRecord(data: InsertTrainingRecord): Promise<TrainingRecord> {
    const [record] = await db.insert(trainingRecords).values(data).returning();
    return record;
  }

  async updateTrainingRecord(id: number, data: Partial<InsertTrainingRecord>): Promise<TrainingRecord | undefined> {
    const [record] = await db.update(trainingRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainingRecords.id, id))
      .returning();
    return record;
  }

  async deleteTrainingRecord(id: number): Promise<void> {
    await db.delete(trainingRecords).where(eq(trainingRecords.id, id));
  }

  async getTenantXeroConnection(tenantId: number): Promise<TenantXeroConnection | undefined> {
    const [conn] = await db.select().from(tenantXeroConnections).where(eq(tenantXeroConnections.tenantId, tenantId));
    return conn;
  }

  async upsertTenantXeroConnection(tenantId: number, data: Partial<InsertTenantXeroConnection>): Promise<TenantXeroConnection> {
    const existing = await this.getTenantXeroConnection(tenantId);
    if (existing) {
      const [updated] = await db.update(tenantXeroConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tenantXeroConnections.tenantId, tenantId))
        .returning();
      return updated;
    }
    const insertData = {
      tenantId,
      clientId: data.clientId || "",
      clientSecret: data.clientSecret || "",
      connectionStatus: data.connectionStatus || "disconnected",
      syncEnabled: data.syncEnabled ?? false,
      syncIntervalMinutes: data.syncIntervalMinutes ?? 60,
      ...data,
    };
    const [created] = await db.insert(tenantXeroConnections).values(insertData).returning();
    return created;
  }

  async deleteTenantXeroConnection(tenantId: number): Promise<void> {
    await db.delete(tenantXeroConnections).where(eq(tenantXeroConnections.tenantId, tenantId));
  }

  async getAllActiveXeroConnections(): Promise<TenantXeroConnection[]> {
    return db.select().from(tenantXeroConnections).where(
      and(
        eq(tenantXeroConnections.syncEnabled, true),
        eq(tenantXeroConnections.connectionStatus, "connected")
      )
    );
  }

  async getXeroSyncRecord(tenantId: number, entityType: string, entityId: number): Promise<XeroSyncRecord | undefined> {
    const [record] = await db.select().from(xeroSyncRecords).where(
      and(
        eq(xeroSyncRecords.tenantId, tenantId),
        eq(xeroSyncRecords.entityType, entityType),
        eq(xeroSyncRecords.entityId, entityId)
      )
    );
    return record;
  }

  async upsertXeroSyncRecord(tenantId: number, data: Partial<InsertXeroSyncRecord> & { entityType: string; entityId: number }): Promise<XeroSyncRecord> {
    const existing = await this.getXeroSyncRecord(tenantId, data.entityType, data.entityId);
    if (existing) {
      const [updated] = await db.update(xeroSyncRecords)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(xeroSyncRecords.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(xeroSyncRecords).values({
      tenantId,
      entityType: data.entityType,
      entityId: data.entityId,
      xeroId: data.xeroId || null,
      syncStatus: data.syncStatus || "pending",
      lastSyncedAt: data.lastSyncedAt || null,
      lastError: data.lastError || null,
    }).returning();
    return created;
  }

  async getXeroSyncRecordsByType(tenantId: number, entityType: string): Promise<XeroSyncRecord[]> {
    return db.select().from(xeroSyncRecords).where(
      and(
        eq(xeroSyncRecords.tenantId, tenantId),
        eq(xeroSyncRecords.entityType, entityType)
      )
    );
  }

  async getXeroSyncRecords(tenantId: number): Promise<XeroSyncRecord[]> {
    return db.select().from(xeroSyncRecords).where(eq(xeroSyncRecords.tenantId, tenantId));
  }
}

export const storage = new DatabaseStorage();
