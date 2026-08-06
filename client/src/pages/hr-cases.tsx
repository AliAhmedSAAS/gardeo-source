import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Scale, AlertTriangle, CheckCircle2, Clock,
  Calendar, User, ChevronRight, FileText, MessageSquare,
  Upload, Trash2, ArrowLeft, Shield, Gavel, RotateCcw,
  ChevronDown, ChevronUp, Loader2, Info,
} from "lucide-react";

type HrCaseListItem = {
  id: number;
  tenantId: number;
  employeeId: number;
  caseType: "disciplinary" | "grievance" | "capability" | "appeal";
  status: "open" | "investigation" | "hearing_scheduled" | "outcome_given" | "appealed" | "closed";
  openedBy: string;
  openedByName: string;
  assignedTo: string | null;
  incidentDate: string | null;
  allegationSummary: string | null;
  hearingDate: string | null;
  outcome: string | null;
  outcomeDate: string | null;
  outcomeNotes: string | null;
  appealDeadline: string | null;
  closedAt: string | null;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  createdAt: string;
};

type HrCaseDetail = HrCaseListItem & {
  events: Array<{
    id: number;
    eventType: string;
    notes: string | null;
    createdByName: string;
    createdAt: string;
  }>;
  documents: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    documentType: string | null;
    createdAt: string;
  }>;
};

