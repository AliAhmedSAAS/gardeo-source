import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, CheckCircle2, Clock, Upload, AlertTriangle, RefreshCw,
  Download, Eye, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";

type DocumentData = {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string | null;
  expiryDate: string | null;
  notes: string | null;
};

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return null;
  if (days < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertTriangle className="w-3 h-3 mr-1" /> Expired {Math.abs(days)}d ago
      </Badge>
    );
  }
  if (days < 30) {
    return (
      <Badge variant="default" className="text-xs bg-red-500 border-red-500">
        <AlertTriangle className="w-3 h-3 mr-1" /> Expires in {days}d
      </Badge>
    );
  }
  if (days <= 90) {
    return (
      <Badge className="text-xs bg-amber-500 border-amber-500 text-white">
        <Clock className="w-3 h-3 mr-1" /> Expires in {days}d
      </Badge>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      Expires {new Date(expiryDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
    </span>
  );
}

const DOCUMENT_TYPES = [
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
    contentType: file.type,
  });
  const { uploadURL, objectPath } = await urlRes.json();
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!uploadRes.ok) throw new Error("Failed to upload file to storage");
  return objectPath;
}

function NewDocumentDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [documentType, setDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const objectPath = await uploadFileToStorage(selectedFile);
      const res = await apiRequest("POST", "/api/documents", {
        documentType: documentType,
        fileName: selectedFile.name,
        fileUrl: objectPath,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        expiryDate: expiryDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document uploaded", description: "Your document has been submitted and is pending verification." });
      onClose();
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload document. Please try again.", variant: "destructive" });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload New Document</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="doc-type">Document Type *</Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger data-testid="select-document-type">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{formatDocType(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-file">Choose File *</Label>
          <Input
            id="doc-file"
            data-testid="input-doc-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-expiry">Expiry Date</Label>
          <Input
            id="doc-expiry"
            data-testid="input-doc-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your document will be reviewed by an admin before being verified.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-upload">Cancel</Button>
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={uploadMutation.isPending || !selectedFile || !documentType}
          data-testid="button-submit-document"
        >
          {uploadMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-1.5" /> Upload Document</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function UploadReplacementDialog({ doc, onClose }: { doc: DocumentData; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const objectPath = await uploadFileToStorage(selectedFile);
      const res = await apiRequest("POST", "/api/documents", {
        documentType: doc.documentType,
        fileName: selectedFile.name,
        fileUrl: objectPath,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        expiryDate: expiryDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document submitted", description: "Your replacement document has been uploaded and is pending verification." });
      onClose();
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload document. Please try again.", variant: "destructive" });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload Replacement Document</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Uploading a replacement for: <span className="font-medium text-foreground capitalize">{doc.documentType.replace(/_/g, " ")}</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="replacement-file">Choose File *</Label>
          <Input
            id="replacement-file"
            data-testid="input-replacement-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="replacement-expiry">New Expiry Date</Label>
          <Input
            id="replacement-expiry"
            data-testid="input-replacement-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your replacement document will be reviewed by an admin before being verified.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-upload">Cancel</Button>
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={uploadMutation.isPending || !selectedFile}
          data-testid="button-submit-replacement"
        >
          {uploadMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-1.5" /> Upload Replacement</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function MyDocumentsPage() {
  const { data: documents = [], isLoading } = useQuery<DocumentData[]>({
    queryKey: ["/api/documents"],
  });
  const [replacingDoc, setReplacingDoc] = useState<DocumentData | null>(null);
  const [showNewDocForm, setShowNewDocForm] = useState(false);

  useEffect(() => {
    apiRequest("GET", "/api/employee/notifications/trigger").catch(() => {});
  }, []);

  const expiringDocs = documents.filter((doc) => {
    const days = getDaysUntilExpiry(doc.expiryDate);
    return days !== null && days < 30;
  });

  return (
    <div className="p-6 space-y-6" data-testid="my-documents-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground text-sm">View, download, and upload your documents.</p>
        </div>
        <Button onClick={() => setShowNewDocForm(true)} data-testid="button-upload-new-document">
          <Plus className="w-4 h-4 mr-1.5" /> Upload Document
        </Button>
      </div>

      {expiringDocs.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20" data-testid="card-expiry-warning">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-300">Documents expiring soon</p>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                  {expiringDocs.length} document{expiringDocs.length !== 1 ? "s are" : " is"} expiring within 30 days. Please upload replacements to stay compliant.
                </p>
                <ul className="mt-2 space-y-1">
                  {expiringDocs.map((doc) => (
                    <li key={doc.id} className="text-sm text-orange-700 dark:text-orange-400 capitalize">
                      • {doc.documentType.replace(/_/g, " ")} — {getDaysUntilExpiry(doc.expiryDate)! < 0 ? "expired" : `${getDaysUntilExpiry(doc.expiryDate)} days left`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No documents uploaded</h3>
            <p className="text-sm text-muted-foreground mt-2">Upload your first document to get started.</p>
            <Button className="mt-4" onClick={() => setShowNewDocForm(true)} data-testid="button-upload-first-document">
              <Plus className="w-4 h-4 mr-1.5" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const daysLeft = getDaysUntilExpiry(doc.expiryDate);
            const isExpiringSoon = daysLeft !== null && daysLeft < 30;
            return (
              <Card
                key={doc.id}
                data-testid={`card-document-${doc.id}`}
                className={isExpiringSoon ? "border-orange-300 dark:border-orange-700" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${isExpiringSoon ? "bg-orange-100 dark:bg-orange-950" : "bg-primary/10"}`}>
                        <FileText className={`w-5 h-5 ${isExpiringSoon ? "text-orange-500" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate" data-testid={`text-doc-filename-${doc.id}`}>
                          {doc.fileName}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                          <span className="capitalize" data-testid={`text-doc-type-${doc.id}`}>{doc.documentType.replace(/_/g, " ")}</span>
                          {doc.createdAt && (
                            <span data-testid={`text-doc-upload-date-${doc.id}`}>Uploaded {new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          )}
                          <ExpiryBadge expiryDate={doc.expiryDate} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap" data-testid={`actions-doc-${doc.id}`}>
                      {doc.isVerified ? (
                        <Badge variant="default" className="bg-green-600 border-green-600" data-testid={`badge-doc-verified-${doc.id}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-doc-pending-${doc.id}`}>
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                      {doc.fileUrl && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                            data-testid={`button-view-doc-${doc.id}`}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            asChild
                            data-testid={`button-download-doc-${doc.id}`}
                          >
                            <a href={doc.fileUrl} download={doc.fileName}>
                              <Download className="w-3.5 h-3.5 mr-1" /> Download
                            </a>
                          </Button>
                        </>
                      )}
                      {isExpiringSoon && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                          onClick={() => setReplacingDoc(doc)}
                          data-testid={`button-replace-doc-${doc.id}`}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" /> Replace
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!replacingDoc} onOpenChange={(open) => !open && setReplacingDoc(null)}>
        {replacingDoc && (
          <UploadReplacementDialog
            doc={replacingDoc}
            onClose={() => setReplacingDoc(null)}
          />
        )}
      </Dialog>

      <Dialog open={showNewDocForm} onOpenChange={(open) => !open && setShowNewDocForm(false)}>
        {showNewDocForm && (
          <NewDocumentDialog onClose={() => setShowNewDocForm(false)} />
        )}
      </Dialog>
    </div>
  );
}
