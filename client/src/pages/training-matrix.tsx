import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap, Grid3X3, CheckCircle2, XCircle, Clock,
  AlertTriangle, Plus, Users, Search, Loader2
} from "lucide-react";

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
};

type MatrixEmployee = {
  employeeId: number;
  employeeName: string;
  records: Record<string, { status: string; expiryDate: string | null; completedDate: string | null; id: number }>;
};

type MatrixData = {
  trainingTypes: string[];
  employees: MatrixEmployee[];
  totalRecords: number;
};

type AllEmployee = { id: number; firstName: string; lastName: string };

const TRAINING_TYPE_LABELS: Record<string, string> = {
  first_aid: "First Aid",
  manual_handling: "Manual Handling",
  fire_marshal: "Fire Marshal",
  conflict_resolution: "Conflict Resolution",
  sia_refresher: "SIA Refresher",
  custom: "Custom",
};

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function StatusCell({ record }: { record?: { status: string; expiryDate: string | null } }) {
  if (!record) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  const days = getDaysUntilExpiry(record.expiryDate);
  const isExpired = record.status === "expired" || (days !== null && days < 0);
  const isWarning = !isExpired && days !== null && days <= 30;
  const isAmber = !isExpired && !isWarning && days !== null && days <= 90;
  const isCompleted = record.status === "completed" && !isExpired;

  if (record.status === "not_started") {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center" title="Not Started">
          <Clock className="w-3 h-3 text-gray-400" />
        </div>
      </div>
    );
  }
  if (record.status === "in_progress") {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center" title="In Progress">
          <Clock className="w-3 h-3 text-blue-500" />
        </div>
      </div>
    );
  }
  if (isExpired) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-red-100 border border-red-400 flex items-center justify-center" title={`Expired${days !== null ? ` (${Math.abs(days)}d ago)` : ""}`}>
          <XCircle className="w-3 h-3 text-red-500" />
        </div>
      </div>
    );
  }
  if (isWarning) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-red-100 border border-red-400 flex items-center justify-center" title={`Expiring soon (${days}d)`}>
          <AlertTriangle className="w-3 h-3 text-red-500" />
        </div>
      </div>
    );
  }
  if (isAmber) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-400 flex items-center justify-center" title={`Expiring in ${days}d`}>
          <AlertTriangle className="w-3 h-3 text-amber-500" />
        </div>
      </div>
    );
  }
  if (isCompleted) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-green-100 border border-green-400 flex items-center justify-center" title="Completed">
          <CheckCircle2 className="w-3 h-3 text-green-600" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center" title={record.status}>
        <span className="text-xs text-gray-400">?</span>
      </div>
    </div>
  );
}

