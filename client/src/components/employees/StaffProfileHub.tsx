import { useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, User, Phone, Mail, FileText,
  CheckCircle2, Clock, Unlock, FileCheck, ExternalLink, Send, Pencil, Upload, CreditCard, AlertTriangle,
  Download, Loader2, ShieldCheck,
} from "lucide-react";

function invalidateEmployee(employeeId: number) {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", String(employeeId)] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
  queryClient.refetchQueries({ queryKey: ["/api/admin/employees", employeeId] });
  queryClient.refetchQueries({ queryKey: ["/api/admin/employees", String(employeeId)] });
}

function looksLikeEmail(value: string | null | undefined): boolean {
  if (!value) return true;
  return /\S+@\S+\.\S+/.test(value.trim());
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const HEALTH_FIELDS: { key: string; label: string }[] = [
  { key: "heartProblems", label: "Heart Problems" },
  { key: "eyeProblems", label: "Eye problems" },
  { key: "earProblems", label: "Ear Problems" },
  { key: "backProblems", label: "Back Problems" },
  { key: "chestProblems", label: "Chest Problems" },
  { key: "asthma", label: "Asthma" },
  { key: "depression", label: "Depression" },
  { key: "skinRashes", label: "Skin Rashes" },
  { key: "diabetes", label: "Diabetes" },
  { key: "beenIll", label: "Been Ill" },
  { key: "arthritis", label: "Arthritis" },
  { key: "cough", label: "Cough" },
  { key: "currentIllness", label: "Current illness" },
  { key: "colorBlind", label: "Color Blind" },
  { key: "smoke", label: "Smoke" },
  { key: "jaundice", label: "Jaundice" },
  { key: "migraine", label: "Migraine" },
  { key: "seriouslyInjured", label: "Seriously Injured" },
  { key: "disability", label: "Disability" },
  { key: "nerve", label: "Nerve" },
  { key: "tendons", label: "Tendons" },
  { key: "rheumaticFever", label: "Rheumatic Fever" },
  { key: "rupture", label: "Rupture" },
  { key: "nasalProblems", label: "Nasal Problems" },
  { key: "highBloodPressure", label: "High Blood Pressure" },
];

const HEALTH_PROFILE_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "height", label: "Height", placeholder: "e.g. 180 cm" },
  { key: "weight", label: "Weight", placeholder: "e.g. 78 kg" },
  { key: "colourOfEyes", label: "Colour of Eyes", placeholder: "e.g. Brown" },
];

const AUDIT_LEGEND = [
  { code: "AR", label: "Accountants reference", color: "bg-gray-800" },
  { code: "CV", label: "Confirmed Verbally", color: "bg-gray-700" },
  { code: "VC", label: "Vetting Complete", color: "bg-black" },
  { code: "SI", label: "SIA register check", color: "bg-teal-600" },
  { code: "CL", label: "Chaser letter", color: "bg-green-600" },
  { code: "CR", label: "Character reference", color: "bg-blue-600" },
  { code: "SDR", label: "Statutory declaration request", color: "bg-red-600" },
  { code: "VE", label: "Verbal Enquiry", color: "bg-purple-600" },
  { code: "DR", label: "Documentation request", color: "bg-orange-500" },
  { code: "WR", label: "Work reference", color: "bg-rose-800" },
];

