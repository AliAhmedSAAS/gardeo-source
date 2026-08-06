import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Users, ShieldCheck, ClipboardCheck, FileText,
  Phone, Mail, MapPin, Calendar, CheckCircle2, AlertTriangle,
  Clock, XCircle, User, Briefcase, Shield, Plus, BookOpen,
  ChevronLeft, ChevronRight, Loader2, ScrollText, Award,
  CreditCard, Home, UserCheck, FileCheck,
  KeyRound, Send, PoundSterling, Pencil, Trash2, Building2, Globe, RefreshCw,
  Copy, Merge, ArrowRight, Zap, ExternalLink, Download, Upload, Paperclip, StickyNote, Heart, Map,
} from "lucide-react";
import {
  StaffProfileSidebar,
  NotesTab,
  PreferredSitesTab,
  ExpertiseTab,
  BackgroundTab,
  HealthTab,
  VettingHubTab,
  DocsHubTab,
  ImmigrationTab,
  BankDetailsTab,
  RightOfWorkTab,
} from "@/components/employees/StaffProfileHub";
import { AddressFieldsGroup } from "@/components/AddressFieldsGroup";
import { SiaLicenceVerify, SiaLicenceVerifyStatus } from "@/components/employees/SiaLicenceVerify";
import { ETHNIC_ORIGIN_OPTIONS, isKnownEthnicOrigin } from "@shared/ethnicOriginOptions";

type EnrichedEmployee = {
  id: number;
  userId: string | null;
  tenantId: number | null;
  employeeNumber: string | null;
  dateOfBirth: string | null;
  nationalInsurance: string | null;
  gender: string | null;
  nationality: string | null;
  placeOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  startDate: string | null;
  jobTitle: string | null;
  department: string | null;
  employmentType: string | null;
  hourlyRate: string | null;
  uniformSize: string | null;
  bootSize: string | null;
  equipmentNotes: string | null;
  siaLicenseNumber: string | null;
  siaLicenseType: string | null;
  siaExpiryDate: string | null;
  siaLastVerifiedAt?: string | null;
  siaRegisterStatus?: string | null;
  siaRegisterHolderName?: string | null;
  dbsCertificateNumber: string | null;
  dbsIssueDate: string | null;
  hasFirstAid: boolean | null;
  firstAidExpiry: string | null;
  supplierId: number | null;
  supplierName: string | null;
  lastSyncedAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  userIsActive: boolean;
  onboardingStatus: string | null;
  vettingCount: number;
  vettingPassed: number;
};

type ImmigrationData = {
  id: number;
  passportDocNo: string | null;
  passportCountry: string | null;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  visaNeeded: boolean | null;
  visaType: string | null;
  visaIssueDate: string | null;
  visaExpiryDate: string | null;
  visaDateOfEntry: string | null;
  shareCode: string | null;
  shareCodeExpiry: string | null;
  brpNeeded: boolean | null;
  brpNumber: string | null;
  brpExpiry: string | null;
} | null;

type EmployeeDetail = EnrichedEmployee & {
  vettingRecords: Array<{
    id: number;
    checkType: string;
    status: string | null;
    referenceNumber: string | null;
    requestedDate: string | null;
    completedDate: string | null;
    expiryDate: string | null;
    result: string | null;
    notes: string | null;
  }>;
  documents: Array<{
    id: number;
    documentType: string;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    expiryDate: string | null;
    isVerified: boolean | null;
    externalUploadedAt: string | null;
    createdAt: string | null;
  }>;
  emergencyContacts: Array<{
    id: number;
    name: string;
    relationship: string;
    phone: string;
    alternatePhone: string | null;
    email: string | null;
    isPrimary: boolean | null;
  }>;
  references: Array<{
    id: number;
    refereeName: string;
    refereeEmail: string | null;
    refereePhone: string | null;
    company: string;
    jobTitle: string | null;
    status: string | null;
    verificationStatus: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  }>;
  employmentHistory: Array<{
    id: number;
    employerName: string;
    jobTitle: string;
    dateFrom: string;
    dateTo: string | null;
    isCurrent: boolean | null;
    reasonForLeaving: string | null;
    duties: string | null;
    verificationStatus: string | null;
    submittedDate: string | null;
    refereeAddress: string | null;
    refereePostcode: string | null;
  }>;
  immigration: ImmigrationData;
  policies: Array<{
    id: number;
    policy_name: string;
    policy_type: string;
    version: string | null;
    issued_at: string;
    issued_by: string | null;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
    status: string;
    notes: string | null;
  }>;
  auditTrail: Array<{
    id: number;
    event_type: string;
    event_category: string;
    title: string;
    description: string | null;
    performed_by_name: string | null;
    event_at: string;
  }>;
  secondPhone?: string | null;
  maritalStatus?: string | null;
  officerStep?: number | null;
  vettingStartDate?: string | null;
  vettingCompleteAt?: string | null;
  contractEndDate?: string | null;
  sageId?: string | null;
  photoUrl?: string | null;
  ethnicOrigin?: string | null;
  paymentType?: string | null;
  permitType?: string | null;
  officerType?: string | null;
  livingFrom?: string | null;
  previousAddressLine1?: string | null;
  previousAddressLine2?: string | null;
  previousCity?: string | null;
  previousCounty?: string | null;
  previousPostcode?: string | null;
  previousLivingFrom?: string | null;
  previousLivingTo?: string | null;
  notes?: any[];
  preferredSites?: any[];
  education?: any[];
  drivingLicences?: any[];
  health?: any;
  certificates?: any[];
  siaLicences?: any[];
  pForm?: any;
  vettingAudit?: any[];
  rightOfWorkChecks?: any[];
  addressHistory?: any[];
};

const ONBOARDING_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  invited: { label: "Invited", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  under_review: { label: "Under Review", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  completed: { label: "Completed", variant: "default" },
};

const VETTING_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  not_started: { label: "Not Started", variant: "secondary" },
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "secondary" },
  passed: { label: "Passed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
};