const CASE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  disciplinary: { label: "Disciplinary", color: "bg-red-100 text-red-700 border-red-200", icon: Shield },
  grievance: { label: "Grievance", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  capability: { label: "Capability", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
  appeal: { label: "Appeal", color: "bg-purple-100 text-purple-700 border-purple-200", icon: RotateCcw },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; color: string }> = {
  open: { label: "Open", variant: "default", color: "bg-green-100 text-green-700 border-green-200" },
  investigation: { label: "Investigation", variant: "secondary", color: "bg-blue-100 text-blue-700 border-blue-200" },
  hearing_scheduled: { label: "Hearing Scheduled", variant: "secondary", color: "bg-amber-100 text-amber-700 border-amber-200" },
  outcome_given: { label: "Outcome Given", variant: "default", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  appealed: { label: "Appealed", variant: "secondary", color: "bg-purple-100 text-purple-700 border-purple-200" },
  closed: { label: "Closed", variant: "secondary", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

const OUTCOME_LABELS: Record<string, string> = {
  no_action: "No Action",
  verbal_warning: "Verbal Warning",
  written_warning: "Written Warning",
  final_warning: "Final Written Warning",
  dismissal: "Dismissal",
  upheld: "Upheld",
  not_upheld: "Not Upheld",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  case_opened: "Case Opened",
  status_changed: "Status Changed",
  outcome_recorded: "Outcome Recorded",
  hearing_scheduled: "Hearing Scheduled",
  case_updated: "Case Updated",
  note_added: "Note Added",
  document_added: "Document Added",
  appeal_lodged: "Appeal Lodged",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTimelineIcon(eventType: string) {
  switch (eventType) {
    case "case_opened": return <Plus className="w-3.5 h-3.5 text-green-600" />;
    case "hearing_scheduled": return <Calendar className="w-3.5 h-3.5 text-amber-600" />;
    case "outcome_recorded": return <Gavel className="w-3.5 h-3.5 text-indigo-600" />;
    case "status_changed": return <RotateCcw className="w-3.5 h-3.5 text-blue-600" />;
    case "appeal_lodged": return <RotateCcw className="w-3.5 h-3.5 text-purple-600" />;
    default: return <MessageSquare className="w-3.5 h-3.5 text-gray-500" />;
  }
}

export default function HrCasesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [appealForm, setAppealForm] = useState({ hearingDate: "", hearingTime: "10:00", notes: "" });
  const [showCreateDialog, setShowCreateDialog] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("openCase");
  });
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [createForm, setCreateForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      employeeId: params.get("employeeId") || "",
      caseType: params.get("openCase") || "disciplinary",
      incidentDate: "",
      allegationSummary: "",
    };
  });
  const [eventForm, setEventForm] = useState({ eventType: "note_added", notes: "" });
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventNotes, setEditingEventNotes] = useState("");
  const [updateForm, setUpdateForm] = useState({ status: "", assignedTo: "" });
  const [scheduleForm, setScheduleForm] = useState({ hearingDate: "", hearingTime: "10:00" });
  const [outcomeForm, setOutcomeForm] = useState({ outcome: "", outcomeDate: "", outcomeNotes: "" });
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [docForm, setDocForm] = useState({ fileName: "", fileUrl: "", documentType: "evidence" });

  const { data: cases = [], isLoading } = useQuery<HrCaseListItem[]>({
    queryKey: ["/api/admin/hr-cases"],
  });

  const { data: selectedCase, isLoading: isDetailLoading } = useQuery<HrCaseDetail>({
    queryKey: ["/api/admin/hr-cases", selectedCaseId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/hr-cases/${selectedCaseId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load case");
      return res.json();
    },
    enabled: !!selectedCaseId,
  });

  const { data: employees = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string; employeeNumber: string | null }>>({
    queryKey: ["/api/admin/employees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/employees", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data.data || [];
      return arr.map((e: any) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, employeeNumber: e.employeeNumber }));
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/hr-cases", data);
      return res.json();
    },
    onSuccess: (created) => {
      toast({ title: "Case opened", description: `HR case #${created.id} created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases"] });
      setShowCreateDialog(false);
      setCreateForm({ employeeId: "", caseType: "disciplinary", incidentDate: "", allegationSummary: "" });
      setSelectedCaseId(created.id);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/hr-cases/${selectedCaseId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Case updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
      setShowUpdateDialog(false);
      setShowScheduleDialog(false);
      setShowOutcomeDialog(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/admin/hr-cases/${selectedCaseId}/events`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
      setShowEventDialog(false);
      setEventForm({ eventType: "note_added", notes: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: number; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/hr-cases/${selectedCaseId}/events/${eventId}`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Note updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
      setEditingEventId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/admin/hr-cases/${selectedCaseId}/events/${eventId}`);
    },
    onSuccess: () => {
      toast({ title: "Entry removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addDocMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/admin/hr-cases/${selectedCaseId}/documents`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document attached" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
      setShowDocDialog(false);
      setDocForm({ fileName: "", fileUrl: "", documentType: "evidence" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/admin/hr-cases/${selectedCaseId}/documents/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases", selectedCaseId] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = cases.filter(c => {
    const matchSearch = !search ||
      c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.employeeNumber?.toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search);
    const matchType = typeFilter === "all" || c.caseType === typeFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const openCount = cases.filter(c => c.status !== "closed").length;
  const byType = {
    disciplinary: cases.filter(c => c.caseType === "disciplinary").length,
    grievance: cases.filter(c => c.caseType === "grievance").length,
    capability: cases.filter(c => c.caseType === "capability").length,
    appeal: cases.filter(c => c.caseType === "appeal").length,
  };

  if (selectedCaseId && selectedCase) {
    const tc = CASE_TYPE_CONFIG[selectedCase.caseType];
    const sc = STATUS_CONFIG[selectedCase.status];
    const TypeIcon = tc.icon;
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedCaseId(null)} data-testid="button-back-cases">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Cases
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold" data-testid="text-case-title">
                Case #{selectedCase.id} — {tc.label}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {selectedCase.employeeName}{selectedCase.employeeNumber ? ` (${selectedCase.employeeNumber})` : ""}
              {selectedCase.jobTitle ? ` · ${selectedCase.jobTitle}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${sc.color}`}>
              {sc.label}
            </span>
            {selectedCase.status !== "closed" && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setScheduleForm({ hearingDate: "", hearingTime: "10:00" }); setShowScheduleDialog(true); }} data-testid="button-schedule-hearing">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Schedule Hearing
                </Button>
                {selectedCase.status === "outcome_given" && (
                  <Button size="sm" variant="outline" onClick={() => { setAppealForm({ hearingDate: "", hearingTime: "10:00", notes: "" }); setShowAppealDialog(true); }} data-testid="button-lodge-appeal">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Lodge Appeal
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setOutcomeForm({ outcome: "", outcomeDate: "", outcomeNotes: "" }); setShowOutcomeDialog(true); }} data-testid="button-record-outcome">
                  <Gavel className="w-3.5 h-3.5 mr-1.5" /> Record Outcome
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setUpdateForm({ status: selectedCase.status, assignedTo: selectedCase.assignedTo || "" }); setShowUpdateDialog(true); }} data-testid="button-update-status">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Update Status
                </Button>
                <Button size="sm" variant="destructive" onClick={() => updateCaseMutation.mutate({ status: "closed" })} data-testid="button-close-case">
                  Close Case
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={async () => {
                  if (!confirm("Permanently delete this case and all its events/documents? This cannot be undone.")) return;
                  await apiRequest("DELETE", `/api/admin/hr-cases/${selectedCase.id}`);
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/hr-cases"] });
                  setSelectedCaseId(null);
                  toast({ title: "Case deleted" });
                }} data-testid="button-delete-case">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Opened By</p>
              <p className="text-sm font-medium" data-testid="text-opened-by">{selectedCase.openedByName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Incident Date</p>
              <p className="text-sm font-medium">{formatDate(selectedCase.incidentDate)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Hearing Date</p>
              <p className="text-sm font-medium">{selectedCase.hearingDate ? formatDateTime(selectedCase.hearingDate) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Appeal Deadline</p>
              <p className="text-sm font-medium">{formatDate(selectedCase.appealDeadline)}</p>
            </CardContent>
          </Card>
        </div>

        {selectedCase.allegationSummary && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Allegation / Summary</p>
              <p className="text-sm leading-relaxed">{selectedCase.allegationSummary}</p>
            </CardContent>
          </Card>
        )}

        {selectedCase.outcome && (
          <Card className="mb-6 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20">
            <CardContent className="p-4">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1 font-medium uppercase tracking-wide">Outcome</p>
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-1">{OUTCOME_LABELS[selectedCase.outcome] || selectedCase.outcome}</p>
              {selectedCase.outcomeDate && <p className="text-xs text-muted-foreground mb-1">Date: {formatDate(selectedCase.outcomeDate)}</p>}
              {selectedCase.outcomeNotes && <p className="text-sm text-muted-foreground">{selectedCase.outcomeNotes}</p>}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="timeline">
          <TabsList className="mb-4">
            <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents ({selectedCase.documents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Case Timeline</CardTitle>
                {selectedCase.status !== "closed" && (
                  <Button size="sm" onClick={() => setShowEventDialog(true)} data-testid="button-add-note">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Note
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isDetailLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : selectedCase.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No timeline events yet.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {[...selectedCase.events].reverse().map((ev) => (
                        <div key={ev.id} className="flex gap-3 pl-10 relative group" data-testid={`event-item-${ev.id}`}>
                          <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-background border-2 border-border flex items-center justify-center">
                            {getTimelineIcon(ev.eventType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium">{EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}</span>
                              <span className="text-xs text-muted-foreground">{formatDateTime(ev.createdAt)}</span>
                              <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => { setEditingEventId(ev.id); setEditingEventNotes(ev.notes || ""); }} data-testid={`button-edit-event-${ev.id}`}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive hover:bg-destructive/10" onClick={() => { if (!confirm("Remove this timeline entry?")) return; deleteEventMutation.mutate(ev.id); }} data-testid={`button-delete-event-${ev.id}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {editingEventId === ev.id ? (
                              <div className="space-y-2 mt-1">
                                <Textarea value={editingEventNotes} onChange={e => setEditingEventNotes(e.target.value)} rows={2} data-testid="textarea-edit-event-notes" />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => updateEventMutation.mutate({ eventId: ev.id, notes: editingEventNotes })} disabled={updateEventMutation.isPending} data-testid="button-save-event-edit">Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingEventId(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              ev.notes && <p className="text-sm text-muted-foreground">{ev.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">by {ev.createdByName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Evidence & Correspondence</CardTitle>
                <Button size="sm" onClick={() => { setDocForm({ fileName: "", fileUrl: "", documentType: "evidence" }); setShowDocDialog(true); }} data-testid="button-attach-document">
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Attach Document
                </Button>
              </CardHeader>
              <CardContent>
                {selectedCase.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents attached. Use "Attach Document" to add evidence or correspondence.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCase.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`doc-item-${doc.id}`}>
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">{doc.documentType} · {formatDate(doc.createdAt)}</p>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noreferrer">View</a>
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => {
                          if (!confirm(`Remove "${doc.fileName}" from this case?`)) return;
                          deleteDocMutation.mutate(doc.id);
                        }} data-testid={`button-delete-doc-${doc.id}`} disabled={deleteDocMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Attach Document Dialog */}
        <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Attach Document</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Document Name / Title <span className="text-destructive">*</span></Label>
                <Input value={docForm.fileName} onChange={e => setDocForm(f => ({ ...f, fileName: e.target.value }))} placeholder="e.g. Investigation Report.pdf" data-testid="input-doc-name" />
              </div>
              <div>
                <Label>URL / Link <span className="text-destructive">*</span></Label>
                <Input value={docForm.fileUrl} onChange={e => setDocForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://..." data-testid="input-doc-url" />
              </div>
              <div>
                <Label>Document Type</Label>
                <Select value={docForm.documentType} onValueChange={v => setDocForm(f => ({ ...f, documentType: v }))}>
                  <SelectTrigger data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evidence">Evidence</SelectItem>
                    <SelectItem value="correspondence">Correspondence</SelectItem>
                    <SelectItem value="witness_statement">Witness Statement</SelectItem>
                    <SelectItem value="outcome_letter">Outcome Letter</SelectItem>
                    <SelectItem value="appeal_letter">Appeal Letter</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDocDialog(false)}>Cancel</Button>
              <Button
                onClick={() => addDocMutation.mutate(docForm)}
                disabled={!docForm.fileName.trim() || !docForm.fileUrl.trim() || addDocMutation.isPending}
                data-testid="button-confirm-attach-document"
              >
                {addDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Attach
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Appeal Dialog */}
        <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Lodge Appeal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lodging an appeal will reopen this case in appeal status and allow you to schedule a new appeal hearing.
              </p>
              <div>
                <Label>Appeal Hearing Date (optional)</Label>
                <Input type="date" value={appealForm.hearingDate} onChange={e => setAppealForm(f => ({ ...f, hearingDate: e.target.value }))} data-testid="input-appeal-date" />
              </div>
              <div>
                <Label>Appeal Hearing Time</Label>
                <Input type="time" value={appealForm.hearingTime} onChange={e => setAppealForm(f => ({ ...f, hearingTime: e.target.value }))} data-testid="input-appeal-time" />
              </div>
              <div>
                <Label>Grounds for Appeal</Label>
                <Textarea value={appealForm.notes} onChange={e => setAppealForm(f => ({ ...f, notes: e.target.value }))} placeholder="State the grounds for appeal..." rows={3} data-testid="textarea-appeal-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAppealDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const updateData: any = { status: "appealed" };
                  if (appealForm.hearingDate) {
                    const dt = new Date(`${appealForm.hearingDate}T${appealForm.hearingTime}`);
                    updateData.hearingDate = dt.toISOString();
                  }
                  updateCaseMutation.mutate(updateData, {
                    onSuccess: () => {
                      if (appealForm.notes.trim()) {
                        addEventMutation.mutate({ eventType: "appeal_lodged", notes: appealForm.notes });
                      }
                      setShowAppealDialog(false);
                    }
                  });
                }}
                disabled={updateCaseMutation.isPending}
                data-testid="button-confirm-appeal"
              >
                {updateCaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Lodge Appeal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Hearing Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Hearing</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Hearing Date</Label>
                <Input type="date" value={scheduleForm.hearingDate} onChange={e => setScheduleForm(f => ({ ...f, hearingDate: e.target.value }))} data-testid="input-hearing-date" />
              </div>
              <div>
                <Label>Hearing Time</Label>
                <Input type="time" value={scheduleForm.hearingTime} onChange={e => setScheduleForm(f => ({ ...f, hearingTime: e.target.value }))} data-testid="input-hearing-time" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!scheduleForm.hearingDate) return;
                  const dt = new Date(`${scheduleForm.hearingDate}T${scheduleForm.hearingTime}`);
                  updateCaseMutation.mutate({ status: "hearing_scheduled", hearingDate: dt.toISOString() });
                }}
                disabled={updateCaseMutation.isPending}
                data-testid="button-confirm-hearing"
              >
                {updateCaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Outcome Dialog */}
        <Dialog open={showOutcomeDialog} onOpenChange={setShowOutcomeDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Outcome</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Outcome</Label>
                <Select value={outcomeForm.outcome} onValueChange={v => setOutcomeForm(f => ({ ...f, outcome: v }))}>
                  <SelectTrigger data-testid="select-outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OUTCOME_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Outcome Date</Label>
                <Input type="date" value={outcomeForm.outcomeDate} onChange={e => setOutcomeForm(f => ({ ...f, outcomeDate: e.target.value }))} data-testid="input-outcome-date" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={outcomeForm.outcomeNotes} onChange={e => setOutcomeForm(f => ({ ...f, outcomeNotes: e.target.value }))} placeholder="Outcome details..." data-testid="textarea-outcome-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOutcomeDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!outcomeForm.outcome) return;
                  updateCaseMutation.mutate({ status: "outcome_given", outcome: outcomeForm.outcome, outcomeDate: outcomeForm.outcomeDate || null, outcomeNotes: outcomeForm.outcomeNotes || null });
                }}
                disabled={updateCaseMutation.isPending || !outcomeForm.outcome}
                data-testid="button-confirm-outcome"
              >
                {updateCaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Outcome
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Case Status</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={updateForm.status} onValueChange={v => setUpdateForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>Cancel</Button>
              <Button onClick={() => { if (updateForm.status) updateCaseMutation.mutate({ status: updateForm.status }); }} disabled={updateCaseMutation.isPending || !updateForm.status} data-testid="button-confirm-status">
                {updateCaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Event Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Note / Event</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Event Type</Label>
                <Select value={eventForm.eventType} onValueChange={v => setEventForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note_added">Note Added</SelectItem>
                    <SelectItem value="document_added">Document Reference</SelectItem>
                    <SelectItem value="appeal_lodged">Appeal Lodged</SelectItem>
                    <SelectItem value="case_updated">General Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} placeholder="Enter details..." rows={4} data-testid="textarea-event-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>Cancel</Button>
              <Button onClick={() => addEventMutation.mutate(eventForm)} disabled={addEventMutation.isPending || !eventForm.notes.trim()} data-testid="button-confirm-event">
                {addEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-hr-cases-title">HR Cases</h1>
          <p className="text-muted-foreground text-sm">Disciplinary, grievance, capability & appeal case management</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-open-case">
          <Plus className="w-4 h-4 mr-2" /> Open New Case
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4.5 h-4.5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disciplinary</p>
              <p className="text-xl font-bold" data-testid="stat-disciplinary">{byType.disciplinary}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grievance</p>
              <p className="text-xl font-bold" data-testid="stat-grievance">{byType.grievance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capability</p>
              <p className="text-xl font-bold" data-testid="stat-capability">{byType.capability}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Cases</p>
              <p className="text-xl font-bold" data-testid="stat-open">{openCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by employee name, number or case ID..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-cases" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
            <SelectValue placeholder="Case Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="disciplinary">Disciplinary</SelectItem>
            <SelectItem value="grievance">Grievance</SelectItem>
            <SelectItem value="capability">Capability</SelectItem>
            <SelectItem value="appeal">Appeal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Scale className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No cases found</p>
            <p className="text-sm">Open a new case to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {filtered.map((c) => {
              const tc = CASE_TYPE_CONFIG[c.caseType];
              const sc = STATUS_CONFIG[c.status];
              const TypeIcon = tc.icon;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedCaseId(c.id)}
                  data-testid={`case-row-${c.id}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">Case #{c.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${tc.color}`}>{tc.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {c.employeeName}{c.employeeNumber ? ` · ${c.employeeNumber}` : ""}{c.jobTitle ? ` · ${c.jobTitle}` : ""}
                    </p>
                    {c.allegationSummary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.allegationSummary}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                    <p>Opened {formatDate(c.createdAt)}</p>
                    {c.hearingDate && <p className="text-amber-600">Hearing {formatDate(c.hearingDate)}</p>}
                    {c.outcome && <p className="text-indigo-600 font-medium">{OUTCOME_LABELS[c.outcome] || c.outcome}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create Case Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Open New HR Case</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee <span className="text-destructive">*</span></Label>
              <Select value={createForm.employeeId} onValueChange={v => setCreateForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.firstName} {e.lastName}{e.employeeNumber ? ` (${e.employeeNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Case Type <span className="text-destructive">*</span></Label>
              <Select value={createForm.caseType} onValueChange={v => setCreateForm(f => ({ ...f, caseType: v }))}>
                <SelectTrigger data-testid="select-case-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disciplinary">Disciplinary</SelectItem>
                  <SelectItem value="grievance">Grievance</SelectItem>
                  <SelectItem value="capability">Capability</SelectItem>
                  <SelectItem value="appeal">Appeal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Incident Date</Label>
              <Input type="date" value={createForm.incidentDate} onChange={e => setCreateForm(f => ({ ...f, incidentDate: e.target.value }))} data-testid="input-incident-date" />
            </div>
            <div>
              <Label>Allegation / Summary</Label>
              <Textarea value={createForm.allegationSummary} onChange={e => setCreateForm(f => ({ ...f, allegationSummary: e.target.value }))} placeholder="Briefly describe the allegation or reason for this case..." rows={4} data-testid="textarea-allegation" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createCaseMutation.mutate(createForm)}
              disabled={createCaseMutation.isPending || !createForm.employeeId || !createForm.caseType}
              data-testid="button-confirm-create-case"
            >
              {createCaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Open Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCaseId && isDetailLoading && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