function useEmpMutation(employeeId: number, successMsg: string) {
  const { toast } = useToast();
  return {
    onSuccess: () => {
      invalidateEmployee(employeeId);
      toast({ title: successMsg });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  };
}

export function StaffProfileSidebar({
  employee,
  onUpdated,
  siaLabel,
  siaClassName,
  dbsLabel,
  dbsClassName,
}: {
  employee: any;
  onUpdated: () => void;
  siaLabel: string;
  siaClassName: string;
  dbsLabel: string;
  dbsClassName: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(String(employee.officerStep ?? 0));

  useEffect(() => {
    setStep(String(employee.officerStep ?? 0));
  }, [employee.officerStep]);

  const stepMutation = useMutation({
    mutationFn: async (officerStep: number) => {
      await apiRequest("PATCH", `/api/admin/employees/${employee.id}`, { officerStep });
    },
    onSuccess: () => {
      onUpdated();
      toast({ title: "Officer step updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const fullName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "Employee";
  const subParts = [
    employee.supplierName,
    employee.email,
    employee.jobTitle,
  ].filter(Boolean);

  const MetaTile = ({
    label,
    children,
  }: {
    label: string;
    children: ReactNode;
  }) => (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 min-w-0">
      <div className="text-[11px] font-medium text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-1 text-sm font-medium truncate">{children}</div>
    </div>
  );

  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start p-5 sm:p-6 border-b border-border/60 bg-gradient-to-br from-muted/40 via-background to-background">
          <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-muted ring-1 ring-border/60 flex items-center justify-center overflow-hidden shadow-sm">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-9 h-9 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate" data-testid="text-employee-detail-name">
                  {fullName}
                </h1>
                {subParts.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {subParts.join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-xs font-medium ${siaClassName}`}>SIA · {siaLabel}</Badge>
                <Badge variant="outline" className={`text-xs font-medium ${dbsClassName}`}>DBS · {dbsLabel}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <MetaTile label="PIN">{employee.employeeNumber || <span className="text-muted-foreground font-normal">Not set</span>}</MetaTile>
          <MetaTile label="Sage ID">
            {employee.sageId ? (
              employee.sageId
            ) : (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Not set</Badge>
            )}
          </MetaTile>
          <MetaTile label="Phone">{employee.phone || <span className="text-muted-foreground font-normal">Not set</span>}</MetaTile>
          <MetaTile label="2nd phone">{employee.secondPhone || <span className="text-muted-foreground font-normal">Not set</span>}</MetaTile>
          <MetaTile label="Pay rate">{employee.hourlyRate ? `£${employee.hourlyRate}` : <span className="text-muted-foreground font-normal">Not set</span>}</MetaTile>
          <MetaTile label="Officer step">
            <Select
              value={step}
              onValueChange={(v) => {
                setStep(v);
                stepMutation.mutate(parseInt(v));
              }}
            >
              <SelectTrigger className="h-8 w-full max-w-[5.5rem] mt-0.5" data-testid="select-officer-step">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MetaTile>
          <MetaTile label="SIA status">
            <Badge variant="outline" className={`text-[10px] ${siaClassName}`}>{siaLabel}</Badge>
          </MetaTile>
          <MetaTile label="DBS status">
            <Badge variant="outline" className={`text-[10px] ${dbsClassName}`}>{dbsLabel}</Badge>
          </MetaTile>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotesTab({ employeeId, notes }: { employeeId: number; notes: any[] }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const handlers = useEmpMutation(employeeId, "Note added");

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/notes`, { body });
    },
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setOpen(false);
      setBody("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (noteId: number) => {
      await apiRequest("DELETE", `/api/admin/employees/${employeeId}/notes/${noteId}`);
    },
    ...useEmpMutation(employeeId, "Note deleted"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-note">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
      {notes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No notes yet</CardContent></Card>
      ) : (
        notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="p-4 flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{formatDate(n.createdAt)}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => deleteMut.mutate(n.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add note</DialogTitle></DialogHeader>
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="HR note..." />
          <DialogFooter>
            <Button onClick={() => createMut.mutate()} disabled={!body.trim() || createMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PreferredSitesTab({ employeeId, rows }: { employeeId: number; rows: any[] }) {
  const [subTab, setSubTab] = useState("preferred");
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const handlers = useEmpMutation(employeeId, "Site preference saved");

  const { data: sites = [] } = useQuery<any[]>({ queryKey: ["/api/sites"] });

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/preferred-sites`, {
        siteId: parseInt(siteId),
        preferenceType: subTab,
      });
    },
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setOpen(false);
      setSiteId("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (rowId: number) => {
      await apiRequest("DELETE", `/api/admin/employees/${employeeId}/preferred-sites/${rowId}`);
    },
    ...useEmpMutation(employeeId, "Removed"),
  });

  const filtered = rows.filter((r) => (r.preferenceType || "preferred") === subTab);

  return (
    <div className="space-y-3">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="preferred">Preferred Sites</TabsTrigger>
            <TabsTrigger value="banned">Banned Sites</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
        <TabsContent value={subTab} className="mt-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No sites</CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.siteName || `Site #${r.siteId}`}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.clientName || "—"}</td>
                      <td className="px-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteMut.mutate(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add {subTab} site</DialogTitle></DialogHeader>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
            <SelectContent>
              {sites.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={() => createMut.mutate()} disabled={!siteId || createMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExpertiseTab({ employeeId, certificates }: { employeeId: number; certificates: any[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", issuer: "", issueDate: "", expiryDate: "" });
  const handlers = useEmpMutation(employeeId, "Certificate added");

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/certificates`, form);
    },
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setOpen(false);
      setForm({ name: "", issuer: "", issueDate: "", expiryDate: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/employees/${employeeId}/certificates/${id}`);
    },
    ...useEmpMutation(employeeId, "Certificate deleted"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Certificates</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
      </div>
      {certificates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No certificates</CardContent></Card>
      ) : (
        certificates.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.issuer || "—"} · Issued {formatDate(c.issueDate)} · Exp {formatDate(c.expiryDate)}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => deleteMut.mutate(c.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
      <p className="text-xs text-muted-foreground">Training records live under the Training tab.</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add certificate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs">Issuer</Label><Input value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Issue date</Label><Input type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} /></div>
              <div><Label className="text-xs">Expiry</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BackgroundTab({
  employeeId,
  employmentHistory,
  education,
  references,
}: {
  employeeId: number;
  employmentHistory: any[];
  education: any[];
  references: any[];
}) {
  const emptyEmpForm = { employerName: "", jobTitle: "", dateFrom: "", dateTo: "", refereePhone: "", refereeEmail: "" };
  const [empOpen, setEmpOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [eduOpen, setEduOpen] = useState(false);
  const [editingEduId, setEditingEduId] = useState<number | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [editingRefId, setEditingRefId] = useState<number | null>(null);
  const [empForm, setEmpForm] = useState(emptyEmpForm);
  const [eduForm, setEduForm] = useState({ institution: "", qualification: "", dateFrom: "", dateTo: "", notes: "" });
  const emptyRefForm = {
    refereeName: "",
    refereeEmail: "",
    refereeAddress: "",
    refereePostcode: "",
    refereePhone: "",
    jobTitle: "",
    howLongKnown: "",
    relationship: "",
    company: "",
  };
  const [refForm, setRefForm] = useState(emptyRefForm);

  const refresh = useEmpMutation(employeeId, "Saved");

  const toDateInput = (value: string | null | undefined) => {
    if (!value) return "";
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  const emptyEduForm = { institution: "", qualification: "", dateFrom: "", dateTo: "", notes: "" };

  const openAddEdu = () => {
    setEditingEduId(null);
    setEduForm(emptyEduForm);
    setEduOpen(true);
  };

  const openEditEdu = (e: any) => {
    setEditingEduId(e.id);
    setEduForm({
      institution: e.institution || "",
      qualification: e.qualification || "",
      dateFrom: toDateInput(e.dateFrom),
      dateTo: toDateInput(e.dateTo),
      notes: e.notes || "",
    });
    setEduOpen(true);
  };

  const openAddRef = () => {
    setEditingRefId(null);
    setRefForm(emptyRefForm);
    setRefOpen(true);
  };

  const openEditRef = (r: any) => {
    setEditingRefId(r.id);
    setRefForm({
      refereeName: r.refereeName || "",
      refereeEmail: r.refereeEmail || "",
      refereeAddress: r.refereeAddress || "",
      refereePostcode: r.refereePostcode || "",
      refereePhone: r.refereePhone || "",
      jobTitle: r.jobTitle || "",
      howLongKnown: r.howLongKnown || "",
      relationship: r.relationship || "",
      company: r.company || "",
    });
    setRefOpen(true);
  };

  const openAddEmp = () => {
    setEditingEmpId(null);
    setEmpForm(emptyEmpForm);
    setEmpOpen(true);
  };

  const openEditEmp = (e: any) => {
    setEditingEmpId(e.id);
    setEmpForm({
      employerName: e.employerName || "",
      jobTitle: e.jobTitle || "",
      dateFrom: toDateInput(e.dateFrom),
      dateTo: toDateInput(e.dateTo),
      refereePhone: e.refereePhone || "",
      refereeEmail: e.refereeEmail || "",
    });
    setEmpOpen(true);
  };

  const addEmp = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/employees/${employeeId}/employment-history`, empForm),
    onSuccess: () => { refresh.onSuccess(); setEmpOpen(false); setEditingEmpId(null); },
    onError: refresh.onError,
  });
  const editEmp = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/admin/employees/${employeeId}/employment-history/${editingEmpId}`, empForm),
    onSuccess: () => { refresh.onSuccess(); setEmpOpen(false); setEditingEmpId(null); },
    onError: refresh.onError,
  });
  const delEmp = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/employees/${employeeId}/employment-history/${id}`),
    ...useEmpMutation(employeeId, "Deleted"),
  });
  const addEdu = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/employees/${employeeId}/education`, eduForm),
    onSuccess: () => { refresh.onSuccess(); setEduOpen(false); setEditingEduId(null); },
    onError: refresh.onError,
  });
  const editEdu = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/admin/employees/${employeeId}/education/${editingEduId}`, eduForm),
    onSuccess: () => { refresh.onSuccess(); setEduOpen(false); setEditingEduId(null); },
    onError: refresh.onError,
  });
  const delEdu = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/employees/${employeeId}/education/${id}`),
    ...useEmpMutation(employeeId, "Deleted"),
  });
  const addRef = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/employees/${employeeId}/references`, {
        ...refForm,
        company: refForm.company || refForm.jobTitle || "N/A",
        referenceKind: "personal",
      }),
    onSuccess: () => {
      refresh.onSuccess();
      setRefOpen(false);
      setRefForm(emptyRefForm);
    },
    onError: refresh.onError,
  });
  const editRef = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/admin/employees/${employeeId}/references/${editingRefId}`, {
        ...refForm,
        company: refForm.company || refForm.jobTitle || "N/A",
      }),
    onSuccess: () => {
      refresh.onSuccess();
      setRefOpen(false);
      setEditingRefId(null);
      setRefForm(emptyRefForm);
    },
    onError: refresh.onError,
  });
  const delRef = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/employees/${employeeId}/references/${id}`),
    ...useEmpMutation(employeeId, "Deleted"),
  });

  const empSaving = addEmp.isPending || editEmp.isPending;
  const eduSaving = addEdu.isPending || editEdu.isPending;
  const refSaving = addRef.isPending || editRef.isPending;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Employment</h3>
          <Button size="sm" variant="outline" onClick={openAddEmp}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
        {employmentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No employment history</p>
        ) : employmentHistory.map((e) => (
          <Card key={e.id} className="mb-2">
            <CardContent className="p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{e.employerName} — {e.jobTitle}</div>
                <div className="text-xs text-muted-foreground">{formatDate(e.dateFrom)} – {e.isCurrent ? "Present" : formatDate(e.dateTo)}</div>
                {(e.refereePhone || e.refereeEmail) && (
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                    {e.refereePhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{e.refereePhone}</span>}
                    {e.refereeEmail && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{e.refereeEmail}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Edit employment"
                  onClick={() => openEditEmp(e)}
                  data-testid={`button-edit-employment-${e.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => delEmp.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Education</h3>
          <Button size="sm" variant="outline" onClick={openAddEdu} data-testid="button-add-education">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        {education.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No education records</p>
        ) : education.map((e) => (
          <Card key={e.id} className="mb-2">
            <CardContent className="p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{e.institution}</div>
                <div className="text-xs text-muted-foreground">{e.qualification || "—"} · {formatDate(e.dateFrom)} – {formatDate(e.dateTo)}</div>
                {e.notes && <div className="text-xs text-muted-foreground mt-0.5">{e.notes}</div>}
              </div>
              <div className="flex items-start gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Edit education"
                  onClick={() => openEditEdu(e)}
                  data-testid={`button-edit-education-${e.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => delEdu.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Personal References</h3>
          <Button size="sm" variant="outline" onClick={openAddRef} data-testid="button-add-reference"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
        {references.filter((r) => (r.referenceKind || "personal") === "personal").length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No personal references</p>
        ) : references.filter((r) => (r.referenceKind || "personal") === "personal").map((r) => (
          <Card key={r.id} className="mb-2">
            <CardContent className="p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{r.refereeName}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                  {r.relationship && <span>{r.relationship}</span>}
                  {r.jobTitle && <span>{r.jobTitle}</span>}
                  {r.howLongKnown && <span>Known {r.howLongKnown}</span>}
                  {r.refereePhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{r.refereePhone}</span>}
                  {r.refereeEmail && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{r.refereeEmail}</span>}
                </div>
                {(r.refereeAddress || r.refereePostcode) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[r.refereeAddress, r.refereePostcode].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Edit reference"
                  onClick={() => openEditRef(r)}
                  data-testid={`button-edit-reference-${r.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => delRef.mutate(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog
        open={empOpen}
        onOpenChange={(open) => {
          setEmpOpen(open);
          if (!open) setEditingEmpId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmpId ? "Edit employment" : "Add employment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Employer" value={empForm.employerName} onChange={(e) => setEmpForm((f) => ({ ...f, employerName: e.target.value }))} />
            <Input placeholder="Job title" value={empForm.jobTitle} onChange={(e) => setEmpForm((f) => ({ ...f, jobTitle: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={empForm.dateFrom} onChange={(e) => setEmpForm((f) => ({ ...f, dateFrom: e.target.value }))} />
              <Input type="date" value={empForm.dateTo} onChange={(e) => setEmpForm((f) => ({ ...f, dateTo: e.target.value }))} />
            </div>
            <Input placeholder="Referee phone" value={empForm.refereePhone} onChange={(e) => setEmpForm((f) => ({ ...f, refereePhone: e.target.value }))} />
            <Input type="email" placeholder="Referee email (for verification send)" value={empForm.refereeEmail} onChange={(e) => setEmpForm((f) => ({ ...f, refereeEmail: e.target.value }))} />
            {!looksLikeEmail(empForm.refereeEmail) && (
              <p className="text-[11px] text-red-600">Enter a valid email address (e.g. name@example.com)</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => (editingEmpId ? editEmp.mutate() : addEmp.mutate())}
              disabled={
                empSaving ||
                !empForm.employerName.trim() ||
                !empForm.jobTitle.trim() ||
                !empForm.dateFrom ||
                !looksLikeEmail(empForm.refereeEmail)
              }
              data-testid="button-save-employment"
            >
              {empSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eduOpen}
        onOpenChange={(open) => {
          setEduOpen(open);
          if (!open) {
            setEduForm(emptyEduForm);
            setEditingEduId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEduId ? "Edit education" : "Add education"}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Institution</Label>
              <Input
                placeholder="Institution"
                value={eduForm.institution}
                onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))}
                data-testid="input-edu-institution"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qualification</Label>
              <Input
                placeholder="Qualification"
                value={eduForm.qualification}
                onChange={(e) => setEduForm((f) => ({ ...f, qualification: e.target.value }))}
                data-testid="input-edu-qualification"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={eduForm.dateFrom}
                  onChange={(e) => setEduForm((f) => ({ ...f, dateFrom: e.target.value }))}
                  data-testid="input-edu-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={eduForm.dateTo}
                  onChange={(e) => setEduForm((f) => ({ ...f, dateTo: e.target.value }))}
                  data-testid="input-edu-date-to"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Additional notes (optional)"
                value={eduForm.notes}
                onChange={(e) => setEduForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                data-testid="input-edu-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => (editingEduId ? editEdu.mutate() : addEdu.mutate())}
              disabled={eduSaving || !eduForm.institution.trim()}
              data-testid="button-save-education"
            >
              {eduSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={refOpen}
        onOpenChange={(open) => {
          setRefOpen(open);
          if (!open) {
            setRefForm(emptyRefForm);
            setEditingRefId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRefId ? "Edit personal reference" : "Add personal reference"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="Name"
                  value={refForm.refereeName}
                  onChange={(e) => setRefForm((f) => ({ ...f, refereeName: e.target.value }))}
                  data-testid="input-ref-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="Email"
                  value={refForm.refereeEmail}
                  onChange={(e) => setRefForm((f) => ({ ...f, refereeEmail: e.target.value }))}
                  data-testid="input-ref-email"
                />
                {!looksLikeEmail(refForm.refereeEmail) && (
                  <p className="text-[11px] text-red-600">Enter a valid email address (e.g. name@example.com)</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Address</Label>
                <Input
                  placeholder="Address"
                  value={refForm.refereeAddress}
                  onChange={(e) => setRefForm((f) => ({ ...f, refereeAddress: e.target.value }))}
                  data-testid="input-ref-address"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Post Code</Label>
                <Input
                  placeholder="Post Code"
                  value={refForm.refereePostcode}
                  onChange={(e) => setRefForm((f) => ({ ...f, refereePostcode: e.target.value }))}
                  data-testid="input-ref-postcode"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="Phone"
                  value={refForm.refereePhone}
                  onChange={(e) => setRefForm((f) => ({ ...f, refereePhone: e.target.value }))}
                  data-testid="input-ref-phone"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Occupation</Label>
                <Input
                  placeholder="Occupation"
                  value={refForm.jobTitle}
                  onChange={(e) => setRefForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  data-testid="input-ref-occupation"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">How Long Known</Label>
                <Input
                  placeholder="How Long Known"
                  value={refForm.howLongKnown}
                  onChange={(e) => setRefForm((f) => ({ ...f, howLongKnown: e.target.value }))}
                  data-testid="input-ref-how-long-known"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relation with you</Label>
              <Input
                placeholder="Relation"
                value={refForm.relationship}
                onChange={(e) => setRefForm((f) => ({ ...f, relationship: e.target.value }))}
                data-testid="input-ref-relationship"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefOpen(false)} data-testid="button-cancel-reference">
              Close
            </Button>
            <Button
              onClick={() => (editingRefId ? editRef.mutate() : addRef.mutate())}
              disabled={refSaving || !refForm.refereeName.trim() || !looksLikeEmail(refForm.refereeEmail)}
              data-testid="button-save-reference"
            >
              {refSaving ? "Saving..." : editingRefId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HealthTab({ employeeId, health }: { employeeId: number; health: any }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of HEALTH_PROFILE_FIELDS) init[f.key] = health?.[f.key] || "";
    for (const f of HEALTH_FIELDS) init[f.key] = health?.[f.key] || "";
    return init;
  });
  const handlers = useEmpMutation(employeeId, "Health saved");

  const saveMut = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/admin/employees/${employeeId}/health`, form),
    ...handlers,
  });

  const mid = Math.ceil(HEALTH_FIELDS.length / 2);
  const left = HEALTH_FIELDS.slice(0, mid);
  const right = HEALTH_FIELDS.slice(mid);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save health</Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Physical profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HEALTH_PROFILE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                value={form[f.key] || ""}
                placeholder={f.placeholder}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                data-testid={`input-health-${f.key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Health information</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {left.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 border-b border-muted py-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Select value={form[f.key] || "EMPTY"} onValueChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v === "EMPTY" ? "" : v }))}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPTY">EMPTY</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">User appearance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {right.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 border-b border-muted py-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Select value={form[f.key] || "EMPTY"} onValueChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v === "EMPTY" ? "" : v }))}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPTY">EMPTY</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VettingHubTab({ employee }: { employee: any }) {
  const employeeId = employee.id;
  const { toast } = useToast();
  const handlers = useEmpMutation(employeeId, "Updated");
  const unlockMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/employees/${employeeId}/p-form/unlock`),
    ...handlers,
  });
  const finishMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/employees/${employeeId}/p-form/finish`),
    ...handlers,
  });

  const [veOpen, setVeOpen] = useState(false);
  const [veTarget, setVeTarget] = useState<any>(null);
  const [veKind, setVeKind] = useState<"employment" | "personal">("employment");
  const [veForm, setVeForm] = useState({
    confirmedFrom: "",
    confirmedTo: "",
    screeningComments: "",
    confirmedVerbally: false,
  });

  const [sendOpen, setSendOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<any>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendMode, setSendMode] = useState<"one" | "all">("one");
  const [sendKind, setSendKind] = useState<"employment" | "personal">("employment");
  const [formLinkOpen, setFormLinkOpen] = useState(false);
  const [formLinkEmail, setFormLinkEmail] = useState(employee.email || "");

  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ code: "VE", action: "", details: "" });

  const { data: tenantProfile } = useQuery<any>({
    queryKey: ["/api/tenant/profile"],
  });
  const { data: vettingDocsMeta } = useQuery<{
    forms: Array<{ code: string; label: string; category: string; format: string; downloadable: boolean }>;
    hrSignatoryConfigured: boolean;
    companyConfigured: boolean;
  }>({
    queryKey: ["/api/admin/employees", employeeId, "vetting-documents"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/vetting-documents`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load vetting documents");
      }
      return res.json();
    },
  });
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);
  const [downloadingRefPdf, setDownloadingRefPdf] = useState<number | null>(null);

  const downloadReferencePdf = async (id: number, kind: "employment" | "personal" = "employment") => {
    setDownloadingRefPdf(id);
    try {
      const pathSegment = kind === "personal" ? "references" : "employment-history";
      const res = await fetch(`/api/admin/employees/${employeeId}/${pathSegment}/${id}/reference-pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Download failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `Reference-Confirmation-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: filename });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingRefPdf(null);
    }
  };

  const downloadVettingDoc = async (code: string, format?: "pdf" | "docx") => {
    setDownloadingForm(`${code}${format || "docx"}`);
    try {
      const qs = format === "pdf" ? "?format=pdf" : "";
      const res = await fetch(`/api/admin/employees/${employeeId}/vetting-documents/${code}${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Download failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `${code}.${format === "pdf" ? "pdf" : "docx"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: filename });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingForm(null);
    }
  };
  const { data: emailConnection } = useQuery<{
    connected?: boolean;
    connectedEmail?: string | null;
    connectionStatus?: string;
  }>({
    queryKey: ["/api/email-command/connection"],
  });
  const tenantBrand =
    (tenantProfile?.tradingName || tenantProfile?.name || "").trim() || "your company";
  const mailboxLabel = emailConnection?.connected
    ? (emailConnection.connectedEmail || "connected Outlook mailbox")
    : null;

  const openVerbalEnquiry = (row: any, kind: "employment" | "personal" = "employment") => {
    setVeKind(kind);
    setVeTarget(row);
    setVeForm({
      confirmedFrom: row.confirmedFrom || row.dateFrom || "",
      confirmedTo: row.confirmedTo || row.dateTo || "",
      screeningComments: row.screeningComments || "",
      confirmedVerbally: row.verificationStatus === "verified",
    });
    setVeOpen(true);
  };

  const openSendOne = (row: any, kind: "employment" | "personal" = "employment") => {
    setSendKind(kind);
    setSendMode("one");
    setSendTarget(row);
    setSendEmail(looksLikeEmail(row.refereeEmail) ? row.refereeEmail || "" : "");
    setSendOpen(true);
  };

  const openSendAll = (kind: "employment" | "personal" = "employment") => {
    setSendKind(kind);
    setSendMode("all");
    setSendTarget(null);
    setSendEmail("");
    setSendOpen(true);
  };

  const openFormLinkDialog = () => {
    setFormLinkEmail(employee.email || "");
    setFormLinkOpen(true);
  };

  const verbalMut = useMutation({
    mutationFn: async () => {
      const base = veKind === "personal" ? "references" : "employment-history";
      await apiRequest(
        "POST",
        `/api/admin/employees/${employeeId}/${base}/${veTarget.id}/verbal-enquiry`,
        veForm,
      );
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setVeOpen(false);
      toast({ title: "Verbal Enquiry recorded" });
    },
    onError: (err: Error) => toast({ title: "Verbal Enquiry failed", description: err.message, variant: "destructive" }),
  });

  const sendOneMut = useMutation({
    mutationFn: async ({ id, refereeEmail }: { id: number; refereeEmail: string }) => {
      const base = sendKind === "personal" ? "references" : "employment-history";
      await apiRequest(
        "POST",
        `/api/admin/employees/${employeeId}/${base}/${id}/send-verification`,
        { refereeEmail },
      );
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setSendOpen(false);
      toast({ title: "Reference verification email sent", description: `Sent as ${tenantBrand}` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendAllMut = useMutation({
    mutationFn: async () => {
      const base = sendKind === "personal" ? "references" : "employment-history";
      const res = await apiRequest(
        "POST",
        `/api/admin/employees/${employeeId}/${base}/send-all-verifications`,
      );
      return res.json();
    },
    onSuccess: (data: { sent: number; results: { ok: boolean; employerName?: string; refereeName?: string; error?: string }[] }) => {
      invalidateEmployee(employeeId);
      setSendOpen(false);
      const failed = (data.results || []).filter((r) => !r.ok);
      const noun = sendKind === "personal" ? "personal reference" : "employment reference";
      toast({
        title: `Sent ${data.sent} ${noun} request(s) as ${tenantBrand}`,
        description: failed.length
          ? failed.map((f) => `${f.employerName || f.refereeName}: ${f.error}`).join("; ")
          : undefined,
        variant: failed.length && data.sent === 0 ? "destructive" : "default",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendFormLinkMut = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/employees/${employeeId}/vetting-form/send-link`,
        { to },
      );
      return res.json();
    },
    onSuccess: (data: { expiresAt: string; sentTo: string; formUrl?: string }) => {
      setFormLinkOpen(false);
      const expiry = formatDate(data.expiresAt);
      toast({
        title: "Application form link sent",
        description: `Sent to ${data.sentTo} as ${tenantBrand}. Link expires ${expiry}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const submitSend = () => {
    if (sendMode === "all") {
      sendAllMut.mutate();
      return;
    }
    const email = sendEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Referee email required", description: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (!sendTarget?.id) return;
    sendOneMut.mutate({ id: sendTarget.id, refereeEmail: email });
  };

  const submitFormLink = () => {
    const email = formLinkEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Recipient email required", description: "Enter a valid email address", variant: "destructive" });
      return;
    }
    sendFormLinkMut.mutate(email);
  };

  const logAuditMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/employees/${employeeId}/vetting-audit`, {
        code: logForm.code,
        action: logForm.action.trim(),
        details: logForm.details.trim() || null,
      });
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setLogOpen(false);
      setLogForm({ code: "VE", action: "", details: "" });
      toast({ title: "Event logged" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const records = employee.vettingRecords || [];
  const audit = employee.vettingAudit || [];
  const pForm = employee.pForm;
  const personalRefs = (employee.references || []).filter((r: any) => (r.referenceKind || "personal") === "personal");
  const employment = employee.employmentHistory || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 flex-1">
          <Button size="sm" variant="outline" onClick={() => unlockMut.mutate()} disabled={unlockMut.isPending}>
            <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock PForm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadVettingDoc("sf01")}
            disabled={!!downloadingForm}
            data-testid="button-application-form-download"
          >
            {downloadingForm === "sf01docx" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 mr-1" />
            )}
            Application Form
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={employment.length === 0}
            onClick={() => {
              if (employment[0]) openVerbalEnquiry(employment[0]);
            }}
            data-testid="button-employment-verbal-enquiry"
          >
            <Phone className="w-3.5 h-3.5 mr-1" /> Verbal Enquiry
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={employment.length === 0 || sendAllMut.isPending}
            onClick={() => openSendAll("employment")}
            data-testid="button-send-employment-verification"
          >
            <Send className="w-3.5 h-3.5 mr-1" /> Send for Employment Reference Verification
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={sendFormLinkMut.isPending}
            onClick={openFormLinkDialog}
            data-testid="button-send-vetting-form-link"
          >
            <Mail className="w-3.5 h-3.5 mr-1" /> Email Application Form
          </Button>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <Badge variant="secondary" className="capitalize">P Form: {pForm?.status || "locked"}</Badge>
          <Button size="sm" onClick={() => finishMut.mutate()} disabled={finishMut.isPending}>
            <FileCheck className="w-3.5 h-3.5 mr-1" /> Mark P Form Finished
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-sm" data-testid="card-vetting-documents">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1F3A5F]" />
                Screening &amp; Vetting Documents
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-filled from company profile
                {(tenantProfile?.name ? ` (${tenantProfile.tradingName || tenantProfile.name})` : "")}
                {vettingDocsMeta && !vettingDocsMeta.hrSignatoryConfigured && (
                  <span className="text-amber-600"> — set HR signatory in Company Profile for signed certificates</span>
                )}
              </p>
            </div>
            {vettingDocsMeta?.forms?.some((f) => f.code === "sf17") && (
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!downloadingForm}
                  onClick={() => downloadVettingDoc("sf17", "docx")}
                  data-testid="button-sf17-docx"
                >
                  {downloadingForm === "sf17docx" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                  SF 17 Word
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
                  disabled={!!downloadingForm}
                  onClick={() => downloadVettingDoc("sf17", "pdf")}
                  data-testid="button-sf17-pdf"
                >
                  {downloadingForm === "sf17pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                  SF 17 PDF
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!vettingDocsMeta ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : vettingDocsMeta.forms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No document templates available</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {vettingDocsMeta.forms.map((form) => (
                <div
                  key={form.code}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  data-testid={`vetting-doc-row-${form.code}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{form.label}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{form.category.replace(/_/g, " ")}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-8 px-2"
                    disabled={!form.downloadable || !!downloadingForm}
                    onClick={() => downloadVettingDoc(form.code)}
                    data-testid={`button-download-${form.code}`}
                  >
                    {downloadingForm === `${form.code}docx` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Personal references</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={personalRefs.length === 0 || sendAllMut.isPending}
              onClick={() => openSendAll("personal")}
              data-testid="button-send-personal-reference-verification"
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Send for verification
            </Button>
            <Badge variant="outline" className="text-[10px] font-medium">{personalRefs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {personalRefs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No personal references yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add them under the Background tab</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-left border-b">
                    <th className="py-2 pr-2 font-medium">Requested</th>
                    <th className="py-2 pr-2 font-medium">Requests</th>
                    <th className="py-2 pr-2 font-medium">Referee</th>
                    <th className="py-2 pr-2 font-medium">Phone</th>
                    <th className="py-2 pr-2 font-medium">Email</th>
                    <th className="py-2 pr-2 font-medium">Info supplied</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {personalRefs.map((r: any, idx: number) => (
                    <tr key={r.id} className={`border-b border-border/50 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className="py-2.5 pr-2">{formatDate(r.requestedDate)}</td>
                      <td className="py-2.5 pr-2">{r.requestCount ?? 0}</td>
                      <td className="py-2.5 pr-2 font-medium">
                        {r.refereeName}
                        {r.verificationStatus === "verified" && (
                          <Badge className="ml-1.5 h-4 text-[9px]" variant="default">Verified</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-muted-foreground">{r.refereePhone || "—"}</td>
                      <td className="py-2.5 pr-2 text-muted-foreground">{r.refereeEmail || "—"}</td>
                      <td className="py-2.5 pr-2">{r.infoSupplied == null ? "—" : r.infoSupplied ? "YES" : "NO"}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5 w-fit">
                          {r.hasReferenceConfirmationPdf ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Download confirmation PDF"
                              disabled={downloadingRefPdf === r.id}
                              onClick={() => downloadReferencePdf(r.id, "personal")}
                              data-testid={`button-download-pref-pdf-${r.id}`}
                            >
                              {downloadingRefPdf === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Verbal Enquiry"
                                onClick={() => openVerbalEnquiry(r, "personal")}
                                data-testid={`button-pref-ve-${r.id}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Send for Personal Reference Verification"
                                disabled={sendOneMut.isPending}
                                onClick={() => openSendOne(r, "personal")}
                                data-testid={`button-send-pref-${r.id}`}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Employment references</CardTitle>
          <Badge variant="outline" className="text-[10px] font-medium">{employment.length}</Badge>
        </CardHeader>
        <CardContent>
          {employment.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No employment history yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add under Background — include referee email/phone for verification send</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-left border-b">
                    <th className="py-2 pr-2 font-medium">Requested</th>
                    <th className="py-2 pr-2 font-medium">Requests</th>
                    <th className="py-2 pr-2 font-medium">Company</th>
                    <th className="py-2 pr-2 font-medium">Phone</th>
                    <th className="py-2 pr-2 font-medium">Email</th>
                    <th className="py-2 pr-2 font-medium">From</th>
                    <th className="py-2 pr-2 font-medium">To</th>
                    <th className="py-2 pr-2 font-medium">Confirmed</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employment.map((e: any, idx: number) => (
                    <tr key={e.id} className={`border-b border-border/50 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className="py-2.5 pr-2">{formatDate(e.requestedDate)}</td>
                      <td className="py-2.5 pr-2">{e.requestCount ?? 0}</td>
                      <td className="py-2.5 pr-2 font-medium">{e.employerName}</td>
                      <td className="py-2.5 pr-2 text-muted-foreground">{e.refereePhone || "—"}</td>
                      <td className="py-2.5 pr-2 text-muted-foreground">{e.refereeEmail || "—"}</td>
                      <td className="py-2.5 pr-2">{formatDate(e.dateFrom)}</td>
                      <td className="py-2.5 pr-2">{formatDate(e.dateTo)}</td>
                      <td className="py-2.5 pr-2">
                        <span className="text-muted-foreground">{formatDate(e.confirmedFrom)} – {formatDate(e.confirmedTo)}</span>
                        {e.verificationStatus === "verified" && (
                          <Badge className="ml-1.5 h-4 text-[9px]" variant="default">Verified</Badge>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5 w-fit">
                          {e.hasReferenceConfirmationPdf ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Download confirmation PDF"
                              disabled={downloadingRefPdf === e.id}
                              onClick={() => downloadReferencePdf(e.id)}
                              data-testid={`button-download-ref-pdf-${e.id}`}
                            >
                              {downloadingRefPdf === e.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Verbal Enquiry"
                                onClick={() => openVerbalEnquiry(e)}
                                data-testid={`button-ve-${e.id}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Send for Employment Reference Verification"
                                disabled={sendOneMut.isPending}
                                onClick={() => openSendOne(e)}
                                data-testid={`button-send-ref-${e.id}`}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sendKind === "personal"
                ? (sendMode === "all"
                    ? "Send personal reference verifications"
                    : `Send personal reference — ${sendTarget?.refereeName || ""}`)
                : (sendMode === "all"
                    ? "Send employment reference verifications"
                    : `Send employment reference — ${sendTarget?.employerName || ""}`)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sent using your <strong>tenant email settings</strong> (Settings → Integrations → Email / SMTP)
              as <strong>{tenantBrand}</strong>
              {tenantProfile?.email ? ` — replies to ${tenantProfile.email}` : ""}.
              {mailboxLabel ? <> Outlook mailbox available: <strong>{mailboxLabel}</strong>.</> : null}
            </p>
            {sendMode === "one" ? (
              <div>
                <Label className="text-xs">Referee email</Label>
                <Input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder={sendKind === "personal" ? "referee@example.com" : "hr@employer.com"}
                  data-testid="input-referee-email-send"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Saved on the {sendKind === "personal" ? "reference" : "employment"} record if different from the current value.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sends to every {sendKind === "personal" ? "personal reference" : "employment"} row that already has a referee email.
                Rows without an email are skipped — use the paper-plane icon on those rows to enter an email first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button
              onClick={submitSend}
              disabled={sendOneMut.isPending || sendAllMut.isPending}
              data-testid="button-confirm-send-ref"
            >
              {(sendOneMut.isPending || sendAllMut.isPending) ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formLinkOpen} onOpenChange={setFormLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email application form link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sends a secure link to complete the vetting application online (Application Form, Equal Ops Review,
              Zero Hours Contract, and Code of Conduct). The link expires in <strong>3 days</strong> and can be edited until then.
              Sent as <strong>{tenantBrand}</strong>
              {tenantProfile?.email ? ` — replies to ${tenantProfile.email}` : ""}.
              {mailboxLabel ? <> Outlook mailbox available: <strong>{mailboxLabel}</strong>.</> : null}
            </p>
            <div>
              <Label className="text-xs">Recipient email</Label>
              <Input
                type="email"
                value={formLinkEmail}
                onChange={(e) => setFormLinkEmail(e.target.value)}
                placeholder="employee@example.com"
                data-testid="input-vetting-form-link-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormLinkOpen(false)}>Cancel</Button>
            <Button
              onClick={submitFormLink}
              disabled={sendFormLinkMut.isPending}
              data-testid="button-confirm-send-vetting-form-link"
            >
              {sendFormLinkMut.isPending ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={veOpen} onOpenChange={setVeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Verbal Enquiry — {veKind === "personal" ? (veTarget?.refereeName || "Personal reference") : (veTarget?.employerName || "Employment")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Log a telephone screening call (VE). Tick Confirmed Verbally to mark the {veKind === "personal" ? "personal reference" : "work reference"} verified (CV{veKind === "personal" ? "" : " / WR"}).
            </p>
            {veKind === "employment" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Confirmed dates from</Label>
                  <Input
                    type="date"
                    value={veForm.confirmedFrom}
                    onChange={(e) => setVeForm((f) => ({ ...f, confirmedFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Confirmed dates to</Label>
                  <Input
                    type="date"
                    value={veForm.confirmedTo}
                    onChange={(e) => setVeForm((f) => ({ ...f, confirmedTo: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Comments</Label>
              <Textarea
                rows={3}
                value={veForm.screeningComments}
                onChange={(e) => setVeForm((f) => ({ ...f, screeningComments: e.target.value }))}
                placeholder="Notes from the call..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={veForm.confirmedVerbally}
                onChange={(e) => setVeForm((f) => ({ ...f, confirmedVerbally: e.target.checked }))}
              />
              Confirmed verbally (mark {veKind === "personal" ? "personal" : "work"} reference verified)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVeOpen(false)}>Cancel</Button>
            <Button onClick={() => verbalMut.mutate()} disabled={verbalMut.isPending}>
              {verbalMut.isPending ? "Saving..." : "Save Verbal Enquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Vetting checks</CardTitle>
          <Badge variant="outline" className="text-[10px] font-medium">{records.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No vetting records yet</p>
              <p className="text-xs text-muted-foreground mt-1">Use /vetting to initiate checks</p>
            </div>
          ) : records.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border border-border/60 bg-muted/10 p-3">
              <div>
                <div className="font-medium">{r.checkType}</div>
                <div className="text-xs text-muted-foreground">Req {formatDate(r.requestedDate)} · Done {formatDate(r.completedDate)}</div>
              </div>
              <Badge variant="outline">{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold">Audit trail</CardTitle>
            <Badge variant="outline" className="text-[10px] font-medium">{audit.length}</Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              setLogForm({ code: "VE", action: "", details: "" });
              setLogOpen(true);
            }}
            data-testid="button-add-audit-event"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Event
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {audit.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No audit trail events yet</p>
              <p className="text-xs text-muted-foreground mt-1">Log an event or they appear as vetting actions are performed</p>
            </div>
          ) : (
            <div className="relative space-y-0 pl-1">
              {audit.map((a: any) => (
                <div key={a.id} className="flex gap-3 text-sm py-3 border-b border-border/40 last:border-0">
                  <div className="text-[11px] text-muted-foreground w-24 shrink-0 pt-0.5">{formatDate(a.createdAt)}</div>
                  <div className={`h-6 min-w-[2rem] px-1.5 rounded-md text-[10px] font-bold text-white flex items-center justify-center shrink-0 ${
                    AUDIT_LEGEND.find((l) => l.code === a.code)?.color || "bg-slate-600"
                  }`}>
                    {a.code}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{a.action}</div>
                    {a.details && <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-4">
            {AUDIT_LEGEND.map((l) => (
              <div
                key={l.code}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${l.color}`} />
                <span className="font-semibold text-foreground">{l.code}</span>
                {l.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log audit event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Code *</Label>
              <Select
                value={logForm.code}
                onValueChange={(v) => {
                  const legend = AUDIT_LEGEND.find((l) => l.code === v);
                  setLogForm((f) => ({
                    ...f,
                    code: v,
                    action: f.action.trim() ? f.action : (legend?.label || ""),
                  }));
                }}
              >
                <SelectTrigger data-testid="select-audit-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_LEGEND.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.code} — {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Action *</Label>
              <Input
                value={logForm.action}
                onChange={(e) => setLogForm((f) => ({ ...f, action: e.target.value }))}
                placeholder="Brief description of the event"
                data-testid="input-audit-title"
              />
            </div>
            <div>
              <Label className="text-xs">Details</Label>
              <Textarea
                rows={3}
                value={logForm.details}
                onChange={(e) => setLogForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Additional details..."
                data-testid="input-audit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => logAuditMut.mutate()}
              disabled={logAuditMut.isPending || !logForm.code || !logForm.action.trim()}
              data-testid="button-submit-audit-event"
            >
              {logAuditMut.isPending ? "Saving..." : "Log Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EMPLOYEE_DOCUMENT_TYPES = [
  "passport", "visa", "brp", "right_to_work", "sia_licence",
  "dbs_certificate", "first_aid", "driving_licence", "proof_of_address",
  "contract", "training_certificate", "other",
];

function formatDocType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Sia/g, "SIA")
    .replace(/Dbs/g, "DBS")
    .replace(/Brp/g, "BRP");
}

async function uploadFileToStorage(file: File): Promise<string> {
  const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  });
  const data = await urlRes.json();
  if (data.useDirectUpload || !data.uploadURL) {
    const directRes = await fetch("/api/uploads/upload", {
      method: "POST",
      headers: {
        "X-File-Name": file.name,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
      credentials: "include",
    });
    const direct = await directRes.json();
    if (!directRes.ok) throw new Error(direct.error || direct.message || "Upload failed");
    return direct.objectPath;
  }
  const uploadRes = await fetch(data.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!uploadRes.ok) throw new Error("Failed to upload file to storage");
  return data.objectPath;
}

export function DocsHubTab({ employeeId, documents, employeeEmail }: { employeeId: number; documents: any[]; employeeEmail?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDocTypes, setRequestDocTypes] = useState<string[]>([]);
  const [requestTo, setRequestTo] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  const handlers = useEmpMutation(employeeId, "Document verified");
  const verifyMut = useMutation({
    mutationFn: async (docId: number) => apiRequest("POST", `/api/admin/employees/${employeeId}/documents/${docId}/verify`),
    ...handlers,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      if (!documentType) throw new Error("Document type required");
      const objectPath = await uploadFileToStorage(selectedFile);
      await apiRequest("POST", `/api/admin/employees/${employeeId}/documents`, {
        documentType,
        fileName: selectedFile.name,
        fileUrl: objectPath,
        mimeType: selectedFile.type || null,
        fileSize: selectedFile.size,
        expiryDate: expiryDate || null,
      });
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setOpen(false);
      setDocumentType("");
      setSelectedFile(null);
      setExpiryDate("");
      toast({ title: "Document uploaded" });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const requestMut = useMutation({
    mutationFn: async () => {
      if (requestDocTypes.length === 0) throw new Error("Select at least one document type");
      const res = await apiRequest("POST", `/api/admin/employees/${employeeId}/documents/request`, {
        documentTypes: requestDocTypes,
        message: requestMessage.trim() || undefined,
        to: requestTo.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setRequestOpen(false);
      setRequestDocTypes([]);
      setRequestMessage("");
      toast({ title: "Document request sent", description: `Emailed ${data.sentTo || "employee"}` });
    },
    onError: (err: Error) => toast({ title: "Failed to send request", description: err.message, variant: "destructive" }),
  });

  const toggleRequestDocType = (type: string) => {
    setRequestDocTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRequestTo(employeeEmail || "");
            setRequestOpen(true);
          }}
          data-testid="button-request-employee-document"
        >
          <Mail className="w-3.5 h-3.5 mr-1" /> Request Document
        </Button>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          data-testid="button-upload-employee-document"
        >
          <Upload className="w-3.5 h-3.5 mr-1" /> Upload Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
            <p className="text-xs text-muted-foreground mt-1">Upload passport, SIA, DBS, contracts, and other compliance files</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-border/70 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{doc.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDocType(doc.documentType)} · Exp {formatDate(doc.expiryDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.isVerified ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>
                  ) : (
                    <>
                      <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                      <Button size="sm" variant="outline" onClick={() => verifyMut.mutate(doc.id)} disabled={verifyMut.isPending}>Verify</Button>
                    </>
                  )}
                  {doc.fileUrl && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Document type *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{formatDocType(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">File *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="input-employee-doc-file"
              />
              {selectedFile && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Expiry date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                data-testid="input-employee-doc-expiry"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => uploadMut.mutate()}
              disabled={uploadMut.isPending || !selectedFile || !documentType}
              data-testid="button-submit-employee-document"
            >
              {uploadMut.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request document from employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Document type(s) * — select one or more</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5 rounded-md border border-border/60 p-2.5 max-h-48 overflow-y-auto">
                {EMPLOYEE_DOCUMENT_TYPES.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 text-sm cursor-pointer select-none"
                    data-testid={`checkbox-request-document-type-${t}`}
                  >
                    <Checkbox
                      checked={requestDocTypes.includes(t)}
                      onCheckedChange={() => toggleRequestDocType(t)}
                    />
                    {formatDocType(t)}
                  </label>
                ))}
              </div>
              {requestDocTypes.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Selected: {requestDocTypes.map(formatDocType).join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Send to *</Label>
              <Input
                type="email"
                value={requestTo}
                onChange={(e) => setRequestTo(e.target.value)}
                placeholder="employee@example.com"
                data-testid="input-request-document-email"
              />
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Add any extra context for the employee..."
                data-testid="textarea-request-document-message"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The employee will receive an email with a link to their My Documents page to upload this file.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestMut.mutate()}
              disabled={requestMut.isPending || requestDocTypes.length === 0 || !requestTo.trim()}
              data-testid="button-submit-request-document"
            >
              {requestMut.isPending ? "Sending..." : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BankDetailsTab({ employee }: { employee: any }) {
  const employeeId = employee.id;
  const bankDetails = employee.bankDetails;
  const pendingChanges: any[] = employee.pendingBankChanges || [];
  const pending = pendingChanges.find((c) => c.status === "pending");
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    accountName: "",
    bankName: "",
    sortCode: "",
    accountNumber: "",
    buildingSocietyRef: "",
  });

  const syncForm = () => {
    setForm({
      accountName: bankDetails?.accountName || "",
      bankName: bankDetails?.bankName || "",
      sortCode: bankDetails?.sortCode || "",
      accountNumber: bankDetails?.accountNumber || "",
      buildingSocietyRef: bankDetails?.buildingSocietyRef || "",
    });
  };

  useEffect(() => {
    if (!editing) syncForm();
  }, [employee.bankDetails, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/employees/${employeeId}/bank-details`, form);
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setEditing(false);
      toast({ title: "Bank details saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: async (changeId: number) => {
      await apiRequest("POST", `/api/admin/pending-bank-changes/${changeId}/approve`, {});
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      toast({ title: "Bank change approved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: async (changeId: number) => {
      await apiRequest("POST", `/api/admin/pending-bank-changes/${changeId}/reject`, { note: "Rejected from employee profile" });
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      toast({ title: "Bank change rejected" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const displayValue = (value: string | null | undefined) => {
    if (!value?.trim()) return <span className="text-muted-foreground font-normal">Not set</span>;
    return value;
  };

  const FieldRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid grid-cols-[minmax(9rem,11rem)_1fr] gap-3 items-center py-2.5 border-b border-border/50 last:border-0">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm font-medium min-w-0">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {pending && (
        <Card className="border-amber-300/60 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Pending bank details change</p>
                <p className="text-xs text-amber-800 mt-1">
                  {pending.bankName} · {pending.accountName} · Sort {pending.sortCode} · Account ****{String(pending.accountNumber).slice(-4)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approveMut.mutate(pending.id)} disabled={approveMut.isPending || rejectMut.isPending} data-testid="button-approve-bank-change">
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => rejectMut.mutate(pending.id)} disabled={approveMut.isPending || rejectMut.isPending} data-testid="button-reject-bank-change">
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            Bank details
          </CardTitle>
          {!editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { syncForm(); setEditing(true); }}
              data-testid="button-edit-bank-details"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" /> {bankDetails ? "Edit" : "Add"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.accountName || !form.bankName || !form.sortCode || !form.accountNumber}
                data-testid="button-save-bank-details"
              >
                {saveMut.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-1">
          {!editing ? (
            bankDetails ? (
              <div>
                <FieldRow label="Account name">{displayValue(bankDetails.accountName)}</FieldRow>
                <FieldRow label="Bank name">{displayValue(bankDetails.bankName)}</FieldRow>
                <FieldRow label="Sort code">{displayValue(bankDetails.sortCode)}</FieldRow>
                <FieldRow label="Account number">{displayValue(bankDetails.accountNumber)}</FieldRow>
                <FieldRow label="Building society ref">{displayValue(bankDetails.buildingSocietyRef)}</FieldRow>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
                <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bank details on file</p>
                <p className="text-xs text-muted-foreground mt-1">Add account details for payroll processing</p>
              </div>
            )
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs">Account name *</Label>
                <Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} data-testid="input-bank-account-name" />
              </div>
              <div>
                <Label className="text-xs">Bank name *</Label>
                <Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} data-testid="input-bank-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sort code *</Label>
                  <Input value={form.sortCode} onChange={(e) => setForm((f) => ({ ...f, sortCode: e.target.value }))} placeholder="00-00-00" data-testid="input-sort-code" />
                </div>
                <div>
                  <Label className="text-xs">Account number *</Label>
                  <Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} data-testid="input-account-number" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Building society ref</Label>
                <Input value={form.buildingSocietyRef} onChange={(e) => setForm((f) => ({ ...f, buildingSocietyRef: e.target.value }))} data-testid="input-building-society-ref" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingChanges.filter((c) => c.status !== "pending").length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Change history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingChanges.filter((c) => c.status !== "pending").slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border border-border/60 bg-muted/10 p-3">
                <div>
                  <div className="font-medium">{c.bankName} · ****{String(c.accountNumber).slice(-4)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</div>
                </div>
                <Badge variant={c.status === "approved" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ImmigrationTab({ employee }: { employee: any }) {
  const employeeId = employee.id;
  const immigration = employee.immigration || {};
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    passportDocNo: "",
    passportCountry: "",
    passportIssueDate: "",
    passportExpiryDate: "",
    visaNeeded: "NO",
    brpNeeded: "NO",
    brpNumber: "",
    brpExpiry: "",
    shareCode: "",
    shareCodeExpiry: "",
    visaType: "",
    visaIssueDate: "",
    visaExpiryDate: "",
    visaDateOfEntry: "",
  });

  const syncForm = () => {
    setForm({
      passportDocNo: immigration.passportDocNo || "",
      passportCountry: immigration.passportCountry || "",
      passportIssueDate: (immigration.passportIssueDate || "").toString().slice(0, 10),
      passportExpiryDate: (immigration.passportExpiryDate || "").toString().slice(0, 10),
      visaNeeded: immigration.visaNeeded ? "YES" : "NO",
      brpNeeded: immigration.brpNeeded ? "YES" : "NO",
      brpNumber: immigration.brpNumber || "",
      brpExpiry: (immigration.brpExpiry || "").toString().slice(0, 10),
      shareCode: immigration.shareCode || "",
      shareCodeExpiry: (immigration.shareCodeExpiry || "").toString().slice(0, 10),
      visaType: immigration.visaType || "",
      visaIssueDate: (immigration.visaIssueDate || "").toString().slice(0, 10),
      visaExpiryDate: (immigration.visaExpiryDate || "").toString().slice(0, 10),
      visaDateOfEntry: (immigration.visaDateOfEntry || "").toString().slice(0, 10),
    });
  };

  useEffect(() => {
    if (!editing) syncForm();
  }, [employee.immigration, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/employees/${employeeId}/immigration`, {
        passportDocNo: form.passportDocNo || null,
        passportCountry: form.passportCountry || null,
        passportIssueDate: form.passportIssueDate || null,
        passportExpiryDate: form.passportExpiryDate || null,
        visaNeeded: form.visaNeeded === "YES",
        brpNeeded: form.brpNeeded === "YES",
        brpNumber: form.brpNumber || null,
        brpExpiry: form.brpExpiry || null,
        shareCode: form.shareCode || null,
        shareCodeExpiry: form.shareCodeExpiry || null,
        visaType: form.visaType || null,
        visaIssueDate: form.visaIssueDate || null,
        visaExpiryDate: form.visaExpiryDate || null,
        visaDateOfEntry: form.visaDateOfEntry || null,
      });
    },
    onSuccess: () => {
      invalidateEmployee(employeeId);
      setEditing(false);
      toast({ title: "Immigration details saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const displayValue = (value: string | null | undefined, emptyLabel = "Not set") => {
    if (value == null || String(value).trim() === "") {
      return <span className="text-amber-700 italic font-normal">{emptyLabel}</span>;
    }
    return value;
  };

  const FieldRow = ({
    label,
    children,
  }: {
    label: string;
    children: ReactNode;
  }) => (
    <div className="grid grid-cols-[minmax(9rem,11rem)_1fr] gap-3 items-center py-2.5 border-b border-border/50 last:border-0">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm font-medium min-w-0">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Passport / ID Card
          </CardTitle>
          {!editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                syncForm();
                setEditing(true);
              }}
              data-testid="button-edit-immigration"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                data-testid="button-save-immigration"
              >
                {saveMut.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-1">
          {!editing ? (
            <div>
              <FieldRow label="Document No">{displayValue(immigration.passportDocNo)}</FieldRow>
              <FieldRow label="Country of Issue">{displayValue(immigration.passportCountry)}</FieldRow>
              <FieldRow label="Date of Issue">{displayValue(formatDate(immigration.passportIssueDate) === "—" ? "" : formatDate(immigration.passportIssueDate))}</FieldRow>
              <FieldRow label="Date of Expiry">{displayValue(formatDate(immigration.passportExpiryDate) === "—" ? "" : formatDate(immigration.passportExpiryDate))}</FieldRow>
              <FieldRow label="Visa Needed">{immigration.visaNeeded ? "YES" : "NO"}</FieldRow>
              <FieldRow label="BRP Needed">{immigration.brpNeeded ? "YES" : "NO"}</FieldRow>
              <FieldRow label="BRP Number">{displayValue(immigration.brpNumber)}</FieldRow>
              <FieldRow label="BRP Exp">{displayValue(formatDate(immigration.brpExpiry) === "—" ? "" : formatDate(immigration.brpExpiry))}</FieldRow>
              <FieldRow label="Share Code">{displayValue(immigration.shareCode)}</FieldRow>
              <FieldRow label="Share Code Exp">{displayValue(formatDate(immigration.shareCodeExpiry) === "—" ? "" : formatDate(immigration.shareCodeExpiry))}</FieldRow>
            </div>
          ) : (
            <div className="space-y-0">
              <FieldRow label="Document No">
                <Input
                  value={form.passportDocNo}
                  onChange={(e) => setForm((f) => ({ ...f, passportDocNo: e.target.value }))}
                  data-testid="input-passport-doc-no"
                />
              </FieldRow>
              <FieldRow label="Country of Issue">
                <Input
                  value={form.passportCountry}
                  onChange={(e) => setForm((f) => ({ ...f, passportCountry: e.target.value }))}
                  data-testid="input-passport-country"
                />
              </FieldRow>
              <FieldRow label="Date of Issue">
                <Input
                  type="date"
                  value={form.passportIssueDate}
                  onChange={(e) => setForm((f) => ({ ...f, passportIssueDate: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="Date of Expiry">
                <Input
                  type="date"
                  value={form.passportExpiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, passportExpiryDate: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="Visa Needed">
                <Select value={form.visaNeeded} onValueChange={(v) => setForm((f) => ({ ...f, visaNeeded: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">YES</SelectItem>
                    <SelectItem value="NO">NO</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="BRP Needed">
                <Select value={form.brpNeeded} onValueChange={(v) => setForm((f) => ({ ...f, brpNeeded: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">YES</SelectItem>
                    <SelectItem value="NO">NO</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="BRP Number">
                <Input
                  value={form.brpNumber}
                  onChange={(e) => setForm((f) => ({ ...f, brpNumber: e.target.value }))}
                  data-testid="input-brp-number"
                />
              </FieldRow>
              <FieldRow label="BRP Exp">
                <Input
                  type="date"
                  value={form.brpExpiry}
                  onChange={(e) => setForm((f) => ({ ...f, brpExpiry: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="Share Code">
                <Input
                  value={form.shareCode}
                  onChange={(e) => setForm((f) => ({ ...f, shareCode: e.target.value }))}
                  data-testid="input-share-code"
                />
              </FieldRow>
              <FieldRow label="Share Code Exp">
                <Input
                  type="date"
                  value={form.shareCodeExpiry}
                  onChange={(e) => setForm((f) => ({ ...f, shareCodeExpiry: e.target.value }))}
                />
              </FieldRow>
            </div>
          )}
        </CardContent>
      </Card>

      {(editing || immigration.visaType || immigration.visaIssueDate || immigration.visaExpiryDate || immigration.visaDateOfEntry) && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Visa details</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            {!editing ? (
              <div>
                <FieldRow label="Visa Type">{displayValue(immigration.visaType)}</FieldRow>
                <FieldRow label="Issue Date">{displayValue(formatDate(immigration.visaIssueDate) === "—" ? "" : formatDate(immigration.visaIssueDate))}</FieldRow>
                <FieldRow label="Expiry Date">{displayValue(formatDate(immigration.visaExpiryDate) === "—" ? "" : formatDate(immigration.visaExpiryDate))}</FieldRow>
                <FieldRow label="Date of Entry">{displayValue(formatDate(immigration.visaDateOfEntry) === "—" ? "" : formatDate(immigration.visaDateOfEntry))}</FieldRow>
              </div>
            ) : (
              <div>
                <FieldRow label="Visa Type">
                  <Input value={form.visaType} onChange={(e) => setForm((f) => ({ ...f, visaType: e.target.value }))} />
                </FieldRow>
                <FieldRow label="Issue Date">
                  <Input type="date" value={form.visaIssueDate} onChange={(e) => setForm((f) => ({ ...f, visaIssueDate: e.target.value }))} />
                </FieldRow>
                <FieldRow label="Expiry Date">
                  <Input type="date" value={form.visaExpiryDate} onChange={(e) => setForm((f) => ({ ...f, visaExpiryDate: e.target.value }))} />
                </FieldRow>
                <FieldRow label="Date of Entry">
                  <Input type="date" value={form.visaDateOfEntry} onChange={(e) => setForm((f) => ({ ...f, visaDateOfEntry: e.target.value }))} />
                </FieldRow>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RightOfWorkTab({ employee }: { employee: any }) {
  const employeeId = employee.id;
  const checks = employee.rightOfWorkChecks || [];
  const immigration = employee.immigration;
  const handlers = useEmpMutation(employeeId, "Right of work check recorded");

  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/employees/${employeeId}/right-of-work-checks`, { status: "valid" }),
    ...handlers,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Immigration snapshot</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-xs text-muted-foreground">Share code</span><div>{immigration?.shareCode || "—"}</div></div>
          <div><span className="text-xs text-muted-foreground">Share code exp</span><div>{formatDate(immigration?.shareCodeExpiry)}</div></div>
          <div><span className="text-xs text-muted-foreground">Passport</span><div>{immigration?.passportDocNo || "—"}</div></div>
          <div><span className="text-xs text-muted-foreground">Passport exp</span><div>{formatDate(immigration?.passportExpiryDate)}</div></div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">6-month compliance checks</h3>
        <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Record check
        </Button>
      </div>
      {checks.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No RoW checks yet</CardContent></Card>
      ) : (
        checks.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex justify-between gap-2 text-sm">
              <div>
                <div className="font-medium capitalize">{c.status}</div>
                <div className="text-xs text-muted-foreground">
                  Last upload {formatDate(c.lastUploadAt)} · Next review {formatDate(c.nextReviewAt)}
                </div>
                {c.notes && <div className="text-xs mt-1">{c.notes}</div>}
              </div>
              <Badge variant="outline">{c.status}</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
