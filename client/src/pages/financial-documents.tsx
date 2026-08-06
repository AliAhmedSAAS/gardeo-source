import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Upload, Search, Trash2, Download, FileText, Image, FileSpreadsheet,
  File, FolderOpen, Eye, Pencil, Plus, X, Calendar, Filter
} from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "statement", label: "Statement" },
  { value: "contract", label: "Contract" },
  { value: "credit_note", label: "Credit Note" },
  { value: "other", label: "Other" },
];

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.csv,.xls,.xlsx";
const ACCEPTED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5" />;
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function typeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "invoice": return "default";
    case "receipt": return "secondary";
    case "contract": return "outline";
    default: return "secondary";
  }
}

export default function FinancialDocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [uploadForm, setUploadForm] = useState({
    title: "",
    documentType: "receipt" as string,
    description: "",
    supplierId: "",
    clientId: "",
    amount: "",
    taxYear: "",
    category: "",
    tags: "",
  });
  const [uploadedFile, setUploadedFile] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string } | null>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      setUploadedFile({
        fileUrl: response.objectPath,
        fileName: response.metadata.name,
        fileSize: response.metadata.size,
        mimeType: response.metadata.contentType,
      });
      toast({ title: "File uploaded", description: "Now fill in the document details." });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
    if (supplierFilter && supplierFilter !== "all") params.set("supplierId", supplierFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  };

  const documentsQuery = useQuery<any>({
    queryKey: ["/api/financial-documents", searchQuery, typeFilter, supplierFilter, dateFrom, dateTo],
    queryFn: async () => {
      const qs = buildQueryParams();
      const res = await fetch(`/api/financial-documents?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const statsQuery = useQuery<any>({
    queryKey: ["/api/financial-documents/stats"],
    queryFn: async () => {
      const res = await fetch("/api/financial-documents/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const suppliersQuery = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const clientsQuery = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/financial-documents", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document saved", description: "Financial document has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents/stats"] });
      resetUploadForm();
      setUploadDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/financial-documents/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Document updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents/stats"] });
      setSelectedDoc(data);
      setEditMode(false);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/financial-documents/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-documents/stats"] });
      setDeleteConfirmId(null);
      setDetailDialogOpen(false);
      setSelectedDoc(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const resetUploadForm = () => {
    setUploadForm({ title: "", documentType: "receipt", description: "", supplierId: "", clientId: "", amount: "", taxYear: "", category: "", tags: "" });
    setUploadedFile(null);
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_MIMES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Accepted: PDF, JPG, PNG, CSV, XLS, XLSX", variant: "destructive" });
      return;
    }
    await uploadFile(file);
  }, [uploadFile, toast]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!ACCEPTED_MIMES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Accepted: PDF, JPG, PNG, CSV, XLS, XLSX", variant: "destructive" });
      return;
    }
    await uploadFile(file);
  }, [uploadFile, toast]);

  const handleCreateSubmit = () => {
    if (!uploadedFile) {
      toast({ title: "No file", description: "Please upload a file first.", variant: "destructive" });
      return;
    }
    if (!uploadForm.title.trim()) {
      toast({ title: "Title required", description: "Please enter a document title.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...uploadForm,
      fileName: uploadedFile.fileName,
      fileUrl: uploadedFile.fileUrl,
      fileSize: uploadedFile.fileSize,
      mimeType: uploadedFile.mimeType,
      supplierId: uploadForm.supplierId ? parseInt(uploadForm.supplierId) : null,
      clientId: uploadForm.clientId ? parseInt(uploadForm.clientId) : null,
      amount: uploadForm.amount || null,
      tags: uploadForm.tags ? uploadForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    });
  };

  const handleUpdateSubmit = () => {
    if (!selectedDoc) return;
    updateMutation.mutate({
      id: selectedDoc.id,
      title: uploadForm.title,
      documentType: uploadForm.documentType,
      description: uploadForm.description,
      supplierId: uploadForm.supplierId ? parseInt(uploadForm.supplierId) : null,
      clientId: uploadForm.clientId ? parseInt(uploadForm.clientId) : null,
      amount: uploadForm.amount || null,
      taxYear: uploadForm.taxYear || null,
      category: uploadForm.category || null,
      tags: uploadForm.tags ? uploadForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    });
  };

  const openDetail = (doc: any) => {
    setSelectedDoc(doc);
    setEditMode(false);
    setUploadForm({
      title: doc.title || "",
      documentType: doc.document_type || doc.documentType || "other",
      description: doc.description || "",
      supplierId: doc.supplier_id?.toString() || doc.supplierId?.toString() || "",
      clientId: doc.client_id?.toString() || doc.clientId?.toString() || "",
      amount: doc.amount || "",
      taxYear: doc.tax_year || doc.taxYear || "",
      category: doc.category || "",
      tags: (doc.tags || []).join(", "),
    });
    setDetailDialogOpen(true);
  };

  const documents = documentsQuery.data || [];
  const stats = statsQuery.data || {};
  const suppliers = (suppliersQuery.data || []) as any[];
  const clients = (clientsQuery.data || []) as any[];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Financial Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">Store and manage receipts, invoices, statements and contracts</p>
        </div>
        <Button
          onClick={() => { resetUploadForm(); setUploadDialogOpen(true); }}
          data-testid="button-upload-document"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold" data-testid="text-total-docs">{stats.totalCount || 0}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total File Size</p>
                  <p className="text-2xl font-bold" data-testid="text-total-size">{formatFileSize(stats.totalSize || 0)}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Recent Uploads (7d)</p>
                  <p className="text-2xl font-bold" data-testid="text-recent-uploads">{stats.recentCount || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stats.byType && Object.entries(stats.byType).map(([type, count]: [string, any]) => (
                      <Badge key={type} variant="secondary" className="text-xs" data-testid={`badge-type-${type}`}>
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Filter className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Document Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Supplier</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger data-testid="select-supplier-filter">
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.companyName || s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="input-date-from" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="input-date-to" />
            </div>
            {(searchQuery || typeFilter !== "all" || supplierFilter !== "all" || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSearchQuery(""); setTypeFilter("all"); setSupplierFilter("all"); setDateFrom(""); setDateTo(""); }}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {documentsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium" data-testid="text-empty-state">No documents found</p>
            <p className="text-sm text-muted-foreground mt-1">Upload your first financial document to get started.</p>
            <Button
              className="mt-4"
              onClick={() => { resetUploadForm(); setUploadDialogOpen(true); }}
              data-testid="button-upload-empty"
            >
              <Plus className="h-4 w-4 mr-2" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc: any) => (
            <Card
              key={doc.id}
              className="hover-elevate cursor-pointer"
              onClick={() => openDetail(doc)}
              data-testid={`card-document-${doc.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {getFileIcon(doc.mime_type || doc.mimeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.file_name || doc.fileName}</p>
                    <div className="flex items-center flex-wrap gap-1 mt-2">
                      <Badge variant={typeBadgeVariant(doc.document_type || doc.documentType)} className="text-xs" data-testid={`badge-doc-type-${doc.id}`}>
                        {(doc.document_type || doc.documentType || "").replace("_", " ")}
                      </Badge>
                      {doc.amount && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-doc-amount-${doc.id}`}>
                          {doc.currency || "GBP"} {parseFloat(doc.amount).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size || doc.fileSize)}</span>
                      <span>{formatDate(doc.created_at || doc.createdAt)}</span>
                    </div>
                    {(doc.supplier_name || doc.supplierName) && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Supplier: {doc.supplier_name || doc.supplierName}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) { resetUploadForm(); } setUploadDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-upload-dialog-title">Upload Financial Document</DialogTitle>
            <DialogDescription>Upload a file and fill in the document details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!uploadedFile ? (
              <div
                className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                data-testid="dropzone-upload"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Drag & drop a file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, CSV, XLS, XLSX</p>
                    <Input
                      type="file"
                      accept={ACCEPTED_TYPES}
                      onChange={handleFileSelect}
                      className="mt-3 max-w-[250px] mx-auto"
                      data-testid="input-file-upload"
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                {getFileIcon(uploadedFile.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFile.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.fileSize)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setUploadedFile(null)} data-testid="button-remove-file">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div>
              <Label>Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder="e.g. March 2024 Invoice"
                data-testid="input-doc-title"
              />
            </div>

            <div>
              <Label>Document Type</Label>
              <Select value={uploadForm.documentType} onValueChange={(v) => setUploadForm({ ...uploadForm, documentType: v })}>
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Optional description..."
                data-testid="input-doc-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier</Label>
                <Select value={uploadForm.supplierId} onValueChange={(v) => setUploadForm({ ...uploadForm, supplierId: v })}>
                  <SelectTrigger data-testid="select-doc-supplier">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.companyName || s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client</Label>
                <Select value={uploadForm.clientId} onValueChange={(v) => setUploadForm({ ...uploadForm, clientId: v })}>
                  <SelectTrigger data-testid="select-doc-client">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.companyName || c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={uploadForm.amount}
                  onChange={(e) => setUploadForm({ ...uploadForm, amount: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-doc-amount"
                />
              </div>
              <div>
                <Label>Tax Year</Label>
                <Input
                  value={uploadForm.taxYear}
                  onChange={(e) => setUploadForm({ ...uploadForm, taxYear: e.target.value })}
                  placeholder="e.g. 2024/25"
                  data-testid="input-doc-tax-year"
                />
              </div>
            </div>

            <div>
              <Label>Tags</Label>
              <Input
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                placeholder="Comma-separated tags"
                data-testid="input-doc-tags"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || !uploadedFile}
              data-testid="button-save-document"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={(open) => { if (!open) { setEditMode(false); } setDetailDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-detail-dialog-title">
              {editMode ? "Edit Document" : "Document Details"}
            </DialogTitle>
            <DialogDescription>
              {editMode ? "Update the document metadata." : "View document information and actions."}
            </DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                {getFileIcon(selectedDoc.mime_type || selectedDoc.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedDoc.file_name || selectedDoc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedDoc.file_size || selectedDoc.fileSize)}</p>
                </div>
                {(selectedDoc.mime_type || selectedDoc.mimeType || "").startsWith("image/") && (
                  <Button variant="ghost" size="icon" onClick={() => window.open(selectedDoc.file_url || selectedDoc.fileUrl, "_blank")} data-testid="button-preview-image">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const url = selectedDoc.file_url || selectedDoc.fileUrl;
                    if (url) window.open(url, "_blank");
                  }}
                  data-testid="button-download-doc"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              {editMode ? (
                <>
                  <div>
                    <Label>Title</Label>
                    <Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} data-testid="input-edit-title" />
                  </div>
                  <div>
                    <Label>Document Type</Label>
                    <Select value={uploadForm.documentType} onValueChange={(v) => setUploadForm({ ...uploadForm, documentType: v })}>
                      <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} data-testid="input-edit-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={uploadForm.amount} onChange={(e) => setUploadForm({ ...uploadForm, amount: e.target.value })} data-testid="input-edit-amount" />
                    </div>
                    <div>
                      <Label>Tax Year</Label>
                      <Input value={uploadForm.taxYear} onChange={(e) => setUploadForm({ ...uploadForm, taxYear: e.target.value })} data-testid="input-edit-tax-year" />
                    </div>
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <Input value={uploadForm.tags} onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })} data-testid="input-edit-tags" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateSubmit} disabled={updateMutation.isPending} className="flex-1" data-testid="button-update-document">
                      {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)} data-testid="button-cancel-edit">Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Title</span>
                      <span className="text-sm font-medium" data-testid="text-detail-title">{selectedDoc.title}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Type</span>
                      <Badge variant={typeBadgeVariant(selectedDoc.document_type || selectedDoc.documentType)} data-testid="text-detail-type">
                        {(selectedDoc.document_type || selectedDoc.documentType || "").replace("_", " ")}
                      </Badge>
                    </div>
                    {selectedDoc.description && (
                      <div>
                        <span className="text-sm text-muted-foreground">Description</span>
                        <p className="text-sm mt-0.5" data-testid="text-detail-description">{selectedDoc.description}</p>
                      </div>
                    )}
                    {selectedDoc.amount && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Amount</span>
                        <span className="text-sm font-medium" data-testid="text-detail-amount">{selectedDoc.currency || "GBP"} {parseFloat(selectedDoc.amount).toFixed(2)}</span>
                      </div>
                    )}
                    {(selectedDoc.tax_year || selectedDoc.taxYear) && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Tax Year</span>
                        <span className="text-sm" data-testid="text-detail-tax-year">{selectedDoc.tax_year || selectedDoc.taxYear}</span>
                      </div>
                    )}
                    {(selectedDoc.supplier_name || selectedDoc.supplierName) && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Supplier</span>
                        <span className="text-sm" data-testid="text-detail-supplier">{selectedDoc.supplier_name || selectedDoc.supplierName}</span>
                      </div>
                    )}
                    {(selectedDoc.client_name || selectedDoc.clientName) && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Client</span>
                        <span className="text-sm" data-testid="text-detail-client">{selectedDoc.client_name || selectedDoc.clientName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Uploaded</span>
                      <span className="text-sm" data-testid="text-detail-date">{formatDate(selectedDoc.created_at || selectedDoc.createdAt)}</span>
                    </div>
                    {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Tags</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedDoc.tags.map((tag: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-tag-${i}`}>{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditMode(true)} className="flex-1" data-testid="button-edit-document">
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    {deleteConfirmId === selectedDoc.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(selectedDoc.id)}
                          disabled={deleteMutation.isPending}
                          data-testid="button-confirm-delete"
                        >
                          {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => setDeleteConfirmId(selectedDoc.id)} data-testid="button-delete-document">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