export default function TrainingMatrixPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [bulkForm, setBulkForm] = useState({
    trainingType: "custom",
    trainingName: "",
    provider: "",
    notes: "",
  });

  const { data: matrixData, isLoading } = useQuery<MatrixData>({
    queryKey: ["/api/admin/training-matrix"],
  });

  const { data: allEmployees = [] } = useQuery<AllEmployee[]>({
    queryKey: ["/api/admin/employees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/employees", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data || []);
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/training-records/bulk-assign", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bulk assign complete", description: `Assigned training to ${data.created} employees` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-matrix"] });
      setShowBulkDialog(false);
      setBulkForm({ trainingType: "custom", trainingName: "", provider: "", notes: "" });
      setSelectedEmployeeIds(new Set());
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredEmployees = (matrixData?.employees || []).filter(e =>
    !searchTerm || e.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const trainingTypes = matrixData?.trainingTypes || [];

  const stats = {
    totalEmployees: matrixData?.employees.length || 0,
    totalRecords: matrixData?.totalRecords || 0,
    completed: (matrixData?.employees || []).reduce((acc, e) =>
      acc + Object.values(e.records).filter(r => r.status === "completed").length, 0),
    expired: (matrixData?.employees || []).reduce((acc, e) =>
      acc + Object.values(e.records).filter(r => r.status === "expired" || (r.expiryDate && getDaysUntilExpiry(r.expiryDate)! < 0)).length, 0),
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEmployeeIds(new Set(allEmployees.map(e => e.id)));
  };

  return (
    <div className="p-6 space-y-6" data-testid="training-matrix-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Grid3X3 className="w-6 h-6 text-primary" />
            Training Matrix
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual grid of employee training completion status across all training types.
          </p>
        </div>
        <Button onClick={() => setShowBulkDialog(true)} data-testid="button-bulk-assign">
          <Users className="w-4 h-4 mr-2" /> Bulk Assign Training
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card data-testid="stat-total-employees">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold">{stats.totalEmployees}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-records">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold">{stats.totalRecords}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-expired">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expired</p>
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search-employees"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-green-100 border border-green-400 flex items-center justify-center"><CheckCircle2 className="w-2.5 h-2.5 text-green-600" /></div> Completed</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-400 flex items-center justify-center"><AlertTriangle className="w-2.5 h-2.5 text-amber-500" /></div> Expiring &lt;90d</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-red-100 border border-red-400 flex items-center justify-center"><XCircle className="w-2.5 h-2.5 text-red-500" /></div> Expired</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center"><Clock className="w-2.5 h-2.5 text-gray-400" /></div> Not Started</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : trainingTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No training records yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Add training records from the employee profile or use Bulk Assign above.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm" data-testid="training-matrix-table">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium sticky left-0 bg-muted/30 min-w-[180px] z-10">Employee</th>
                  {trainingTypes.map(type => (
                    <th key={type} className="p-3 font-medium text-center min-w-[120px]">
                      <span className="text-xs leading-tight block">{TRAINING_TYPE_LABELS[type] || type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr
                    key={emp.employeeId}
                    className={`border-b ${idx % 2 === 0 ? "" : "bg-muted/10"} hover:bg-muted/20 transition-colors`}
                    data-testid={`row-employee-${emp.employeeId}`}
                  >
                    <td className="p-3 font-medium sticky left-0 bg-background z-10" style={{ backgroundColor: idx % 2 === 0 ? "white" : "hsl(var(--muted)/0.1)" }}>
                      <span className="text-sm">{emp.employeeName}</span>
                    </td>
                    {trainingTypes.map(type => (
                      <td key={type} className="p-3 text-center">
                        <StatusCell record={emp.records[type]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEmployees.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No employees match your search.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Bulk Assign Training
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Training Type</Label>
              <Select value={bulkForm.trainingType} onValueChange={v => setBulkForm(f => ({ ...f, trainingType: v }))}>
                <SelectTrigger data-testid="select-bulk-training-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRAINING_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Training Name *</Label>
              <Input
                value={bulkForm.trainingName}
                onChange={e => setBulkForm(f => ({ ...f, trainingName: e.target.value }))}
                placeholder="e.g. First Aid at Work (Level 3)"
                data-testid="input-bulk-training-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Input
                value={bulkForm.provider}
                onChange={e => setBulkForm(f => ({ ...f, provider: e.target.value }))}
                placeholder="e.g. St John Ambulance"
                data-testid="input-bulk-provider"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={bulkForm.notes}
                onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-bulk-notes"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Select Employees ({selectedEmployeeIds.size} selected)</Label>
                <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                  Select All
                </Button>
              </div>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {allEmployees.map((emp: any) => (
                  <div key={emp.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30">
                    <Checkbox
                      checked={selectedEmployeeIds.has(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                      data-testid={`checkbox-employee-${emp.id}`}
                    />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button
              onClick={() => bulkAssignMutation.mutate({
                employeeIds: [...selectedEmployeeIds],
                trainingType: bulkForm.trainingType,
                trainingName: bulkForm.trainingName,
                provider: bulkForm.provider,
                notes: bulkForm.notes,
              })}
              disabled={bulkAssignMutation.isPending || selectedEmployeeIds.size === 0 || !bulkForm.trainingName}
              data-testid="button-confirm-bulk-assign"
            >
              {bulkAssignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Assign to {selectedEmployeeIds.size} Employee{selectedEmployeeIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