const STANDARD_POLICIES = [
  { name: "Company Handbook", type: "handbook" },
  { name: "Health & Safety Policy", type: "policy" },
  { name: "Data Protection Policy (GDPR)", type: "policy" },
  { name: "Equal Opportunities Policy", type: "policy" },
  { name: "Disciplinary Procedure", type: "policy" },
  { name: "Grievance Procedure", type: "policy" },
  { name: "Anti-Bribery & Corruption Policy", type: "policy" },
  { name: "Whistleblowing Policy", type: "policy" },
  { name: "Uniform & Appearance Policy", type: "policy" },
  { name: "Lone Worker Policy", type: "policy" },
  { name: "Use of Force Policy", type: "policy" },
  { name: "Mobile Phone & Device Policy", type: "policy" },
  { name: "Social Media Policy", type: "policy" },
  { name: "Drug & Alcohol Policy", type: "policy" },
  { name: "Absence Management Policy", type: "policy" },
  { name: "Code of Conduct", type: "policy" },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getComplianceStatus(emp: EnrichedEmployee) {
  if (emp.vettingCount === 0) return { label: "No Checks", variant: "secondary" as const, icon: Clock };
  if (emp.vettingPassed === emp.vettingCount) return { label: "Compliant", variant: "default" as const, icon: CheckCircle2 };
  if (emp.vettingPassed === 0) return { label: "Non-Compliant", variant: "destructive" as const, icon: XCircle };
  return { label: "Partial", variant: "secondary" as const, icon: AlertTriangle };
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function getSiaExpiryStatus(siaExpiryDate: string | null): { color: string; label: string; bg: string } {
  if (!siaExpiryDate) return { color: "text-gray-400 dark:text-gray-500", label: "No SIA", bg: "bg-gray-100 dark:bg-gray-800" };
  const expiry = new Date(siaExpiryDate);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { color: "text-red-600 dark:text-red-400", label: "Expired", bg: "bg-red-50 dark:bg-red-900/20" };
  if (daysLeft <= 60) return { color: "text-amber-600 dark:text-amber-400", label: `${daysLeft}d`, bg: "bg-amber-50 dark:bg-amber-900/20" };
  return { color: "text-green-600 dark:text-green-400", label: "Valid", bg: "bg-green-50 dark:bg-green-900/20" };
}

function getDbsStatus(dbsCertificateNumber: string | null): { color: string; label: string; bg: string } {
  if (!dbsCertificateNumber) return { color: "text-red-600 dark:text-red-400", label: "No DBS", bg: "bg-red-50 dark:bg-red-900/20" };
  return { color: "text-green-600 dark:text-green-400", label: "DBS ✓", bg: "bg-green-50 dark:bg-green-900/20" };
}

const EMPLOYEE_DETAIL_TAB_GROUPS = [
  {
    group: "Profile",
    tabs: [
      { value: "personal", label: "Personal", icon: User, testId: "tab-personal" },
      { value: "background", label: "Background", icon: Briefcase, testId: "tab-background" },
      { value: "immigration", label: "Immigration", icon: Globe, testId: "tab-immigration" },
      { value: "bank-details", label: "Bank Details", icon: CreditCard, testId: "tab-bank-details" },
      { value: "emergency", label: "Emergency", icon: Phone, testId: "tab-emergency" },
      { value: "health", label: "Health", icon: Heart, testId: "tab-health" },
      { value: "notes", label: "Notes", icon: StickyNote, testId: "tab-notes" },
    ],
  },
  {
    group: "Compliance",
    tabs: [
      { value: "bs7858", label: "BS7858", icon: Shield, testId: "tab-bs7858" },
      { value: "vetting", label: "Vetting", icon: ShieldCheck, testId: "tab-vetting" },
      { value: "documents", label: "Documents", icon: FileText, testId: "tab-documents" },
      { value: "policies", label: "Policies", icon: BookOpen, testId: "tab-policies" },
      { value: "right-of-work", label: "Right of Work", icon: Globe, testId: "tab-row" },
    ],
  },
  {
    group: "HR",
    tabs: [
      { value: "probation", label: "Probation", icon: ClipboardCheck, testId: "tab-probation" },
      { value: "absences", label: "Absence", icon: Calendar, testId: "tab-absences" },
      { value: "training", label: "Training", icon: Award, testId: "tab-training" },
      { value: "portal", label: "Portal Access", icon: KeyRound, testId: "tab-portal-access" },
    ],
  },
  {
    group: "Operations",
    tabs: [
      { value: "pay-rates", label: "Pay Rates", icon: PoundSterling, testId: "tab-pay-rates" },
      { value: "preferred-sites", label: "Sites", icon: Map, testId: "tab-preferred-sites" },
      { value: "expertise", label: "Expertise", icon: Award, testId: "tab-expertise" },
    ],
  },
] as const;

function ComplianceRing({ percentage, size = 44 }: { percentage: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  const color = percentage >= 100 ? "#16a34a" : percentage >= 60 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={size < 44 ? 9 : 10} fontWeight="600" fill={color}>
        {percentage}%
      </text>
    </svg>
  );
}

type PaginatedEmployeeResponse = {
  data: EnrichedEmployee[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; active: number; compliant: number; onboarding: number };
};

export default function EmployeesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageLimit = 50;
  const [matchDetail, detailParams] = useRoute("/admin/employees/:id");
  const parsedDetailId = matchDetail && detailParams?.id ? parseInt(detailParams.id, 10) : NaN;
  const selectedEmployeeId = matchDetail && !isNaN(parsedDetailId) ? parsedDetailId : null;
  const closeDetail = () => {
    setIsEditing(false);
    setShowAddContact(false);
    setEditingContactId(null);
    setDetailTab("personal");
    navigate("/admin/employees");
  };
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "", lastName: "", email: "", username: "", phone: "",
    jobTitle: "", department: "", employmentType: "full_time", supplierId: "",
    startDate: "", dateOfBirth: "", nationalInsurance: "", gender: "",
    nationality: "British", addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", country: "United Kingdom",
  });
  const [policyForm, setPolicyForm] = useState({ policyName: "", policyType: "policy", version: "1.0", notes: "" });
  const [showPayRateForm, setShowPayRateForm] = useState(false);
  const [editingPayRate, setEditingPayRate] = useState<any>(null);
  const [payRateForm, setPayRateForm] = useState({ hourlyRate: "", effectiveFrom: "", effectiveTo: "", reason: "" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [detailTab, setDetailTab] = useState("personal");
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false });
  const [showDedupDialog, setShowDedupDialog] = useState(false);
  const [selectedPrimaries, setSelectedPrimaries] = useState<Record<string, number>>({});
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(pageLimit));
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data: paginatedData, isLoading } = useQuery<PaginatedEmployeeResponse>({
    queryKey: ["/api/admin/employees", page, debouncedSearch, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const employees = paginatedData?.data || [];
  const totalCount = paginatedData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageLimit);

  const { data: supplierOptions = [] } = useQuery<Array<{ id: number; companyName: string }>>({
    queryKey: ["/api/suppliers"],
  });

  const { data: employeeDetail, isLoading: isDetailLoading, isError: isDetailError } = useQuery<EmployeeDetail>({
    queryKey: ["/api/admin/employees", selectedEmployeeId],
    enabled: !!selectedEmployeeId,
    retry: false,
  });

  const { data: officerTypes = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/tenant/officer-types"],
    enabled: !!selectedEmployeeId,
  });

  const officerTypeNames = officerTypes.map((t) => t.name);
  const hasLegacyOfficerType =
    !!editForm.officerType &&
    !officerTypeNames.some((n) => n.toLowerCase() === String(editForm.officerType).toLowerCase());

  const { data: bs7858Data } = useQuery<any>({
    queryKey: ["/api/admin/employees", selectedEmployeeId, "bs7858"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${selectedEmployeeId}/bs7858`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedEmployeeId,
  });

  const { data: payRates = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/employees", selectedEmployeeId, "pay-rates"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${selectedEmployeeId}/pay-rates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedEmployeeId,
  });

  const createPayRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/admin/employees/${selectedEmployeeId}/pay-rates`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pay rate added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId, "pay-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      setShowPayRateForm(false);
      setPayRateForm({ hourlyRate: "", effectiveFrom: "", effectiveTo: "", reason: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePayRateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/employee-pay-rates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pay rate updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId, "pay-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      setEditingPayRate(null);
      setPayRateForm({ hourlyRate: "", effectiveFrom: "", effectiveTo: "", reason: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePayRateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/employee-pay-rates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pay rate deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId, "pay-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/employees", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee added", description: "New employee has been created successfully. Default password: Password123!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      setShowAddDialog(false);
      setAddForm({
        firstName: "", lastName: "", email: "", username: "", phone: "",
        jobTitle: "", department: "", employmentType: "full_time", supplierId: "",
        startDate: "", dateOfBirth: "", nationalInsurance: "", gender: "",
        nationality: "British", addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", country: "United Kingdom",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/employees/${selectedEmployeeId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      setIsEditing(false);
      setDetailTab("personal");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/admin/employees/${selectedEmployeeId}/emergency-contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
      setShowAddContact(false);
      setContactForm({ name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/employees/${selectedEmployeeId}/emergency-contacts/${contactId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
      setEditingContactId(null);
      setContactForm({ name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest("DELETE", `/api/admin/employees/${selectedEmployeeId}/emergency-contacts/${contactId}`);
    },
    onSuccess: () => {
      toast({ title: "Contact deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/employees/bulk-delete", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.deleted} employee${data.deleted !== 1 ? "s" : ""} deleted` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: dedupData, isLoading: isDedupLoading, refetch: refetchDedups } = useQuery<{
    groups: Array<{
      key: string;
      confidence: number;
      members: Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        employeeNumber: string | null;
        externalId: string | null;
        supplierId: number | null;
        supplierName: string | null;
        siaLicenseNumber: string | null;
        nationalInsurance: string | null;
        dateOfBirth: string | null;
        userIsActive: boolean;
        shiftCount: number;
        docCount: number;
        bankCount: number;
        createdAt: string;
        isPlaceholder: boolean;
        isOrphaned: boolean;
      }>;
    }>;
    summary: { totalGroups: number; totalDuplicates: number; orphanedCount: number };
  }>({
    queryKey: ["/api/admin/employees/duplicates"],
    enabled: showDedupDialog,
  });

  const mergeMutation = useMutation({
    mutationFn: async (data: { primaryId: number; secondaryIds: number[] }) => {
      const res = await apiRequest("POST", "/api/admin/employees/merge", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Merge complete", description: `${data.mergedCount} record(s) merged into primary #${data.primaryId}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
    },
    onError: (err: any) => toast({ title: "Merge failed", description: err.message, variant: "destructive" }),
  });

  const purgeMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/employees/bulk-purge", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Purge complete", description: `${data.purged} orphaned record(s) purged` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
    },
    onError: (err: any) => toast({ title: "Purge failed", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const startEditing = () => {
    if (!employeeDetail) return;
    setEditForm({
      firstName: employeeDetail.firstName || "",
      lastName: employeeDetail.lastName || "",
      email: employeeDetail.email || "",
      phone: employeeDetail.phone || "",
      secondPhone: employeeDetail.secondPhone || "",
      employeeNumber: employeeDetail.employeeNumber || "",
      sageId: employeeDetail.sageId || "",
      supplierId: employeeDetail.supplierId ? String(employeeDetail.supplierId) : "",
      jobTitle: employeeDetail.jobTitle || "",
      department: employeeDetail.department || "",
      employmentType: employeeDetail.employmentType || "",
      officerType: employeeDetail.officerType || "",
      permitType: employeeDetail.permitType || "",
      ethnicOrigin: employeeDetail.ethnicOrigin || "",
      startDate: employeeDetail.startDate || "",
      contractEndDate: employeeDetail.contractEndDate || "",
      vettingStartDate: employeeDetail.vettingStartDate || "",
      dateOfBirth: employeeDetail.dateOfBirth || "",
      placeOfBirth: employeeDetail.placeOfBirth || "",
      maritalStatus: employeeDetail.maritalStatus || "",
      gender: employeeDetail.gender || "",
      nationality: employeeDetail.nationality || "",
      nationalInsurance: employeeDetail.nationalInsurance || "",
      addressLine1: employeeDetail.addressLine1 || "",
      addressLine2: employeeDetail.addressLine2 || "",
      city: employeeDetail.city || "",
      county: employeeDetail.county || "",
      postcode: employeeDetail.postcode || "",
      country: employeeDetail.country || "United Kingdom",
      livingFrom: employeeDetail.livingFrom || "",
      previousAddressLine1: employeeDetail.previousAddressLine1 || "",
      previousAddressLine2: employeeDetail.previousAddressLine2 || "",
      previousCity: employeeDetail.previousCity || "",
      previousCounty: employeeDetail.previousCounty || "",
      previousPostcode: employeeDetail.previousPostcode || "",
      previousLivingFrom: employeeDetail.previousLivingFrom || "",
      previousLivingTo: employeeDetail.previousLivingTo || "",
      siaLicenseNumber: employeeDetail.siaLicenseNumber || "",
      siaLicenseType: employeeDetail.siaLicenseType || "",
      siaExpiryDate: employeeDetail.siaExpiryDate || "",
      dbsCertificateNumber: employeeDetail.dbsCertificateNumber || "",
      dbsIssueDate: employeeDetail.dbsIssueDate || "",
      hasFirstAid: employeeDetail.hasFirstAid || false,
      firstAidExpiry: employeeDetail.firstAidExpiry || "",
      officerStep: String(employeeDetail.officerStep ?? 0),
    });
    setIsEditing(true);
  };

  const issuePolicyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/admin/employees/${selectedEmployeeId}/policies`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Policy issued", description: "Policy has been issued to the employee." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
      setShowPolicyDialog(false);
      setPolicyForm({ policyName: "", policyType: "policy", version: "1.0", notes: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const acknowledgePolicyMutation = useMutation({
    mutationFn: async (policyId: number) => {
      const res = await apiRequest("PATCH", `/api/admin/employees/${selectedEmployeeId}/policies/${policyId}/acknowledge`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Policy acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stats = paginatedData?.stats || { total: 0, active: 0, compliant: 0, onboarding: 0 };

  return (
    <div className="p-6 space-y-6" data-testid="employees-page">
      {!matchDetail && (
      <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground text-sm">View and manage your workforce, compliance, and vetting status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setShowDedupDialog(true); setDismissedGroups(new Set()); setSelectedPrimaries({}); }}
            data-testid="button-find-duplicates"
          >
            <Copy className="w-4 h-4 mr-2" />
            Find Duplicates
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
            data-testid="button-add-employee"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-total-employees">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Employees</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-active-employees">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-compliant-employees">{stats.compliant}</div>
              <div className="text-xs text-muted-foreground">Fully Compliant</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-accent" data-testid="text-onboarding-employees">{stats.onboarding}</div>
              <div className="text-xs text-muted-foreground">Onboarding</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-employees"
            placeholder="Search by name, email, role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "compliant", label: "Compliant" },
            { value: "non_compliant", label: "Non-Compliant" },
          ].map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(f.value); setPage(1); setSelectedIds(new Set()); }}
              data-testid={`button-filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-[#1F3A5F]/10 border border-[#1F3A5F]/20 rounded-lg" data-testid="bulk-action-bar">
          <span className="text-sm font-medium">{selectedIds.size} employee{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} data-testid="button-deselect-all">Clear</Button>
            <Button size="sm" variant="destructive" disabled={bulkDeleteMutation.isPending} onClick={() => {
              if (confirm(`Are you sure you want to delete ${selectedIds.size} employee${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) {
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }
            }} data-testid="button-bulk-delete">
              {bulkDeleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No employees found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Click 'Add Employee' to create your first employee record."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={employees.length > 0 && selectedIds.size === employees.length}
              onCheckedChange={toggleSelectAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-xs text-muted-foreground">Select All ({employees.length})</span>
          </div>
          {employees.map((emp: EnrichedEmployee) => {
            const compliance = getComplianceStatus(emp);
            const ComplianceIcon = compliance.icon;
            const onboardConf = ONBOARDING_STATUS_CONFIG[emp.onboardingStatus || ""] || null;
            const bs7858Pct = emp.vettingCount > 0 ? Math.round((emp.vettingPassed / emp.vettingCount) * 100) : 0;
            const siaStatus = getSiaExpiryStatus(emp.siaExpiryDate);
            const dbsStatus = getDbsStatus(emp.dbsCertificateNumber);

            return (
              <Card
                key={emp.id}
                className={`hover-elevate cursor-pointer ${selectedIds.has(emp.id) ? "ring-2 ring-[#1F3A5F]/40" : ""}`}
                onClick={() => navigate(`/admin/employees/${emp.id}`)}
                data-testid={`card-employee-${emp.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(emp.id)}
                          onCheckedChange={() => toggleSelect(emp.id)}
                          data-testid={`checkbox-employee-${emp.id}`}
                        />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {getInitials(emp.firstName, emp.lastName)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {emp.employeeNumber && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-employee-number-${emp.id}`}>{emp.employeeNumber}</span>}
                          <div className="font-medium text-sm truncate" data-testid={`text-employee-name-${emp.id}`}>
                            {emp.firstName} {emp.lastName}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate" data-testid={`text-employee-email-${emp.id}`}>
                          {emp.email}
                        </div>
                        {emp.supplierName && (
                          <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5" data-testid={`text-employee-employer-${emp.id}`}>
                            <Building2 className="w-3 h-3" /> {emp.supplierName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap ml-auto">
                      {emp.vettingCount > 0 && (
                        <ComplianceRing percentage={bs7858Pct} size={44} />
                      )}
                      <div className="hidden sm:flex flex-col gap-1">
                        <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${siaStatus.bg} ${siaStatus.color}`} data-testid={`badge-sia-${emp.id}`}>
                          <Shield className="w-2.5 h-2.5" />
                          SIA: {siaStatus.label}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${dbsStatus.bg} ${dbsStatus.color}`} data-testid={`badge-dbs-${emp.id}`}>
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {dbsStatus.label}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!emp.userIsActive && (
                          <Badge variant="destructive" className="text-[10px] h-5" data-testid={`badge-inactive-${emp.id}`}>
                            Inactive
                          </Badge>
                        )}
                        {onboardConf && (
                          <Badge variant={onboardConf.variant} className="text-[10px] h-5" data-testid={`badge-onboarding-${emp.id}`}>
                            <ClipboardCheck className="w-2.5 h-2.5 mr-1" />
                            {onboardConf.label}
                          </Badge>
                        )}
                        <Badge variant={compliance.variant} className="text-[10px] h-5" data-testid={`badge-compliance-${emp.id}`}>
                          <ComplianceIcon className="w-2.5 h-2.5 mr-1" />
                          {compliance.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageLimit) + 1}-{Math.min(page * pageLimit, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Employee Detail Page */}
      {matchDetail && (
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2"
            onClick={closeDetail}
            data-testid="button-back-to-employees"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Employees
          </Button>
          {(!selectedEmployeeId || isDetailError) ? (
            <div className="flex flex-col items-center justify-center text-center py-20 gap-4" data-testid="employee-not-found">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Employee not found</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We couldn't find an employee with this reference. It may have been removed or the link is incorrect.
                </p>
              </div>
              <Button onClick={closeDetail} data-testid="button-back-not-found">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Employees
              </Button>
            </div>
          ) : isDetailLoading || !employeeDetail ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {(() => {
                const siaStatus = getSiaExpiryStatus(employeeDetail.siaExpiryDate);
                const dbsStatus = getDbsStatus(employeeDetail.dbsCertificateNumber);
                return (
                  <StaffProfileSidebar
                    employee={employeeDetail}
                    onUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", selectedEmployeeId] })}
                    siaLabel={siaStatus.label}
                    siaClassName={`${siaStatus.bg} ${siaStatus.color}`}
                    dbsLabel={dbsStatus.label}
                    dbsClassName={`${dbsStatus.bg} ${dbsStatus.color}`}
                  />
                );
              })()}

              <div className="min-w-0">
              <Tabs
                value={detailTab}
                onValueChange={(v) => { setDetailTab(v); if (v !== "personal") setIsEditing(false); }}
                className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6"
              >
                <aside className="w-full lg:w-56 shrink-0" data-testid="employee-detail-sidebar">
                  <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden lg:sticky lg:top-4">
                    <TabsList className="hidden lg:flex flex-col h-auto w-full items-stretch rounded-none bg-transparent p-2 gap-0 border-0">
                      {EMPLOYEE_DETAIL_TAB_GROUPS.map((section) => (
                        <div key={section.group} className="w-full">
                          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 first:pt-1">
                            {section.group}
                          </div>
                          {section.tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                              <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                data-testid={tab.testId}
                                className="w-full justify-start rounded-md px-2.5 py-2 text-sm gap-2 shadow-none border-0 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                {tab.label}
                              </TabsTrigger>
                            );
                          })}
                        </div>
                      ))}
                    </TabsList>
                    <div className="lg:hidden overflow-x-auto border-b border-border/60">
                      <TabsList className="inline-flex h-auto min-w-full w-max flex-nowrap items-stretch justify-start gap-0 rounded-none bg-transparent p-0 border-0">
                        {EMPLOYEE_DETAIL_TAB_GROUPS.map((section, sectionIdx) => (
                          <div
                            key={section.group}
                            className={`flex flex-col shrink-0 ${sectionIdx > 0 ? "border-l border-border/60" : ""}`}
                          >
                            <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                              {section.group}
                            </div>
                            <div className="flex items-stretch px-1 pb-0">
                              {section.tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                  <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    data-testid={tab.testId}
                                    className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm gap-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                  </TabsTrigger>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </TabsList>
                    </div>
                  </div>
                </aside>

                <div className="flex-1 min-w-0">
                <TabsContent value="notes" className="mt-4">
                  <NotesTab employeeId={employeeDetail.id} notes={employeeDetail.notes || []} />
                </TabsContent>
                <TabsContent value="preferred-sites" className="mt-4">
                  <PreferredSitesTab employeeId={employeeDetail.id} rows={employeeDetail.preferredSites || []} />
                </TabsContent>
                <TabsContent value="expertise" className="mt-4">
                  <ExpertiseTab employeeId={employeeDetail.id} certificates={employeeDetail.certificates || []} />
                </TabsContent>
                <TabsContent value="background" className="mt-4">
                  <BackgroundTab
                    employeeId={employeeDetail.id}
                    employmentHistory={employeeDetail.employmentHistory || []}
                    education={employeeDetail.education || []}
                    references={employeeDetail.references || []}
                  />
                </TabsContent>
                <TabsContent value="health" className="mt-4">
                  <HealthTab employeeId={employeeDetail.id} health={employeeDetail.health} />
                </TabsContent>
                <TabsContent value="right-of-work" className="mt-4">
                  <RightOfWorkTab employee={employeeDetail} />
                </TabsContent>


                {/* Edit form (from Details → Edit) */}
                <TabsContent value="personal" className="space-y-4 mt-4">
                  {!isEditing ? (
                    <div className="space-y-6">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => startEditing()} data-testid="button-edit-employee">
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => navigate(`/admin/hr-cases?openCase=disciplinary&employeeId=${selectedEmployeeId}`)}>
                          <Shield className="w-3.5 h-3.5 mr-1" /> Open Disciplinary
                        </Button>
                        <Button size="sm" variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50" onClick={() => navigate(`/admin/hr-cases?openCase=grievance&employeeId=${selectedEmployeeId}`)}>
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Open Grievance
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                        <DetailItem icon={CreditCard} label="Employee No." value={employeeDetail.employeeNumber} />
                        <DetailItem icon={Building2} label="Employer" value={employeeDetail.supplierName} />
                        <DetailItem icon={Briefcase} label="Job Title" value={employeeDetail.jobTitle} />
                        <DetailItem icon={Shield} label="Officer Type" value={employeeDetail.officerType} />
                        <DetailItem icon={Building2} label="Department" value={employeeDetail.department} />
                        <DetailItem icon={Users} label="Employment Type" value={employeeDetail.employmentType?.replace(/_/g, " ")} />
                        <DetailItem icon={Calendar} label="Start Date" value={formatDate(employeeDetail.startDate)} />
                        <DetailItem icon={Calendar} label="Date of Birth" value={formatDate(employeeDetail.dateOfBirth)} />
                        <DetailItem icon={MapPin} label="Place of Birth" value={employeeDetail.placeOfBirth} />
                        <DetailItem icon={Users} label="Marital Status" value={employeeDetail.maritalStatus} />
                        <DetailItem icon={User} label="Gender" value={employeeDetail.gender} />
                        <DetailItem icon={Globe} label="Nationality" value={employeeDetail.nationality} />
                        <DetailItem icon={Users} label="Ethnic Origin" value={employeeDetail.ethnicOrigin} />
                        <DetailItem icon={CreditCard} label="NI Number" value={employeeDetail.nationalInsurance} />
                      </div>

                      <div className="border-t pt-5">
                        <h3 className="text-sm font-semibold mb-3">Address</h3>
                        <DetailItem
                          icon={MapPin}
                          label="Current"
                          value={[
                            employeeDetail.addressLine1,
                            employeeDetail.addressLine2,
                            employeeDetail.city,
                            employeeDetail.county,
                            employeeDetail.postcode,
                            employeeDetail.country || "United Kingdom",
                          ].filter(Boolean).join(", ") || "Not set"}
                        />
                        {(employeeDetail.previousAddressLine1 || employeeDetail.previousCity || employeeDetail.previousPostcode) && (
                          <div className="mt-3">
                            <DetailItem
                              icon={MapPin}
                              label="Previous"
                              value={[
                                employeeDetail.previousAddressLine1,
                                employeeDetail.previousAddressLine2,
                                employeeDetail.previousCity,
                                employeeDetail.previousCounty,
                                employeeDetail.previousPostcode,
                              ].filter(Boolean).join(", ") || "Not set"}
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-5">
                        <h3 className="text-sm font-semibold mb-4">SIA License & DBS</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                          <DetailItem icon={Shield} label="SIA License" value={employeeDetail.siaLicenseNumber} />
                          <DetailItem icon={Shield} label="SIA Type" value={employeeDetail.siaLicenseType} />
                          <DetailItem icon={Calendar} label="SIA Expiry" value={formatDate(employeeDetail.siaExpiryDate)} />
                          <DetailItem icon={FileCheck} label="DBS Certificate" value={employeeDetail.dbsCertificateNumber} />
                          <DetailItem icon={Calendar} label="DBS Issue Date" value={formatDate(employeeDetail.dbsIssueDate)} />
                          <DetailItem icon={FileCheck} label="First Aid" value={employeeDetail.hasFirstAid ? "Yes" : "No"} />
                        </div>
                        <div className="mt-4">
                          <SiaLicenceVerify
                            employeeId={employeeDetail.id}
                            licenceNumber={employeeDetail.siaLicenseNumber}
                            lastVerifiedAt={employeeDetail.siaLastVerifiedAt}
                            registerStatus={employeeDetail.siaRegisterStatus}
                            registerHolderName={employeeDetail.siaRegisterHolderName}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setDetailTab("personal"); }} data-testid="button-cancel-edit">Cancel</Button>
                        <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" disabled={updateEmployeeMutation.isPending} onClick={() => updateEmployeeMutation.mutate(editForm)} data-testid="button-save-employee">
                          {updateEmployeeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Save
                        </Button>
                      </div>
                      <h4 className="text-sm font-medium">Personal Information</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">First Name</Label>
                          <Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-edit-first-name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Last Name</Label>
                          <Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-edit-last-name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-email" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Phone</Label>
                          <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-edit-phone" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Second Phone</Label>
                          <Input value={editForm.secondPhone || ""} onChange={e => setEditForm(f => ({ ...f, secondPhone: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Employee No. / PIN</Label>
                          <Input value={editForm.employeeNumber} onChange={e => setEditForm(f => ({ ...f, employeeNumber: e.target.value }))} data-testid="input-edit-emp-number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sage ID</Label>
                          <Input value={editForm.sageId || ""} onChange={e => setEditForm(f => ({ ...f, sageId: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Officer Type</Label>
                          <Select
                            value={editForm.officerType || "none"}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, officerType: v === "none" ? "" : v }))}
                          >
                            <SelectTrigger data-testid="select-edit-officer-type"><SelectValue placeholder="Select officer type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Selected</SelectItem>
                              {officerTypes.map((type) => (
                                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                              ))}
                              {hasLegacyOfficerType && (
                                <SelectItem value={editForm.officerType}>{editForm.officerType}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Permit Type</Label>
                          <Input value={editForm.permitType || ""} onChange={e => setEditForm(f => ({ ...f, permitType: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ethnic Origin</Label>
                          <Select
                            value={editForm.ethnicOrigin || "none"}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, ethnicOrigin: v === "none" ? "" : v }))}
                          >
                            <SelectTrigger data-testid="select-edit-ethnic-origin"><SelectValue placeholder="Select ethnic origin" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Set</SelectItem>
                              {ETHNIC_ORIGIN_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                              {editForm.ethnicOrigin && !isKnownEthnicOrigin(editForm.ethnicOrigin) && (
                                <SelectItem value={editForm.ethnicOrigin}>{editForm.ethnicOrigin}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vetting Start</Label>
                          <Input type="date" value={editForm.vettingStartDate || ""} onChange={e => setEditForm(f => ({ ...f, vettingStartDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Contract End</Label>
                          <Input type="date" value={editForm.contractEndDate || ""} onChange={e => setEditForm(f => ({ ...f, contractEndDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Employer</Label>
                          <Select value={editForm.supplierId || "in_house"} onValueChange={v => setEditForm(f => ({ ...f, supplierId: v === "in_house" ? "" : v }))}>
                            <SelectTrigger data-testid="select-edit-employer"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_house">In-House</SelectItem>
                              {supplierOptions.map(s => (<SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Separator />
                      <h4 className="text-sm font-medium">Employment Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Job Title</Label>
                          <Input value={editForm.jobTitle} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} data-testid="input-edit-job-title" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Department</Label>
                          <Input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} data-testid="input-edit-department" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Employment Type</Label>
                          <Select value={editForm.employmentType || "none"} onValueChange={v => setEditForm(f => ({ ...f, employmentType: v === "none" ? "" : v }))}>
                            <SelectTrigger data-testid="select-edit-employment-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Set</SelectItem>
                              <SelectItem value="full_time">Full Time</SelectItem>
                              <SelectItem value="part_time">Part Time</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="zero_hours">Zero Hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start Date</Label>
                          <Input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-edit-start-date" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date of Birth</Label>
                          <Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} data-testid="input-edit-dob" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Place of Birth</Label>
                          <Input value={editForm.placeOfBirth} onChange={e => setEditForm(f => ({ ...f, placeOfBirth: e.target.value }))} data-testid="input-edit-place-of-birth" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Marital Status</Label>
                          <Select value={editForm.maritalStatus || "none"} onValueChange={v => setEditForm(f => ({ ...f, maritalStatus: v === "none" ? "" : v }))}>
                            <SelectTrigger data-testid="select-edit-marital-status"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Set</SelectItem>
                              <SelectItem value="single">Single</SelectItem>
                              <SelectItem value="married">Married</SelectItem>
                              <SelectItem value="divorced">Divorced</SelectItem>
                              <SelectItem value="widowed">Widowed</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gender</Label>
                          <Select value={editForm.gender || "none"} onValueChange={v => setEditForm(f => ({ ...f, gender: v === "none" ? "" : v }))}>
                            <SelectTrigger data-testid="select-edit-gender"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Set</SelectItem>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nationality</Label>
                          <Input value={editForm.nationality} onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))} data-testid="input-edit-nationality" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">NI Number</Label>
                          <Input value={editForm.nationalInsurance} onChange={e => setEditForm(f => ({ ...f, nationalInsurance: e.target.value }))} placeholder="QQ 12 34 56 C" data-testid="input-edit-ni" />
                        </div>
                      </div>
                      <Separator />
                      <h4 className="text-sm font-medium">Address</h4>
                      <p className="text-xs text-muted-foreground -mt-2 mb-2">Current</p>
                      <AddressFieldsGroup
                        idPrefix="edit-addr"
                        value={{
                          addressLine1: editForm.addressLine1,
                          addressLine2: editForm.addressLine2,
                          city: editForm.city,
                          county: editForm.county,
                          postcode: editForm.postcode,
                          country: editForm.country,
                        }}
                        onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                      />
                      <p className="text-xs text-muted-foreground mt-4 mb-2">Previous</p>
                      <AddressFieldsGroup
                        idPrefix="edit-prev-addr"
                        value={{
                          addressLine1: editForm.previousAddressLine1,
                          addressLine2: editForm.previousAddressLine2,
                          city: editForm.previousCity,
                          county: editForm.previousCounty,
                          postcode: editForm.previousPostcode,
                          country: "United Kingdom",
                        }}
                        onChange={(patch) =>
                          setEditForm((f) => ({
                            ...f,
                            previousAddressLine1: patch.addressLine1 ?? f.previousAddressLine1,
                            previousAddressLine2: patch.addressLine2 ?? f.previousAddressLine2,
                            previousCity: patch.city ?? f.previousCity,
                            previousCounty: patch.county ?? f.previousCounty,
                            previousPostcode: patch.postcode ?? f.previousPostcode,
                          }))
                        }
                        livingFrom={editForm.previousLivingFrom}
                        livingTo={editForm.previousLivingTo}
                        onLivingFromChange={(v) => setEditForm((f) => ({ ...f, previousLivingFrom: v }))}
                        onLivingToChange={(v) => setEditForm((f) => ({ ...f, previousLivingTo: v }))}
                      />
                      <Separator />
                      <h4 className="text-sm font-medium">SIA License & DBS</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2 sm:col-span-1">
                          <Label className="text-xs">SIA License Number</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              className="flex-1 min-w-0"
                              value={editForm.siaLicenseNumber}
                              onChange={e => setEditForm(f => ({ ...f, siaLicenseNumber: e.target.value }))}
                              data-testid="input-edit-sia-number"
                            />
                            <SiaLicenceVerify
                              employeeId={selectedEmployeeId!}
                              licenceNumber={editForm.siaLicenseNumber}
                              lastVerifiedAt={employeeDetail?.siaLastVerifiedAt}
                              registerStatus={employeeDetail?.siaRegisterStatus}
                              registerHolderName={employeeDetail?.siaRegisterHolderName}
                              inline
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SIA Type</Label>
                          <Input value={editForm.siaLicenseType} onChange={e => setEditForm(f => ({ ...f, siaLicenseType: e.target.value }))} placeholder="e.g. Door Supervisor" data-testid="input-edit-sia-type" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SIA Expiry Date</Label>
                          <Input type="date" value={editForm.siaExpiryDate} onChange={e => setEditForm(f => ({ ...f, siaExpiryDate: e.target.value }))} data-testid="input-edit-sia-expiry" />
                        </div>
                        <SiaLicenceVerifyStatus
                          lastVerifiedAt={employeeDetail?.siaLastVerifiedAt}
                          registerStatus={employeeDetail?.siaRegisterStatus}
                          registerHolderName={employeeDetail?.siaRegisterHolderName}
                        />
                        <div className="space-y-1">
                          <Label className="text-xs">DBS Certificate Number</Label>
                          <Input value={editForm.dbsCertificateNumber} onChange={e => setEditForm(f => ({ ...f, dbsCertificateNumber: e.target.value }))} data-testid="input-edit-dbs-number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">DBS Issue Date</Label>
                          <Input type="date" value={editForm.dbsIssueDate} onChange={e => setEditForm(f => ({ ...f, dbsIssueDate: e.target.value }))} data-testid="input-edit-dbs-issue" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">First Aid Certified</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Switch checked={editForm.hasFirstAid} onCheckedChange={v => setEditForm(f => ({ ...f, hasFirstAid: v }))} data-testid="switch-edit-first-aid" />
                            <span className="text-sm">{editForm.hasFirstAid ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        {editForm.hasFirstAid && (
                          <div className="space-y-1">
                            <Label className="text-xs">First Aid Expiry</Label>
                            <Input type="date" value={editForm.firstAidExpiry} onChange={e => setEditForm(f => ({ ...f, firstAidExpiry: e.target.value }))} data-testid="input-edit-first-aid-expiry" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* BS7858 Compliance Tab */}
                <TabsContent value="bs7858" className="space-y-4 mt-4" data-testid="bs7858-checklist">
                  {bs7858Data?.summary && (
                    <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                      <ComplianceRing percentage={bs7858Data.summary.percentage} size={56} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#1F3A5F]" />
                          BS7858 Security Screening
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">British Standard for security screening</p>
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{bs7858Data.summary.passed} of {bs7858Data.summary.total} checks passed</span>
                            <Badge variant={bs7858Data.summary.overallStatus === "compliant" ? "default" : bs7858Data.summary.overallStatus === "partial" ? "secondary" : "destructive"} className="text-[10px] h-5">
                              {bs7858Data.summary.overallStatus === "compliant" ? "Compliant" : bs7858Data.summary.overallStatus === "partial" ? "Partial" : "Non-Compliant"}
                            </Badge>
                          </div>
                          <Progress value={bs7858Data.summary.percentage} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {bs7858Data?.checks ? (
                    <div className="space-y-2">
                      {bs7858Data.checks.map((check: any) => (
                        <div
                          key={check.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            check.status === "passed" ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10" :
                            check.status === "pending" ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10" :
                            check.status === "expired" ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10" :
                            "border-muted-foreground/20 bg-muted/20"
                          }`}
                          data-testid={`bs7858-check-${check.id}`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {check.status === "passed" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                             check.status === "pending" ? <Clock className="w-4 h-4 text-amber-500" /> :
                             check.status === "expired" ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                             <XCircle className="w-4 h-4 text-muted-foreground/40" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-sm ${check.status === "passed" ? "text-green-800 dark:text-green-300" : check.status === "pending" ? "text-amber-800 dark:text-amber-300" : check.status === "expired" ? "text-red-800 dark:text-red-300" : "text-muted-foreground"}`}>
                              {check.name}
                            </div>
                            {check.details && (
                              <div className="text-xs text-muted-foreground mt-0.5">{check.details}</div>
                            )}
                            {check.id === "sia_license" && selectedEmployeeId && (
                              <div className="mt-2">
                                <SiaLicenceVerify
                                  employeeId={selectedEmployeeId}
                                  licenceNumber={employeeDetail?.siaLicenseNumber}
                                  lastVerifiedAt={employeeDetail?.siaLastVerifiedAt}
                                  registerStatus={employeeDetail?.siaRegisterStatus}
                                  registerHolderName={employeeDetail?.siaRegisterHolderName}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                          <Badge variant={check.status === "passed" ? "default" : check.status === "pending" ? "secondary" : check.status === "expired" ? "destructive" : "outline"} className="text-[10px] h-5 flex-shrink-0">
                            {check.status === "passed" ? "Passed" : check.status === "pending" ? "Pending" : check.status === "expired" ? "Expired" : "Not Started"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="vetting" className="space-y-4 mt-4">
                  <VettingHubTab employee={employeeDetail} />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-3 mt-4">
                  <DocsHubTab employeeId={employeeDetail.id} documents={employeeDetail.documents || []} employeeEmail={employeeDetail.email} />
                </TabsContent>

                {/* Immigration Tab */}
                <TabsContent value="immigration" className="space-y-4 mt-4" data-testid="immigration-tab">
                  <ImmigrationTab employee={employeeDetail} />
                </TabsContent>

                {/* Policies & Handbook Tab */}
                <TabsContent value="policies" className="space-y-4 mt-4" data-testid="policies-tab">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#1F3A5F]" />
                      Policies & Company Handbook
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => setShowPolicyDialog(true)}
                      className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
                      data-testid="button-issue-policy"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Issue Policy
                    </Button>
                  </div>

                  {employeeDetail.policies && employeeDetail.policies.length > 0 ? (
                    <div className="space-y-2">
                      {employeeDetail.policies.map((policy) => (
                        <Card key={policy.id} data-testid={`card-policy-${policy.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-0.5">
                                  {policy.policy_type === "handbook" ? <BookOpen className="w-4 h-4 text-blue-600" /> : <ScrollText className="w-4 h-4 text-purple-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{policy.policy_name}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Version {policy.version || "1.0"} • Issued {formatDateTime(policy.issued_at)}
                                  </div>
                                  {policy.acknowledged_at && (
                                    <div className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Acknowledged {formatDateTime(policy.acknowledged_at)}
                                    </div>
                                  )}
                                  {policy.notes && (
                                    <div className="text-xs text-muted-foreground mt-1">{policy.notes}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant={policy.status === "acknowledged" ? "default" : "secondary"}>
                                  {policy.status === "acknowledged" ? "Acknowledged" : "Pending"}
                                </Badge>
                                {policy.status !== "acknowledged" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => acknowledgePolicyMutation.mutate(policy.id)}
                                    disabled={acknowledgePolicyMutation.isPending}
                                    data-testid={`button-acknowledge-${policy.id}`}
                                  >
                                    Acknowledge
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No policies issued yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Click "Issue Policy" to assign policies and handbooks</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Emergency Tab */}
                <TabsContent value="emergency" className="space-y-3 mt-4">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setContactForm({ name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false }); setShowAddContact(true); setEditingContactId(null); }} data-testid="button-add-emergency-contact">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Contact
                    </Button>
                  </div>
                  {(showAddContact || editingContactId !== null) && (
                    <Card className="border-[#1F3A5F]/30">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="text-sm font-medium">{editingContactId ? "Edit Contact" : "Add Emergency Contact"}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name *</Label>
                            <Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} data-testid="input-contact-name" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Relationship *</Label>
                            <Input value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} placeholder="e.g. Spouse, Parent" data-testid="input-contact-relationship" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Phone *</Label>
                            <Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-contact-phone" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Alternate Phone</Label>
                            <Input value={contactForm.alternatePhone} onChange={e => setContactForm(f => ({ ...f, alternatePhone: e.target.value }))} data-testid="input-contact-alt-phone" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email</Label>
                            <Input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} data-testid="input-contact-email" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Primary Contact</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Switch checked={contactForm.isPrimary} onCheckedChange={v => setContactForm(f => ({ ...f, isPrimary: v }))} data-testid="switch-contact-primary" />
                              <span className="text-sm">{contactForm.isPrimary ? "Yes" : "No"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setShowAddContact(false); setEditingContactId(null); }}>Cancel</Button>
                          <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" disabled={!contactForm.name || !contactForm.phone || !contactForm.relationship || addContactMutation.isPending || updateContactMutation.isPending} onClick={() => {
                            if (editingContactId) {
                              updateContactMutation.mutate({ contactId: editingContactId, data: contactForm });
                            } else {
                              addContactMutation.mutate(contactForm);
                            }
                          }} data-testid="button-save-contact">
                            {(addContactMutation.isPending || updateContactMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                            {editingContactId ? "Update" : "Add"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {employeeDetail.emergencyContacts.length === 0 && !showAddContact ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <Phone className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No emergency contacts added</p>
                      </CardContent>
                    </Card>
                  ) : (
                    employeeDetail.emergencyContacts.map((contact) => (
                      <Card key={contact.id} data-testid={`card-emergency-${contact.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                              <div className="font-medium text-sm">{contact.name}</div>
                              <div className="text-xs text-muted-foreground">{contact.relationship}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.isPrimary && <Badge variant="default">Primary</Badge>}
                              <Button size="sm" variant="outline" className="h-7" onClick={() => {
                                setContactForm({ name: contact.name, relationship: contact.relationship, phone: contact.phone, alternatePhone: contact.alternatePhone || "", email: contact.email || "", isPrimary: contact.isPrimary || false });
                                setEditingContactId(contact.id);
                                setShowAddContact(false);
                              }} data-testid={`button-edit-contact-${contact.id}`}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7" onClick={() => { if (confirm("Delete this contact?")) deleteContactMutation.mutate(contact.id); }} data-testid={`button-delete-contact-${contact.id}`}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{contact.phone}</span>
                            </div>
                            {contact.alternatePhone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{contact.alternatePhone}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="portal" className="space-y-4 mt-4">
                  <PortalAccessTab employeeId={employeeDetail.id} email={employeeDetail.email} />
                </TabsContent>

                <TabsContent value="pay-rates" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <PoundSterling className="w-4 h-4 text-[#FF8C42]" />
                        Pay Rate History
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Current rate: <strong>£{employeeDetail.hourlyRate || "0.00"}/hr</strong> — Rates are matched to shifts by date for accurate payroll
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowPayRateForm(true);
                        setEditingPayRate(null);
                        setPayRateForm({ hourlyRate: "", effectiveFrom: "", effectiveTo: "", reason: "" });
                      }}
                      data-testid="button-add-pay-rate"
                      className="bg-[#FF8C42] hover:bg-[#e87d38]"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Rate
                    </Button>
                  </div>

                  {showPayRateForm && (
                    <div className="p-3 rounded-lg border border-[#FF8C42]/30 bg-orange-50 space-y-3" data-testid="pay-rate-form">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Hourly Rate (£) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="12.50"
                            value={payRateForm.hourlyRate}
                            onChange={(e) => setPayRateForm(f => ({ ...f, hourlyRate: e.target.value }))}
                            data-testid="input-pay-rate-hourly"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reason</Label>
                          <Input
                            placeholder="e.g. Annual review, Promotion"
                            value={payRateForm.reason}
                            onChange={(e) => setPayRateForm(f => ({ ...f, reason: e.target.value }))}
                            data-testid="input-pay-rate-reason"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Effective From *</Label>
                          <Input
                            type="date"
                            value={payRateForm.effectiveFrom}
                            onChange={(e) => setPayRateForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                            data-testid="input-pay-rate-from"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Effective To</Label>
                          <Input
                            type="date"
                            value={payRateForm.effectiveTo}
                            onChange={(e) => setPayRateForm(f => ({ ...f, effectiveTo: e.target.value }))}
                            data-testid="input-pay-rate-to"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setShowPayRateForm(false); setEditingPayRate(null); }}>Cancel</Button>
                        <Button
                          size="sm"
                          className="bg-[#FF8C42] hover:bg-[#e87d38]"
                          disabled={!payRateForm.hourlyRate || !payRateForm.effectiveFrom || createPayRateMutation.isPending || updatePayRateMutation.isPending}
                          data-testid="button-save-pay-rate"
                          onClick={() => {
                            if (editingPayRate) {
                              updatePayRateMutation.mutate({ id: editingPayRate.id, data: payRateForm });
                            } else {
                              createPayRateMutation.mutate(payRateForm);
                            }
                          }}
                        >
                          {(createPayRateMutation.isPending || updatePayRateMutation.isPending) && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                          {editingPayRate ? "Update" : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {payRates.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Hourly Rate</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Effective From</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Effective To</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Reason</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {payRates.map((pr: any, idx: number) => (
                            <tr key={pr.id} className={idx === 0 ? "bg-orange-50/50" : ""} data-testid={`row-pay-rate-${pr.id}`}>
                              <td className="px-3 py-2 font-medium">
                                £{parseFloat(pr.hourly_rate).toFixed(2)}/hr
                                {idx === 0 && <Badge className="ml-2 bg-[#FF8C42] text-white text-[10px]">Current</Badge>}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{pr.effective_from}</td>
                              <td className="px-3 py-2 text-muted-foreground">{pr.effective_to || "Ongoing"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{pr.reason || "—"}</td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  data-testid={`button-edit-pay-rate-${pr.id}`}
                                  onClick={() => {
                                    setEditingPayRate(pr);
                                    setPayRateForm({
                                      hourlyRate: pr.hourly_rate,
                                      effectiveFrom: pr.effective_from,
                                      effectiveTo: pr.effective_to || "",
                                      reason: pr.reason || "",
                                    });
                                    setShowPayRateForm(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                  data-testid={`button-delete-pay-rate-${pr.id}`}
                                  onClick={() => deletePayRateMutation.mutate(pr.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <PoundSterling className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No pay rate history recorded</p>
                      <p className="text-xs mt-1">Click "Add Rate" to set up pay rate history for accurate date-based payroll calculations</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="bank-details" className="space-y-4 mt-4" data-testid="bank-details-tab">
                  <BankDetailsTab employee={employeeDetail} />
                </TabsContent>

                {/* Probation Tab */}
                <ProbationTab employeeId={selectedEmployeeId!} />

                {/* Absence Tab */}
                <TabsContent value="absences" className="space-y-4 mt-4" data-testid="absences-tab">
                  <AbsenceTab employeeId={selectedEmployeeId!} />
                </TabsContent>

                {/* Training Tab */}
                <TrainingTab employeeId={selectedEmployeeId!} />

                </div>
              </Tabs>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add New Employee
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              The employee will be created with the default password <strong>Password123!</strong> and can change it on first login.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={addForm.firstName}
                  onChange={(e) => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                  data-testid="input-add-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name *</Label>
                <Input
                  value={addForm.lastName}
                  onChange={(e) => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                  data-testid="input-add-last-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="input-add-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Username *</Label>
                <Input
                  value={addForm.username}
                  onChange={(e) => setAddForm(f => ({ ...f, username: e.target.value }))}
                  data-testid="input-add-username"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={addForm.phone}
                  onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="07xxx xxxxxx"
                  data-testid="input-add-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Birth</Label>
                <Input
                  type="date"
                  value={addForm.dateOfBirth}
                  onChange={(e) => setAddForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                  data-testid="input-add-dob"
                />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-medium">Employment Details</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Employer</Label>
                <Select value={addForm.supplierId || "in_house"} onValueChange={(v) => setAddForm(f => ({ ...f, supplierId: v === "in_house" ? "" : v }))}>
                  <SelectTrigger data-testid="select-add-employer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_house">In-House</SelectItem>
                    {supplierOptions.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={addForm.jobTitle}
                  onChange={(e) => setAddForm(f => ({ ...f, jobTitle: e.target.value }))}
                  placeholder="Security Officer"
                  data-testid="input-add-job-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Input
                  value={addForm.department}
                  onChange={(e) => setAddForm(f => ({ ...f, department: e.target.value }))}
                  data-testid="input-add-department"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employment Type</Label>
                <Select value={addForm.employmentType} onValueChange={(v) => setAddForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger data-testid="select-add-employment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="zero_hours">Zero Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={addForm.startDate}
                  onChange={(e) => setAddForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-add-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NI Number</Label>
                <Input
                  value={addForm.nationalInsurance}
                  onChange={(e) => setAddForm(f => ({ ...f, nationalInsurance: e.target.value }))}
                  placeholder="QQ 12 34 56 C"
                  data-testid="input-add-ni"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={addForm.gender} onValueChange={(v) => setAddForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger data-testid="select-add-gender">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-medium">Address</h4>
            <AddressFieldsGroup
              idPrefix="add-addr"
              value={{
                addressLine1: addForm.addressLine1,
                addressLine2: addForm.addressLine2,
                city: addForm.city,
                county: addForm.county,
                postcode: addForm.postcode,
                country: addForm.country,
              }}
              onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Nationality</Label>
              <Input
                value={addForm.nationality}
                onChange={(e) => setAddForm(f => ({ ...f, nationality: e.target.value }))}
                data-testid="input-add-nationality"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={() => createEmployeeMutation.mutate(addForm)}
              disabled={createEmployeeMutation.isPending || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.username}
              className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
              data-testid="button-submit-add-employee"
            >
              {createEmployeeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Policy Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Issue Policy / Handbook
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Policy / Handbook *</Label>
              <Select value={policyForm.policyName} onValueChange={(v) => {
                const found = STANDARD_POLICIES.find(p => p.name === v);
                setPolicyForm(f => ({ ...f, policyName: v, policyType: found?.type || "policy" }));
              }}>
                <SelectTrigger data-testid="select-policy-name">
                  <SelectValue placeholder="Select a policy..." />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_POLICIES.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.type === "handbook" ? "📕" : "📄"} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={policyForm.policyType} onValueChange={(v) => setPolicyForm(f => ({ ...f, policyType: v }))}>
                  <SelectTrigger data-testid="select-policy-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="handbook">Handbook</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Version</Label>
                <Input
                  value={policyForm.version}
                  onChange={(e) => setPolicyForm(f => ({ ...f, version: e.target.value }))}
                  data-testid="input-policy-version"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={policyForm.notes}
                onChange={(e) => setPolicyForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                className="min-h-[60px]"
                data-testid="input-policy-notes"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
            <Button
              onClick={() => issuePolicyMutation.mutate(policyForm)}
              disabled={issuePolicyMutation.isPending || !policyForm.policyName}
              className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
              data-testid="button-submit-policy"
            >
              {issuePolicyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Issue Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDedupDialog} onOpenChange={setShowDedupDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="dedup-dialog-title">
              <Copy className="w-5 h-5" /> Duplicate Detection & Merge
            </DialogTitle>
          </DialogHeader>

          {isDedupLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="dedup-loading">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Scanning for duplicates...</span>
            </div>
          ) : dedupData ? (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold" data-testid="text-dup-groups">{dedupData.summary.totalGroups}</div>
                    <div className="text-xs text-muted-foreground">Duplicate Groups</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600" data-testid="text-dup-records">{dedupData.summary.totalDuplicates}</div>
                    <div className="text-xs text-muted-foreground">Records Involved</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-red-600" data-testid="text-orphaned-count">{dedupData.summary.orphanedCount}</div>
                    <div className="text-xs text-muted-foreground">Orphaned Records</div>
                  </CardContent>
                </Card>
              </div>

              {dedupData.summary.orphanedCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" data-testid="orphan-purge-bar">
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{dedupData.summary.orphanedCount} orphaned placeholder records found</p>
                    <p className="text-xs text-red-600 dark:text-red-400">No external ID, placeholder email, zero shifts. Safe to purge.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={purgeMutation.isPending}
                    data-testid="button-bulk-purge"
                    onClick={() => {
                      const orphanIds = dedupData.groups
                        .flatMap(g => g.members)
                        .filter(m => m.isOrphaned)
                        .map(m => m.id);
                      if (orphanIds.length > 0 && confirm(`Purge ${orphanIds.length} orphaned record(s)? This cannot be undone.`)) {
                        purgeMutation.mutate(orphanIds);
                      }
                    }}
                  >
                    {purgeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                    Purge All Orphans
                  </Button>
                </div>
              )}

              {dedupData.groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-duplicates-message">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">No duplicates found</p>
                  <p className="text-sm">Your employee database is clean.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dedupData.groups.filter(g => !dismissedGroups.has(g.key)).map((group) => {
                    const primaryId = selectedPrimaries[group.key];
                    return (
                      <Card key={group.key} data-testid={`dedup-group-${group.key}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {group.members[0]?.firstName} {group.members[0]?.lastName}
                              <Badge variant="secondary" className="text-xs">{group.members.length} records</Badge>
                              <Badge
                                variant={group.confidence >= 80 ? "destructive" : group.confidence >= 60 ? "default" : "secondary"}
                                className="text-xs"
                                data-testid={`confidence-${group.key}`}
                              >
                                {group.confidence}% match
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs"
                                onClick={() => setDismissedGroups(prev => new Set(Array.from(prev).concat(group.key)))}
                                data-testid={`button-dismiss-${group.key}`}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Dismiss
                              </Button>
                              {primaryId && (
                                <Button
                                  size="sm"
                                  className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90 text-xs"
                                  disabled={mergeMutation.isPending}
                                  data-testid={`button-merge-${group.key}`}
                                  onClick={() => {
                                    const secondaryIds = group.members.filter(m => m.id !== primaryId).map(m => m.id);
                                    if (confirm(`Merge ${secondaryIds.length} record(s) into #${primaryId}? All shifts, documents, and related data will be moved to the primary record.`)) {
                                      mergeMutation.mutate({ primaryId, secondaryIds });
                                    }
                                  }}
                                >
                                  {mergeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Merge className="w-3.5 h-3.5 mr-1" />}
                                  Merge into #{primaryId}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-muted-foreground">
                                  <th className="text-left p-2 w-10">Primary</th>
                                  <th className="text-left p-2">ID</th>
                                  <th className="text-left p-2">Email</th>
                                  <th className="text-left p-2">SIA</th>
                                  <th className="text-left p-2">NI</th>
                                  <th className="text-left p-2">Supplier</th>
                                  <th className="text-left p-2">Ext. ID</th>
                                  <th className="text-right p-2">Shifts</th>
                                  <th className="text-right p-2">Docs</th>
                                  <th className="text-left p-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.members.map((m) => (
                                  <tr
                                    key={m.id}
                                    className={`border-b last:border-0 ${primaryId === m.id ? "bg-blue-50 dark:bg-blue-900/20" : ""} ${m.isOrphaned ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                                    data-testid={`dedup-member-${m.id}`}
                                  >
                                    <td className="p-2">
                                      <input
                                        type="radio"
                                        name={`primary-${group.key}`}
                                        checked={primaryId === m.id}
                                        onChange={() => setSelectedPrimaries(prev => ({ ...prev, [group.key]: m.id }))}
                                        data-testid={`radio-primary-${m.id}`}
                                      />
                                    </td>
                                    <td className="p-2 font-mono">#{m.id}</td>
                                    <td className="p-2 truncate max-w-[150px]" title={m.email}>
                                      {m.email}
                                      {m.isPlaceholder && <Badge variant="destructive" className="text-[10px] ml-1 px-1">placeholder</Badge>}
                                    </td>
                                    <td className="p-2 font-mono">{m.siaLicenseNumber || "-"}</td>
                                    <td className="p-2 font-mono">{m.nationalInsurance || "-"}</td>
                                    <td className="p-2 truncate max-w-[120px]">{m.supplierName || "-"}</td>
                                    <td className="p-2 font-mono">{m.externalId || <span className="text-red-500">none</span>}</td>
                                    <td className="p-2 text-right font-medium">{m.shiftCount}</td>
                                    <td className="p-2 text-right">{m.docCount}</td>
                                    <td className="p-2">
                                      {m.isOrphaned ? (
                                        <Badge variant="destructive" className="text-[10px]">orphaned</Badge>
                                      ) : m.userIsActive ? (
                                        <Badge variant="default" className="text-[10px]">active</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-[10px]">inactive</Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {!primaryId && (
                            <p className="text-xs text-muted-foreground mt-2 italic">Select a primary record to enable merge.</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PortalAccessTab({ employeeId, email }: { employeeId: number; email: string }) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const canToggleAccount = ["super_admin", "tenant_admin", "ceo", "admin"].includes(currentUser?.role ?? "");

  const portalStatusQuery = useQuery<{
    portalAccessEnabled: boolean;
    portalEmail: string;
    invitationSentAt: string | null;
    invitationAccepted: boolean;
    inviteLink: string | null;
    loginCount: number;
    lastLoginAt: string | null;
    hasUserAccount: boolean;
    userIsActive: boolean;
    userId: string | null;
  }>({
    queryKey: ["/api/admin/employees", employeeId, "portal-status"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/portal-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch portal status");
      return res.json();
    },
  });

  const portalAccessMutation = useMutation({
    mutationFn: async (data: { portalAccessEnabled?: boolean; portalEmail?: string }) => {
      await apiRequest("PATCH", `/api/admin/employees/${employeeId}/portal-access`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "portal-status"] });
      toast({ title: "Portal access updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/send-invitation`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "portal-status"] });
      toast({ title: "Invitation sent", description: "The employee has been notified about their portal access." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/send-reminder`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "portal-status"] });
      toast({ title: "Reminder sent" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/employees/${employeeId}/reset-password`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "portal-status"] });
      toast({ title: "Password reset link created", description: data?.resetLink ? "Link ready to copy." : "Reset link generated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleAccountMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const userId = portalStatusQuery.data?.userId;
      if (!userId) throw new Error("No user account found");
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { isActive });
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "portal-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      toast({ title: isActive ? "Account enabled" : "Account disabled", description: isActive ? "The employee account has been enabled." : "The employee account has been disabled." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const ps = portalStatusQuery.data;

  if (portalStatusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="w-5 h-5" />
          Portal Access
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Allow this employee to log in and access their portal (shifts, documents, profile).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4" data-testid="portal-toggle-section">
          <div>
            <Label htmlFor="emp-portal-toggle" className="text-base font-medium">Enable portal access</Label>
            <p className="text-sm text-muted-foreground">Employee can log in and view their shifts, documents and profile</p>
          </div>
          <Switch
            id="emp-portal-toggle"
            data-testid="portal-toggle"
            checked={ps?.portalAccessEnabled ?? false}
            onCheckedChange={(checked) => portalAccessMutation.mutate({ portalAccessEnabled: checked })}
            disabled={portalAccessMutation.isPending}
          />
        </div>

        {(ps?.portalAccessEnabled || ps?.portalEmail) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="emp-portal-email">Portal login email</Label>
              <div className="flex gap-2">
                <Input
                  id="emp-portal-email"
                  data-testid="portal-email-input"
                  type="email"
                  placeholder={email || "employee@example.com"}
                  defaultValue={ps?.portalEmail ?? email ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== (ps?.portalEmail ?? email ?? "")) {
                      portalAccessMutation.mutate({ portalEmail: v });
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                data-testid="send-invitation-btn"
                onClick={() => sendInvitationMutation.mutate()}
                disabled={sendInvitationMutation.isPending || !ps?.portalAccessEnabled}
              >
                {sendInvitationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {ps?.invitationSentAt ? "Resend invitation" : "Send invitation"}
              </Button>
              {!ps?.invitationAccepted && ps?.invitationSentAt && (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="send-reminder-btn"
                  onClick={() => sendReminderMutation.mutate()}
                  disabled={sendReminderMutation.isPending}
                >
                  {sendReminderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                  Send reminder
                </Button>
              )}
              {ps?.invitationAccepted && (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="reset-password-btn"
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Reset password
                </Button>
              )}
            </div>

            {ps?.inviteLink && !ps?.invitationAccepted && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Invitation link</Label>
                <p className="text-xs text-muted-foreground">If the employee did not receive the email, copy this link and send it to them.</p>
                <div className="flex gap-2 items-center rounded-lg border bg-muted/30 p-3">
                  <code className="text-xs flex-1 truncate" data-testid="invite-link" title={ps.inviteLink}>{ps.inviteLink}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="copy-link-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(ps.inviteLink!);
                      toast({ title: "Copied", description: "Invitation link copied to clipboard." });
                    }}
                  >
                    <ClipboardCheck className="w-4 h-4 mr-1" />
                    Copy link
                  </Button>
                </div>
              </div>
            )}

            {ps?.invitationAccepted && (
              <p className="text-xs text-muted-foreground">The invitation link is only shown while the invitation is pending. This employee has already accepted; use &quot;Reset password&quot; if they need to sign in again.</p>
            )}

            {!ps?.hasUserAccount && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                This employee does not have a user account yet. Sending an invitation will prompt account creation.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm" data-testid="portal-status-grid">
              <div>
                <span className="text-muted-foreground">Invitation</span>
                <p className="font-medium" data-testid="invitation-status">
                  {ps?.invitationAccepted ? (
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Accepted</span>
                  ) : ps?.invitationSentAt ? (
                    <span className="text-amber-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending</span>
                  ) : (
                    <span className="text-muted-foreground">Not sent</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Logins</span>
                <p className="font-medium" data-testid="login-count">{ps?.loginCount ?? 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last login</span>
                <p className="font-medium" data-testid="last-login">
                  {ps?.lastLoginAt ? new Date(ps.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Account status</span>
                  <p className="font-medium" data-testid="account-status">
                    {ps?.hasUserAccount ? (
                      ps.userIsActive ? (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Disabled</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">No account</span>
                    )}
                  </p>
                </div>
                {ps?.hasUserAccount && canToggleAccount && (
                  ps?.userIsActive ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      data-testid="disable-account-btn"
                      onClick={() => toggleAccountMutation.mutate(false)}
                      disabled={toggleAccountMutation.isPending}
                    >
                      {toggleAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Disable Account
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="enable-account-btn"
                      onClick={() => toggleAccountMutation.mutate(true)}
                      disabled={toggleAccountMutation.isPending}
                    >
                      {toggleAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Enable Account
                    </Button>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon?: any; label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      {(label || Icon) ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
      ) : null}
      <div className={`text-sm font-medium ${!label && Icon ? "flex items-center gap-1.5" : ""}`}>
        {!label && Icon ? <Icon className="w-3.5 h-3.5 text-muted-foreground" /> : null}
        {value || "N/A"}
      </div>
    </div>
  );
}


type ProbationRecord = {
  id: number;
  employeeId: number;
  startDate: string;
  reviewDate: string;
  extendedReviewDate: string | null;
  status: "active" | "passed" | "extended" | "failed";
  outcomeNotes: string | null;
  reviewed_by_name: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
};
const PROBATION_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Active", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  passed: { label: "Passed", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  extended: { label: "Extended", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};


function ProbationTab({ employeeId }: { employeeId: number }) {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProbationRecord | null>(null);
  const [createForm, setCreateForm] = useState({ startDate: "", reviewDate: "", outcomeNotes: "" });
  const [outcomeForm, setOutcomeForm] = useState({ status: "passed", outcomeNotes: "", extendedReviewDate: "" });
  const { data: records = [], isLoading } = useQuery<ProbationRecord[]>({
    queryKey: ["/api/admin/employees", employeeId, "probation"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/probation`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/probation-records", { ...data, employeeId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Probation record created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "probation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/probation-records"] });
      setShowCreateForm(false);
      setCreateForm({ startDate: "", reviewDate: "", outcomeNotes: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const outcomeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/probation-records/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Outcome recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "probation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/probation-records"] });
      setShowOutcomeForm(false);
      setSelectedRecord(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activeRecord = records.find(r => r.status === "active" || r.status === "extended");
  const daysUntilReview = activeRecord
    ? Math.ceil((new Date(activeRecord.extendedReviewDate || activeRecord.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <TabsContent value="probation" className="space-y-4 mt-4" data-testid="probation-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#FF8C42]" />
          Probation Records
        </h3>
        {!activeRecord && (
          <Button
            size="sm"
            className="bg-[#FF8C42] hover:bg-[#e87d38] text-white"
            onClick={() => setShowCreateForm(true)}
            data-testid="button-add-probation"
          >
            <Plus className="w-3 h-3 mr-1" /> Start Probation
          </Button>
        )}
      </div>

      {/* Active probation summary card */}
      {activeRecord && (
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/40 space-y-3" data-testid="active-probation-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">
                {activeRecord.status === "extended" ? "Extended Probation" : "Probation Active"}
              </span>
            </div>
            {daysUntilReview !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                daysUntilReview < 0 ? "bg-red-100 text-red-700" :
                daysUntilReview <= 7 ? "bg-red-100 text-red-600" :
                daysUntilReview <= 28 ? "bg-amber-100 text-amber-700" :
                "bg-green-100 text-green-700"
              }`} data-testid="days-remaining">
                {daysUntilReview < 0 ? `${Math.abs(daysUntilReview)}d overdue` : `${daysUntilReview}d until review`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Start Date</div>
              <div className="font-medium">{formatDate(activeRecord.startDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Review Date</div>
              <div className="font-medium">{formatDate(activeRecord.reviewDate)}</div>
            </div>
            {activeRecord.extendedReviewDate && (
              <div>
                <div className="text-xs text-muted-foreground">Extended To</div>
                <div className="font-medium text-amber-700">{formatDate(activeRecord.extendedReviewDate)}</div>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
            onClick={() => {
              setSelectedRecord(activeRecord);
              setOutcomeForm({ status: "passed", outcomeNotes: "", extendedReviewDate: "" });
              setShowOutcomeForm(true);
            }}
            data-testid="button-record-outcome"
          >
            Record Outcome
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="p-4 rounded-lg border border-[#FF8C42]/30 bg-orange-50/30 space-y-3" data-testid="create-probation-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date *</Label>
              <Input type="date" value={createForm.startDate} onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-probation-start" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Review Date *</Label>
              <Input type="date" value={createForm.reviewDate} onChange={e => setCreateForm(f => ({ ...f, reviewDate: e.target.value }))} data-testid="input-probation-review" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea placeholder="Initial probation notes..." value={createForm.outcomeNotes} onChange={e => setCreateForm(f => ({ ...f, outcomeNotes: e.target.value }))} rows={2} data-testid="textarea-probation-notes" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#FF8C42] hover:bg-[#e87d38] text-white"
              disabled={!createForm.startDate || !createForm.reviewDate || createMutation.isPending}
              onClick={() => createMutation.mutate(createForm)}
              data-testid="button-save-probation"
            >
              {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Start Probation
            </Button>
          </div>
        </div>
      )}

      {/* Outcome form */}
      {showOutcomeForm && selectedRecord && (
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3" data-testid="outcome-form">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Outcome</h4>
          <div className="space-y-1">
            <Label className="text-xs">Outcome *</Label>
            <Select value={outcomeForm.status} onValueChange={v => setOutcomeForm(f => ({ ...f, status: v }))} >
              <SelectTrigger className="h-8" data-testid="select-probation-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passed">Pass — Probation completed successfully</SelectItem>
                <SelectItem value="extended">Extend — Set a new review date</SelectItem>
                <SelectItem value="failed">Fail — Probation failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {outcomeForm.status === "extended" && (
            <div className="space-y-1">
              <Label className="text-xs">New Review Date *</Label>
              <Input type="date" value={outcomeForm.extendedReviewDate} onChange={e => setOutcomeForm(f => ({ ...f, extendedReviewDate: e.target.value }))} data-testid="input-extended-date" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea placeholder="Outcome notes, performance summary..." value={outcomeForm.outcomeNotes} onChange={e => setOutcomeForm(f => ({ ...f, outcomeNotes: e.target.value }))} rows={2} data-testid="textarea-outcome-notes" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowOutcomeForm(false); setSelectedRecord(null); }}>Cancel</Button>
            <Button
              size="sm"
              className={outcomeForm.status === "failed" ? "bg-red-600 hover:bg-red-700 text-white" : outcomeForm.status === "passed" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#FF8C42] hover:bg-[#e87d38] text-white"}
              disabled={outcomeMutation.isPending || (outcomeForm.status === "extended" && !outcomeForm.extendedReviewDate)}
              onClick={() => outcomeMutation.mutate({ id: selectedRecord.id, data: { status: outcomeForm.status, outcomeNotes: outcomeForm.outcomeNotes || undefined, extendedReviewDate: outcomeForm.status === "extended" ? outcomeForm.extendedReviewDate : undefined } })}
              data-testid="button-confirm-outcome"
            >
              {outcomeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {!isLoading && records.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Start</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Review Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => {
                  const cfg = PROBATION_STATUS_CONFIG[r.status] || PROBATION_STATUS_CONFIG.active;
                  return (
                    <tr key={r.id} data-testid={`probation-row-${r.id}`}>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(r.startDate)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(r.extendedReviewDate || r.reviewDate)}
                        {r.extendedReviewDate && <span className="text-xs text-amber-600 ml-1">(ext)</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[160px] truncate">{r.outcomeNotes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && records.length === 0 && !showCreateForm && (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No probation records</p>
          <p className="text-xs mt-1">Click "Start Probation" to add a probation record for this employee</p>
        </div>
      )}
    </TabsContent>
  );
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  sickness: "Sickness",
  unauthorised: "Unauthorised",
  compassionate: "Compassionate",
  paternity: "Paternity",
  maternity: "Maternity",
  jury_duty: "Jury Duty",
  other: "Other",
};

const ABSENCE_TYPE_COLORS: Record<string, string> = {
  sickness: "bg-red-100 text-red-700 border-red-200",
  unauthorised: "bg-orange-100 text-orange-700 border-orange-200",
  compassionate: "bg-blue-100 text-blue-700 border-blue-200",
  paternity: "bg-purple-100 text-purple-700 border-purple-200",
  maternity: "bg-pink-100 text-pink-700 border-pink-200",
  jury_duty: "bg-yellow-100 text-yellow-700 border-yellow-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

type AbsenceRecord = {
  id: number;
  employeeId: number;
  absenceType: string;
  startDate: string;
  endDate: string | null;
  totalDays: number | null;
  reason: string | null;
  selfCertified: boolean | null;
  returnToWorkConducted: boolean | null;
  returnToWorkDate: string | null;
  returnToWorkNotes: string | null;
  status: string;
  createdAt: string | null;
};

type BradfordFactor = {
  score: number;
  spells: number;
  totalDays: number;
  rating: "green" | "amber" | "red";
};
function AbsenceTab({ employeeId }: { employeeId: number }) {
  const { toast } = useToast();
  const [showLogForm, setShowLogForm] = useState(false);
  const [showRtwForm, setShowRtwForm] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceRecord | null>(null);
  const [logForm, setLogForm] = useState({
    absenceType: "sickness",
    startDate: "",
    endDate: "",
    totalDays: "",
    reason: "",
    selfCertified: false,
    status: "open",
  });
  const [rtwForm, setRtwForm] = useState({
    returnToWorkDate: "",
    returnToWorkNotes: "",
    returnToWorkConducted: true,
    status: "closed",
  });

  const { data: absences = [], isLoading: absencesLoading } = useQuery<AbsenceRecord[]>({
    queryKey: ["/api/admin/employees", employeeId, "absences"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/absences`, { credentials: "include" });

      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId,
  });
  const { data: bradford } = useQuery<BradfordFactor>({
    queryKey: ["/api/admin/employees", employeeId, "bradford-factor"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/bradford-factor`, { credentials: "include" });
      if (!res.ok) return { score: 0, spells: 0, totalDays: 0, rating: "green" as const };
      return res.json();
    },
    enabled: !!employeeId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/absences", { ...data, employeeId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Absence logged" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "absences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "bradford-factor"] });
      setShowLogForm(false);
      setLogForm({ absenceType: "sickness", startDate: "", endDate: "", totalDays: "", reason: "", selfCertified: false, status: "open" });

    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/absences/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Absence updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "absences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "bradford-factor"] });
      setShowRtwForm(false);
      setSelectedAbsence(null);

    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const bradfordColor = bradford?.rating === "red"
    ? "text-red-600 bg-red-50 border-red-200"
    : bradford?.rating === "amber"
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-emerald-600 bg-emerald-50 border-emerald-200";

  const currentYear = new Date().getFullYear();
  const thisYearDays = absences
    .filter(a => a.startDate?.startsWith(String(currentYear)))
    .reduce((s, a) => s + (a.totalDays ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Bradford Factor card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`border ${bradfordColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-70 mb-1">Bradford Factor Score (12 months)</p>
                <p className="text-3xl font-bold" data-testid="bradford-score">{bradford?.score ?? 0}</p>
                <p className="text-xs mt-1 opacity-80">
                  {bradford?.spells ?? 0} spell{(bradford?.spells ?? 0) !== 1 ? "s" : ""} × {bradford?.spells ?? 0}² × {bradford?.totalDays ?? 0} days
                </p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${bradfordColor}`}>
                  {bradford?.rating === "red" ? "⚠ HIGH RISK" : bradford?.rating === "amber" ? "▲ MEDIUM" : "✓ LOW"}
                </div>
                <p className="text-xs mt-2 opacity-70">
                  {bradford?.rating === "green" ? "< 36" : bradford?.rating === "amber" ? "36–200" : "> 200"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Absence Summary</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-[#1F3A5F]" data-testid="total-absences-count">{absences.length}</p>
                <p className="text-xs text-muted-foreground">Total records</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1F3A5F]" data-testid="this-year-days">{thisYearDays}</p>
                <p className="text-xs text-muted-foreground">Days this year</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600" data-testid="open-absences-count">
                  {absences.filter(a => a.status === "open").length}
                </p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600" data-testid="sickness-count">
                  {absences.filter(a => a.absenceType === "sickness").length}
                </p>
                <p className="text-xs text-muted-foreground">Sickness</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bradford scale legend */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 text-xs">
        <span className="font-medium text-muted-foreground">B = S² × D:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Green &lt; 36</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Amber 36–200</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Red &gt; 200</span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Absence History</h3>
        <Button
          size="sm"
          className="bg-[#1F3A5F] hover:bg-[#152d4a] text-white h-7 text-xs"
          onClick={() => setShowLogForm(true)}
          data-testid="button-log-absence-employee"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Log Absence
        </Button>
      </div>

      {absencesLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : absences.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No absences recorded</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Start</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">End</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Days</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">RTW</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {absences.map(a => {
                const needsRtw = a.absenceType === "sickness" && (a.totalDays ?? 0) > 3 && !a.returnToWorkConducted;
                return (
                  <tr key={a.id} className="hover:bg-muted/20" data-testid={`row-emp-absence-${a.id}`}>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${ABSENCE_TYPE_COLORS[a.absenceType] || ABSENCE_TYPE_COLORS.other}`}>
                        {ABSENCE_TYPE_LABELS[a.absenceType] || a.absenceType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{formatDate(a.startDate)}</td>
                    <td className="py-2 px-3 text-muted-foreground">{formatDate(a.endDate)}</td>
                    <td className="py-2 px-3 font-medium">{a.totalDays ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[160px] truncate">{a.reason || "—"}</td>
                    <td className="py-2 px-3">
                      {needsRtw && a.status === "closed" && !a.returnToWorkConducted ? (
                        <span className="text-orange-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Req.</span>
                      ) : a.returnToWorkConducted ? (
                        <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Done</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {a.status === "closed" ? (
                        <span className="text-muted-foreground">Closed</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Open</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {a.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => updateMutation.mutate({ id: a.id, data: { status: "closed" } })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-close-emp-absence-${a.id}`}
                          >
                            Close
                          </Button>
                        )}
                        {a.absenceType === "sickness" && !a.returnToWorkConducted && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              setSelectedAbsence(a);
                              setRtwForm({ returnToWorkDate: "", returnToWorkNotes: a.returnToWorkNotes || "", returnToWorkConducted: true, status: "closed" });
                              setShowRtwForm(true);
                            }}
                            data-testid={`button-rtw-emp-absence-${a.id}`}
                          >
                            RTW
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Absence Dialog */}
      <Dialog open={showLogForm} onOpenChange={setShowLogForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Log Absence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Absence Type *</Label>
              <Select value={logForm.absenceType} onValueChange={v => setLogForm(f => ({ ...f, absenceType: v }))}>
                <SelectTrigger data-testid="select-emp-absence-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ABSENCE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input type="date" value={logForm.startDate} onChange={e => setLogForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-emp-absence-start" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={logForm.endDate} onChange={e => setLogForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-emp-absence-end" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total Days</Label>
              <Input type="number" min="1" value={logForm.totalDays} onChange={e => setLogForm(f => ({ ...f, totalDays: e.target.value }))} placeholder="Auto-calculated" data-testid="input-emp-absence-days" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Textarea value={logForm.reason} onChange={e => setLogForm(f => ({ ...f, reason: e.target.value }))} rows={2} data-testid="input-emp-absence-reason" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="emp-self-cert" checked={logForm.selfCertified} onCheckedChange={v => setLogForm(f => ({ ...f, selfCertified: !!v }))} data-testid="checkbox-emp-self-certified" />
              <Label htmlFor="emp-self-cert" className="text-xs cursor-pointer">Self-certified</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={logForm.status} onValueChange={v => setLogForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-emp-absence-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogForm(false)}>Cancel</Button>
            <Button
              className="bg-[#1F3A5F] hover:bg-[#152d4a] text-white"
              onClick={() => {
                if (!logForm.absenceType || !logForm.startDate) {
                  toast({ title: "Please fill required fields", variant: "destructive" });
                  return;
                }
                const days = (!logForm.totalDays && logForm.startDate && logForm.endDate)
                  ? Math.ceil((new Date(logForm.endDate).getTime() - new Date(logForm.startDate).getTime()) / 86400000) + 1
                  : logForm.totalDays ? parseInt(logForm.totalDays) : null;
                createMutation.mutate({ ...logForm, totalDays: days });
              }}
              disabled={createMutation.isPending}
              data-testid="button-save-emp-absence"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Absence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RTW Dialog */}
      <Dialog open={showRtwForm} onOpenChange={setShowRtwForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Return to Work
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">RTW Interview Date *</Label>
              <Input type="date" value={rtwForm.returnToWorkDate} onChange={e => setRtwForm(f => ({ ...f, returnToWorkDate: e.target.value }))} data-testid="input-emp-rtw-date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Interview Notes</Label>
              <Textarea value={rtwForm.returnToWorkNotes} onChange={e => setRtwForm(f => ({ ...f, returnToWorkNotes: e.target.value }))} rows={4} data-testid="input-emp-rtw-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRtwForm(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!rtwForm.returnToWorkDate) {
                  toast({ title: "Please enter interview date", variant: "destructive" });
                  return;
                }
                if (selectedAbsence) {
                  updateMutation.mutate({ id: selectedAbsence.id, data: rtwForm });
                }
              }}
              disabled={updateMutation.isPending}
              data-testid="button-save-emp-rtw"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Complete RTW
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


const TRAINING_TYPE_OPTIONS = [
  { value: "first_aid", label: "First Aid" },
  { value: "manual_handling", label: "Manual Handling" },
  { value: "fire_marshal", label: "Fire Marshal" },
  { value: "conflict_resolution", label: "Conflict Resolution" },
  { value: "sia_refresher", label: "SIA Refresher" },
  { value: "custom", label: "Custom" },
];

const TRAINING_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
];

type TrainingRecord = {
  id: number;
  employeeId: number;
  tenantId: number;
  trainingType: string;
  trainingName: string;
  provider: string | null;
  completedDate: string | null;
  expiryDate: string | null;
  certificateUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string | null;
};

function getTrainingExpiryBadge(record: TrainingRecord) {
  const days = record.expiryDate
    ? Math.ceil((new Date(record.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (record.status === "not_started") return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
  if (record.status === "in_progress") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">In Progress</Badge>;
  if (record.status === "expired" || (days !== null && days < 0)) {
    return <Badge variant="destructive" className="text-xs">Expired{days !== null ? ` (${Math.abs(days)}d ago)` : ""}</Badge>;
  }
  if (days !== null && days <= 30) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Expiring in {days}d</Badge>;
  }
  if (days !== null && days <= 90) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Expiring in {days}d</Badge>;
  }
  if (record.status === "completed") {
    return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Completed{days !== null ? ` · ${days}d left` : ""}</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">{record.status}</Badge>;
}

function TrainingTab({ employeeId }: { employeeId: number }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [form, setForm] = useState({
    trainingType: "custom",
    trainingName: "",
    provider: "",
    completedDate: "",
    expiryDate: "",
    certificateUrl: "",
    status: "not_started",
    notes: "",
  });

  async function handleCertificateUpload(file: File) {
    setCertUploading(true);
    try {
      const res = await fetch("/api/uploads/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-File-Name": file.name, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.objectPath || data.url || "";
      setForm(f => ({ ...f, certificateUrl: url }));
      toast({ title: "Certificate uploaded", description: file.name });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setCertUploading(false);
    }
  }

  const { data: trainingRecords = [], isLoading } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/admin/training-records/employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/training-records/employee/${employeeId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId,
  });
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/training-records", { ...data, employeeId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training record added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-records/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-matrix"] });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/training-records/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training record updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-records/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-matrix"] });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/training-records/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training record deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-records/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-matrix"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setShowForm(false);
    setEditingRecord(null);
    setForm({ trainingType: "custom", trainingName: "", provider: "", completedDate: "", expiryDate: "", certificateUrl: "", status: "not_started", notes: "" });
  }

  function startEdit(record: TrainingRecord) {
    setEditingRecord(record);
    setForm({
      trainingType: record.trainingType,
      trainingName: record.trainingName,
      provider: record.provider || "",
      completedDate: record.completedDate || "",
      expiryDate: record.expiryDate || "",
      certificateUrl: record.certificateUrl || "",
      status: record.status,
      notes: record.notes || "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.trainingName.trim()) {
      toast({ title: "Training name is required", variant: "destructive" });
      return;
    }
    const payload = {
      trainingType: form.trainingType,
      trainingName: form.trainingName.trim(),
      provider: form.provider || null,
      completedDate: form.completedDate || null,
      expiryDate: form.expiryDate || null,
      certificateUrl: form.certificateUrl || null,
      status: form.status,
      notes: form.notes || null,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <TabsContent value="training" className="space-y-4 mt-4" data-testid="training-tab">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">Training Records</h3>
          <p className="text-xs text-muted-foreground">{trainingRecords.length} record{trainingRecords.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditingRecord(null); }} data-testid="button-add-training">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Training
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium text-sm">{editingRecord ? "Edit Training Record" : "Add Training Record"}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Training Type</Label>
                <Select value={form.trainingType} onValueChange={v => setForm(f => ({ ...f, trainingType: v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-training-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-training-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Training Name *</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.trainingName}
                  onChange={e => setForm(f => ({ ...f, trainingName: e.target.value }))}
                  placeholder="e.g. First Aid at Work Level 3"
                  data-testid="input-training-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  placeholder="e.g. St John Ambulance"
                  data-testid="input-training-provider"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Certificate</Label>
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 text-xs flex-1"
                    value={form.certificateUrl}
                    onChange={e => setForm(f => ({ ...f, certificateUrl: e.target.value }))}
                    placeholder="https:// or upload a file →"
                    data-testid="input-training-certificate"
                  />
                  <label className="cursor-pointer" title="Upload certificate file">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCertificateUpload(f); e.target.value = ""; }}
                      data-testid="input-cert-file-upload"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={certUploading} asChild>
                      <span>{certUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}</span>
                    </Button>
                  </label>
                </div>
                {form.certificateUrl && (
                  <a href={form.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5">
                    <Paperclip className="w-3 h-3" /> View certificate
                  </a>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Completed Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.completedDate}
                  onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))}
                  data-testid="input-training-completed-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  data-testid="input-training-expiry-date"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  className="text-xs"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  data-testid="input-training-notes"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-training"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                {editingRecord ? "Update" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : trainingRecords.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No training records yet</p>
          <p className="text-xs mt-1">Click "Add Training" to record mandatory or optional training completions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trainingRecords.map(record => (
            <Card key={record.id} className="border" data-testid={`card-training-record-${record.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{record.trainingName}</span>
                      {getTrainingExpiryBadge(record)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="capitalize">{record.trainingType.replace(/_/g, " ")}</span>
                      {record.provider && <span>· {record.provider}</span>}
                      {record.completedDate && <span>· Completed: {new Date(record.completedDate).toLocaleDateString("en-GB")}</span>}
                      {record.expiryDate && <span>· Expires: {new Date(record.expiryDate).toLocaleDateString("en-GB")}</span>}
                    </div>
                    {record.notes && <p className="text-xs text-muted-foreground italic">{record.notes}</p>}
                    {record.certificateUrl && (
                      <a
                        href={record.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        data-testid={`link-certificate-${record.id}`}
                      >
                        <ExternalLink className="w-3 h-3" /> View Certificate
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => startEdit(record)}
                      data-testid={`button-edit-training-${record.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this training record?")) deleteMutation.mutate(record.id);
                      }}
                      data-testid={`button-delete-training-${record.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
