import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { canApplyRules, selfShiftPayDisplay } from "@shared/payrollControl";
import { Loader2, RefreshCw, Download, Eye, Trash2, Mail } from "lucide-react";

type QueueBill = {
  id: number;
  billNumber: string;
  billDate: string;
  dueDate: string;
  empLevel: number;
  branch: string;
  particulars: string;
  accountTitle: string;
  accountNumber: string;
  sortCode: string;
  status: string;
  billAmount: number;
  paidAmount: number;
  balance: number;
  remarks: string | null;
  niNumber: string | null;
  payrollProvider: string | null;
  terms: string | null;
  postDate: string | null;
  bankName: string | null;
  remittance: boolean;
  payeeName: string;
  email: string | null;
  employeeId: number;
};

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

export default function PayrollPendingPaymentsPage() {
  const { user } = useAuth();
  /** Same gate as Create Bill / Remittance / server financeOnly (finance + tenant admins). */
  const canManageBills = canApplyRules(user?.role);
  const { toast } = useToast();
  const [paid, setPaid] = useState(false);
  const [search, setSearch] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [payeeType, setPayeeType] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [remarksFilter, setRemarksFilter] = useState("ALL");
  const [sort, setSort] = useState("bill_date");
  const [dir, setDir] = useState("ASC");
  const [queMark, setQueMark] = useState("ALL");
  const [empLevel, setEmpLevel] = useState("ALL");
  const [individual, setIndividual] = useState(false);
  const [bulkPostDate, setBulkPostDate] = useState("");
  const [bulkBank, setBulkBank] = useState("");
  const [remarksUpdate, setRemarksUpdate] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rowPay, setRowPay] = useState<Record<number, { paidAmount: string; postDate: string; bankName: string }>>({});
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Payroll payment");
  const [emailBody, setEmailBody] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: number } | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams({
      paid: String(paid), search, dueFrom, dueTo, payeeType, branch,
      remarks: remarksFilter, sort, dir, queMark,
    });
    if (empLevel !== "ALL") p.set("empLevel", empLevel);
    return p.toString();
  }, [paid, search, dueFrom, dueTo, payeeType, branch, remarksFilter, sort, dir, queMark, empLevel]);

  const { data, isFetching, refetch } = useQuery<{ bills: QueueBill[] }>({
    queryKey: ["/api/payroll-control/queue", qs],
    queryFn: async () => {
      const res = await fetch(`/api/payroll-control/queue?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });
  const bills = data?.bills || [];

  const { data: review } = useQuery<{ bill: any; lines: any[] }>({
    queryKey: ["/api/payroll-control/bills", reviewId, "review"],
    enabled: !!reviewId,
    queryFn: async () => {
      const res = await fetch(`/api/payroll-control/bills/${reviewId}/review`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/queue"] });

  const markPaidMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await apiRequest("POST", "/api/payroll-control/mark-paid", { items });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Payments posted" }); invalidate(); setSelected(new Set()); },
    onError: (err: Error) => toast({ title: "Mark Paid failed", description: err.message, variant: "destructive" }),
  });

  const remarksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-control/queue/remarks", {
        billIds: Array.from(selected), remarks: remarksUpdate,
      });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Remarks updated" }); invalidate(); },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (billIds: number[]) => {
      if (billIds.length === 1) {
        const res = await apiRequest("DELETE", `/api/payroll-control/bills/${billIds[0]}`);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/payroll-control/bills/delete", { billIds });
      return res.json();
    },
    onSuccess: (_data, billIds) => {
      toast({ title: billIds.length === 1 ? "Bill deleted" : `${billIds.length} bills deleted` });
      invalidate();
      setSelected(new Set());
      setConfirmAction(null);
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const remittanceMutation = useMutation({
    mutationFn: async (billIds: number[]) => {
      if (billIds.length === 1) {
        const res = await apiRequest("POST", `/api/payroll-control/bills/${billIds[0]}/remittance`);
        if (!res.ok) throw new Error((await res.json()).message || "Failed");
        return res.json();
      }
      const res = await apiRequest("POST", "/api/payroll-control/remittance", { billIds });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
    onSuccess: (data: any, billIds) => {
      if (billIds.length === 1) {
        toast({ title: "Remittance emailed to officer" });
      } else {
        const failed = Number(data?.failed || 0);
        toast({
          title: failed ? `Remittance sent (${data.sent || 0}), ${failed} failed` : `Remittance sent to ${data.sent || billIds.length} officer(s)`,
          variant: failed ? "destructive" : "default",
        });
      }
      invalidate();
      setConfirmAction(null);
    },
    onError: (err: Error) => toast({ title: "Remittance failed", description: err.message, variant: "destructive" }),
  });

  const bulkEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-control/send-email", {
        billIds: Array.from(selected), subject: emailSubject, body: emailBody,
      });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Emails sent" }); setEmailOpen(false); },
    onError: (err: Error) => toast({ title: "Email failed", description: err.message, variant: "destructive" }),
  });

  function payItems(ids: number[]) {
    return ids.map((id) => {
      const bill = bills.find((b) => b.id === id)!;
      const override = rowPay[id] || {};
      return {
        billId: id,
        paidAmount: Number(override.paidAmount ?? bill.balance ?? bill.billAmount),
        postDate: individual ? (override.postDate || bill.postDate) : bulkPostDate,
        bankName: individual ? (override.bankName || bill.bankName) : (bulkBank || bill.bankName),
        remittance: bill.remittance,
        remarks: bill.remarks,
      };
    });
  }

  async function runConfirmed() {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    if (type === "delete") {
      deleteMutation.mutate([id]);
      return;
    }
    if (type === "delete-bulk") {
      deleteMutation.mutate(Array.from(selected));
      return;
    }
    if (type === "remittance") {
      remittanceMutation.mutate([id]);
      return;
    }
    if (type === "remittance-bulk") {
      remittanceMutation.mutate(Array.from(selected));
      return;
    }
    setConfirmAction(null);
    try {
      if (type === "sms") {
        const res = await apiRequest("POST", `/api/payroll-control/bills/${id}/sms`);
        if (!res.ok) throw new Error((await res.json()).message);
        toast({ title: "SMS sent" });
      } else if (type === "email") {
        const res = await apiRequest("POST", `/api/payroll-control/bills/${id}/email`);
        if (!res.ok) throw new Error((await res.json()).message);
        toast({ title: "Email sent" });
      } else if (type === "payslip-email") {
        const res = await apiRequest("POST", `/api/payroll-control/bills/${id}/payslip`, { email: true });
        if (!res.ok) throw new Error((await res.json()).message);
        toast({ title: "Payslip emailed" });
      }
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }

  const allSelected = bills.length > 0 && bills.every((b) => selected.has(b.id));

  return (
    <div className="p-6 space-y-4" data-testid="payroll-pending-page">
      <div>
        <h1 className="text-2xl font-bold">Pending Payment</h1>
        <p className="text-sm text-muted-foreground">Unpaid queue, Mark Paid, remittance, SMS/email, CSV, and payslips.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={paid} onCheckedChange={(v) => setPaid(!!v)} /> Paid
        </label>
        <Input className="w-40" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div><Label>Due from</Label><Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} /></div>
        <div><Label>Due to</Label><Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} /></div>
        <Select value={payeeType} onValueChange={setPayeeType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Payee type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            <SelectItem value="Self-employed">Self-employed</SelectItem>
            <SelectItem value="PAYE">PAYE</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            <SelectItem value="Employee">Employee</SelectItem>
            <SelectItem value="Contractor">Contractor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={remarksFilter} onValueChange={setRemarksFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            <SelectItem value="1st4 PAYE">1st4 PAYE</SelectItem>
            <SelectItem value="GFM PAYE">GFM PAYE</SelectItem>
          </SelectContent>
        </Select>
        <Select value={`${sort}:${dir}`} onValueChange={(v) => { const [s, d] = v.split(":"); setSort(s); setDir(d); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bill_date:ASC">Bill date ASC</SelectItem>
            <SelectItem value="bill_date:DESC">Bill date DESC</SelectItem>
            <SelectItem value="amount:ASC">Amount ASC</SelectItem>
            <SelectItem value="amount:DESC">Amount DESC</SelectItem>
            <SelectItem value="remarks:ASC">Remarks ASC</SelectItem>
            <SelectItem value="remarks:DESC">Remarks DESC</SelectItem>
          </SelectContent>
        </Select>
        <Select value={queMark} onValueChange={setQueMark}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Que all</SelectItem>
            <SelectItem value="checked">Que checked</SelectItem>
            <SelectItem value="unchecked">Que unchecked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={empLevel} onValueChange={setEmpLevel}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Level all</SelectItem>
            {[0,1,2,3,4,5,6,7].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={individual} onCheckedChange={(v) => setIndividual(!!v)} /> Individual
        </label>
        {!individual && (
          <>
            <Input type="date" value={bulkPostDate} onChange={(e) => setBulkPostDate(e.target.value)} />
            <Input className="w-36" placeholder="Bulk bank" value={bulkBank} onChange={(e) => setBulkBank(e.target.value)} />
          </>
        )}
        {canManageBills && (
          <>
            <Input className="w-40" placeholder="Remarks update" value={remarksUpdate} onChange={(e) => setRemarksUpdate(e.target.value)} />
            <Button variant="outline" disabled={selected.size === 0} onClick={() => remarksMutation.mutate()}>Remarks update</Button>
            <Button variant="outline" onClick={() => window.open(`/api/payroll-control/queue.csv?paid=${paid}`, "_blank")}><Download className="w-4 h-4 mr-1" />CSV</Button>
            <Button
              disabled={selected.size === 0 || markPaidMutation.isPending || paid}
              onClick={() => markPaidMutation.mutate(payItems(Array.from(selected)))}
              data-testid="btn-mark-paid"
            >
              {markPaidMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Mark Paid
            </Button>
            <Button variant="outline" disabled={selected.size === 0} onClick={() => setEmailOpen(true)}>Send Email</Button>
            <Button variant="outline" disabled={selected.size === 0} onClick={() => apiRequest("POST", "/api/payroll-control/payslips/bulk", { billIds: Array.from(selected), email: false }).then(() => toast({ title: "Payslips generated" }))}>Payslips</Button>
            <Button
              variant="outline"
              disabled={selected.size === 0 || remittanceMutation.isPending}
              onClick={() => setConfirmAction({ type: "remittance-bulk", id: 0 })}
            >
              <Mail className="w-4 h-4 mr-1" />
              Send Remittance
            </Button>
            <Button
              variant="destructive"
              disabled={selected.size === 0 || deleteMutation.isPending}
              onClick={() => setConfirmAction({ type: "delete-bulk", id: 0 })}
            >
              Delete selected
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2"><Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(bills.map((b) => b.id)) : new Set())} /></th>
              <th className="p-2">Bill ID</th>
              <th className="p-2">Bill Date</th>
              <th className="p-2">Emp</th>
              <th className="p-2">Branch</th>
              <th className="p-2">Particulars</th>
              <th className="p-2">Account</th>
              <th className="p-2">Acc no</th>
              <th className="p-2">Sort</th>
              <th className="p-2">Status</th>
              <th className="p-2">Bill</th>
              <th className="p-2">Paid</th>
              <th className="p-2">Balance</th>
              <th className="p-2">Remarks</th>
              <th className="p-2">NI</th>
              <th className="p-2">Actions</th>
              <th className="p-2">Provider</th>
              <th className="p-2">Post date</th>
              <th className="p-2">Bank</th>
              <th className="p-2">
                <Checkbox
                  onCheckedChange={(v) => {
                    bills.forEach((b) => { b.remittance = !!v; });
                    queryClient.setQueryData(["/api/payroll-control/queue", qs], { bills: bills.map((b) => ({ ...b, remittance: !!v })) });
                  }}
                /> Remit
              </th>
            </tr>
          </thead>
          <tbody>
            {isFetching && bills.length === 0 ? (
              <tr><td colSpan={20} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : bills.map((b) => (
              <tr key={b.id} className="border-t align-top">
                <td className="p-2">
                  <Checkbox checked={selected.has(b.id)} onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(b.id); else next.delete(b.id);
                    setSelected(next);
                  }} />
                </td>
                <td className="p-2 font-mono">{b.billNumber}</td>
                <td className="p-2">{String(b.billDate).slice(0, 10)}</td>
                <td className="p-2">{b.empLevel}</td>
                <td className="p-2">{b.branch}</td>
                <td className="p-2">{b.payeeName}<div className="text-muted-foreground">{b.particulars}</div></td>
                <td className="p-2">{b.accountTitle}</td>
                <td className="p-2">{b.accountNumber}</td>
                <td className="p-2">{b.sortCode}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">{gbp(b.billAmount)}</td>
                <td className="p-2">
                  {individual ? (
                    <Input className="h-7 w-20" defaultValue={String(b.balance)} onChange={(e) => setRowPay((p) => ({ ...p, [b.id]: { ...p[b.id], paidAmount: e.target.value, postDate: p[b.id]?.postDate || "", bankName: p[b.id]?.bankName || "" } }))} />
                  ) : gbp(b.paidAmount)}
                </td>
                <td className="p-2">{gbp(b.balance)}</td>
                <td className="p-2 max-w-[120px]">{b.remarks}</td>
                <td className="p-2">{b.niNumber}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      title="Review"
                      onClick={() => setReviewId(b.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canManageBills && !paid && (
                      <Button size="sm" onClick={() => markPaidMutation.mutate(payItems([b.id]))} data-testid={`btn-save-pay-${b.id}`}>
                        Save / pay
                      </Button>
                    )}
                    {canManageBills && <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "sms", id: b.id })}>SMS</Button>}
                    {canManageBills && <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "email", id: b.id })}>Email</Button>}
                    {canManageBills && <Button size="sm" variant="outline" onClick={() => window.open(`/api/payroll-control/bills/${b.id}/payslip`, "_blank")}>Payslip</Button>}
                    {canManageBills && <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "payslip-email", id: b.id })}>Email payslip</Button>}
                    {canManageBills && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="Send remittance"
                        disabled={remittanceMutation.isPending}
                        onClick={() => setConfirmAction({ type: "remittance", id: b.id })}
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    )}
                    {canManageBills && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="View remittance PDF"
                        onClick={() => window.open(`/api/payroll-control/bills/${b.id}/remittance`, "_blank")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    {canManageBills && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                        onClick={() => setConfirmAction({ type: "delete", id: b.id })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="p-2">{b.payrollProvider}</td>
                <td className="p-2">
                  {individual ? (
                    <Input type="date" className="h-7" defaultValue={b.postDate ? String(b.postDate).slice(0, 10) : ""} onChange={(e) => setRowPay((p) => ({ ...p, [b.id]: { paidAmount: p[b.id]?.paidAmount || String(b.balance), postDate: e.target.value, bankName: p[b.id]?.bankName || b.bankName || "" } }))} />
                  ) : (b.postDate ? String(b.postDate).slice(0, 10) : "—")}
                </td>
                <td className="p-2">
                  {individual ? (
                    <Input className="h-7 w-28" defaultValue={b.bankName || ""} onChange={(e) => setRowPay((p) => ({ ...p, [b.id]: { paidAmount: p[b.id]?.paidAmount || String(b.balance), postDate: p[b.id]?.postDate || "", bankName: e.target.value } }))} />
                  ) : (b.bankName || "—")}
                </td>
                <td className="p-2">
                  <Checkbox
                    checked={b.remittance}
                    onCheckedChange={(v) => {
                      queryClient.setQueryData(["/api/payroll-control/queue", qs], {
                        bills: bills.map((x) => x.id === b.id ? { ...x, remittance: !!v } : x),
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!reviewId} onOpenChange={() => setReviewId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Review shifts {review?.bill?.bill_number}</DialogTitle></DialogHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="p-1">Date</th>
                <th className="p-1">Officer</th>
                <th className="p-1">Site</th>
                <th className="p-1">In</th>
                <th className="p-1">Out</th>
                <th className="p-1">Hours</th>
                <th className="p-1">Holiday</th>
                <th className="p-1">Rate</th>
                <th className="p-1">Wages</th>
                <th className="p-1">Deduction</th>
                <th className="p-1">Net</th>
              </tr>
            </thead>
            <tbody>
              {(review?.lines || []).map((l: any) => {
                const pay = selfShiftPayDisplay({
                  hours: Number(l.hours) || 0,
                  rate: Number(l.rate) || 0,
                  wages: Number(l.wages) || 0,
                  bucket: review?.bill?.payee_type === "Self-employed" ? "self" : l.bucket,
                });
                return (
                  <tr key={l.id} className="border-b">
                    <td className="p-1">{String(l.date).slice(0, 10)}</td>
                    <td className="p-1">{l.first_name} {l.last_name}</td>
                    <td className="p-1">{l.site_name}</td>
                    <td className="p-1">{l.start_time}</td>
                    <td className="p-1">{l.end_time}</td>
                    <td className="p-1">{l.hours}</td>
                    <td className="p-1">{l.holiday_hours}</td>
                    <td className="p-1">{gbp(pay.rate)}</td>
                    <td className="p-1">{gbp(pay.wages)}</td>
                    <td className={`p-1 ${pay.deduction > 0 ? "text-red-600" : ""}`}>
                      {pay.deduction > 0 ? gbp(pay.deduction) : "—"}
                    </td>
                    <td className="p-1">{pay.deduction > 0 ? gbp(pay.net) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
          <Label>Subject</Label>
          <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          <Label>Body</Label>
          <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => bulkEmailMutation.mutate()} disabled={bulkEmailMutation.isPending}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "delete" || confirmAction?.type === "delete-bulk"
                ? "Delete bill?"
                : confirmAction?.type === "remittance" || confirmAction?.type === "remittance-bulk"
                  ? "Send remittance?"
                  : "Confirm"}
            </DialogTitle>
          </DialogHeader>
          {confirmAction?.type === "delete" || confirmAction?.type === "delete-bulk" ? (
            <p className="text-sm">
              {confirmAction.type === "delete-bulk"
                ? `Delete ${selected.size} selected bill(s)? Shifts will become claimable again on Bill Section.`
                : "Delete this bill? Shifts will become claimable again on Bill Section."}
            </p>
          ) : confirmAction?.type === "remittance" || confirmAction?.type === "remittance-bulk" ? (
            <p className="text-sm">
              {confirmAction.type === "remittance-bulk"
                ? `Email remittance advice PDF to ${selected.size} selected officer(s)?`
                : "Email remittance advice PDF to this officer?"}
            </p>
          ) : (
            <p className="text-sm">Send this {confirmAction?.type.replace("-", " ")} now?</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.type === "delete" || confirmAction?.type === "delete-bulk" ? "destructive" : "default"}
              disabled={deleteMutation.isPending || remittanceMutation.isPending}
              onClick={runConfirmed}
            >
              {deleteMutation.isPending || remittanceMutation.isPending ? "Working..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
