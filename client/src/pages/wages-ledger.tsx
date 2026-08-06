import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Download, RefreshCw, Search, X, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

function formatGBP(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  if (isNaN(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const s = d.toString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const VAT_QUARTERS = [
  "1. May'21 to July'21",
  "2. Aug'21 to Oct'21",
  "3. Nov'21 to Jan'22",
  "4. Feb'22 to Apr'22",
  "1. May'22 to July'22",
  "2. Aug'22 to Oct'22",
  "3. Nov'22 to Jan'23",
  "4. Feb'23 to Apr'23",
  "1. May'23 to July'23",
  "2. Aug'23 to Oct'23",
  "3. Nov'23 to Jan'24",
  "4. Feb'24 to Apr'24",
  "1. May'24 to July'24",
  "2. Aug'24 to Oct'24",
  "3. Nov'24 to Jan'25",
  "4. Feb'25 to Apr'25",
  "1. May'25 to July'25",
  "2. Aug'25 to Oct'25",
];

const EMPTY_FORM = {
  entryDate: "",
  vatQuarter: "",
  description: "",
  grossAmount: "",
  notes: "",
};

export default function WagesLedgerPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/wages-ledger", search, quarterFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (quarterFilter && quarterFilter !== "all") params.set("quarter", quarterFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/wages-ledger?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load wages ledger");
      return res.json();
    },
  });

  const entries: any[] = data?.entries || [];
  const total: number = data?.total || 0;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/wages-ledger", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Entry added", description: "Wages ledger entry has been recorded." });
      setShowAddDialog(false);
      setForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ["/api/wages-ledger"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/wages-ledger/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Wages ledger entry has been updated." });
      setEditEntry(null);
      setForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ["/api/wages-ledger"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/wages-ledger/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Wages ledger entry has been removed." });
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["/api/wages-ledger"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const isDialogOpen = showAddDialog || !!editEntry;

  const openAdd = () => {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
    setShowAddDialog(true);
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setForm({
      entryDate: entry.entry_date?.toString().substring(0, 10) || "",
      vatQuarter: entry.vat_quarter || "",
      description: entry.description || "",
      grossAmount: parseFloat(entry.gross_amount || "0").toFixed(2),
      notes: entry.notes || "",
    });
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = () => {
    if (!form.entryDate || form.grossAmount === "" || isNaN(parseFloat(form.grossAmount))) {
      toast({ title: "Required fields missing", description: "Date and gross amount are required.", variant: "destructive" });
      return;
    }
    const payload = {
      entryDate: form.entryDate,
      vatQuarter: form.vatQuarter === "none" ? "" : form.vatQuarter,
      description: form.description,
      grossAmount: parseFloat(form.grossAmount).toFixed(2),
      notes: form.notes,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (quarterFilter && quarterFilter !== "all") params.set("quarter", quarterFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/wages-ledger/export/csv?${params}`, "_blank");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}
          >
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-wages-page-title">Wages Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Historical wages payments — excluded from VAT (boxes 4 &amp; 7).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openAdd} data-testid="button-add-wages">
            <Plus className="w-4 h-4 mr-1.5" /> Add Entry
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-wages-csv">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-wages">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">VAT Quarter</Label>
              <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                <SelectTrigger className="w-56" data-testid="select-wages-quarter">
                  <SelectValue placeholder="All Quarters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quarters</SelectItem>
                  {VAT_QUARTERS.map(q => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" data-testid="input-wages-from" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" data-testid="input-wages-to" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-wages-search"
                />
              </div>
            </div>
            {search && (
              <Button variant="ghost" size="icon" onClick={() => setSearch("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Wages ({entries.length} entries)</p>
              <p className="text-2xl font-bold" data-testid="text-wages-total">{formatGBP(total)}</p>
            </div>
            <div className="text-sm text-muted-foreground text-right">
              <p className="font-medium text-amber-600">VAT Excluded</p>
              <p>No input VAT claimed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">No wages entries found</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">VAT Quarter</th>
                    <th className="text-left px-4 py-2 font-medium">Description</th>
                    <th className="text-left px-4 py-2 font-medium">Notes</th>
                    <th className="text-right px-4 py-2 font-medium">Gross Amount</th>
                    <th className="text-right px-4 py-2 font-medium text-blue-700 dark:text-blue-400">Running Total</th>
                    <th className="text-right px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id} className="border-b hover:bg-muted/20" data-testid={`row-wages-${e.id}`}>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.vat_quarter || "—"}</td>
                      <td className="px-4 py-2 max-w-xs truncate">{e.description || "—"}</td>
                      <td className="px-4 py-2 max-w-xs truncate text-muted-foreground text-xs">{e.notes || ""}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatGBP(e.gross_amount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-blue-700 dark:text-blue-400" data-testid={`text-running-total-${e.id}`}>
                        {e.running_total != null ? formatGBP(e.running_total) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} data-testid={`button-edit-wages-${e.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(e)} data-testid={`button-delete-wages-${e.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td colSpan={5} className="px-4 py-2 text-right">Total ({entries.length} entries)</td>
                    <td className="px-4 py-2 text-right font-mono">{formatGBP(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-wages-dialog-title">
              {editEntry ? "Edit Wages Entry" : "Add Wages Entry"}
            </DialogTitle>
            <DialogDescription>
              {editEntry
                ? "Update this wages ledger entry."
                : "Record an ad-hoc wages ledger entry. Wages are excluded from VAT."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date *</Label>
              <Input
                type="date"
                value={form.entryDate}
                onChange={(e) => handleFormChange("entryDate", e.target.value)}
                data-testid="input-wages-form-date"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Gross Amount (£) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.grossAmount}
                onChange={(e) => handleFormChange("grossAmount", e.target.value)}
                placeholder="0.00"
                data-testid="input-wages-form-gross"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">VAT Quarter</Label>
              <Select value={form.vatQuarter || "none"} onValueChange={(v) => handleFormChange("vatQuarter", v)}>
                <SelectTrigger data-testid="select-wages-form-quarter">
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {VAT_QUARTERS.map(q => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                placeholder="e.g. Monthly wages payment"
                data-testid="input-wages-form-description"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                placeholder="Optional notes"
                rows={2}
                data-testid="input-wages-form-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-wages">Cancel</Button>
            <Button
              onClick={handleSubmitForm}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-wages"
            >
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-wages-delete-dialog-title">Delete Wages Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the wages entry on {formatDate(deleteConfirm?.entry_date)} for {formatGBP(deleteConfirm?.gross_amount)}?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete-wages">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-wages"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
