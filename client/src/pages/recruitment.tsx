import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, UserPlus, Users, Search, Plus, Eye, Calendar, MapPin,
  Clock, Sparkles, Loader2, TrendingUp, CheckCircle2, XCircle,
  DollarSign, Video, User, ChevronRight, BarChart3, FileDown, ArrowRight,
  Upload, AlertTriangle, Mail, Copy, Link2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Site } from "@shared/schema";

type JobPosting = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string;
  requirements: string | null;
  hourlyRate: string | null;
  isActive: boolean | null;
  closingDate: string | null;
  applicantCount: number;
  siteName: string | null;
  jobRef: string | null;
};

type EnrichedApplicant = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string | null;
  jobTitle: string | null;
  jobPostingId: number | null;
  interviewDate: string | null;
  interviewLocation: string | null;
  interviewLink: string | null;
  interviewerName: string | null;
  interviewerId: string | null;
  rating: number | null;
  notes: string | null;
  coverLetter: string | null;
  source: string | null;
  offerDate: string | null;
  offerSalary: string | null;
  offerStatus: string | null;
  offerLetterUrl: string | null;
  offerEmailSentAt: string | null;
  offerResponseToken: string | null;
  offerRespondedAt: string | null;
  hiredAt: string | null;
};

type RecruitmentMetrics = {
  funnel: { stage: string; label: string; count: number }[];
  stageTransitions: { label: string; avgDays: number | null; sampleSize: number }[];
  sources: { source: string; count: number }[];
  conversionRates: { from: string; to: string; fromLabel: string; toLabel: string; rate: number; fromCount: number; toCount: number }[];
  monthlyHires: { month: string; label: string; count: number }[];
  avgTimeToHire: number | null;
  total: number;
};

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  screening: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  interview: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  offer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  hired: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const SOURCE_LABELS: Record<string, string> = {
  job_board: "Job Board",
  referral: "Referral",
  agency: "Agency",
  direct: "Direct",
  other: "Other",
};

const EMPLOYMENT_TYPES: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  temporary: "Temporary",
};

