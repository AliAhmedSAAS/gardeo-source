import { useState, useCallback, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, AlertTriangle,
  Download, Users, MapPin, Building, Clock, Truck, RefreshCw, CheckCircle2,
  XCircle, Loader2, Link2, Plus,
} from "lucide-react";

type DataType = "employees" | "sites" | "clients" | "timesheets" | "suppliers";

interface FieldMapping {
  systemField: string;
  label: string;
  required: boolean;
  description?: string;
}

const DATA_TYPE_CONFIG: Record<DataType, { label: string; icon: typeof Users; description: string; fields: FieldMapping[] }> = {
  employees: {
    label: "Employees",
    icon: Users,
    description: "Import employee records including personal details, SIA licences, and DBS certificates",
    fields: [
      { systemField: "firstName", label: "First Name", required: true },
      { systemField: "lastName", label: "Last Name", required: true },
      { systemField: "email", label: "Email", required: true },
      { systemField: "phone", label: "Phone", required: false },
      { systemField: "employeeNumber", label: "Employee Number", required: false },
      { systemField: "dateOfBirth", label: "Date of Birth", required: false, description: "Format: YYYY-MM-DD" },
      { systemField: "nationalInsurance", label: "National Insurance No.", required: false },
      { systemField: "addressLine1", label: "Address Line 1", required: false },
      { systemField: "addressLine2", label: "Address Line 2", required: false },
      { systemField: "city", label: "City", required: false },
      { systemField: "postcode", label: "Postcode", required: false },
      { systemField: "jobTitle", label: "Job Title", required: false },
      { systemField: "department", label: "Department", required: false },
      { systemField: "employmentType", label: "Employment Type", required: false, description: "e.g. full_time, part_time, contract" },
      { systemField: "hourlyRate", label: "Hourly Rate (£)", required: false },
      { systemField: "startDate", label: "Start Date", required: false, description: "Format: YYYY-MM-DD" },
      { systemField: "siaLicenseNumber", label: "SIA Licence Number", required: false },
      { systemField: "siaLicenseType", label: "SIA Licence Type", required: false },
      { systemField: "siaExpiryDate", label: "SIA Expiry Date", required: false, description: "Format: YYYY-MM-DD" },
      { systemField: "dbsCertificateNumber", label: "DBS Certificate Number", required: false },
      { systemField: "dbsIssueDate", label: "DBS Issue Date", required: false, description: "Format: YYYY-MM-DD" },
      { systemField: "supplierName", label: "Supplier Name", required: false, description: "Supplier company name — leave blank for in-house employees" },
      { systemField: "supplierExternalId", label: "Supplier External ID", required: false, description: "Supplier ID from your previous system (numeric) — used to link to imported supplier" },
      { systemField: "externalId", label: "External ID", required: false, description: "Employee ID from your previous system (numeric) — used for timesheet matching" },
    ],
  },
  sites: {
    label: "Sites / Locations",
    icon: MapPin,
    description: "Import site and location records with client details",
    fields: [
      { systemField: "name", label: "Site Name", required: true },
      { systemField: "address", label: "Address", required: true },
      { systemField: "city", label: "City", required: false },
      { systemField: "postcode", label: "Postcode", required: false },
      { systemField: "latitude", label: "Latitude", required: false },
      { systemField: "longitude", label: "Longitude", required: false },
      { systemField: "clientName", label: "Client Name", required: false },
      { systemField: "clientContact", label: "Client Contact", required: false },
      { systemField: "clientEmail", label: "Client Email", required: false },
      { systemField: "clientPhone", label: "Client Phone", required: false },
      { systemField: "clientExternalId", label: "Client External ID", required: false, description: "Client ID from your previous system (numeric) — used to link site to imported client" },
      { systemField: "contractRef", label: "Contract Reference", required: false },
      { systemField: "notes", label: "Notes", required: false },
      { systemField: "externalId", label: "External ID", required: false, description: "Site ID from your previous system (numeric) — used for timesheet matching" },
    ],
  },
  clients: {
    label: "Clients",
    icon: Building,
    description: "Import client/company records as site entries with client details attached",
    fields: [
      { systemField: "name", label: "Client Name", required: true },
      { systemField: "address", label: "Address", required: true },
      { systemField: "city", label: "City", required: false },
      { systemField: "postcode", label: "Postcode", required: false },
      { systemField: "contactName", label: "Contact Name", required: false },
      { systemField: "contactEmail", label: "Contact Email", required: false },
      { systemField: "contactPhone", label: "Contact Phone", required: false },
      { systemField: "contractRef", label: "Contract Reference", required: false },
      { systemField: "notes", label: "Notes", required: false },
      { systemField: "externalId", label: "External ID", required: false, description: "Client ID from your previous system (numeric) — used for timesheet matching" },
    ],
  },
  timesheets: {
    label: "Timesheets / Shifts",
    icon: Clock,
    description: "Import historical timesheet and shift data",
    fields: [
      { systemField: "employeeName", label: "Employee Name", required: false, description: "Full name or employee number (or use First Name + Last Name)" },
      { systemField: "firstName", label: "First Name", required: false, description: "Employee first name (used with Last Name)" },
      { systemField: "lastName", label: "Last Name", required: false, description: "Employee last name (used with First Name)" },
      { systemField: "clientName", label: "Client Name", required: false, description: "Client company name" },
      { systemField: "siteName", label: "Site Name", required: true, description: "Site or location name" },
      { systemField: "supplierName", label: "Supplier Name", required: false, description: "Supplier company who provided the cover" },
      { systemField: "siaLicence", label: "SIA Licence", required: false, description: "Officer's SIA licence number" },
      { systemField: "date", label: "Date", required: true, description: "Format: YYYY-MM-DD" },
      { systemField: "startTime", label: "Start Time", required: true, description: "Format: HH:MM (24hr)" },
      { systemField: "endTime", label: "End Time", required: true, description: "Format: HH:MM (24hr)" },
      { systemField: "breakMinutes", label: "Break (minutes)", required: false },
      { systemField: "hoursWorked", label: "Hours Worked", required: false, description: "Total hours worked for the shift" },
      { systemField: "hourlyRate", label: "Hourly Rate", required: false, description: "Pay rate per hour (£)" },
      { systemField: "total", label: "Total Pay", required: false, description: "Total amount for the shift (£)" },
      { systemField: "status", label: "Status", required: false, description: "e.g. completed, scheduled, cancelled" },
      { systemField: "title", label: "Shift Title", required: false },
      { systemField: "notes", label: "Notes", required: false },
      { systemField: "employeeExternalId", label: "Employee External ID", required: false, description: "Employee ID from your previous system (numeric)" },
      { systemField: "clientExternalId", label: "Client External ID", required: false, description: "Client ID from your previous system (numeric)" },
      { systemField: "supplierExternalId", label: "Supplier External ID", required: false, description: "Supplier ID from your previous system (numeric)" },
      { systemField: "siteExternalId", label: "Site External ID", required: false, description: "Site ID from your previous system (numeric)" },
      { systemField: "shiftExternalId", label: "Shift External ID", required: false, description: "Shift ID from your previous system — used to prevent duplicate imports" },
    ],
  },
  suppliers: {
    label: "Suppliers",
    icon: Truck,
    description: "Import supplier company records",
    fields: [
      { systemField: "companyName", label: "Company Name", required: true },
      { systemField: "contactName", label: "Contact Name", required: true },
      { systemField: "email", label: "Email", required: true },
      { systemField: "phone", label: "Phone", required: false },
      { systemField: "address", label: "Address", required: false },
      { systemField: "city", label: "City", required: false },
      { systemField: "postcode", label: "Postcode", required: false },
      { systemField: "supplierType", label: "Supplier Type", required: false, description: "labour or non_labour" },
      { systemField: "registeredOfficeAddress", label: "Registered Office Address", required: false },
      { systemField: "registeredOfficeCity", label: "Registered Office City", required: false },
      { systemField: "registeredOfficePostcode", label: "Registered Office Postcode", required: false },
      { systemField: "registeredOfficeCountry", label: "Registered Office Country", required: false },
      { systemField: "tradingAddress", label: "Trading Address", required: false },
      { systemField: "tradingCity", label: "Trading City", required: false },
      { systemField: "tradingPostcode", label: "Trading Postcode", required: false },
      { systemField: "financeContactName", label: "Finance Contact Name", required: false },
      { systemField: "financeContactEmail", label: "Finance Contact Email", required: false },
      { systemField: "natureOfSupply", label: "Nature of Supply", required: false },
      { systemField: "vatNumber", label: "VAT Number", required: false },
      { systemField: "vatStatus", label: "VAT Status", required: false, description: "vat_registered or not_vat_registered" },
      { systemField: "companyRegNumber", label: "Company Reg Number", required: false },
      { systemField: "incorporationDate", label: "Incorporation Date", required: false },
      { systemField: "accountName", label: "Bank Account Name", required: false },
      { systemField: "bankName", label: "Bank Name", required: false },
      { systemField: "sortCode", label: "Sort Code", required: false },
      { systemField: "accountNumber", label: "Account Number", required: false },
      { systemField: "billingFrequency", label: "Billing Frequency", required: false, description: "e.g. weekly, fortnightly, monthly" },
      { systemField: "notes", label: "Notes", required: false },
      { systemField: "onboardingDate", label: "Onboarding Date", required: false, description: "Format: YYYY-MM-DD — date supplier was onboarded/approved" },
      { systemField: "externalId", label: "External ID", required: false, description: "Supplier ID from your previous system (numeric) — used for timesheet matching" },
    ],
  },
};

