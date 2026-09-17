import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, formatApiErrorDescription, formatApiErrorTitle } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Calendar, Clock, MapPin, Users, Building2, CalendarDays, Truck,
  ChevronLeft, ChevronRight, Copy, Eye, LayoutList, LayoutGrid,
  Pencil, Trash2, CheckSquare, X, AlertTriangle, Zap, CheckCircle2,
  BookTemplate, LayoutTemplate, RefreshCw, Search,
} from "lucide-react";
import type { Site, ShiftTemplate } from "@shared/schema";

type EnrichedShift = {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string | null;
  shiftCode: string | null;
  externalId: string | null;
  notes: string | null;
  siteId: number | null;
  employeeId: number | null;
  supplierId: number | null;
  dutyTypeId: number | null;
  payRate?: string | null;
  chargeRate?: string | null;
  siteName: string;
  employeeName: string;
  supplierName: string;
  clientId?: number | null;
  clientName?: string | null;
  bookedOnAt?: string | null;
  checkInTime?: string | null;
  bookedOnCallData?: unknown;
};

function isShiftBookedOn(shift: Pick<EnrichedShift, "status" | "bookedOnAt" | "checkInTime" | "bookedOnCallData">) {
  return Boolean(
    shift.bookedOnAt ||
    shift.checkInTime ||
    shift.bookedOnCallData ||
    shift.status === "booked_on" ||
    shift.status === "in_progress",
  );
}

type EmployeeOption = {
  id: number;
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
};

type SupplierOption = {
  id: number;
  companyName: string;
};

type ClientOption = {
  id: number;
  companyName?: string;
  company_name?: string;
};

type TenantInfo = {
  companyName?: string;
};

