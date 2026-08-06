import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";
import {
  getRequiredSupplierPolicyTypes,
  SUPPLIER_POLICY_LABELS,
  SUPPLIER_POLICY_DESCRIPTIONS,
} from "@shared/supplierRequiredPolicies";
import { useUpload } from "@/hooks/use-upload";
import {
  FileText, Upload, Loader2, Check, Circle, XCircle, CalendarClock, RefreshCw,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type PolicyItem = {
  id: number;
  policyType: string;
  fileName: string;
  fileUrl: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export default function SupplierPoliciesPage() {
  const { toast } = useToast();

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["/api/supplier-portal/me"],
  });

  const { data: policies = [] } = useQuery<PolicyItem[]>({
    queryKey: ["/api/supplier-portal/policies"],
    enabled: !!supplier?.id,
  });

  const requiredPolicyTypes = supplier ? getRequiredSupplierPolicyTypes(supplier) : [];
  const canUpload = supplier && ["draft", "info_required", "pending", "submitted", "approved", "active"].includes(supplier.status ?? "");

  const [uploadPolicyOpen, setUploadPolicyOpen] = useState(false);
  const [uploadPolicyType, setUploadPolicyType] = useState("");
  const [uploadPolicyIssueDate, setUploadPolicyIssueDate] = useState("");
  const [uploadPolicyExpiryDate, setUploadPolicyExpiryDate] = useState("");
  const [uploadPolicyNotes, setUploadPolicyNotes] = useState("");
  const [uploadPolicyFileSelected, setUploadPolicyFileSelected] = useState<File | null>(null);
  const uploadPolicyFormRef = useRef<{ policyType: string; issueDate: string; expiryDate: string; notes: string } | null>(null);
  const uploadPolicyInputRef = useRef<HTMLInputElement>(null);

  const openUploadDialog = (preselectType?: string) => {
    setUploadPolicyType(preselectType ?? "");
    setUploadPolicyIssueDate("");
    setUploadPolicyExpiryDate("");
    setUploadPolicyNotes("");
    setUploadPolicyFileSelected(null);
    setUploadPolicyOpen(true);
  };

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res) => {
      const meta = uploadPolicyFormRef.current;
      if (!supplier?.id || !meta?.policyType) return;
      const fileUrl = res.objectPath.startsWith("http") ? res.objectPath : `${window.location.origin}${res.objectPath}`;
      await apiRequest("POST", "/api/supplier-portal/policies", {
        policyType: meta.policyType,
        fileName: res.metadata.name,
        fileUrl,
        fileSize: res.metadata.size,
        mimeType: res.metadata.contentType,
        issueDate: meta.issueDate || undefined,
        expiryDate: meta.expiryDate || undefined,
        notes: meta.notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/policies"] });
      setUploadPolicyOpen(false);
      setUploadPolicyType("");
      setUploadPolicyIssueDate("");
      setUploadPolicyExpiryDate("");
      setUploadPolicyNotes("");
      setUploadPolicyFileSelected(null);
      toast({ title: "Policy uploaded", description: "Admin will review and approve or reject your policy." });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  if (isLoading || !supplier) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusIcon = (status?: string) => {
    if (status === "approved") return <Check className="w-4 h-4 text-green-600" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Circle className="w-4 h-4 text-amber-500" />;
  };

  const expiringPolicies = policies
    .filter((p) => p.status === "approved" && p.expiryDate)
    .map((p) => {
      const exp = new Date(p.expiryDate!);
      exp.setHours(0, 0, 0, 0);
      return { ...p, isExpired: exp < today, isExpiring: exp >= today && exp <= in30Days };
    })
    .filter((p) => p.isExpired || p.isExpiring)
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Policies</h1>
        <p className="text-muted-foreground">
          Upload your company policies as required by UK ISO 9001 and HMRC guidelines. Set issue date, expiry date, and notes. Admin will review each policy.
        </p>
      </div>

      {/* Expiring / expired alerts */}
      {expiringPolicies.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              Expiring & expired policies
            </CardTitle>
            <CardDescription>These policies need attention. Upload a replacement before they expire.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringPolicies.map((p) => {
                const label = SUPPLIER_POLICY_LABELS[p.policyType as keyof typeof SUPPLIER_POLICY_LABELS] ?? p.policyType;
                const expDate = new Date(p.expiryDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                return (
                  <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${p.isExpired ? "border-destructive/50 bg-destructive/5" : "border-amber-200"}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {p.isExpired ? <XCircle className="w-4 h-4 text-destructive shrink-0" /> : <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span className="font-medium truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={p.isExpired ? "destructive" : "secondary"}>
                        {p.isExpired ? `Expired ${expDate}` : `Expires ${expDate}`}
                      </Badge>
                      {canUpload && (
                        <Button size="sm" variant="outline" onClick={() => openUploadDialog(p.policyType)}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Replace
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required policies checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Required policies
          </CardTitle>
          <CardDescription>Based on your supplier type (UK ISO 9001 and HMRC requirements).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requiredPolicyTypes.map((type) => {
            const label = SUPPLIER_POLICY_LABELS[type as keyof typeof SUPPLIER_POLICY_LABELS] ?? type;
            const desc = SUPPLIER_POLICY_DESCRIPTIONS[type as keyof typeof SUPPLIER_POLICY_DESCRIPTIONS];
            const policiesOfType = policies.filter((p) => p.policyType === type);
            const latest = [...policiesOfType].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const isComplete = latest?.status === "approved";
            const isRejected = latest?.status === "rejected";
            const isPending = latest?.status === "pending";
            const isExpiring = latest?.expiryDate && new Date(latest.expiryDate) <= in30Days;
            return (
              <div key={type} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isRejected ? "border-destructive/50 bg-destructive/5" : isComplete ? "border-green-200 bg-green-50/30 dark:border-green-800/50 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-950/20"}`}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {statusIcon(latest?.status)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                    {isRejected && latest?.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">Rejected: {latest.rejectionReason}</p>
                    )}
                    {isPending && <p className="text-xs text-amber-600 mt-1">Uploaded, awaiting review</p>}
                    {isExpiring && <p className="text-xs text-amber-600 mt-1">Expiring soon</p>}
                  </div>
                </div>
                {canUpload && (
                  <Button size="sm" variant={isComplete ? "ghost" : "outline"} onClick={() => openUploadDialog(type)}>
                    {isComplete ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* All uploaded policies */}
      {policies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded policies</CardTitle>
            <CardDescription>All policies you have uploaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {policies.map((p) => {
                const label = SUPPLIER_POLICY_LABELS[p.policyType as keyof typeof SUPPLIER_POLICY_LABELS] ?? p.policyType;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {statusIcon(p.status)}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                        {p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending"}
                      </Badge>
                      {p.expiryDate && (
                        <span className="text-xs text-muted-foreground">
                          Exp: {new Date(p.expiryDate).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload button */}
      {canUpload && (
        <Button onClick={() => openUploadDialog()} className="w-full" variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Upload a policy
        </Button>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadPolicyOpen} onOpenChange={setUploadPolicyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload company policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Policy type</Label>
              <Select value={uploadPolicyType} onValueChange={setUploadPolicyType}>
                <SelectTrigger><SelectValue placeholder="Select policy type" /></SelectTrigger>
                <SelectContent>
                  {requiredPolicyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SUPPLIER_POLICY_LABELS[type as keyof typeof SUPPLIER_POLICY_LABELS] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue date</Label>
                <Input type="date" value={uploadPolicyIssueDate} onChange={(e) => setUploadPolicyIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>Expiry / review date</Label>
                <Input type="date" value={uploadPolicyExpiryDate} onChange={(e) => setUploadPolicyExpiryDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Annual review completed Jan 2025, signed by CEO"
                value={uploadPolicyNotes}
                onChange={(e) => setUploadPolicyNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Policy document (PDF or image)</Label>
              <input
                ref={uploadPolicyInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setUploadPolicyFileSelected(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => uploadPolicyInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadPolicyFileSelected ? "Change file" : "Choose file"}
                </Button>
                {uploadPolicyFileSelected && (
                  <span className="text-sm text-muted-foreground truncate">{uploadPolicyFileSelected.name}</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setUploadPolicyOpen(false)}>Cancel</Button>
              <Button
                disabled={!uploadPolicyType || !uploadPolicyFileSelected || isUploading}
                onClick={() => {
                  if (!uploadPolicyType || !uploadPolicyFileSelected) return;
                  uploadPolicyFormRef.current = {
                    policyType: uploadPolicyType,
                    issueDate: uploadPolicyIssueDate,
                    expiryDate: uploadPolicyExpiryDate,
                    notes: uploadPolicyNotes,
                  };
                  uploadFile(uploadPolicyFileSelected);
                }}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload policy
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