const COMMON_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "forename", "given name", "first_name", "firstname"],
  lastName: ["last name", "surname", "family name", "last_name", "lastname"],
  email: ["email", "email address", "e-mail", "emailaddress"],
  phone: ["phone", "telephone", "mobile", "phone number", "tel", "contact number"],
  dateOfBirth: ["date of birth", "dob", "birth date", "birthdate", "date_of_birth"],
  nationalInsurance: ["ni", "ni number", "national insurance", "nino", "ni_number"],
  addressLine1: ["address", "address line 1", "address1", "street", "address_line_1"],
  addressLine2: ["address line 2", "address2", "address_line_2"],
  city: ["city", "town", "town/city"],
  postcode: ["postcode", "post code", "zip", "zip code", "postal code"],
  name: ["name", "site name", "location name", "site_name"],
  companyName: ["company name", "company", "organisation", "organization", "company_name"],
  contactName: ["contact name", "contact", "contact_name"],
  employeeNumber: ["employee number", "emp number", "emp no", "employee_number", "employee id", "emp_no", "badge"],
  jobTitle: ["job title", "position", "role", "job_title"],
  department: ["department", "dept", "team"],
  hourlyRate: ["hourly rate", "rate", "pay rate", "hourly_rate", "rate per hour", "£ per hour"],
  startDate: ["start date", "hire date", "join date", "start_date"],
  siaLicenseNumber: ["sia licence", "sia number", "sia license", "sia_license_number", "sia licence number", "sia licence no", "sia license number", "sia license no"],
  siaLicenseType: ["sia type", "licence type", "sia_license_type"],
  siaExpiryDate: ["sia expiry", "sia expiry date", "sia_expiry_date"],
  dbsCertificateNumber: ["dbs number", "dbs certificate", "dbs_certificate_number"],
  dbsIssueDate: ["dbs issue date", "dbs date", "dbs_issue_date"],
  employmentType: ["employment type", "contract type", "employment_type"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  clientName: ["client name", "client", "customer", "client_name"],
  clientContact: ["client contact", "contact person", "client_contact"],
  clientEmail: ["client email", "client_email"],
  clientPhone: ["client phone", "client_phone"],
  contractRef: ["contract ref", "contract reference", "contract number", "contract_ref"],
  date: ["date", "shift date", "work date"],
  startTime: ["start time", "start", "time in", "start_time", "clock in"],
  endTime: ["end time", "end", "finish", "time out", "end_time", "clock out", "finish time"],
  breakMinutes: ["break", "break minutes", "break_minutes", "break time", "break mins", "break min"],
  hoursWorked: ["hours worked", "hours", "total hours", "hours_worked", "worked hours", "duration"],
  total: ["total", "total pay", "total amount", "gross pay", "amount", "pay total", "shift total"],
  status: ["status", "shift status", "state", "completion status"],
  siaLicence: ["sia licence", "sia license", "sia number", "sia licence number", "sia license number", "sia", "licence", "licence number", "license number", "sia licence no"],
  title: ["title", "shift title", "shift type", "shift_title"],
  notes: ["notes", "comments", "remarks"],
  siteName: ["site name", "site", "location", "site_name", "client site"],
  employeeName: ["employee name", "employee", "worker", "staff", "employee_name", "officer", "officer name", "guard", "guard name", "operative", "operative name"],
  supplierName: ["supplier name", "supplier", "supplier_name", "agency", "agency name", "provider", "subcontractor", "sub contractor", "covering supplier"],
  onboardingDate: ["onboarding date", "onboarding_date", "start date", "start_date", "approved date", "approval date", "onboarded", "date onboarded", "supplier start date"],
  supplierType: ["supplier type", "supplier_type", "type", "service type"],
  registeredOfficeAddress: ["registered office address", "registered address", "registered_office_address", "reg address"],
  registeredOfficeCity: ["registered office city", "registered city", "registered_office_city"],
  registeredOfficePostcode: ["registered office postcode", "registered postcode", "registered_office_postcode", "reg postcode"],
  registeredOfficeCountry: ["registered office country", "registered country", "registered_office_country"],
  tradingAddress: ["trading address", "trading_address", "trade address"],
  tradingCity: ["trading city", "trading_city"],
  tradingPostcode: ["trading postcode", "trading_postcode"],
  financeContactName: ["finance contact", "finance contact name", "finance_contact_name", "accounts contact"],
  financeContactEmail: ["finance email", "finance contact email", "finance_contact_email", "accounts email"],
  natureOfSupply: ["nature of supply", "nature_of_supply", "service description", "supply type"],
  vatStatus: ["vat status", "vat_status", "vat registered"],
  incorporationDate: ["incorporation date", "incorporation_date", "date of incorporation", "incorporated"],
  accountName: ["account name", "account_name", "bank account name"],
  billingFrequency: ["billing frequency", "billing_frequency", "payment frequency", "invoice frequency", "pay frequency"],
  vatNumber: ["vat number", "vat", "vat_number", "vat no"],
  companyRegNumber: ["company reg", "crn", "company registration", "company_reg_number"],
  bankName: ["bank name", "bank", "bank_name"],
  sortCode: ["sort code", "sort_code"],
  accountNumber: ["account number", "account_number", "acc number"],
  contactEmail: ["contact email", "contact_email"],
  contactPhone: ["contact phone", "contact_phone"],
  address: ["address", "site address", "location address"],
  externalId: ["external id", "external_id", "old id", "legacy id", "original id", "previous id", "old system id", "migration id", "ref number", "reference id", "source id"],
  employeeExternalId: ["employee external id", "employee_external_id", "employee old id", "employee legacy id", "employee id", "emp external id", "emp id", "worker id", "officer id"],
  clientExternalId: ["client external id", "client_external_id", "client old id", "client legacy id", "client id", "customer id", "customer external id"],
  supplierExternalId: ["supplier external id", "supplier_external_id", "supplier old id", "supplier legacy id", "supplier id", "agency id", "agency external id", "provider id"],
  siteExternalId: ["site external id", "site_external_id", "site old id", "site legacy id", "site id", "location id", "location external id"],
  shiftExternalId: ["shift external id", "shift_external_id", "shift id", "shift_id", "shift old id", "shift legacy id", "timesheet id", "timesheet_id", "record id"],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_\-./\\()#*]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bno\b\.?/g, "number")
    .replace(/\bnr\b\.?/g, "number")
    .trim();
}