type AvailableEmployee = {
  id: number;
  name: string;
  jobTitle?: string | null;
  siaLicenseType?: string | null;
  siaExpiryDate?: string | null;
  hasFirstAid?: boolean | null;
  postcode?: string | null;
  hasConflict: boolean;
  conflictingShift?: { title: string; startTime: string; endTime: string } | null;
  onApprovedLeave?: boolean;
  markedAvailable: boolean;
  availabilityNote: string;
  licenseMatch: boolean;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-500" },
  booked_on: { label: "Booked On", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300", dot: "bg-teal-500" },
  in_progress: { label: "In Progress", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", dot: "bg-orange-500" },
  booked_off: { label: "Booked Off", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", dot: "bg-indigo-500" },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300", dot: "bg-gray-400" },
  no_show: { label: "No Show", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
  missed: { label: "Missed", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300", dot: "bg-rose-500" },
};

type CalendarView = "week" | "fortnight" | "month";
type RepeatOption = "none" | "week" | "fortnight" | "month";

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDayName(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

function generateRepeatDates(startDate: string, repeat: RepeatOption): string[] {
  if (repeat === "none") return [startDate];
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dates: string[] = [];
  const days = repeat === "week" ? 7 : repeat === "fortnight" ? 14 : 28;
  for (let i = 0; i < days; i++) {
    dates.push(formatDateKey(addDays(start, i)));
  }
  return dates;
}

export default function SchedulingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() => getMonday(new Date()));
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [detailShift, setDetailShift] = useState<EnrichedShift | null>(null);

  const [editShift, setEditShift] = useState<EnrichedShift | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", date: "", startTime: "", endTime: "", siteId: "", employeeId: "", supplierId: "", dutyTypeId: "", notes: "",
    payRate: "", chargeRate: "",
    payRateOptionId: "", chargeRateOptionId: "",
  });
  const [editRatesManual, setEditRatesManual] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedShift | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchSite, setSearchSite] = useState("all");
  const [searchClient, setSearchClient] = useState("all");
  const [searchSupplier, setSearchSupplier] = useState("all");
  const [searchOfficer, setSearchOfficer] = useState("all");
  const [searchAssignment, setSearchAssignment] = useState("all");

  const [shiftForm, setShiftForm] = useState({
    title: "", date: "", startTime: "", endTime: "",
    siteId: "", employeeId: "", supplierId: "", dutyTypeId: "", notes: "",
    payRate: "", chargeRate: "",
    payRateOptionId: "", chargeRateOptionId: "",
  });
  const [ratesManual, setRatesManual] = useState(false);
  const [repeatOption, setRepeatOption] = useState<RepeatOption>("none");

  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "", description: "", title: "", startTime: "", endTime: "",
    siteId: "", siaLicenseType: "", requiredCount: "1", notes: "",
    daysOfWeek: [] as number[],
  });
  const [applyTemplateDialog, setApplyTemplateDialog] = useState<ShiftTemplate | null>(null);
  const [applyDateRange, setApplyDateRange] = useState({ startDate: "", endDate: "" });
  const [showAvailableSuggestions, setShowAvailableSuggestions] = useState(false);

  const dateRange = useMemo(() => {
    if (calendarView === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const startDay = getMonday(firstDay);
      const daysInMonth = getDaysInMonth(year, month);
      const lastDay = new Date(year, month, daysInMonth);
      const endDayOfWeek = lastDay.getDay();
      const endPadding = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
      const totalDays = Math.ceil(((firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1) + daysInMonth + endPadding) / 7) * 7;
      const endDay = addDays(startDay, totalDays - 1);
      return { startDate: formatDateKey(startDay), endDate: formatDateKey(endDay) };
    }
    const numDays = calendarView === "week" ? 7 : 14;
    const endDay = addDays(currentDate, numDays - 1);
    return { startDate: formatDateKey(currentDate), endDate: formatDateKey(endDay) };
  }, [currentDate, calendarView]);

  const shiftsFetchRange = useMemo(() => {
    if (viewMode !== "list") return dateRange;
    const start = searchDateFrom || dateRange.startDate;
    const end = searchDateTo || dateRange.endDate;
    if (start && end && end < start) return { startDate: start, endDate: start };
    return { startDate: start, endDate: end };
  }, [viewMode, searchDateFrom, searchDateTo, dateRange]);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/shifts", shiftsFetchRange.startDate, shiftsFetchRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: shiftsFetchRange.startDate, endDate: shiftsFetchRange.endDate });
      const res = await fetch(`/api/shifts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load shifts");
      return res.json();
    },
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: dutyTypes = [] } = useQuery<Array<{ id: number; name: string; requiresLicense: boolean }>>({
    queryKey: ["/api/tenant/duty-types"],
  });

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ["/api/clients"],
  });

  const selectedSupplierId = shiftForm.supplierId;
  const isInhouse = !selectedSupplierId || selectedSupplierId === "inhouse";

  const canResolveRates = !!shiftForm.date && !!shiftForm.siteId;
  type RateOption = {
    id: string;
    rate: string;
    label: string;
  };
  const { data: resolvedRates } = useQuery<{
    payRate: string | null;
    chargeRate: string | null;
    payRateSource: "employee" | "supplier" | null;
    chargeRateSource: "site" | null;
    chargeRateOptions: RateOption[];
    payRateOptions: RateOption[];
  }>({
    queryKey: [
      "/api/shifts/resolve-rates",
      shiftForm.date,
      shiftForm.siteId,
      shiftForm.dutyTypeId,
      shiftForm.employeeId,
      shiftForm.supplierId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ date: shiftForm.date });
      if (shiftForm.siteId) params.set("siteId", shiftForm.siteId);
      if (shiftForm.dutyTypeId) params.set("dutyTypeId", shiftForm.dutyTypeId);
      if (shiftForm.employeeId) params.set("employeeId", shiftForm.employeeId);
      if (shiftForm.supplierId && shiftForm.supplierId !== "inhouse") params.set("supplierId", shiftForm.supplierId);
      const res = await fetch(`/api/shifts/resolve-rates?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to resolve rates");
      return res.json();
    },
    enabled: shiftDialogOpen && canResolveRates,
  });

  useEffect(() => {
    if (!resolvedRates || ratesManual) return;
    setShiftForm((f) => {
      const chargeOpt = resolvedRates.chargeRateOptions?.[0];
      const payOpt = resolvedRates.payRateOptions?.[0];
      const keepCharge = f.chargeRateOptionId && resolvedRates.chargeRateOptions?.some((o) => o.id === f.chargeRateOptionId);
      const keepPay = f.payRateOptionId && resolvedRates.payRateOptions?.some((o) => o.id === f.payRateOptionId);
      return {
        ...f,
        chargeRate: keepCharge ? f.chargeRate : (chargeOpt?.rate ?? ""),
        chargeRateOptionId: keepCharge ? f.chargeRateOptionId : (chargeOpt?.id ?? ""),
        payRate: keepPay ? f.payRate : (payOpt?.rate ?? ""),
        payRateOptionId: keepPay ? f.payRateOptionId : (payOpt?.id ?? ""),
      };
    });
  }, [resolvedRates, ratesManual]);

  const editCanResolveRates = !!editForm.date && !!editForm.siteId && !!editShift;
  const { data: editResolvedRates } = useQuery<{
    payRate: string | null;
    chargeRate: string | null;
    chargeRateOptions: RateOption[];
    payRateOptions: RateOption[];
    payRateSource: "employee" | "supplier" | null;
  }>({
    queryKey: [
      "/api/shifts/resolve-rates",
      "edit",
      editForm.date,
      editForm.siteId,
      editForm.dutyTypeId,
      editForm.employeeId,
      editForm.supplierId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ date: editForm.date });
      if (editForm.siteId) params.set("siteId", editForm.siteId);
      if (editForm.dutyTypeId) params.set("dutyTypeId", editForm.dutyTypeId);
      if (editForm.employeeId) params.set("employeeId", editForm.employeeId);
      if (editForm.supplierId && editForm.supplierId !== "inhouse") params.set("supplierId", editForm.supplierId);
      const res = await fetch(`/api/shifts/resolve-rates?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to resolve rates");
      return res.json();
    },
    enabled: editCanResolveRates,
  });

  useEffect(() => {
    if (!editResolvedRates) return;
    if (!editRatesManual) {
      setEditForm((f) => {
        const chargeOpt =
          editResolvedRates.chargeRateOptions?.find((o) => o.rate === f.chargeRate) ||
          editResolvedRates.chargeRateOptions?.[0];
        const payOpt =
          editResolvedRates.payRateOptions?.find((o) => o.rate === f.payRate) ||
          editResolvedRates.payRateOptions?.[0];
        return {
          ...f,
          chargeRate: chargeOpt?.rate ?? f.chargeRate,
          chargeRateOptionId: chargeOpt?.id ?? "",
          payRate: payOpt?.rate ?? f.payRate,
          payRateOptionId: payOpt?.id ?? "",
        };
      });
      return;
    }
    // Keep saved rates; just bind matching option ids for the selects
    setEditForm((f) => {
      const chargeOpt = editResolvedRates.chargeRateOptions?.find((o) => o.rate === f.chargeRate);
      const payOpt = editResolvedRates.payRateOptions?.find((o) => o.rate === f.payRate);
      return {
        ...f,
        chargeRateOptionId: chargeOpt?.id || f.chargeRateOptionId || "",
        payRateOptionId: payOpt?.id || f.payRateOptionId || "",
      };
    });
  }, [editResolvedRates, editRatesManual]);

  const { data: inhouseEmployees = [], isLoading: inhouseLoading, isError: inhouseError } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/employees/inhouse"],
    enabled: isInhouse,
  });

  const { data: supplierEmployees = [], isLoading: supplierOfficersLoading, isError: supplierOfficersError } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/suppliers", selectedSupplierId, "employees"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${selectedSupplierId}/employees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load supplier officers");
      return res.json();
    },
    enabled: !isInhouse && !!selectedSupplierId,
  });

  const editSupplierId = editForm.supplierId;
  const editIsInhouse = !editSupplierId || editSupplierId === "inhouse";
  const { data: editSupplierEmployees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/suppliers", editSupplierId, "employees"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${editSupplierId}/employees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load supplier officers");
      return res.json();
    },
    enabled: !!editShift && !editIsInhouse && !!editSupplierId,
  });

  const filteredEmployees = isInhouse ? inhouseEmployees : supplierEmployees;
  const editFilteredEmployees = editIsInhouse ? inhouseEmployees : editSupplierEmployees;
  const officersLoading = isInhouse ? inhouseLoading : supplierOfficersLoading;
  const officersError = isInhouse ? inhouseError : supplierOfficersError;

  const officerLabel = (emp: EmployeeOption) =>
    `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.employeeNumber || `Officer #${emp.id}`;

  const { data: approvedSuppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ["/api/suppliers/approved-list"],
  });

  const { data: filterInhouseOfficers = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/employees/inhouse"],
    enabled: viewMode === "list" && (searchSupplier === "inhouse" || searchSupplier === "all"),
  });

  const { data: filterSupplierOfficers = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/suppliers", searchSupplier, "employees"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${searchSupplier}/employees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load supplier officers");
      return res.json();
    },
    enabled: viewMode === "list" && !!searchSupplier && searchSupplier !== "all" && searchSupplier !== "inhouse",
  });

  const { data: permissionsData } = useQuery<{ tenant?: TenantInfo }>({
    queryKey: ["/api/my-permissions"],
  });
  const tenantCompanyName = permissionsData?.tenant?.companyName || "Own Company";

  const { data: shiftTemplates = [] } = useQuery<(ShiftTemplate & { siteName?: string | null })[]>({
    queryKey: ["/api/shift-templates"],
  });

  const canFetchSuggestions = !!(
    isInhouse && shiftForm.date && shiftForm.startTime && shiftForm.endTime && showAvailableSuggestions
  );
  const { data: availableEmployees = [], isLoading: suggestionsLoading } = useQuery<AvailableEmployee[]>({
    queryKey: ["/api/shifts/available-employees", shiftForm.date, shiftForm.startTime, shiftForm.endTime],
    queryFn: async () => {
      const params = new URLSearchParams({ date: shiftForm.date, startTime: shiftForm.startTime, endTime: shiftForm.endTime });
      const res = await fetch(`/api/shifts/available-employees?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load suggestions");
      return res.json();
    },
    enabled: canFetchSuggestions,
  });

  const unassignedShifts = useMemo(() => shifts.filter(s => !s.employeeId && s.status === "scheduled"), [shifts]);

  const createShiftMutation = useMutation({
    mutationFn: async (data: typeof shiftForm) => {
      const payload = {
        title: data.title,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        siteId: data.siteId ? Number(data.siteId) : null,
        employeeId: data.employeeId ? Number(data.employeeId) : null,
        supplierId: data.supplierId && data.supplierId !== "inhouse" ? Number(data.supplierId) : null,
        dutyTypeId: data.dutyTypeId ? Number(data.dutyTypeId) : null,
        notes: data.notes || null,
        payRate: data.payRate || null,
        chargeRate: data.chargeRate || null,
      };
      const res = await apiRequest("POST", "/api/shifts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift created", description: "The shift has been added to the schedule." });
      closeShiftDialog();
    },
    onError: (err: Error) => {
      toast({
        title: formatApiErrorTitle(err),
        description: (
          <span className="whitespace-pre-line">{formatApiErrorDescription(err)}</span>
        ),
        variant: "destructive",
      });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (payload: { shifts: any[] }) => {
      const res = await apiRequest("POST", "/api/shifts/bulk-create", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shifts created", description: `${data.created} shifts have been added to the schedule.` });
      closeShiftDialog();
    },
    onError: (err: Error) => {
      toast({
        title: formatApiErrorTitle(err),
        description: (
          <span className="whitespace-pre-line">{formatApiErrorDescription(err)}</span>
        ),
        variant: "destructive",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      const res = await apiRequest("POST", "/api/shift-templates", {
        name: data.name,
        description: data.description || null,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        daysOfWeek: data.daysOfWeek,
        siteId: data.siteId ? Number(data.siteId) : null,
        siaLicenseType: data.siaLicenseType || null,
        requiredCount: Number(data.requiredCount) || 1,
        notes: data.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-templates"] });
      toast({ title: "Template created", description: "Shift template saved successfully." });
      setTemplateForm({ name: "", description: "", title: "", startTime: "", endTime: "", siteId: "", siaLicenseType: "", requiredCount: "1", notes: "", daysOfWeek: [] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shift-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ id, startDate, endDate }: { id: number; startDate: string; endDate: string }) => {
      const res = await apiRequest("POST", `/api/shift-templates/${id}/apply`, { startDate, endDate });
      return res.json();
    },
    onSuccess: (data: { created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setApplyTemplateDialog(null);
      setApplyDateRange({ startDate: "", endDate: "" });
      toast({ title: "Template applied", description: `${data.created} shifts created from template.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const closeShiftDialog = useCallback(() => {
    setShiftDialogOpen(false);
    setShiftForm({ title: "", date: "", startTime: "", endTime: "", siteId: "", employeeId: "", supplierId: "", dutyTypeId: "", notes: "", payRate: "", chargeRate: "", payRateOptionId: "", chargeRateOptionId: "" });
    setRatesManual(false);
    setRepeatOption("none");
    setSelectedDay("");
    setShowAvailableSuggestions(false);
  }, []);

  const openCreateForDay = useCallback((dateKey: string) => {
    setSelectedDay(dateKey);
    setShiftForm(f => ({ ...f, date: dateKey }));
    setShiftDialogOpen(true);
  }, []);

  const handleCreateShift = useCallback(() => {
    if (repeatOption === "none") {
      createShiftMutation.mutate(shiftForm);
    } else {
      const dates = generateRepeatDates(shiftForm.date, repeatOption);
      const shiftPayloads = dates.map(date => ({
        title: shiftForm.title,
        date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        siteId: shiftForm.siteId ? Number(shiftForm.siteId) : null,
        employeeId: shiftForm.employeeId ? Number(shiftForm.employeeId) : null,
        supplierId: shiftForm.supplierId && shiftForm.supplierId !== "inhouse" ? Number(shiftForm.supplierId) : null,
        dutyTypeId: shiftForm.dutyTypeId ? Number(shiftForm.dutyTypeId) : null,
        notes: shiftForm.notes || null,
        payRate: shiftForm.payRate || null,
        chargeRate: shiftForm.chargeRate || null,
      }));
      bulkCreateMutation.mutate({ shifts: shiftPayloads });
    }
  }, [shiftForm, repeatOption, createShiftMutation, bulkCreateMutation]);

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/shifts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift updated", description: "Changes have been saved." });
      setEditShift(null);
    },
    onError: (err: Error) => {
      toast({
        title: formatApiErrorTitle(err),
        description: (
          <span className="whitespace-pre-line">{formatApiErrorDescription(err)}</span>
        ),
        variant: "destructive",
      });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Shift deleted", description: "The shift has been removed." });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      setEditShift(null);
      setDetailShift(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (shiftIds: number[]) => {
      const res = await apiRequest("POST", "/api/shifts/bulk-delete", { shiftIds });
      return res.json();
    },
    onSuccess: (data: { deleted: number[]; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setSelectedShiftIds(new Set());
      setBulkDeleteConfirmOpen(false);
      toast({ title: "Shifts deleted", description: `${data.deleted.length} shift${data.deleted.length !== 1 ? "s" : ""} removed.${data.errors.length > 0 ? ` ${data.errors.length} failed.` : ""}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEditShift = useCallback((shift: EnrichedShift) => {
    setEditShift(shift);
    setEditRatesManual(true);
    setEditForm({
      title: shift.title,
      date: shift.date.split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      siteId: shift.siteId ? String(shift.siteId) : "",
      employeeId: shift.employeeId ? String(shift.employeeId) : "",
      supplierId: shift.supplierId ? String(shift.supplierId) : "",
      dutyTypeId: shift.dutyTypeId ? String(shift.dutyTypeId) : "",
      notes: shift.notes || "",
      payRate: shift.payRate != null ? String(shift.payRate) : "",
      chargeRate: shift.chargeRate != null ? String(shift.chargeRate) : "",
      payRateOptionId: "",
      chargeRateOptionId: "",
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editShift) return;
    updateShiftMutation.mutate({
      id: editShift.id,
      data: {
        title: editForm.title,
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        siteId: editForm.siteId ? Number(editForm.siteId) : null,
        employeeId: editForm.employeeId ? Number(editForm.employeeId) : null,
        supplierId: editForm.supplierId && editForm.supplierId !== "inhouse" ? Number(editForm.supplierId) : null,
        dutyTypeId: editForm.dutyTypeId ? Number(editForm.dutyTypeId) : null,
        notes: editForm.notes || null,
        payRate: editForm.payRate || null,
        chargeRate: editForm.chargeRate || null,
      },
    });
  }, [editShift, editForm, updateShiftMutation]);

  const toggleShiftSelect = useCallback((id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, EnrichedShift[]> = {};
    for (const shift of shifts) {
      const dateKey = shift.date.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(shift);
    }
    return map;
  }, [shifts]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    if (calendarView === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const startDay = getMonday(firstDay);
      const daysInMonth = getDaysInMonth(year, month);
      const lastDay = new Date(year, month, daysInMonth);
      const endDayOfWeek = lastDay.getDay();
      const endPadding = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
      const totalDays = Math.ceil(((firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1) + daysInMonth + endPadding) / 7) * 7;
      for (let i = 0; i < totalDays; i++) {
        days.push(addDays(startDay, i));
      }
    } else {
      const numDays = calendarView === "week" ? 7 : 14;
      for (let i = 0; i < numDays; i++) {
        days.push(addDays(currentDate, i));
      }
    }
    return days;
  }, [currentDate, calendarView]);

  const navigateCalendar = useCallback((direction: number) => {
    setCurrentDate(prev => {
      if (calendarView === "month") {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + direction);
        return d;
      }
      const days = calendarView === "week" ? 7 : 14;
      return addDays(prev, days * direction);
    });
  }, [calendarView]);

  const goToToday = useCallback(() => {
    if (calendarView === "month") {
      setCurrentDate(new Date());
    } else {
      setCurrentDate(getMonday(new Date()));
    }
  }, [calendarView]);

  const calendarTitle = useMemo(() => {
    if (calendarView === "month") {
      return currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    const first = calendarDays[0];
    const last = calendarDays[calendarDays.length - 1];
    if (!first || !last) return "";
    if (first.getMonth() === last.getMonth()) {
      return `${formatShortDate(first)} - ${last.getDate()} ${last.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
    }
    return `${formatShortDate(first)} - ${formatShortDate(last)} ${last.getFullYear()}`;
  }, [calendarDays, calendarView, currentDate]);

  const stats = useMemo(() => ({
    total: shifts.length,
    scheduled: shifts.filter((s) => s.status === "scheduled").length,
    inProgress: shifts.filter((s) => s.status === "in_progress").length,
    completed: shifts.filter((s) => s.status === "completed").length,
    noShow: shifts.filter((s) => s.status === "no_show").length,
  }), [shifts]);

  const filteredSitesForFilter = useMemo(() => {
    if (searchClient === "all") return sites;
    return sites.filter((s) => String(s.clientId) === searchClient);
  }, [sites, searchClient]);

  const officerFilterOptions = useMemo(() => {
    const byId = new Map<number, string>();
    const addEmp = (id: number, name: string) => {
      const cleaned = name.trim();
      if (!id || !cleaned || cleaned === "Unassigned") return;
      if (!byId.has(id)) byId.set(id, cleaned);
    };

    if (searchSupplier === "inhouse") {
      for (const emp of filterInhouseOfficers) {
        addEmp(emp.id, officerLabel(emp));
      }
    } else if (searchSupplier !== "all") {
      for (const emp of filterSupplierOfficers) {
        addEmp(emp.id, officerLabel(emp));
      }
    } else {
      for (const emp of filterInhouseOfficers) {
        addEmp(emp.id, officerLabel(emp));
      }
      for (const shift of shifts) {
        if (shift.employeeId) addEmp(shift.employeeId, shift.employeeName || "");
      }
    }

    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchSupplier, filterInhouseOfficers, filterSupplierOfficers, shifts]);

  const hasActiveFilters = !!(
    searchQuery
    || searchDateFrom
    || searchDateTo
    || searchStatus !== "all"
    || searchSite !== "all"
    || searchClient !== "all"
    || searchSupplier !== "all"
    || searchOfficer !== "all"
    || searchAssignment !== "all"
  );

  const clearAllFilters = () => {
    setSearchQuery("");
    setSearchDateFrom("");
    setSearchDateTo("");
    setSearchStatus("all");
    setSearchSite("all");
    setSearchClient("all");
    setSearchSupplier("all");
    setSearchOfficer("all");
    setSearchAssignment("all");
  };

  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shifts.filter((shift) => {
      const shiftDate = shift.date.split("T")[0];
      if (searchDateFrom && shiftDate < searchDateFrom) return false;
      if (searchDateTo && shiftDate > searchDateTo) return false;
      if (searchStatus !== "all" && shift.status !== searchStatus) return false;
      if (searchSite !== "all" && String(shift.siteId) !== searchSite) return false;
      if (searchClient !== "all" && String(shift.clientId || "") !== searchClient) return false;
      if (searchSupplier === "inhouse") {
        if (shift.supplierId) return false;
      } else if (searchSupplier !== "all" && String(shift.supplierId || "") !== searchSupplier) {
        return false;
      }
      if (searchOfficer !== "all" && String(shift.employeeId || "") !== searchOfficer) return false;
      if (searchAssignment === "assigned" && !shift.employeeId) return false;
      if (searchAssignment === "unassigned" && shift.employeeId) return false;
      if (q) {
        const statusLabel = (STATUS_CONFIG[shift.status || "scheduled"]?.label || shift.status || "").toLowerCase();
        const haystack = [
          shift.title,
          shift.employeeName,
          shift.siteName,
          shift.supplierName,
          shift.clientName,
          shift.shiftCode,
          shift.externalId,
          shift.notes,
          shift.startTime,
          shift.endTime,
          statusLabel,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [shifts, searchQuery, searchDateFrom, searchDateTo, searchStatus, searchSite, searchClient, searchSupplier, searchOfficer, searchAssignment]);

  const getStatusBorderColor = (status: string | null) => {
    switch (status) {
      case "booked_on": return "#14b8a6";
      case "in_progress": return "#f97316";
      case "booked_off": return "#6366f1";
      case "verified": return "#10b981";
      case "completed": return "#22c55e";
      case "cancelled": return "#9ca3af";
      case "no_show": return "#ef4444";
      case "missed": return "#f43f5e";
      default: return "#3b82f6";
    }
  };

  const renderShiftPill = (shift: EnrichedShift) => {
    const statusConf = STATUS_CONFIG[shift.status || "scheduled"] || STATUS_CONFIG.scheduled;
    const isSelected = selectedShiftIds.has(shift.id);
    const isSelecting = selectedShiftIds.size > 0;
    return (
      <div
        key={shift.id}
        className={`group/pill relative w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight mb-0.5 border transition-all hover:ring-1 hover:ring-primary/30 hover:shadow-sm cursor-pointer ${statusConf.className} ${isSelected ? "ring-2 ring-[#1F3A5F] ring-offset-1" : ""}`}
        style={{ borderLeft: `3px solid ${getStatusBorderColor(shift.status)}` }}
        data-testid={`shift-pill-${shift.id}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isSelecting) {
            toggleShiftSelect(shift.id);
          } else {
            setDetailShift(shift);
          }
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <div
            className={`flex-shrink-0 ${isSelecting ? "block" : "hidden group-hover/pill:block"}`}
            onClick={(e) => { e.stopPropagation(); toggleShiftSelect(shift.id); }}
          >
            <Checkbox
              checked={isSelected}
              className="w-3 h-3"
              data-testid={`checkbox-pill-${shift.id}`}
            />
          </div>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dot} ${isSelecting ? "hidden" : "group-hover/pill:hidden"}`} />
          <span className="font-semibold truncate">{shift.startTime}–{shift.endTime}</span>
          <div className={`ml-auto flex items-center gap-0.5 flex-shrink-0 ${isSelecting ? "hidden" : "hidden group-hover/pill:flex"}`}>
            <button
              onClick={(e) => { e.stopPropagation(); openEditShift(shift); }}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
              data-testid={`button-edit-pill-${shift.id}`}
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(shift); setDeleteConfirmOpen(true); }}
              className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
              data-testid={`button-delete-pill-${shift.id}`}
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        <div className="truncate font-medium opacity-90">{shift.siteName || shift.title}</div>
        {shift.employeeName && (
          <div className="truncate opacity-70 flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5 flex-shrink-0" />
            {shift.employeeName}
          </div>
        )}
        {!shift.employeeName && (
          <div className="truncate text-amber-600 dark:text-amber-400 font-medium">Unassigned</div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const isMonthView = calendarView === "month";
    const currentMonth = currentDate.getMonth();
    const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div className="border rounded-lg overflow-hidden bg-card" data-testid="calendar-grid">
        <div className="grid grid-cols-7 border-b">
          {weekDayNames.map(day => (
            <div key={day} className="px-2 py-2 text-xs font-semibold text-center text-muted-foreground border-r last:border-r-0 bg-muted/30">
              {day}
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-7 ${isMonthView ? "" : ""}`}>
          {calendarDays.map((day, idx) => {
            const dateKey = formatDateKey(day);
            const dayShifts = shiftsByDate[dateKey] || [];
            const isCurrentMonth = !isMonthView || day.getMonth() === currentMonth;
            const today = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={dateKey}
                onClick={() => openCreateForDay(dateKey)}
                className={`group border-r border-b last:border-r-0 cursor-pointer transition-all relative ${
                  isMonthView ? "min-h-[100px]" : "min-h-[120px]"
                } ${!isCurrentMonth ? "opacity-40 bg-muted/20" : "hover:bg-blue-50/50 dark:hover:bg-blue-950/20"} ${isWeekend ? "bg-amber-50/30 dark:bg-amber-950/10" : ""} ${today ? "bg-blue-50/60 dark:bg-blue-950/30 ring-inset ring-1 ring-blue-200 dark:ring-blue-800" : ""}`}
                data-testid={`calendar-day-${dateKey}`}
              >
                <div className="p-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-medium leading-none ${today ? "bg-[#1F3A5F] text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm" : "text-muted-foreground"}`}>
                        {day.getDate()}
                      </span>
                      {!isMonthView && (
                        <span className="text-[10px] text-muted-foreground">{formatDayName(day)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {dayShifts.length > 0 && (
                        <span className="text-[10px] font-semibold text-white bg-[#1F3A5F] px-1.5 py-0.5 rounded-full leading-none">{dayShifts.length}</span>
                      )}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FF8C42]">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {dayShifts.slice(0, isMonthView ? 3 : 5).map(renderShiftPill)}
                    {dayShifts.length > (isMonthView ? 3 : 5) && (
                      <div className="text-[10px] text-muted-foreground text-center py-0.5 font-medium">
                        +{dayShifts.length - (isMonthView ? 3 : 5)} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <div className="space-y-4">
      <div
        className="flex items-end gap-2 flex-nowrap overflow-x-auto pb-1"
        data-testid="list-filters-row"
      >
        <div className="relative min-w-[200px] w-[220px] flex-shrink-0">
          <Label className="text-[10px] text-muted-foreground px-0.5">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              data-testid="input-filter-search"
              placeholder="Search shifts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="flex-shrink-0 w-[138px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">From</Label>
          <Input
            data-testid="input-filter-date-from"
            type="date"
            value={searchDateFrom}
            max={searchDateTo || undefined}
            onChange={(e) => setSearchDateFrom(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="flex-shrink-0 w-[138px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">To</Label>
          <Input
            data-testid="input-filter-date-to"
            type="date"
            value={searchDateTo}
            min={searchDateFrom || undefined}
            onChange={(e) => setSearchDateTo(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="flex-shrink-0 w-[150px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Client</Label>
          <SearchableSelect
            value={searchClient}
            onValueChange={(val) => {
              setSearchClient(val);
              setSearchSite("all");
            }}
            options={clients.map((client) => ({
              value: String(client.id),
              label: client.companyName || client.company_name || `Client #${client.id}`,
            }))}
            noneValue="all"
            noneLabel="All Clients"
            placeholder="All clients"
            searchPlaceholder="Search clients…"
            triggerClassName="h-9"
            data-testid="select-filter-client"
          />
        </div>
        <div className="flex-shrink-0 w-[150px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Site</Label>
          <SearchableSelect
            value={searchSite}
            onValueChange={setSearchSite}
            options={filteredSitesForFilter.map((site) => ({
              value: String(site.id),
              label: site.name,
            }))}
            noneValue="all"
            noneLabel="All Sites"
            placeholder="All sites"
            searchPlaceholder="Search sites…"
            triggerClassName="h-9"
            data-testid="select-filter-site"
          />
        </div>
        <div className="flex-shrink-0 w-[170px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Subcontractor</Label>
          <SearchableSelect
            value={searchSupplier}
            onValueChange={(val) => {
              setSearchSupplier(val);
              setSearchOfficer("all");
            }}
            options={[
              { value: "inhouse", label: `${tenantCompanyName} (In-house)` },
              ...approvedSuppliers.map((s) => ({
                value: String(s.id),
                label: s.companyName,
              })),
            ]}
            noneValue="all"
            noneLabel="All Subcontractors"
            placeholder="All subcontractors"
            searchPlaceholder="Search subcontractors…"
            triggerClassName="h-9"
            data-testid="select-filter-supplier"
          />
        </div>
        <div className="flex-shrink-0 w-[160px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Officer</Label>
          <SearchableSelect
            value={searchOfficer}
            onValueChange={setSearchOfficer}
            options={officerFilterOptions.map((officer) => ({
              value: String(officer.id),
              label: officer.name,
            }))}
            noneValue="all"
            noneLabel="All Officers"
            placeholder="All officers"
            searchPlaceholder="Search officers…"
            triggerClassName="h-9"
            data-testid="select-filter-officer"
          />
        </div>
        <div className="flex-shrink-0 w-[130px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Status</Label>
          <Select value={searchStatus} onValueChange={setSearchStatus}>
            <SelectTrigger className="h-9" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="booked_on">Booked On</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="booked_off">Booked Off</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-shrink-0 w-[120px]">
          <Label className="text-[10px] text-muted-foreground px-0.5">Assignment</Label>
          <Select value={searchAssignment} onValueChange={setSearchAssignment}>
            <SelectTrigger className="h-9" data-testid="select-filter-assignment">
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 flex-shrink-0 mb-0"
            onClick={clearAllFilters}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        )}
      </div>
      {filteredShifts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No shifts found</h3>
            <p className="text-sm text-muted-foreground">
              {shifts.length > 0 ? "Try adjusting your filters." : "Create your first shift to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredShifts.map((shift) => {
            const statusConf = STATUS_CONFIG[shift.status || "scheduled"] || STATUS_CONFIG.scheduled;
            return (
              <Card key={shift.id} data-testid={`card-shift-${shift.id}`} className="cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => setDetailShift(shift)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {shift.shiftCode && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-shift-code-${shift.id}`}>{shift.shiftCode}</span>}
                          <div className="font-medium text-sm" data-testid={`text-shift-title-${shift.id}`}>{shift.title}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(shift.date.split("T")[0] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          <span>{shift.startTime} - {shift.endTime}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right text-sm min-w-0">
                        {shift.clientName && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate" data-testid={`text-shift-client-${shift.id}`}>{shift.clientName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate" data-testid={`text-shift-site-${shift.id}`}>{shift.siteName || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate" data-testid={`text-shift-employee-${shift.id}`}>{shift.employeeName || "Unassigned"}</span>
                        </div>
                        {shift.supplierName && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Truck className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate" data-testid={`text-shift-supplier-${shift.id}`}>{shift.supplierName}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className={statusConf.className} data-testid={`badge-shift-status-${shift.id}`}>
                        {statusConf.label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6" data-testid="scheduling-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Scheduling</h1>
          <p className="text-muted-foreground text-sm">Manage shifts and schedules with calendar or list view.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowTemplatesDialog(true)} data-testid="button-manage-templates">
            <LayoutTemplate className="w-4 h-4 mr-1" /> Templates
          </Button>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-none"
              data-testid="button-view-calendar"
            >
              <LayoutGrid className="w-4 h-4 mr-1" /> Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
              data-testid="button-view-list"
            >
              <LayoutList className="w-4 h-4 mr-1" /> List
            </Button>
          </div>
          <Button onClick={() => { setShiftForm(f => ({ ...f, date: formatDateKey(new Date()) })); setShiftDialogOpen(true); }} data-testid="button-create-shift">
            <Plus className="w-4 h-4 mr-1" /> Create Shift
          </Button>
        </div>
      </div>

      {unassignedShifts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10" data-testid="card-unassigned-shifts">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">{unassignedShifts.length} Unassigned Shift{unassignedShifts.length !== 1 ? "s" : ""}</span>
                <span className="text-xs text-muted-foreground">in current view — need an officer assigned</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {unassignedShifts.slice(0, 5).map(shift => (
                <div key={shift.id} className="flex items-center justify-between p-2 rounded-lg border border-amber-200 bg-white dark:bg-background gap-3" data-testid={`unassigned-shift-${shift.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{shift.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(shift.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {shift.startTime}–{shift.endTime}</span>
                    {shift.siteName && <span className="text-xs text-muted-foreground truncate hidden sm:block">· {shift.siteName}</span>}
                  </div>
                  <Button size="sm" variant="outline" className="text-xs flex-shrink-0 border-amber-300 hover:bg-amber-100"
                    onClick={() => { setDetailShift(null); openEditShift(shift); }}
                    data-testid={`button-assign-shift-${shift.id}`}
                  >
                    <Zap className="w-3 h-3 mr-1" /> Assign
                  </Button>
                </div>
              ))}
              {unassignedShifts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">+{unassignedShifts.length - 5} more unassigned</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold" data-testid="text-total-shifts">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-600" data-testid="text-scheduled-count">{stats.scheduled}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-accent" data-testid="text-in-progress-count">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600" data-testid="text-completed-count">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-600" data-testid="text-no-show-count">{stats.noShow}</div>
            <div className="text-xs text-muted-foreground">No Shows</div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "calendar" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateCalendar(-1)} data-testid="button-prev-period">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateCalendar(1)} data-testid="button-next-period">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold ml-2" data-testid="text-calendar-title">{calendarTitle}</h2>
            </div>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={calendarView === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setCalendarView("week"); setCurrentDate(getMonday(currentDate)); }}
                className="rounded-none text-xs"
                data-testid="button-view-week"
              >
                Week
              </Button>
              <Button
                variant={calendarView === "fortnight" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setCalendarView("fortnight"); setCurrentDate(getMonday(currentDate)); }}
                className="rounded-none text-xs"
                data-testid="button-view-fortnight"
              >
                Fortnight
              </Button>
              <Button
                variant={calendarView === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setCalendarView("month")}
                className="rounded-none text-xs"
                data-testid="button-view-month"
              >
                Month
              </Button>
            </div>
          </div>
          {shiftsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            renderCalendar()
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                {conf.label}
              </div>
            ))}
            <span className="text-muted-foreground/50">|</span>
            <span>Click any day to create a shift</span>
          </div>
        </div>
      ) : (
        renderListView()
      )}

      <Dialog open={shiftDialogOpen} onOpenChange={(open) => { if (!open) closeShiftDialog(); else setShiftDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Shift
              {selectedDay && <span className="text-sm font-normal text-muted-foreground">— {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="shift-title">Shift Title</Label>
              <Input
                id="shift-title"
                data-testid="input-shift-title"
                value={shiftForm.title}
                onChange={(e) => setShiftForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Night Security Shift"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shift-date">Date</Label>
                <Input
                  id="shift-date"
                  data-testid="input-shift-date"
                  type="date"
                  value={shiftForm.date}
                  onChange={(e) => { setRatesManual(false); setShiftForm((f) => ({ ...f, date: e.target.value })); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-start">Start</Label>
                <Input
                  id="shift-start"
                  data-testid="input-shift-start-time"
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-end">End</Label>
                <Input
                  id="shift-end"
                  data-testid="input-shift-end-time"
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5" />
                Repeat Pattern
              </Label>
              <Select value={repeatOption} onValueChange={(v) => setRepeatOption(v as RepeatOption)}>
                <SelectTrigger data-testid="select-repeat-option">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Single day only</SelectItem>
                  <SelectItem value="week">Every day for 1 week (7 days)</SelectItem>
                  <SelectItem value="fortnight">Every day for 2 weeks (14 days)</SelectItem>
                  <SelectItem value="month">Every day for 4 weeks (28 days)</SelectItem>
                </SelectContent>
              </Select>
              {repeatOption !== "none" && shiftForm.date && (() => {
                const count = repeatOption === "week" ? 7 : repeatOption === "fortnight" ? 14 : 28;
                const startD = new Date(shiftForm.date + "T00:00:00");
                const endD = addDays(startD, count - 1);
                return (
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                      <Copy className="w-3 h-3" />
                      <span>{count} shifts will be created</span>
                    </div>
                    <p className="text-blue-600 dark:text-blue-400">
                      From <strong>{startD.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</strong> to <strong>{endD.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</strong>
                    </p>
                    {shiftForm.startTime && shiftForm.endTime && (
                      <p className="text-blue-500 dark:text-blue-400">Same time each day: {shiftForm.startTime}–{shiftForm.endTime}</p>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Site <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={shiftForm.siteId}
                onValueChange={(val) => { setRatesManual(false); setShiftForm((f) => ({ ...f, siteId: val })); }}
                options={sites.map((site) => ({ value: String(site.id), label: site.name }))}
                placeholder="Select a site"
                searchPlaceholder="Search sites…"
                emptyText="No sites found."
                data-testid="select-shift-site"
              />
            </div>
            <div className="space-y-2">
              <Label>Duty Type</Label>
              <Select value={shiftForm.dutyTypeId || "none"} onValueChange={(val) => { setRatesManual(false); setShiftForm((f) => ({ ...f, dutyTypeId: val === "none" ? "" : val })); }}>
                <SelectTrigger data-testid="select-shift-duty-type">
                  <SelectValue placeholder="Select duty type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No duty type</SelectItem>
                  {dutyTypes.map((dt) => (
                    <SelectItem key={dt.id} value={String(dt.id)}>
                      {dt.name}{dt.requiresLicense ? " (licence required)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shiftForm.dutyTypeId && dutyTypes.find((d) => String(d.id) === shiftForm.dutyTypeId)?.requiresLicense && (
                <p className="text-[11px] text-muted-foreground">Assigned officer must have a valid SIA licence for this duty type.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Supplier / Provider</Label>
              <SearchableSelect
                value={shiftForm.supplierId || "inhouse"}
                onValueChange={(val) => { setRatesManual(false); setShiftForm((f) => ({ ...f, supplierId: val, employeeId: "" })); }}
                options={[
                  { value: "inhouse", label: `In-house (${tenantCompanyName})` },
                  ...approvedSuppliers.map((sup) => ({
                    value: String(sup.id),
                    label: sup.companyName,
                  })),
                ]}
                placeholder={`In-house (${tenantCompanyName})`}
                searchPlaceholder="Search suppliers…"
                data-testid="select-shift-supplier"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Officer {!isInhouse ? "(Supplier Officers)" : "(In-house Staff)"}</Label>
                {isInhouse && shiftForm.date && shiftForm.startTime && shiftForm.endTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 gap-1"
                    onClick={() => setShowAvailableSuggestions(v => !v)}
                    data-testid="button-toggle-suggestions"
                  >
                    <Users className="w-3 h-3" />
                    {showAvailableSuggestions ? "Hide" : "Show"} Suggestions
                  </Button>
                )}
              </div>
              <SearchableSelect
                value={shiftForm.employeeId}
                onValueChange={(val) => { setRatesManual(false); setShiftForm((f) => ({ ...f, employeeId: val === "none" ? "" : val })); }}
                options={filteredEmployees.map((emp) => ({
                  value: String(emp.id),
                  label: officerLabel(emp),
                  keywords: emp.employeeNumber || undefined,
                }))}
                noneValue="none"
                noneLabel="Unassigned"
                disabled={officersLoading || officersError || filteredEmployees.length === 0}
                placeholder={
                  officersLoading
                    ? "Loading officers..."
                    : officersError
                      ? "Failed to load officers"
                      : filteredEmployees.length === 0
                        ? "No officers available"
                        : "Select an officer"
                }
                searchPlaceholder="Search officers…"
                emptyText="No officers found."
                data-testid="select-shift-employee"
              />
              {showAvailableSuggestions && isInhouse && (
                <div className="border rounded-lg p-2 bg-muted/20 space-y-1.5 max-h-48 overflow-y-auto" data-testid="available-employees-panel">
                  {suggestionsLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading suggestions...
                    </div>
                  ) : availableEmployees.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No employees found</p>
                  ) : (
                    availableEmployees.map(emp => (
                      <div
                        key={emp.id}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer hover:bg-background transition-colors ${(emp.hasConflict || emp.onApprovedLeave) ? "opacity-50" : ""}`}
                        onClick={() => { if (!emp.hasConflict && !emp.onApprovedLeave) setShiftForm(f => ({ ...f, employeeId: String(emp.id) })); }}
                        data-testid={`suggestion-emp-${emp.id}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">{emp.name}</span>
                            {emp.hasFirstAid && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">FA</span>}
                            {emp.siaLicenseType && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">{emp.siaLicenseType}</span>}
                            {emp.onApprovedLeave && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">On Leave</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {emp.hasConflict ? (
                              <span className="text-[10px] text-red-600 flex items-center gap-0.5">
                                <X className="w-2.5 h-2.5" /> Conflict: {emp.conflictingShift?.title} {emp.conflictingShift?.startTime}–{emp.conflictingShift?.endTime}
                              </span>
                            ) : emp.onApprovedLeave ? (
                              <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Approved leave on this date
                              </span>
                            ) : (
                              <span className={`text-[10px] flex items-center gap-0.5 ${emp.markedAvailable ? "text-green-600" : "text-amber-600"}`}>
                                {emp.markedAvailable ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                {emp.availabilityNote}
                              </span>
                            )}
                          </div>
                        </div>
                        {!emp.hasConflict && !emp.onApprovedLeave && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 flex-shrink-0" onClick={() => setShiftForm(f => ({ ...f, employeeId: String(emp.id) }))}>
                            Select
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Charge rate (£/hr)</Label>
                <Select
                  value={shiftForm.chargeRateOptionId || "none"}
                  onValueChange={(val) => {
                    setRatesManual(true);
                    if (val === "none") {
                      setShiftForm((f) => ({ ...f, chargeRate: "", chargeRateOptionId: "" }));
                      return;
                    }
                    const opt = (resolvedRates?.chargeRateOptions || []).find((o) => o.id === val);
                    setShiftForm((f) => ({
                      ...f,
                      chargeRateOptionId: val,
                      chargeRate: opt?.rate || "",
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-shift-charge-rate">
                    <SelectValue placeholder="Select charge rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No charge rate</SelectItem>
                    {(resolvedRates?.chargeRateOptions || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  From site rates{resolvedRates?.chargeRateOptions?.length ? ` (${resolvedRates.chargeRateOptions.length})` : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Pay rate (£/hr)</Label>
                <Select
                  value={shiftForm.payRateOptionId || "none"}
                  onValueChange={(val) => {
                    setRatesManual(true);
                    if (val === "none") {
                      setShiftForm((f) => ({ ...f, payRate: "", payRateOptionId: "" }));
                      return;
                    }
                    const opt = (resolvedRates?.payRateOptions || []).find((o) => o.id === val);
                    setShiftForm((f) => ({
                      ...f,
                      payRateOptionId: val,
                      payRate: opt?.rate || "",
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-shift-pay-rate">
                    <SelectValue placeholder={isInhouse ? "Select employee rate" : "Select supplier rate"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No pay rate</SelectItem>
                    {(resolvedRates?.payRateOptions || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {isInhouse ? "From employee pay rates" : "From supplier rate cards"}
                  {resolvedRates?.payRateOptions?.length ? ` (${resolvedRates.payRateOptions.length})` : ""}
                  {ratesManual && (
                    <button type="button" className="ml-2 underline" onClick={() => setRatesManual(false)}>
                      Use default
                    </button>
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-notes">Notes</Label>
              <Textarea
                id="shift-notes"
                data-testid="input-shift-notes"
                value={shiftForm.notes}
                onChange={(e) => setShiftForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes for this shift..."
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeShiftDialog} data-testid="button-cancel-shift">
              Cancel
            </Button>
            <Button
              onClick={handleCreateShift}
              disabled={createShiftMutation.isPending || bulkCreateMutation.isPending || !shiftForm.title || !shiftForm.date || !shiftForm.startTime || !shiftForm.endTime || !shiftForm.siteId}
              data-testid="button-submit-shift"
            >
              {(createShiftMutation.isPending || bulkCreateMutation.isPending) ? "Creating..." : repeatOption !== "none" ? `Create ${repeatOption === "week" ? "7" : repeatOption === "fortnight" ? "14" : "28"} Shifts` : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailShift} onOpenChange={(open) => { if (!open) setDetailShift(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Shift Details
            </DialogTitle>
          </DialogHeader>
          {detailShift && (() => {
            const statusConf = STATUS_CONFIG[detailShift.status || "scheduled"] || STATUS_CONFIG.scheduled;
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold" data-testid="text-detail-title">{detailShift.title}</h3>
                  <Badge className={statusConf.className} data-testid="badge-detail-status">{statusConf.label}</Badge>
                </div>
                {(detailShift.shiftCode || detailShift.externalId) && (
                  <div className="flex items-center gap-3">
                    {detailShift.shiftCode && <p className="text-xs font-mono text-muted-foreground" data-testid="text-detail-code">Code: {detailShift.shiftCode}</p>}
                    {detailShift.externalId && <p className="text-xs font-mono text-muted-foreground" data-testid="text-detail-external-id">Ext. Ref: {detailShift.externalId}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium" data-testid="text-detail-date">{new Date(detailShift.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="font-medium" data-testid="text-detail-time">{detailShift.startTime} - {detailShift.endTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Site</p>
                    <p className="font-medium" data-testid="text-detail-site">{detailShift.siteName || "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Officer</p>
                    <p className="font-medium" data-testid="text-detail-employee">{detailShift.employeeName || "Unassigned"}</p>
                  </div>
                  {detailShift.supplierName && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Supplier</p>
                      <p className="font-medium" data-testid="text-detail-supplier">{detailShift.supplierName}</p>
                    </div>
                  )}
                </div>
                {detailShift.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm" data-testid="text-detail-notes">{detailShift.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => { setDetailShift(null); openEditShift(detailShift); }} data-testid="button-detail-edit">
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(detailShift); setDeleteConfirmOpen(true); }} data-testid="button-detail-delete">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editShift} onOpenChange={(open) => { if (!open) setEditShift(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Shift
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Shift Title</Label>
              <Input
                data-testid="input-edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input data-testid="input-edit-date" type="date" value={editForm.date} onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input data-testid="input-edit-start-time" type="time" value={editForm.startTime} onChange={(e) => setEditForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input data-testid="input-edit-end-time" type="time" value={editForm.endTime} onChange={(e) => setEditForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={editForm.siteId}
                onValueChange={(val) => setEditForm(f => ({ ...f, siteId: val }))}
                options={sites.map((site) => ({ value: String(site.id), label: site.name }))}
                placeholder="Select a site"
                searchPlaceholder="Search sites…"
                data-testid="select-edit-site"
              />
            </div>
            <div className="space-y-2">
              <Label>Duty Type</Label>
              <Select value={editForm.dutyTypeId || "none"} onValueChange={(val) => setEditForm(f => ({ ...f, dutyTypeId: val === "none" ? "" : val }))}>
                <SelectTrigger data-testid="select-edit-duty-type">
                  <SelectValue placeholder="Select duty type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No duty type</SelectItem>
                  {dutyTypes.map((dt) => (
                    <SelectItem key={dt.id} value={String(dt.id)}>
                      {dt.name}{dt.requiresLicense ? " (licence required)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <SearchableSelect
                value={editForm.supplierId || "inhouse"}
                onValueChange={(val) => setEditForm(f => ({ ...f, supplierId: val, employeeId: "" }))}
                options={[
                  { value: "inhouse", label: `${tenantCompanyName} (In-house)` },
                  ...approvedSuppliers.map((s) => ({ value: String(s.id), label: s.companyName })),
                ]}
                placeholder="Select supplier"
                searchPlaceholder="Search suppliers…"
                data-testid="select-edit-supplier"
              />
            </div>
            <div className="space-y-2">
              <Label>Officer</Label>
              <SearchableSelect
                value={editForm.employeeId || "none"}
                onValueChange={(val) => setEditForm(f => ({ ...f, employeeId: val === "none" ? "" : val }))}
                options={[
                  { value: "none", label: "Unassigned" },
                  ...editFilteredEmployees.map((emp) => ({ value: String(emp.id), label: officerLabel(emp) })),
                ]}
                placeholder="Select an officer (optional)"
                searchPlaceholder="Search officers…"
                data-testid="select-edit-employee"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea data-testid="input-edit-notes" value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Charge rate (£/hr)</Label>
                <Select
                  value={editForm.chargeRateOptionId || (editForm.chargeRate ? `current-charge-${editForm.chargeRate}` : "none")}
                  onValueChange={(val) => {
                    setEditRatesManual(true);
                    if (val === "none") {
                      setEditForm((f) => ({ ...f, chargeRate: "", chargeRateOptionId: "" }));
                      return;
                    }
                    if (val.startsWith("current-charge-")) {
                      setEditForm((f) => ({ ...f, chargeRateOptionId: "", chargeRate: val.replace("current-charge-", "") }));
                      return;
                    }
                    const opt = (editResolvedRates?.chargeRateOptions || []).find((o) => o.id === val);
                    setEditForm((f) => ({
                      ...f,
                      chargeRateOptionId: val,
                      chargeRate: opt?.rate || "",
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-edit-charge-rate">
                    <SelectValue placeholder="Select charge rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No charge rate</SelectItem>
                    {(editResolvedRates?.chargeRateOptions || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                    {editForm.chargeRate &&
                      !(editResolvedRates?.chargeRateOptions || []).some((o) => o.rate === editForm.chargeRate) && (
                        <SelectItem value={`current-charge-${editForm.chargeRate}`}>
                          £{Number(editForm.chargeRate).toFixed(2)}/hr — current
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pay rate (£/hr)</Label>
                <Select
                  value={editForm.payRateOptionId || (editForm.payRate ? `current-pay-${editForm.payRate}` : "none")}
                  onValueChange={(val) => {
                    setEditRatesManual(true);
                    if (val === "none") {
                      setEditForm((f) => ({ ...f, payRate: "", payRateOptionId: "" }));
                      return;
                    }
                    if (val.startsWith("current-pay-")) {
                      setEditForm((f) => ({ ...f, payRateOptionId: "", payRate: val.replace("current-pay-", "") }));
                      return;
                    }
                    const opt = (editResolvedRates?.payRateOptions || []).find((o) => o.id === val);
                    setEditForm((f) => ({
                      ...f,
                      payRateOptionId: val,
                      payRate: opt?.rate || "",
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-edit-pay-rate">
                    <SelectValue placeholder="Select pay rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No pay rate</SelectItem>
                    {(editResolvedRates?.payRateOptions || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                    {editForm.payRate &&
                      !(editResolvedRates?.payRateOptions || []).some((o) => o.rate === editForm.payRate) && (
                        <SelectItem value={`current-pay-${editForm.payRate}`}>
                          £{Number(editForm.payRate).toFixed(2)}/hr — current
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="destructive" size="sm" onClick={() => { if (editShift) { setDeleteTarget(editShift); setDeleteConfirmOpen(true); } }} data-testid="button-edit-delete">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditShift(null)} data-testid="button-edit-cancel">Cancel</Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateShiftMutation.isPending || !editForm.title || !editForm.date || !editForm.startTime || !editForm.endTime || !editForm.siteId}
                data-testid="button-edit-save"
              >
                {updateShiftMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && isShiftBookedOn(deleteTarget) ? "Officer already booked on" : "Delete Shift"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && isShiftBookedOn(deleteTarget) ? (
                <>
                  {deleteTarget.employeeName ? `${deleteTarget.employeeName} has already booked on` : "An officer has already booked on"} this shift
                  {deleteTarget.siteName ? ` at ${deleteTarget.siteName}` : ""}
                  {" "}({deleteTarget.startTime}–{deleteTarget.endTime}). Deleting it will also remove the book-on, ops checks, and check-calls. This cannot be undone.
                </>
              ) : (
                "Are you sure you want to delete this shift? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }} data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteShiftMutation.mutate(deleteTarget.id); }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteShiftMutation.isPending ? "Deleting..." : deleteTarget && isShiftBookedOn(deleteTarget) ? "Delete booked-on shift" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {shifts.filter((s) => selectedShiftIds.has(s.id) && isShiftBookedOn(s)).length > 0
                ? "Delete shifts including booked-on"
                : `Delete ${selectedShiftIds.size} Shift${selectedShiftIds.size !== 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const bookedOnCount = shifts.filter((s) => selectedShiftIds.has(s.id) && isShiftBookedOn(s)).length;
                if (bookedOnCount > 0) {
                  return `${bookedOnCount} of ${selectedShiftIds.size} selected shift${selectedShiftIds.size !== 1 ? "s have" : " has"} already been booked on. Deleting will also remove those book-ons, ops checks, and check-calls. This cannot be undone.`;
                }
                return `Are you sure you want to delete ${selectedShiftIds.size} selected shift${selectedShiftIds.size !== 1 ? "s" : ""}? This action cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteConfirmOpen(false)} data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedShiftIds))}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedShiftIds.size} Shift${selectedShiftIds.size !== 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedShiftIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" data-testid="bulk-action-bar">
          <div className="flex items-center gap-3 bg-[#1F3A5F] text-white px-6 py-3 rounded-full shadow-xl">
            <CheckSquare className="w-4 h-4" />
            <span className="font-medium text-sm">{selectedShiftIds.size} shift{selectedShiftIds.size !== 1 ? "s" : ""} selected</span>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setBulkDeleteConfirmOpen(true)} data-testid="button-bulk-delete">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-white hover:text-white hover:bg-white/20" onClick={() => setSelectedShiftIds(new Set())} data-testid="button-clear-selection">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Shift Templates Dialog */}
      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" /> Shift Templates
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="list">
            <TabsList className="mb-4">
              <TabsTrigger value="list" data-testid="tab-templates-list">Saved Templates</TabsTrigger>
              <TabsTrigger value="create" data-testid="tab-templates-create">Create Template</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="space-y-3 max-h-[50vh] overflow-y-auto">
              {shiftTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <LayoutTemplate className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No templates yet. Create one to get started.</p>
                </div>
              ) : (
                shiftTemplates.map(template => {
                  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <Card key={template.id} data-testid={`card-template-${template.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm">{template.name}</div>
                            {template.description && <div className="text-xs text-muted-foreground">{template.description}</div>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{template.startTime}–{template.endTime}</span>
                              {template.siteName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{template.siteName}</span>}
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{template.daysOfWeek.map((d: number) => dayNames[d]).join(", ")}</span>
                              {template.requiredCount > 1 && <Badge variant="outline" className="text-[10px] h-4">{template.requiredCount}x staff</Badge>}
                              {template.siaLicenseType && <Badge variant="secondary" className="text-[10px] h-4">{template.siaLicenseType}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={() => { setApplyTemplateDialog(template as ShiftTemplate); setApplyDateRange({ startDate: formatDateKey(new Date()), endDate: "" }); }}
                              data-testid={`button-apply-template-${template.id}`}
                            >
                              <Zap className="w-3 h-3 mr-1" /> Apply
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500 hover:text-red-600"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`button-delete-template-${template.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
            <TabsContent value="create" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Template Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={templateForm.name}
                    onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Site X — Night Shift"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={templateForm.description}
                    onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Shift Title <span className="text-red-500">*</span></Label>
                  <Input
                    value={templateForm.title}
                    onChange={e => setTemplateForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Door Supervisor"
                    data-testid="input-template-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Site</Label>
                  <SearchableSelect
                    value={templateForm.siteId || ""}
                    onValueChange={(v) => setTemplateForm(f => ({ ...f, siteId: v }))}
                    options={sites.map((s) => ({ value: String(s.id), label: s.name }))}
                    placeholder="Any site"
                    searchPlaceholder="Search sites…"
                    noneValue=""
                    noneLabel="Any site"
                    data-testid="select-template-site"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Time <span className="text-red-500">*</span></Label>
                  <Input type="time" value={templateForm.startTime} onChange={e => setTemplateForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-template-start" />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time <span className="text-red-500">*</span></Label>
                  <Input type="time" value={templateForm.endTime} onChange={e => setTemplateForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-template-end" />
                </div>
                <div className="space-y-1.5">
                  <Label>SIA License Type Required</Label>
                  <Select value={templateForm.siaLicenseType} onValueChange={v => setTemplateForm(f => ({ ...f, siaLicenseType: v }))}>
                    <SelectTrigger data-testid="select-template-sia">
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any type</SelectItem>
                      <SelectItem value="Door Supervisor">Door Supervisor</SelectItem>
                      <SelectItem value="Security Guard">Security Guard</SelectItem>
                      <SelectItem value="CCTV Operator">CCTV Operator</SelectItem>
                      <SelectItem value="Close Protection">Close Protection</SelectItem>
                      <SelectItem value="Vehicle Immobiliser">Vehicle Immobiliser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Staff Required</Label>
                  <Input type="number" min="1" max="50" value={templateForm.requiredCount} onChange={e => setTemplateForm(f => ({ ...f, requiredCount: e.target.value }))} data-testid="input-template-count" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Days of Week <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 flex-wrap">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTemplateForm(f => ({
                          ...f,
                          daysOfWeek: f.daysOfWeek.includes(idx) ? f.daysOfWeek.filter(d => d !== idx) : [...f.daysOfWeek, idx],
                        }))}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${templateForm.daysOfWeek.includes(idx) ? "bg-[#1F3A5F] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        data-testid={`button-day-${day.toLowerCase()}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => createTemplateMutation.mutate(templateForm)}
                disabled={createTemplateMutation.isPending || !templateForm.name || !templateForm.title || !templateForm.startTime || !templateForm.endTime || templateForm.daysOfWeek.length === 0}
                data-testid="button-save-template"
              >
                {createTemplateMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      {applyTemplateDialog && (
        <Dialog open={!!applyTemplateDialog} onOpenChange={(open) => { if (!open) setApplyTemplateDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Apply Template: {applyTemplateDialog.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select a date range to create shifts from this template. Only matching days of week will generate shifts.</p>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={applyDateRange.startDate} onChange={e => setApplyDateRange(r => ({ ...r, startDate: e.target.value }))} data-testid="input-apply-start" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={applyDateRange.endDate} onChange={e => setApplyDateRange(r => ({ ...r, endDate: e.target.value }))} data-testid="input-apply-end" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyTemplateDialog(null)} data-testid="button-cancel-apply">Cancel</Button>
              <Button
                onClick={() => applyTemplateMutation.mutate({ id: applyTemplateDialog.id, startDate: applyDateRange.startDate, endDate: applyDateRange.endDate })}
                disabled={applyTemplateMutation.isPending || !applyDateRange.startDate || !applyDateRange.endDate}
                data-testid="button-confirm-apply"
              >
                {applyTemplateMutation.isPending ? "Creating..." : "Apply Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
