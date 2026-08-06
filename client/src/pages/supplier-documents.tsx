import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";
import {
  getRequiredSupplierDocumentTypes,
  SUPPLIER_DOC_LABELS,
  SUPPLIER_DOC_DESCRIPTIONS,
} from "@shared/supplierRequiredDocs";
import type { SupplierDocumentType } from "@shared/supplierRequiredDocs";
import { useUpload } from "@/hooks/use-upload";
import {
  FileText, Upload, Loader2, Check, Circle, XCircle, FileX2, CalendarClock, RefreshCw, Trash2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DocItem = {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  createdAt?: string;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  displayName?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
};

export default function SupplierDocumentsPage() {
  const { toast } = useToast();

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["/api/supplier-portal/me"],
  });

  const { data: documents = [] } = useQuery<DocItem[]>({
    queryKey: ["/api/supplier-portal/documents"],
    enabled: !!supplier?.id,
  });

  const requiredDocTypes = supplier ? getRequiredSupplierDocumentTypes(supplier) : [];
  const canUpload = supplier && ["draft", "info_required", "pending", "submitted", "approved", "active"].includes(supplier.status ?? "");

  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/supplier-portal/documents/${deleteTarget.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/documents"] });
      toast({ title: "Document deleted", description: `${deleteTarget.fileName} has been removed.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<SupplierDocumentType | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);
  const uploadFormRef = useRef<{ type: SupplierDocumentType; displayName: string; expiryDate: string; notes: string } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const openUploadDialog = (preselectType?: SupplierDocumentType) => {
    setUploadDocType(preselectType ?? null);
    setUploadDisplayName("");
    setUploadExpiryDate("");
    setUploadNotes("");
    setUploadFileSelected(null);
    setUploadDocOpen(true);
  };

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res) => {
      const meta = uploadFormRef.current;
      if (!supplier?.id || !meta?.type) return;
      const fileUrl = res.objectPath.startsWith("http") ? res.objectPath : `${window.location.origin}${res.objectPath}`;
      await apiRequest("POST", "/api/supplier-portal/documents", {
        documentType: meta.type,
        fileName: res.metadata.name,
        fileUrl,
        fileSize: res.metadata.size,
        mimeType: res.metadata.contentType,
        displayName: meta.displayName.trim() || undefined,
        expiryDate: meta.expiryDate || undefined,
        notes: meta.notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/documents"] });
      setUploadDocOpen(false);
      setUploadDocType(null);
      setUploadDisplayName("");
      setUploadExpiryDate("");
      setUploadNotes("");
      setUploadFileSelected(null);
      toast({ title: "Document uploaded", description: "It will be reviewed by admin." });
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

  const expiringDocs = documents
    .filter((d) => d.status === "approved" && d.expiryDate)
    .map((d) => {
      const exp = new Date(d.expiryDate!);
      exp.setHours(0, 0, 0, 0);
      return { ...d, isExpired: exp < today, isExpiring: exp >= today && exp <= in30Days };
    })
    .filter((d) => d.isExpired || d.isExpiring)
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">Upload and manage your compliance documents. Admin will review each document.</p>
      </div>

      {/* Expiring / expired alerts */}
      {expiringDocs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              Expiring & expired documents
            </CardTitle>
            <CardDescription>These documents need attention. Upload a replacement before they expire.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocs.map((d) => {
                const label = SUPPLIER_DOC_LABELS[d.documentType as SupplierDocumentType] ?? d.displayName ?? d.documentType;
                const expDate = new Date(d.expiryDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                return (
                  <div key={d.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${d.isExpired ? "border-destructive/50 bg-destructive/5" : "border-amber-200"}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {d.isExpired ? <XCircle className="w-4 h-4 text-destructive shrink-0" /> : <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span className="font-medium truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={d.isExpired ? "destructive" : "secondary"}>
                        {d.isExpired ? `Expired ${expDate}` : `Expires ${expDate}`}
                      </Badge>
                      {canUpload && (
                        <Button size="sm" variant="outline" onClick={() => openUploadDialog(d.documentType as SupplierDocumentType)}>
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

      {/* Required documents checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Required documents
          </CardTitle>
          <CardDescription>These documents are required based on your supplier type and VAT status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requiredDocTypes.map((type) => {
            const label = SUPPLIER_DOC_LABELS[type] ?? type;
            const desc = SUPPLIER_DOC_DESCRIPTIONS[type] ?? "";
            const docsOfType = documents.filter((d) => d.documentType === type);
            const latest = [...docsOfType].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
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
                  <Button size="sm" variant={isComplete ? "ghost" : "outline"} onClick={() => openUploadDialog(type as SupplierDocumentType)}>
                    {isComplete ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* All uploaded documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded documents</CardTitle>
            <CardDescription>All documents you have uploaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((d) => {
                const label = SUPPLIER_DOC_LABELS[d.documentType as SupplierDocumentType] ?? d.displayName ?? d.documentType;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {statusIcon(d.status)}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                        {d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Pending"}
                      </Badge>
                      {d.expiryDate && (
                        <span className="text-xs text-muted-foreground">
                          Exp: {new Date(d.expiryDate).toLocaleDateString("en-GB")}
                        </span>
                      )}
                      {d.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-delete-document-${d.id}`}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          onClick={() => setDeleteTarget(d)}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Upload button */}
      {canUpload && (
        <Button onClick={() => openUploadDialog()} className="w-full" variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Upload a document
        </Button>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Document type</Label>
              <Select value={uploadDocType ?? ""} onValueChange={(v) => setUploadDocType(v as SupplierDocumentType)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {[...requiredDocTypes, "other"].map((type) => (
                    <SelectItem key={type} value={type}>{SUPPLIER_DOC_LABELS[type as SupplierDocumentType] ?? type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uploadDocType === "other" && (
              <div>
                <Label>Document name</Label>
                <Input value={uploadDisplayName} onChange={(e) => setUploadDisplayName(e.target.value)} placeholder="e.g. Additional insurance" />
              </div>
            )}
            <div>
              <Label>Expiry date (optional)</Label>
              <Input type="date" value={uploadExpiryDate} onChange={(e) => setUploadExpiryDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Any notes about this document" />
            </div>
            <div>
              <Label>File</Label>
              <Input
                ref={uploadInputRef}
                type="file"
                onChange={(e) => setUploadFileSelected(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
              <Button
                disabled={!uploadDocType || !uploadFileSelected || isUploading || (uploadDocType === "other" && !uploadDisplayName.trim())}
                onClick={() => {
                  if (!uploadDocType || !uploadFileSelected) return;
                  uploadFormRef.current = { type: uploadDocType, displayName: uploadDisplayName, expiryDate: uploadExpiryDate, notes: uploadNotes };
                  uploadFile(uploadFileSelected);
                }}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-document"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