function autoMapColumn(csvHeader: string, fields: FieldMapping[]): string {
  const normalized = normalizeHeader(csvHeader);
  const normalizedRaw = csvHeader.toLowerCase().trim();

  for (const field of fields) {
    if (normalizedRaw === field.systemField.toLowerCase()) return field.systemField;

    const aliases = COMMON_ALIASES[field.systemField] || [];
    if (aliases.some(a => a === normalizedRaw || normalizeHeader(a) === normalized)) return field.systemField;

    if (normalized === field.label.toLowerCase()) return field.systemField;
  }

  for (const field of fields) {
    const aliases = COMMON_ALIASES[field.systemField] || [];
    if (aliases.some(a => normalized.includes(a) || a.includes(normalized))) return field.systemField;
  }
  return "";
}

type Step = "select" | "upload" | "mapping" | "preview" | "importing" | "complete";

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface SiteDuplicateMatch {
  siteId: number;
  siteName: string;
  matchReason: string;
  score: number;
}

interface PotentialDuplicate {
  incomingSiteName: string;
  matches: SiteDuplicateMatch[];
}

interface SiteDecision {
  action: "use_existing" | "create_new";
  siteId?: number;
}

interface EntityDuplicateCandidate {
  incomingName: string;
  incomingEmail?: string;
  matchReason: string;
  matchedName: string;
  score: number;
}