const FUNNEL_COLORS = [
  "bg-blue-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-green-500",
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

export default function RecruitmentPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"postings" | "applicants" | "metrics">("postings");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [showMakeOffer, setShowMakeOffer] = useState(false);
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<EnrichedApplicant | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");

  const [jobForm, setJobForm] = useState({
    title: "", department: "", location: "", employmentType: "full_time",
    description: "", requirements: "", hourlyRate: "", siteId: "", closingDate: "",
  });

  const [applicantForm, setApplicantForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", jobPostingId: "", coverLetter: "", source: "direct",
  });

  const [offerForm, setOfferForm] = useState({
    offerSalary: "", startDate: "", notes: "",
  });

  const [interviewForm, setInterviewForm] = useState({
    interviewDate: "", interviewLocation: "", interviewLink: "", interviewerName: "", interviewerId: "",
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [metricsDateRange, setMetricsDateRange] = useState<"30" | "60" | "90" | "all">("all");

  const [showImportCSV, setShowImportCSV] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<{ firstName: string; lastName: string; email: string; phone: string; jobPostingId: string; source: string; _error?: string }[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);

  const generateJobDescription = async () => {
    if (!jobForm.title.trim()) {
      toast({ title: "Please enter a job title first", variant: "destructive" });
      return;
    }
    setIsGeneratingAI(true);
    try {
      const res = await fetch("/api/ai/generate-job-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: jobForm.title }),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      setJobForm((prev) => ({
        ...prev,
        description: data.description || prev.description,
        requirements: data.requirements || prev.requirements,
      }));
      toast({ title: "AI generated description and requirements" });
    } catch (err: any) {
      toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const { data: jobPostings = [], isLoading: isLoadingJobs } = useQuery<JobPosting[]>({
    queryKey: ["/api/job-postings"],
  });

  const { data: applicants = [], isLoading: isLoadingApplicants } = useQuery<EnrichedApplicant[]>({
    queryKey: ["/api/applicants"],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const metricsQueryKey = metricsDateRange === "all"
    ? "/api/admin/recruitment/metrics"
    : `/api/admin/recruitment/metrics?days=${metricsDateRange}`;

  const { data: metrics } = useQuery<RecruitmentMetrics>({
    queryKey: ["/api/admin/recruitment/metrics", metricsDateRange],
    queryFn: async () => {
      const res = await fetch(metricsQueryKey, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: activeTab === "metrics",
  });

  const { data: adminUsers = [] } = useQuery<{ id: string; firstName: string; lastName: string; role: string }[]>({
    queryKey: ["/api/admin/users"],
    enabled: showScheduleInterview,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: typeof jobForm) => {
      const payload = {
        ...data,
        siteId: data.siteId ? parseInt(data.siteId) : null,
        closingDate: data.closingDate || null,
      };
      await apiRequest("POST", "/api/job-postings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-postings"] });
      setShowCreateJob(false);
      setJobForm({ title: "", department: "", location: "", employmentType: "full_time", description: "", requirements: "", hourlyRate: "", siteId: "", closingDate: "" });
      toast({ title: "Job posting created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create job posting", description: err.message, variant: "destructive" });
    },
  });

  const toggleJobMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/job-postings/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-postings"] });
      toast({ title: "Job posting updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update job posting", description: err.message, variant: "destructive" });
    },
  });

  const addApplicantMutation = useMutation({
    mutationFn: async (data: typeof applicantForm) => {
      const payload = {
        ...data,
        jobPostingId: data.jobPostingId ? parseInt(data.jobPostingId) : null,
      };
      await apiRequest("POST", "/api/applicants", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      setShowAddApplicant(false);
      setApplicantForm({ firstName: "", lastName: "", email: "", phone: "", jobPostingId: "", coverLetter: "", source: "direct" });
      toast({ title: "Applicant added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add applicant", description: err.message, variant: "destructive" });
    },
  });

  const updateApplicantMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/applicants/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      toast({ title: "Applicant status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const makeOfferMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; offerSalary: string; startDate: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/admin/applicants/${id}/offer`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      setShowMakeOffer(false);
      setOfferForm({ offerSalary: "", startDate: "", notes: "" });
      const emailSent = data?.emailSent;
      toast({ title: "Offer made successfully", description: emailSent ? "Offer letter PDF downloaded and emailed to the applicant." : "Offer letter PDF is ready to download." });
      if (selectedApplicant && data?.applicant) {
        setSelectedApplicant({ ...selectedApplicant, ...data.applicant, status: "offer", offerStatus: "pending" });
      }
      // Auto-download the offer letter PDF
      if (data?.pdfBase64) {
        const byteChars = atob(data.pdfBase64);
        const byteNums = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
        const blob = new Blob([new Uint8Array(byteNums)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Offer_Letter_${selectedApplicant?.firstName}_${selectedApplicant?.lastName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to make offer", description: err.message, variant: "destructive" });
    },
  });

  const respondOfferMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      return await apiRequest("PATCH", `/api/admin/applicants/${id}/offer/respond`, { response });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      if (selectedApplicant) {
        setSelectedApplicant({
          ...selectedApplicant,
          offerStatus: variables.response,
          status: variables.response === "declined" ? "rejected" : "offer",
        });
      }
      toast({ title: `Offer ${variables.response}` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update offer response", description: err.message, variant: "destructive" });
    },
  });

  const sendOfferEmailMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/applicants/${id}/send-offer-email`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      if (selectedApplicant) {
        setSelectedApplicant({ ...selectedApplicant, offerEmailSentAt: data?.offerEmailSentAt || new Date().toISOString() });
      }
      toast({ title: "Offer email sent", description: "The offer letter has been emailed to the applicant." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send offer email", description: err.message, variant: "destructive" });
    },
  });

  const hireMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/applicants/${id}/hire`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      setSelectedApplicant(null);
      const onboardingId = data?.onboarding?.id;
      toast({ title: "Employee record created!", description: "Redirecting to their onboarding record..." });
      setTimeout(() => {
        navigate(onboardingId ? `/admin/onboarding?open=${onboardingId}` : "/admin/onboarding");
      }, 1200);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to hire applicant", description: err.message, variant: "destructive" });
    },
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof interviewForm) => {
      return await apiRequest("POST", `/api/admin/applicants/${id}/interview`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      setShowScheduleInterview(false);
      setInterviewForm({ interviewDate: "", interviewLocation: "", interviewLink: "", interviewerName: "", interviewerId: "" });
      toast({ title: "Interview scheduled", description: "Interviewer notified via in-app notification" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to schedule interview", description: err.message, variant: "destructive" });
    },
  });

  const importCSVMutation = useMutation({
    mutationFn: async (rows: typeof csvPreviewRows) => {
      const payload = rows.filter((r) => !r._error).map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone || undefined,
        jobPostingId: r.jobPostingId ? parseInt(r.jobPostingId) : null,
        source: r.source || undefined,
      }));
      const res = await apiRequest("POST", "/api/admin/applicants/import", { rows: payload });
      return res.json();
    },
    onSuccess: (data: { imported: number; duplicates: string[]; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applicants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recruitment/metrics"] });
      setShowImportCSV(false);
      setCsvPreviewRows([]);
      setCsvParseError(null);
      const parts = [`${data.imported} applicant${data.imported !== 1 ? "s" : ""} imported`];
      if (data.duplicates.length > 0) parts.push(`${data.duplicates.length} duplicate${data.duplicates.length !== 1 ? "s" : ""} skipped`);
      if (data.errors.length > 0) parts.push(`${data.errors.length} row${data.errors.length !== 1 ? "s" : ""} had errors`);
      toast({ title: "CSV Import Complete", description: parts.join(", ") });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setCsvParseError("CSV must have a header row and at least one data row.");
      setCsvPreviewRows([]);
      return;
    }
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };
    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
    const col = (row: string[], name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (row[idx] || "").trim() : "";
    };
    const rows = lines.slice(1).map((line) => {
      const cells = parseRow(line);
      const firstName = col(cells, "first_name");
      const lastName = col(cells, "last_name");
      const email = col(cells, "email");
      const phone = col(cells, "phone");
      const jobPostingId = col(cells, "job_posting_id");
      const source = col(cells, "source");
      let _error: string | undefined;
      if (!firstName || !lastName || !email) _error = "Missing required fields (first_name, last_name, email)";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) _error = "Invalid email address";
      return { firstName, lastName, email, phone, jobPostingId, source, _error };
    });
    setCsvParseError(null);
    setCsvPreviewRows(rows);
  }

  const filteredApplicants = applicants.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || a.email.toLowerCase().includes(search);
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesJob = jobFilter === "all" || String(a.jobPostingId) === jobFilter;
    return matchesSearch && matchesStatus && matchesJob;
  });

  const filteredJobs = jobPostings.filter((j) => {
    const search = searchTerm.toLowerCase();
    return j.title.toLowerCase().includes(search) ||
      (j.department || "").toLowerCase().includes(search) ||
      (j.location || "").toLowerCase().includes(search);
  });

  const stats = {
    totalPostings: jobPostings.length,
    activePostings: jobPostings.filter((j) => j.isActive).length,
    totalApplicants: applicants.length,
    hiredCount: applicants.filter((a) => a.status === "hired").length,
  };

  const maxFunnelCount = Math.max(...(metrics?.funnel?.map(f => f.count) || [1]), 1);

  return (
    <div className="p-6 space-y-6" data-testid="recruitment-page">
      <div>
        <h1 className="text-2xl font-bold">Recruitment</h1>
        <p className="text-muted-foreground text-sm">Manage job postings, applicants, and hiring pipeline.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-total-postings">{stats.totalPostings}</div>
            <div className="text-xs text-muted-foreground">Total Postings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-postings">{stats.activePostings}</div>
            <div className="text-xs text-muted-foreground">Active Postings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-total-applicants">{stats.totalApplicants}</div>
            <div className="text-xs text-muted-foreground">Total Applicants</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UserPlus className="w-5 h-5 mx-auto mb-1 text-accent" />
            <div className="text-2xl font-bold text-accent" data-testid="text-hired-count">{stats.hiredCount}</div>
            <div className="text-xs text-muted-foreground">Hired</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={activeTab === "postings" ? "default" : "outline"}
            onClick={() => { setActiveTab("postings"); setSearchTerm(""); }}
            data-testid="tab-postings"
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Job Postings
          </Button>
          <Button
            variant={activeTab === "applicants" ? "default" : "outline"}
            onClick={() => { setActiveTab("applicants"); setSearchTerm(""); }}
            data-testid="tab-applicants"
          >
            <Users className="w-4 h-4 mr-2" />
            Applicants
          </Button>
          <Button
            variant={activeTab === "metrics" ? "default" : "outline"}
            onClick={() => { setActiveTab("metrics"); setSearchTerm(""); }}
            data-testid="tab-metrics"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Pipeline Metrics
          </Button>
        </div>
        <div className="flex-1" />
        {activeTab === "postings" && (
          <Button onClick={() => setShowCreateJob(true)} data-testid="button-create-job">
            <Plus className="w-4 h-4 mr-2" />
            Create Job Posting
          </Button>
        )}
        {activeTab === "applicants" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setShowImportCSV(true); setCsvPreviewRows([]); setCsvParseError(null); }} data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setShowAddApplicant(true)} data-testid="button-add-applicant">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Applicant
            </Button>
          </div>
        )}
      </div>

      {activeTab !== "metrics" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder={activeTab === "postings" ? "Search job postings..." : "Search applicants..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {activeTab === "applicants" && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                  <SelectValue placeholder="Filter by job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobPostings.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}

      {activeTab === "postings" && (
        <>
          {isLoadingJobs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-64 bg-muted animate-pulse rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No job postings found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? "Try adjusting your search." : "Create your first job posting to start recruiting."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredJobs.map((job) => (
                <Card key={job.id} data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {job.jobRef && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-job-ref-${job.id}`}>{job.jobRef}</span>}
                          <h3 className="font-semibold text-sm truncate" data-testid={`text-job-title-${job.id}`}>
                            {job.title}
                          </h3>
                        </div>
                        {job.department && (
                          <p className="text-xs text-muted-foreground">{job.department}</p>
                        )}
                      </div>
                      <Badge
                        variant={job.isActive ? "default" : "secondary"}
                        data-testid={`badge-job-status-${job.id}`}
                      >
                        {job.isActive ? "Active" : "Closed"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {job.employmentType && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {EMPLOYMENT_TYPES[job.employmentType] || job.employmentType}
                        </span>
                      )}
                      {job.hourlyRate && (
                        <span className="flex items-center gap-1">
                          £{job.hourlyRate}/hr
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {job.applicantCount} applicant{job.applicantCount !== 1 ? "s" : ""}
                      </span>
                      {job.closingDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Closes {formatDate(job.closingDate)}
                        </span>
                      )}
                      {job.siteName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.siteName}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobMutation.mutate({ id: job.id, isActive: !job.isActive })}
                        disabled={toggleJobMutation.isPending}
                        data-testid={`button-toggle-job-${job.id}`}
                      >
                        {job.isActive ? "Close Posting" : "Reactivate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "applicants" && (
        <>
          {isLoadingApplicants ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
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
          ) : filteredApplicants.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No applicants found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || jobFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Applicants will appear here once they apply or are added."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredApplicants.map((applicant) => {
                const status = applicant.status || "applied";
                return (
                  <Card
                    key={applicant.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedApplicant(applicant)}
                    data-testid={`card-applicant-${applicant.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-primary">
                              {(applicant.firstName?.[0] || "")}{(applicant.lastName?.[0] || "")}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate" data-testid={`text-applicant-name-${applicant.id}`}>
                              {applicant.firstName} {applicant.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {applicant.email}
                            </div>
                            {applicant.jobTitle && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Briefcase className="w-3 h-3" /> {applicant.jobTitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {applicant.source && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {SOURCE_LABELS[applicant.source] || applicant.source}
                            </span>
                          )}
                          {applicant.interviewDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(applicant.interviewDate)}
                            </span>
                          )}
                          {applicant.rating !== null && applicant.rating !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              Rating: {applicant.rating}/5
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.applied}`}
                            data-testid={`badge-applicant-status-${applicant.id}`}
                          >
                            {STATUS_LABELS[status] || status}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setSelectedApplicant(applicant); }}
                            data-testid={`button-view-applicant-${applicant.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "metrics" && (
        <div className="space-y-6" data-testid="metrics-panel">
          {/* Date range filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Date range:</span>
            {(["30", "60", "90", "all"] as const).map(range => (
              <Button
                key={range}
                size="sm"
                variant={metricsDateRange === range ? "default" : "outline"}
                onClick={() => setMetricsDateRange(range)}
                data-testid={`date-range-${range}`}
              >
                {range === "all" ? "All time" : `Last ${range} days`}
              </Button>
            ))}
          </div>

          {!metrics ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="p-6"><div className="h-32 bg-muted animate-pulse rounded" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <>
              {/* KPI summary row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <div className="text-2xl font-bold" data-testid="text-avg-time-to-hire">
                      {metrics.avgTimeToHire !== null ? metrics.avgTimeToHire : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Avg. Days to Hire</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <UserPlus className="w-5 h-5 mx-auto mb-1 text-green-600" />
                    <div className="text-2xl font-bold text-green-600" data-testid="text-metrics-hired">
                      {metrics.funnel.find(f => f.stage === "hired")?.count ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {metricsDateRange === "all" ? "Total Hired" : `Hired (${metricsDateRange}d)`}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-accent" />
                    <div className="text-2xl font-bold" data-testid="text-overall-conversion">
                      {(() => {
                        const applied = metrics.funnel.find(f => f.stage === "applied")?.count ?? 0;
                        const hired = metrics.funnel.find(f => f.stage === "hired")?.count ?? 0;
                        return applied > 0 ? `${Math.round((hired / applied) * 100)}%` : "—";
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground">Applied → Hired Rate</div>
                  </CardContent>
                </Card>
              </div>

              {/* Funnel with conversion rates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-4 h-4" />
                    Recruitment Funnel & Conversion Rates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics.funnel.map((stage, i) => {
                    const conversion = metrics.conversionRates.find(c => c.from === stage.stage);
                    return (
                      <div key={stage.stage} data-testid={`funnel-stage-${stage.stage}`}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                              <span className="font-medium">{stage.label}</span>
                            </div>
                            <span className="font-bold text-base">{stage.count}</span>
                          </div>
                          <div className="h-6 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${FUNNEL_COLORS[i] || "bg-primary"}`}
                              style={{ width: `${maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        {conversion && (
                          <div className="flex items-center gap-1 mt-1 ml-2 text-xs text-muted-foreground" data-testid={`conversion-${stage.stage}-to-${conversion.to}`}>
                            <ArrowRight className="w-3 h-3" />
                            <span>
                              {conversion.fromLabel} → {conversion.toLabel}:{" "}
                              <span className={`font-semibold ${conversion.rate >= 50 ? "text-green-600" : conversion.rate >= 25 ? "text-yellow-600" : "text-red-500"}`}>
                                {conversion.rate}%
                              </span>
                              {" "}({conversion.toCount} of {conversion.fromCount})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Monthly hires trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4" />
                    Monthly Hires (Last 12 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.monthlyHires.every(m => m.count === 0) ? (
                    <p className="text-sm text-muted-foreground">No hire data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={metrics.monthlyHires} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value: number) => [value, "Hires"]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Bar dataKey="count" fill="#1F3A5F" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-4 h-4" />
                      Average Days Between Stages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(metrics.stageTransitions ?? []).map(({ label, avgDays, sampleSize }) => (
                        <div key={label} className="flex items-center justify-between text-sm" data-testid={`stage-transition-${label.replace(/\s/g, "-").toLowerCase()}`}>
                          <div>
                            <span className="text-muted-foreground">{label}</span>
                            {sampleSize > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">({sampleSize} hires)</span>
                            )}
                          </div>
                          <span className="font-semibold">
                            {avgDays !== null ? `${avgDays} day${avgDays !== 1 ? "s" : ""}` : "—"}
                          </span>
                        </div>
                      ))}
                      {(metrics.stageTransitions ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground">No transition data yet — data appears once applicants progress through stages</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-4 h-4" />
                      Source Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metrics.sources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    ) : (
                      <div className="space-y-3">
                        {metrics.sources.map(({ source, count }) => (
                          <div key={source} className="space-y-1" data-testid={`source-${source}`}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{SOURCE_LABELS[source] || source}</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${metrics.total > 0 ? (count / metrics.total) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Job Dialog */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Posting</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createJobMutation.mutate(jobForm); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="job-title">Title</Label>
              <Input
                id="job-title"
                data-testid="input-job-title"
                value={jobForm.title}
                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-department">Department</Label>
                <Input
                  id="job-department"
                  data-testid="input-job-department"
                  value={jobForm.department}
                  onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-location">Location</Label>
                <Input
                  id="job-location"
                  data-testid="input-job-location"
                  value={jobForm.location}
                  onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={jobForm.employmentType}
                  onValueChange={(val) => setJobForm({ ...jobForm, employmentType: val })}
                >
                  <SelectTrigger data-testid="select-job-employment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-hourly-rate">Hourly Rate (£)</Label>
                <Input
                  id="job-hourly-rate"
                  data-testid="input-job-hourly-rate"
                  value={jobForm.hourlyRate}
                  onChange={(e) => setJobForm({ ...jobForm, hourlyRate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={jobForm.siteId}
                  onValueChange={(val) => setJobForm({ ...jobForm, siteId: val })}
                >
                  <SelectTrigger data-testid="select-job-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-closing-date">Closing Date</Label>
                <Input
                  id="job-closing-date"
                  type="date"
                  data-testid="input-job-closing-date"
                  value={jobForm.closingDate}
                  onChange={(e) => setJobForm({ ...jobForm, closingDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="job-description">Description</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateJobDescription}
                  disabled={isGeneratingAI}
                  className="h-7 text-xs gap-1"
                  data-testid="button-ai-generate-description"
                >
                  {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Generate
                </Button>
              </div>
              <Textarea
                id="job-description"
                data-testid="input-job-description"
                value={jobForm.description}
                onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                rows={4}
                required
                placeholder={isGeneratingAI ? "Generating with AI..." : "Enter job description or use AI Generate"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-requirements">Requirements</Label>
              <Textarea
                id="job-requirements"
                data-testid="input-job-requirements"
                value={jobForm.requirements}
                onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                rows={4}
                placeholder="Enter requirements"
              />
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setShowCreateJob(false)} data-testid="button-cancel-create-job">
                Cancel
              </Button>
              <Button type="submit" disabled={createJobMutation.isPending} data-testid="button-submit-create-job">
                {createJobMutation.isPending ? "Creating..." : "Create Posting"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Applicant Dialog */}
      <Dialog open={showAddApplicant} onOpenChange={setShowAddApplicant}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Applicant</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); addApplicantMutation.mutate(applicantForm); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-first-name">First Name</Label>
                <Input
                  id="app-first-name"
                  data-testid="input-applicant-first-name"
                  value={applicantForm.firstName}
                  onChange={(e) => setApplicantForm({ ...applicantForm, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-last-name">Last Name</Label>
                <Input
                  id="app-last-name"
                  data-testid="input-applicant-last-name"
                  value={applicantForm.lastName}
                  onChange={(e) => setApplicantForm({ ...applicantForm, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-email">Email</Label>
                <Input
                  id="app-email"
                  type="email"
                  data-testid="input-applicant-email"
                  value={applicantForm.email}
                  onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-phone">Phone</Label>
                <Input
                  id="app-phone"
                  data-testid="input-applicant-phone"
                  value={applicantForm.phone}
                  onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Posting</Label>
                <Select
                  value={applicantForm.jobPostingId}
                  onValueChange={(val) => setApplicantForm({ ...applicantForm, jobPostingId: val })}
                >
                  <SelectTrigger data-testid="select-applicant-job">
                    <SelectValue placeholder="Select job posting" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobPostings.map((j) => (
                      <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={applicantForm.source}
                  onValueChange={(val) => setApplicantForm({ ...applicantForm, source: val })}
                >
                  <SelectTrigger data-testid="select-applicant-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_board">Job Board</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-cover-letter">Cover Letter</Label>
              <Textarea
                id="app-cover-letter"
                data-testid="input-applicant-cover-letter"
                value={applicantForm.coverLetter}
                onChange={(e) => setApplicantForm({ ...applicantForm, coverLetter: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setShowAddApplicant(false)} data-testid="button-cancel-add-applicant">
                Cancel
              </Button>
              <Button type="submit" disabled={addApplicantMutation.isPending} data-testid="button-submit-add-applicant">
                {addApplicantMutation.isPending ? "Adding..." : "Add Applicant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Make Offer Dialog */}
      <Dialog open={showMakeOffer} onOpenChange={setShowMakeOffer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make Offer — {selectedApplicant?.firstName} {selectedApplicant?.lastName}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedApplicant) return;
              makeOfferMutation.mutate({ id: selectedApplicant.id, ...offerForm });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offer-salary">Annual Salary (£)</Label>
                <Input
                  id="offer-salary"
                  type="number"
                  placeholder="e.g. 28000"
                  data-testid="input-offer-salary"
                  value={offerForm.offerSalary}
                  onChange={(e) => setOfferForm({ ...offerForm, offerSalary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-start-date">Proposed Start Date</Label>
                <Input
                  id="offer-start-date"
                  type="date"
                  data-testid="input-offer-start-date"
                  value={offerForm.startDate}
                  onChange={(e) => setOfferForm({ ...offerForm, startDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-notes">Notes</Label>
              <Textarea
                id="offer-notes"
                data-testid="input-offer-notes"
                value={offerForm.notes}
                onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
                rows={3}
                placeholder="Any additional notes for this offer..."
              />
            </div>
            <p className="text-xs text-muted-foreground">An offer letter PDF will be generated and downloaded automatically.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMakeOffer(false)}>Cancel</Button>
              <Button type="submit" disabled={makeOfferMutation.isPending} data-testid="button-submit-offer">
                {makeOfferMutation.isPending ? "Generating..." : "Make Offer & Download PDF"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      <Dialog open={showScheduleInterview} onOpenChange={setShowScheduleInterview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview — {selectedApplicant?.firstName} {selectedApplicant?.lastName}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedApplicant) return;
              scheduleInterviewMutation.mutate({ id: selectedApplicant.id, ...interviewForm });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="interview-date">Date & Time</Label>
              <Input
                id="interview-date"
                type="datetime-local"
                data-testid="input-interview-date"
                value={interviewForm.interviewDate}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-location">Location</Label>
              <Input
                id="interview-location"
                data-testid="input-interview-location"
                placeholder="e.g. Head Office, London"
                value={interviewForm.interviewLocation}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewLocation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-link">Video Link (optional)</Label>
              <Input
                id="interview-link"
                data-testid="input-interview-link"
                placeholder="e.g. https://meet.google.com/..."
                value={interviewForm.interviewLink}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewLink: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interviewer-name">Interviewer Name</Label>
              <Input
                id="interviewer-name"
                data-testid="input-interviewer-name"
                placeholder="e.g. Jane Smith"
                value={interviewForm.interviewerName}
                onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
              />
            </div>
            {adminUsers.length > 0 && (
              <div className="space-y-2">
                <Label>Notify User (in-app)</Label>
                <Select
                  value={interviewForm.interviewerId}
                  onValueChange={(val) => setInterviewForm({ ...interviewForm, interviewerId: val })}
                >
                  <SelectTrigger data-testid="select-interviewer-user">
                    <SelectValue placeholder="Select user to notify" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowScheduleInterview(false)}>Cancel</Button>
              <Button type="submit" disabled={scheduleInterviewMutation.isPending} data-testid="button-submit-interview">
                {scheduleInterviewMutation.isPending ? "Scheduling..." : "Schedule Interview"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Applicant Detail Dialog */}
      <Dialog open={!!selectedApplicant} onOpenChange={() => setSelectedApplicant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedApplicant && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {selectedApplicant.firstName?.[0]}{selectedApplicant.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <DialogTitle data-testid="text-applicant-detail-name">
                      {selectedApplicant.firstName} {selectedApplicant.lastName}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">{selectedApplicant.email}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <p>{selectedApplicant.phone || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job</span>
                    <p>{selectedApplicant.jobTitle || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source</span>
                    <p>{selectedApplicant.source ? (SOURCE_LABELS[selectedApplicant.source] || selectedApplicant.source) : "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rating</span>
                    <p>{selectedApplicant.rating !== null && selectedApplicant.rating !== undefined ? `${selectedApplicant.rating}/5` : "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Status</span>
                    <p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[selectedApplicant.status || "applied"]}`}>
                        {STATUS_LABELS[selectedApplicant.status || "applied"]}
                      </span>
                    </p>
                  </div>
                  {selectedApplicant.hiredAt && (
                    <div>
                      <span className="text-muted-foreground">Hired At</span>
                      <p>{formatDateTime(selectedApplicant.hiredAt)}</p>
                    </div>
                  )}
                </div>

                {/* Interview details */}
                {selectedApplicant.interviewDate && (
                  <div className="border rounded-lg p-3 space-y-2 bg-purple-50 dark:bg-purple-950/20">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Interview Details
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Date/Time</span>
                        <p>{formatDateTime(selectedApplicant.interviewDate)}</p>
                      </div>
                      {selectedApplicant.interviewerName && (
                        <div>
                          <span className="text-muted-foreground">Interviewer</span>
                          <p>{selectedApplicant.interviewerName}</p>
                        </div>
                      )}
                      {selectedApplicant.interviewLocation && (
                        <div>
                          <span className="text-muted-foreground">Location</span>
                          <p>{selectedApplicant.interviewLocation}</p>
                        </div>
                      )}
                      {selectedApplicant.interviewLink && (
                        <div>
                          <span className="text-muted-foreground">Video Link</span>
                          <a href={selectedApplicant.interviewLink} target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-xs truncate">
                            <Video className="w-3 h-3" /> Join
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Offer details */}
                {selectedApplicant.offerDate && (
                  <div className="border rounded-lg p-3 space-y-2 bg-orange-50 dark:bg-orange-950/20">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Offer Details
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Offer Date</span>
                        <p>{formatDate(selectedApplicant.offerDate)}</p>
                      </div>
                      {selectedApplicant.offerSalary && (
                        <div>
                          <span className="text-muted-foreground">Salary</span>
                          <p>£{parseFloat(selectedApplicant.offerSalary).toLocaleString()}/yr</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Offer Status</span>
                        <p className="capitalize">{selectedApplicant.offerStatus || "pending"}</p>
                      </div>
                    </div>
                    {selectedApplicant.offerEmailSentAt ? (
                      <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email sent {new Date(selectedApplicant.offerEmailSentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email not yet sent
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `/api/admin/applicants/${selectedApplicant.id}/offer-letter`;
                          a.download = `Offer_Letter_${selectedApplicant.firstName}_${selectedApplicant.lastName}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        data-testid="button-download-offer-letter"
                      >
                        <FileDown className="w-3 h-3 mr-1" /> Download Offer Letter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendOfferEmailMutation.mutate(selectedApplicant.id)}
                        disabled={sendOfferEmailMutation.isPending}
                        data-testid="button-send-offer-email"
                      >
                        {sendOfferEmailMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                        {selectedApplicant.offerEmailSentAt ? "Resend Offer Email" : "Send Offer Email"}
                      </Button>
                      {selectedApplicant.offerResponseToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-700 border-blue-300 hover:bg-blue-50"
                          onClick={() => {
                            const link = `${window.location.origin}/offer-response/${selectedApplicant.offerResponseToken}`;
                            navigator.clipboard.writeText(link).then(() => {
                              toast({ title: "Link copied", description: "Offer response link copied to clipboard." });
                            }).catch(() => {
                              toast({ title: "Link", description: link });
                            });
                          }}
                          data-testid="button-copy-offer-link"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copy Applicant Link
                        </Button>
                      )}
                      {selectedApplicant.offerStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => respondOfferMutation.mutate({ id: selectedApplicant.id, response: "accepted" })}
                            disabled={respondOfferMutation.isPending}
                            data-testid="button-accept-offer"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => respondOfferMutation.mutate({ id: selectedApplicant.id, response: "declined" })}
                            disabled={respondOfferMutation.isPending}
                            data-testid="button-decline-offer"
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Decline
                          </Button>
                        </>
                      )}
                    </div>
                    {selectedApplicant.offerResponseToken && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1 font-medium mb-1">
                          <Link2 className="w-3 h-3" /> Applicant Self-Service Link
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">
                          {`${window.location.origin}/offer-response/${selectedApplicant.offerResponseToken}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Share this link with the applicant so they can accept or decline online.</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedApplicant.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes</span>
                    <p className="mt-1">{selectedApplicant.notes}</p>
                  </div>
                )}
                {selectedApplicant.coverLetter && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cover Letter</span>
                    <p className="mt-1 whitespace-pre-wrap">{selectedApplicant.coverLetter}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <Select
                    value={selectedApplicant.status || "applied"}
                    onValueChange={(val) => {
                      updateApplicantMutation.mutate({ id: selectedApplicant.id, status: val });
                      setSelectedApplicant({ ...selectedApplicant, status: val });
                    }}
                  >
                    <SelectTrigger data-testid="select-update-applicant-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  {(selectedApplicant.status === "interview" || selectedApplicant.status === "screening" || selectedApplicant.status === "applied") && !selectedApplicant.interviewDate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowScheduleInterview(true)}
                      data-testid="button-schedule-interview"
                    >
                      <Calendar className="w-3 h-3 mr-1" /> Schedule Interview
                    </Button>
                  )}
                  {selectedApplicant.status === "interview" && !selectedApplicant.offerDate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowMakeOffer(true)}
                      data-testid="button-make-offer"
                    >
                      <DollarSign className="w-3 h-3 mr-1" /> Make Offer
                    </Button>
                  )}
                  {(selectedApplicant.status === "offer" && selectedApplicant.offerStatus === "accepted") && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => hireMutation.mutate(selectedApplicant.id)}
                      disabled={hireMutation.isPending}
                      data-testid="button-mark-hired"
                    >
                      {hireMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                      {hireMutation.isPending ? "Creating..." : "Mark as Hired"}
                    </Button>
                  )}
                  {selectedApplicant.status === "offer" && !selectedApplicant.offerStatus && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => hireMutation.mutate(selectedApplicant.id)}
                      disabled={hireMutation.isPending}
                      data-testid="button-mark-hired"
                    >
                      {hireMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                      {hireMutation.isPending ? "Creating..." : "Mark as Hired"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportCSV} onOpenChange={(open) => { setShowImportCSV(open); if (!open) { setCsvPreviewRows([]); setCsvParseError(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Applicants from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Expected CSV columns:</p>
              <p><span className="font-mono text-xs bg-muted px-1 rounded">first_name</span>, <span className="font-mono text-xs bg-muted px-1 rounded">last_name</span>, <span className="font-mono text-xs bg-muted px-1 rounded">email</span> (required) — <span className="font-mono text-xs bg-muted px-1 rounded">phone</span>, <span className="font-mono text-xs bg-muted px-1 rounded">job_posting_id</span>, <span className="font-mono text-xs bg-muted px-1 rounded">source</span> (optional)</p>
              <p>Duplicate emails within the tenant will be skipped automatically.</p>
            </div>

            <div>
              <Label htmlFor="csv-file-input">Choose CSV file</Label>
              <div className="mt-1 flex items-center gap-3">
                <label
                  htmlFor="csv-file-input"
                  className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                  data-testid="label-csv-file"
                >
                  <Upload className="w-4 h-4" />
                  Click to select a .csv file
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    data-testid="input-csv-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        parseCSV(text);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {csvPreviewRows.length > 0 && (
                  <span className="text-sm text-muted-foreground">{csvPreviewRows.length} row{csvPreviewRows.length !== 1 ? "s" : ""} parsed</span>
                )}
              </div>
            </div>

            {csvParseError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-csv-parse-error">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {csvParseError}
              </div>
            )}

            {csvPreviewRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Preview</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400">{csvPreviewRows.filter((r) => !r._error).length} valid</span>
                    {csvPreviewRows.filter((r) => r._error).length > 0 && (
                      <span className="text-destructive">{csvPreviewRows.filter((r) => r._error).length} with errors (will be skipped)</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border overflow-auto max-h-64">
                  <table className="w-full text-xs" data-testid="table-csv-preview">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">First Name</th>
                        <th className="text-left px-3 py-2 font-medium">Last Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Phone</th>
                        <th className="text-left px-3 py-2 font-medium">Job ID</th>
                        <th className="text-left px-3 py-2 font-medium">Source</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((row, i) => (
                        <tr key={i} className={row._error ? "bg-destructive/5" : i % 2 === 0 ? "" : "bg-muted/30"} data-testid={`row-csv-preview-${i}`}>
                          <td className="px-3 py-1.5">{row.firstName || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">{row.lastName || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">{row.email || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">{row.phone || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">{row.jobPostingId || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">{row.source || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5">
                            {row._error ? (
                              <span className="text-destructive flex items-center gap-1" title={row._error}><AlertTriangle className="w-3 h-3" /> Error</span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowImportCSV(false); setCsvPreviewRows([]); setCsvParseError(null); }} data-testid="button-cancel-import">
                Cancel
              </Button>
              <Button
                onClick={() => importCSVMutation.mutate(csvPreviewRows)}
                disabled={csvPreviewRows.filter((r) => !r._error).length === 0 || importCSVMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importCSVMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importCSVMutation.isPending ? "Importing..." : `Import ${csvPreviewRows.filter((r) => !r._error).length} Applicant${csvPreviewRows.filter((r) => !r._error).length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