interface EntityPreviewResult {
  potentialDuplicates: EntityDuplicateCandidate[];
  toCreate: number;
  toMerge: number;
  toSkip?: number;
  totalRows: number;
}

interface SitePreviewResult {
  potentialDuplicates: Array<{ incomingSiteName: string; matches: SiteDuplicateMatch[] }>;
  toCreate: number;
  toMerge: number;
  totalRows: number;
}

export default function DataImportPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select");
  const [dataType, setDataType] = useState<DataType | "">("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);
  const [siteDecisions, setSiteDecisions] = useState<Record<string, SiteDecision>>({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [entityPreviewResult, setEntityPreviewResult] = useState<EntityPreviewResult | SitePreviewResult | null>(null);
  const [showEntityPreviewDialog, setShowEntityPreviewDialog] = useState(false);
  const [entityDecisions, setEntityDecisions] = useState<Record<string, "use_existing" | "create_new">>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<Array<{ id: number; companyName: string }>>([]);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);

  useEffect(() => {
    if (dataType === "timesheets") {
      setIsSuppliersLoading(true);
      apiRequest("GET", "/api/suppliers")
        .then(res => res.json())
        .then((data: Array<{ id: number; companyName: string; isActive?: boolean }>) => {
          const active = data
            .filter(s => s.isActive !== false)
            .sort((a, b) => a.companyName.localeCompare(b.companyName));
          setSuppliers(active);
        })
        .catch(() => setSuppliers([]))
        .finally(() => setIsSuppliersLoading(false));
    }
  }, [dataType]);

  const config = dataType ? DATA_TYPE_CONFIG[dataType] : null;

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          toast({ title: "Empty file", description: "The file contains no data rows", variant: "destructive" });
          return;
        }

        const headers = results.meta.fields || [];
        const data = results.data as Record<string, string>[];
        setCsvHeaders(headers);
        setCsvData(data);

        if (config) {
          const autoMapped: Record<string, string> = {};
          headers.forEach(h => {
            const match = autoMapColumn(h, config.fields);
            if (match) autoMapped[h] = match;
          });
          setColumnMapping(autoMapped);
        }

        setStep("mapping");
        toast({ title: "File loaded", description: `${data.length} rows found with ${headers.length} columns` });
      },
      error: (error) => {
        toast({ title: "Parse error", description: error.message, variant: "destructive" });
      },
    });
  }, [config, toast]);

  const mappedData = useMemo(() => {
    if (!config) return [];
    return csvData.map((row, idx) => {
      const mapped: Record<string, string> = { _rowIndex: String(idx + 2) };
      Object.entries(columnMapping).forEach(([csvCol, sysField]) => {
        if (sysField) mapped[sysField] = (row[csvCol] || "").trim();
      });
      return mapped;
    });
  }, [csvData, columnMapping, config]);

  const validate = useCallback(() => {
    if (!config) return [];
    const errors: ValidationError[] = [];
    const requiredFields = config.fields.filter(f => f.required);
    const mappedFields = new Set(Object.values(columnMapping));

    mappedData.forEach((row) => {
      requiredFields.forEach(field => {
        if (!mappedFields.has(field.systemField) || !row[field.systemField]) {
          errors.push({ row: parseInt(row._rowIndex), field: field.label, message: `${field.label} is required` });
        }
      });
    });
    return errors;
  }, [config, columnMapping, mappedData]);

  const handleValidate = useCallback(() => {
    const errors = validate();
    setValidationErrors(errors);
    setStep("preview");
  }, [validate]);

  const executeImport = useCallback(async (decisions?: Record<string, SiteDecision>, entityDecs?: Record<string, "use_existing" | "create_new">) => {
    if (!dataType || !config) return;

    setIsImporting(true);
    setStep("importing");
    setImportProgress(0);

    try {
      const cleanData = mappedData.map((row) => {
        const { _rowIndex, ...rest } = row;
        return rest;
      });
      const batchSize = 200;
      let totalSuccess = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      const allErrors: Array<{ row: number; field: string; message: string }> = [];

      for (let i = 0; i < cleanData.length; i += batchSize) {
        const batch = cleanData.slice(i, i + batchSize);
        const batchStart = i;

        const body: any = { data: batch, batchStart };
        if ((dataType === "timesheets" || dataType === "sites") && decisions && Object.keys(decisions).length > 0) {
          body.siteDecisions = decisions;
        }
        if ((dataType === "employees" || dataType === "clients") && entityDecs && Object.keys(entityDecs).length > 0) {
          body.entityDecisions = entityDecs;
        }
        if (dataType === "timesheets" && selectedSupplierId) {
          body.overrideSupplierId = Number(selectedSupplierId);
        }

        const response = await apiRequest("POST", `/api/data-import/${dataType}`, body);

        let result: any;
        try {
          result = await response.json();
        } catch {
          console.error("Failed to parse import response as JSON");
          throw new Error("Server returned an invalid response. Please try again.");
        }
        totalSuccess += result.success || 0;
        totalFailed += result.failed || 0;
        totalSkipped += result.skipped || 0;
        if (result.errors) allErrors.push(...result.errors);

        setImportProgress(Math.min(100, Math.round(((i + batch.length) / cleanData.length) * 100)));
      }

      setImportResult({
        total: cleanData.length,
        success: totalSuccess,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: allErrors,
      });
      setStep("complete");
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Import failed", description: error.message || "An error occurred during import", variant: "destructive" });
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  }, [dataType, config, mappedData, selectedSupplierId, toast]);

  const handleImport = useCallback(async () => {
    if (!dataType || !config) return;

    if (dataType === "timesheets") {
      setIsPreviewLoading(true);
      let previewSucceeded = false;
      try {
        const cleanData = mappedData.map((row) => {
          const { _rowIndex, ...rest } = row;
          return rest;
        });

        const previewBody: any = { data: cleanData };
        if (selectedSupplierId) {
          previewBody.overrideSupplierId = Number(selectedSupplierId);
        }
        const response = await apiRequest("POST", "/api/data-import/timesheets/preview", previewBody);
        let result: any;
        try {
          result = await response.json();
        } catch {
          console.error("Failed to parse preview response as JSON");
          throw new Error("Server returned an invalid response. Please try again.");
        }

        previewSucceeded = true;

        if (result.potentialDuplicates && result.potentialDuplicates.length > 0) {
          setPotentialDuplicates(result.potentialDuplicates);
          const defaultDecisions: Record<string, SiteDecision> = {};
          result.potentialDuplicates.forEach((dup: PotentialDuplicate) => {
            defaultDecisions[dup.incomingSiteName] = {
              action: "use_existing",
              siteId: dup.matches[0].siteId,
            };
          });
          setSiteDecisions(defaultDecisions);
          setShowDuplicateDialog(true);
        } else {
          await executeImport();
        }
      } catch (error: any) {
        console.error("Import flow error:", error);
        if (!previewSucceeded) {
          toast({ title: "Preview failed", description: error.message || "Could not check for duplicates", variant: "destructive" });
        }
      } finally {
        setIsPreviewLoading(false);
      }
    } else if (dataType === "sites") {
      setIsPreviewLoading(true);
      try {
        const cleanData = mappedData.map((row) => {
          const { _rowIndex, ...rest } = row;
          return rest;
        });
        const response = await apiRequest("POST", "/api/data-import/sites/preview", { data: cleanData });
        const result: any = await response.json();
        const hasDuplicates = result.potentialDuplicates && result.potentialDuplicates.length > 0;
        if (hasDuplicates) {
          setPotentialDuplicates(result.potentialDuplicates);
          const defaultDecisions: Record<string, SiteDecision> = {};
          result.potentialDuplicates.forEach((dup: PotentialDuplicate) => {
            defaultDecisions[dup.incomingSiteName] = {
              action: "use_existing",
              siteId: dup.matches[0].siteId,
            };
          });
          setSiteDecisions(defaultDecisions);
          setShowDuplicateDialog(true);
        } else {
          await executeImport();
        }
      } catch (error: any) {
        toast({ title: "Preview failed", description: error.message || "Could not check for duplicates", variant: "destructive" });
        await executeImport();
      } finally {
        setIsPreviewLoading(false);
      }
    } else if (dataType === "employees" || dataType === "clients") {
      setIsPreviewLoading(true);
      try {
        const cleanData = mappedData.map((row) => {
          const { _rowIndex, ...rest } = row;
          return rest;
        });
        const response = await apiRequest("POST", `/api/data-import/${dataType}/preview`, { data: cleanData });
        const result: any = await response.json();
        const hasDuplicates = result.potentialDuplicates && result.potentialDuplicates.length > 0;
        if (hasDuplicates) {
          setEntityPreviewResult(result);
          const defaultDecisions: Record<string, "use_existing" | "create_new"> = {};
          result.potentialDuplicates.forEach((dup: EntityDuplicateCandidate) => {
            const key = dup.incomingName;
            defaultDecisions[key] = "use_existing";
          });
          setEntityDecisions(defaultDecisions);
          setShowEntityPreviewDialog(true);
        } else {
          await executeImport();
        }
      } catch (error: any) {
        toast({ title: "Preview failed", description: error.message || "Could not check for duplicates", variant: "destructive" });
        await executeImport();
      } finally {
        setIsPreviewLoading(false);
      }
    } else {
      await executeImport();
    }
  }, [dataType, config, mappedData, selectedSupplierId, toast, executeImport]);

  const handleDuplicateConfirm = useCallback(async () => {
    setShowDuplicateDialog(false);
    const normalizedDecisions: Record<string, SiteDecision> = {};
    for (const [key, value] of Object.entries(siteDecisions)) {
      normalizedDecisions[key] = value;
      normalizedDecisions[key.toLowerCase()] = value;
    }
    await executeImport(normalizedDecisions);
  }, [executeImport, siteDecisions]);

  const handleUseAllExisting = useCallback(() => {
    const decisions: Record<string, SiteDecision> = {};
    potentialDuplicates.forEach((dup) => {
      decisions[dup.incomingSiteName] = {
        action: "use_existing",
        siteId: dup.matches[0].siteId,
      };
    });
    setSiteDecisions(decisions);
  }, [potentialDuplicates]);

  const handleCreateAllNew = useCallback(() => {
    const decisions: Record<string, SiteDecision> = {};
    potentialDuplicates.forEach((dup) => {
      decisions[dup.incomingSiteName] = { action: "create_new" };
    });
    setSiteDecisions(decisions);
  }, [potentialDuplicates]);

  const handleReset = () => {
    setStep("select");
    setDataType("");
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
    setFileName("");
    setPotentialDuplicates([]);
    setSiteDecisions({});
    setShowDuplicateDialog(false);
    setEntityPreviewResult(null);
    setShowEntityPreviewDialog(false);
    setEntityDecisions({});
    setSelectedSupplierId("");
  };

  const downloadTemplate = (type: DataType) => {
    const cfg = DATA_TYPE_CONFIG[type];
    const headers = cfg.fields.map(f => f.label);
    const csv = Papa.unparse({ fields: headers, data: [] });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mappedCount = Object.values(columnMapping).filter(Boolean).length;
  const requiredMapped = config ? config.fields.filter(f => f.required && Object.values(columnMapping).includes(f.systemField)).length : 0;
  const requiredTotal = config ? config.fields.filter(f => f.required).length : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Data Import / Migration</h1>
        <p className="text-muted-foreground mt-1">
          Bulk upload data from other systems when onboarding a new customer. Map your columns to Gardeo fields.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {(["select", "upload", "mapping", "preview", "importing", "complete"] as Step[]).map((s, i) => {
          const labels = ["Select Type", "Upload File", "Map Columns", "Preview", "Importing", "Complete"];
          const stepNum = i + 1;
          const isCurrent = step === s;
          const isPast = (["select", "upload", "mapping", "preview", "importing", "complete"] as Step[]).indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${isPast ? "bg-[#FF8C42]" : "bg-gray-200"}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${isCurrent ? "bg-[#1F3A5F] text-white" : isPast ? "bg-[#FF8C42] text-white" : "bg-gray-100 text-gray-500"}`}
                data-testid={`step-indicator-${s}`}>
                {isPast ? <Check className="w-3.5 h-3.5" /> : <span>{stepNum}</span>}
                <span className="hidden sm:inline">{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {step === "select" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Data Type</CardTitle>
              <CardDescription>Choose the type of data you want to import</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.entries(DATA_TYPE_CONFIG) as [DataType, typeof DATA_TYPE_CONFIG["employees"]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isSelected = dataType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setDataType(key)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected ? "border-[#FF8C42] bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                      data-testid={`select-type-${key}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#FF8C42] text-white" : "bg-gray-100 text-gray-500"}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold">{cfg.label}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{cfg.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download Templates</CardTitle>
              <CardDescription>Download a CSV template with the correct column headers for each data type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(Object.entries(DATA_TYPE_CONFIG) as [DataType, typeof DATA_TYPE_CONFIG["employees"]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <Button key={key} variant="outline" onClick={() => downloadTemplate(key)} data-testid={`download-template-${key}`}>
                      <Download className="w-4 h-4 mr-2" />
                      <Icon className="w-4 h-4 mr-1" />
                      {cfg.label} Template
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => dataType && setStep("upload")}
              disabled={!dataType}
              className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
              data-testid="button-next-upload"
            >
              Next: Upload File <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "upload" && config && (
        <div className="space-y-6">
          {dataType === "timesheets" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#FF8C42]" />
                  Supplier Selection
                </CardTitle>
                <CardDescription>
                  Optionally select a supplier for all shifts in this import. If selected, this overrides any supplier column in the CSV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md">
                  <Select
                    value={selectedSupplierId}
                    onValueChange={(val) => setSelectedSupplierId(val === "__none__" ? "" : val)}
                    disabled={isSuppliersLoading}
                  >
                    <SelectTrigger data-testid="select-override-supplier">
                      <SelectValue placeholder={isSuppliersLoading ? "Loading suppliers..." : "— No supplier override (use CSV data) —"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No supplier override (use CSV data) —</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSupplierId && (
                    <p className="text-sm text-muted-foreground mt-2">
                      All shifts will be assigned to <span className="font-medium">{suppliers.find(s => String(s.id) === selectedSupplierId)?.companyName}</span>, ignoring any supplier columns in the CSV.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <config.icon className="w-5 h-5 text-[#FF8C42]" />
                Upload {config.label} Data
              </CardTitle>
              <CardDescription>
                Upload a CSV file containing your {config.label.toLowerCase()} data. The first row should contain column headers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-[#FF8C42] transition-colors">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">Drop your CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground mb-4">Supports CSV files up to 10MB</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  data-testid="input-csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" asChild>
                    <span data-testid="button-browse-file">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Browse Files
                    </span>
                  </Button>
                </label>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-2">Required Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {config.fields.filter(f => f.required).map(f => (
                    <Badge key={f.systemField} variant="destructive" className="text-xs">{f.label}</Badge>
                  ))}
                </div>
                <h4 className="font-medium mt-4 mb-2">Optional Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {config.fields.filter(f => !f.required).map(f => (
                    <Badge key={f.systemField} variant="secondary" className="text-xs">{f.label}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("select")} data-testid="button-back-select">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      )}

      {step === "mapping" && config && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Map your CSV columns to Gardeo fields. We've auto-detected some mappings for you.
                <span className="ml-2 font-medium">{fileName} — {csvData.length} rows</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  {mappedCount} / {csvHeaders.length} columns mapped
                </Badge>
                <Badge variant={requiredMapped === requiredTotal ? "default" : "destructive"} className="text-sm">
                  {requiredMapped} / {requiredTotal} required fields mapped
                </Badge>
              </div>

              <div className="space-y-3">
                {csvHeaders.map(header => {
                  const currentMapping = columnMapping[header] || "";
                  const alreadyMapped = Object.entries(columnMapping)
                    .filter(([k, v]) => v && k !== header)
                    .map(([, v]) => v);

                  return (
                    <div key={header} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`mapping-row-${header}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Sample: {csvData[0]?.[header] || "(empty)"}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <Select
                          value={currentMapping}
                          onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [header]: val === "__none__" ? "" : val }))}
                        >
                          <SelectTrigger className="w-full" data-testid={`mapping-select-${header}`}>
                            <SelectValue placeholder="— Skip this column —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Skip this column —</SelectItem>
                            {config.fields
                              .filter(f => !alreadyMapped.includes(f.systemField) || f.systemField === currentMapping)
                              .map(f => (
                                <SelectItem key={f.systemField} value={f.systemField}>
                                  {f.label} {f.required && "*"}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {currentMapping && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-upload">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button
              onClick={handleValidate}
              disabled={requiredMapped < requiredTotal}
              className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
              data-testid="button-validate"
            >
              Validate & Preview <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && config && (
        <div className="space-y-6">
          {dataType === "timesheets" && selectedSupplierId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2" data-testid="banner-supplier-override">
              <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-sm text-blue-800">
                All shifts will be assigned to supplier: <span className="font-semibold">{suppliers.find(s => String(s.id) === selectedSupplierId)?.companyName}</span>
              </span>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview & Validation</CardTitle>
              <CardDescription>{csvData.length} rows ready for import</CardDescription>
            </CardHeader>
            <CardContent>
              {validationErrors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="font-semibold text-red-700">{validationErrors.length} validation issues found</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {validationErrors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-sm text-red-600">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                    {validationErrors.length > 20 && (
                      <p className="text-sm text-red-500 font-medium">... and {validationErrors.length - 20} more</p>
                    )}
                  </div>
                </div>
              )}

              {validationErrors.length === 0 && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-700">All rows passed validation</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="preview-table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-gray-500">Row</th>
                      {config.fields
                        .filter(f => Object.values(columnMapping).includes(f.systemField))
                        .map(f => (
                          <th key={f.systemField} className="text-left p-2 font-medium text-gray-500">
                            {f.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedData.slice(0, 10).map((row, i) => {
                      const rowErrors = validationErrors.filter(e => e.row === parseInt(row._rowIndex));
                      return (
                        <tr key={i} className={`border-b ${rowErrors.length > 0 ? "bg-red-50" : ""}`}>
                          <td className="p-2 text-gray-400">{row["_rowIndex"]}</td>
                          {config.fields
                            .filter(f => Object.values(columnMapping).includes(f.systemField))
                            .map(f => {
                              const hasError = rowErrors.some(e => e.field === f.label);
                              return (
                                <td key={f.systemField} className={`p-2 ${hasError ? "text-red-600 font-medium" : ""}`}>
                                  {row[f.systemField] || <span className="text-gray-300">—</span>}
                                </td>
                              );
                            })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {csvData.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2 p-2">
                    Showing first 10 of {csvData.length} rows
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-mapping">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Mapping
            </Button>
            <Button
              onClick={handleImport}
              disabled={isPreviewLoading}
              className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 text-white"
              data-testid="button-start-import"
            >
              {isPreviewLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking for duplicates...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {csvData.length} Records
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#1F3A5F] mb-4" />
            <h3 className="text-xl font-semibold mb-2">Importing Data...</h3>
            <p className="text-muted-foreground mb-6">Please wait while your data is being processed</p>
            <div className="max-w-md mx-auto">
              <Progress value={importProgress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{importProgress}% complete</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "complete" && importResult && (
        <div className="space-y-6">
          {dataType === "timesheets" && selectedSupplierId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2" data-testid="banner-supplier-override-complete">
              <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-sm text-blue-800">
                Supplier override applied: <span className="font-semibold">{suppliers.find(s => String(s.id) === selectedSupplierId)?.companyName}</span>
              </span>
            </div>
          )}
          <Card>
            <CardContent className="py-12 text-center">
              {importResult.failed === 0 && importResult.success > 0 ? (
                <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              ) : importResult.success > 0 ? (
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
              ) : (
                <AlertTriangle className="w-16 h-16 mx-auto text-orange-500 mb-4" />
              )}
              <h3 className="text-2xl font-bold mb-2" data-testid="text-import-result">
                {importResult.success > 0 && importResult.failed === 0 ? "Import Complete" : importResult.success === 0 && importResult.skipped > 0 ? "All Records Already Exist" : "Import Finished with Errors"}
              </h3>
              {importResult.success === 0 && importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground mb-2">All records in this file were already imported. No duplicates were created.</p>
              )}
              {(() => {
                const mergedCount = importResult.errors.filter(e => e.field === "Merged").length;
                const newCount = importResult.success - mergedCount;
                return (
                  <div className="flex justify-center gap-6 mt-4 flex-wrap">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-[#1F3A5F]" data-testid="text-total-count">{importResult.total}</p>
                      <p className="text-sm text-muted-foreground">Total Records</p>
                    </div>
                    {newCount > 0 && (
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600" data-testid="text-new-count">{newCount}</p>
                        <p className="text-sm text-muted-foreground">New Records</p>
                      </div>
                    )}
                    {mergedCount > 0 && (
                      <div className="text-center">
                        <p className="text-3xl font-bold text-blue-600" data-testid="text-merged-count">{mergedCount}</p>
                        <p className="text-sm text-muted-foreground">Merged (Updated)</p>
                      </div>
                    )}
                    {importResult.skipped > 0 && (
                      <div className="text-center">
                        <p className="text-3xl font-bold text-orange-500" data-testid="text-skipped-count">{importResult.skipped}</p>
                        <p className="text-sm text-muted-foreground">Unchanged (Duplicates)</p>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div className="text-center">
                        <p className="text-3xl font-bold text-red-600" data-testid="text-failed-count">{importResult.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.errors.some(e => e.field !== "Duplicate" && e.field !== "Merged") ? <XCircle className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-orange-500" />}
                  {importResult.errors.some(e => e.field !== "Duplicate" && e.field !== "Merged") ? "Import Details" : "Import Details"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className={`text-sm ${err.field === "Auto-Created" ? "text-emerald-600" : err.field === "Merged" ? "text-blue-600" : err.field === "Duplicate" ? "text-orange-600" : "text-red-600"}`}>
                      Row {err.row}: {err.field} — {err.message}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Button onClick={handleReset} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-new-import">
              <RefreshCw className="w-4 h-4 mr-2" />
              Start New Import
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" data-testid="dialog-site-duplicates">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Potential Duplicate Sites Found
            </DialogTitle>
            <DialogDescription>
              {potentialDuplicates.length} site{potentialDuplicates.length !== 1 ? 's' : ''} in your import may already exist. Choose whether to use the existing site or create a new one for each.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pb-2">
            <Button variant="outline" size="sm" onClick={handleUseAllExisting} data-testid="button-use-all-existing">
              <Link2 className="w-3.5 h-3.5 mr-1.5" />
              Use All Existing
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateAllNew} data-testid="button-create-all-new">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create All New
            </Button>
          </div>

          <div className="flex-1 max-h-[50vh] overflow-y-auto pr-4">
            <div className="space-y-3">
              {potentialDuplicates.map((dup, idx) => {
                const decision = siteDecisions[dup.incomingSiteName];
                const isUsingExisting = decision?.action === "use_existing";
                return (
                  <div key={idx} className="border rounded-lg p-4" data-testid={`duplicate-row-${idx}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-muted-foreground">Incoming site name:</p>
                        <p className="font-semibold truncate">{dup.incomingSiteName}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant={isUsingExisting ? "default" : "outline"}
                          className={isUsingExisting ? "bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" : ""}
                          onClick={() => setSiteDecisions(prev => ({
                            ...prev,
                            [dup.incomingSiteName]: { action: "use_existing", siteId: decision?.siteId || dup.matches[0].siteId },
                          }))}
                          data-testid={`button-use-existing-${idx}`}
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Use Existing
                        </Button>
                        <Button
                          size="sm"
                          variant={!isUsingExisting ? "default" : "outline"}
                          className={!isUsingExisting ? "bg-amber-600 hover:bg-amber-700" : ""}
                          onClick={() => setSiteDecisions(prev => ({
                            ...prev,
                            [dup.incomingSiteName]: { action: "create_new" },
                          }))}
                          data-testid={`button-create-new-${idx}`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Create New
                        </Button>
                      </div>
                    </div>

                    {isUsingExisting && dup.matches.length > 1 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1.5">Select which existing site to use:</p>
                        <Select
                          value={String(decision?.siteId || dup.matches[0].siteId)}
                          onValueChange={(val) => setSiteDecisions(prev => ({
                            ...prev,
                            [dup.incomingSiteName]: { action: "use_existing", siteId: parseInt(val) },
                          }))}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-existing-site-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dup.matches.map((match) => (
                              <SelectItem key={match.siteId} value={String(match.siteId)}>
                                {match.siteName} — {match.matchReason} ({match.score}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isUsingExisting && dup.matches.length === 1 && (
                      <div className="mt-1 flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-sm text-green-700">
                          Will map to: <span className="font-medium">{dup.matches[0].siteName}</span>
                        </span>
                        <Badge variant="secondary" className="text-xs">{dup.matches[0].matchReason}</Badge>
                      </div>
                    )}

                    {!isUsingExisting && (
                      <div className="mt-1 flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-sm text-amber-700">Will create a new site record</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)} data-testid="button-cancel-duplicates">
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateConfirm}
              className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 text-white"
              data-testid="button-confirm-import"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirm & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEntityPreviewDialog} onOpenChange={setShowEntityPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-entity-duplicates">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Potential Duplicate Records Found
            </DialogTitle>
            <DialogDescription>
              {entityPreviewResult && "potentialDuplicates" in entityPreviewResult
                ? `${entityPreviewResult.potentialDuplicates.length} record${entityPreviewResult.potentialDuplicates.length !== 1 ? "s" : ""} in your import may already exist. Existing records will be merged (empty fields filled in only).`
                : "Review potential duplicates before proceeding."}
            </DialogDescription>
          </DialogHeader>

          {entityPreviewResult && (
            <div className="flex gap-4 text-sm border rounded-lg p-3 bg-muted/30">
              <span className="text-green-700 font-medium">{entityPreviewResult.toCreate} new</span>
              <span className="text-blue-700 font-medium">{entityPreviewResult.toMerge} merge/update</span>
              <span className="text-muted-foreground">{entityPreviewResult.totalRows} total rows</span>
            </div>
          )}

          <div className="flex-1 max-h-[45vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              {entityPreviewResult && "potentialDuplicates" in entityPreviewResult &&
                (entityPreviewResult.potentialDuplicates as EntityDuplicateCandidate[]).map((dup, idx) => {
                  const decision = entityDecisions[dup.incomingName] || "use_existing";
                  return (
                    <div key={idx} className="border rounded-lg p-3" data-testid={`entity-duplicate-row-${idx}`}>
                      <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{dup.incomingName}</p>
                          {dup.incomingEmail && (
                            <p className="text-xs text-muted-foreground">{dup.incomingEmail}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{dup.matchReason}</Badge>
                            <span className="text-xs text-muted-foreground">score: {dup.score}</span>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-xs font-medium text-blue-700">{dup.matchedName}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant={decision === "use_existing" ? "default" : "outline"}
                              className={`text-xs h-7 ${decision === "use_existing" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                              data-testid={`button-merge-entity-${idx}`}
                              onClick={() => setEntityDecisions(prev => ({ ...prev, [dup.incomingName]: "use_existing" }))}
                            >
                              Merge with existing
                            </Button>
                            {dup.matchReason !== "Email match" && (
                              <Button
                                size="sm"
                                variant={decision === "create_new" ? "default" : "outline"}
                                className={`text-xs h-7 ${decision === "create_new" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                                data-testid={`button-create-new-entity-${idx}`}
                                onClick={() => setEntityDecisions(prev => ({ ...prev, [dup.incomingName]: "create_new" }))}
                              >
                                Create new
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEntityPreviewDialog(false)} data-testid="button-cancel-entity-preview">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setShowEntityPreviewDialog(false);
                await executeImport(undefined, entityDecisions);
              }}
              className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 text-white"
              data-testid="button-confirm-entity-import"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirm & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
