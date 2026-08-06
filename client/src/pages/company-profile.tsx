import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Pencil,
  Save,
  X,
  Upload,
  Phone,
  Mail,
  Globe,
  MapPin,
  Shield,
  Loader2,
  Search,
  Camera,
  PenLine,
  Eraser,
  FileText,
} from "lucide-react";
import type { Tenant } from "@shared/schema";

function SignatoryPad({ onSignatureChange }: { onSignatureChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing, getPos]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && hasDrawn) {
      const canvas = canvasRef.current;
      if (canvas) onSignatureChange(canvas.toDataURL("image/png"));
    }
    setIsDrawing(false);
  }, [isDrawing, hasDrawn, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div>
      <div className="border-2 border-dashed rounded-lg p-1 bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full cursor-crosshair touch-none"
          style={{ height: "120px" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid="canvas-signatory-pad"
        />
      </div>
      {hasDrawn && (
        <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={clearSignature} data-testid="btn-clear-signatory">
          <Eraser className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

export default function CompanyProfilePage() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const { toast } = useToast();

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/profile"],
  });

  useEffect(() => {
    if (tenant && !editing) {
      setForm({
        name: tenant.name || "",
        tradingName: tenant.tradingName || "",
        addressLine1: tenant.addressLine1 || "",
        addressLine2: tenant.addressLine2 || "",
        city: tenant.city || "",
        county: tenant.county || "",
        postcode: tenant.postcode || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        website: tenant.website || "",
        vatNumber: tenant.vatNumber || "",
        companyRegNumber: tenant.companyRegNumber || "",
        siaAcsNumber: tenant.siaAcsNumber || "",
      });
    }
  }, [tenant, editing]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      setEditing(false);
      toast({ title: "Profile updated", description: "Company details have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await apiRequest("PATCH", "/api/tenant/profile", { logoUrl: objectPath });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Logo uploaded", description: "Company logo has been updated." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function lookupCompany() {
    const regNum = form.companyRegNumber;
    if (!regNum || regNum.length < 6) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/companies-house/lookup/${regNum}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        name: data.companyName || prev.name,
        addressLine1: data.addressLine1 || prev.addressLine1,
        addressLine2: data.addressLine2 || prev.addressLine2,
        city: data.city || prev.city,
        county: data.county || prev.county,
        postcode: data.postcode || prev.postcode,
      }));
      toast({ title: "Company found", description: `${data.companyName} — ${data.companyStatus}` });
    } catch {
      toast({ title: "Lookup error", description: "Could not reach Companies House API", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No company profile found. Please contact your administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="company-profile-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Company Profile</h1>
            <p className="text-sm text-muted-foreground">View and manage your company details</p>
          </div>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} data-testid="btn-edit-profile">
            <Pencil className="w-4 h-4 mr-1" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} data-testid="btn-cancel-edit">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} data-testid="btn-save-profile">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center overflow-visible">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl.startsWith("/objects") ? tenant.logoUrl : `/objects/${tenant.logoUrl}`} alt="Company logo" className="w-24 h-24 rounded-lg object-cover" />
                ) : (
                  <Building2 className="w-12 h-12 text-primary" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer" data-testid="btn-upload-logo">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
            </div>
            <h2 className="text-lg font-bold" data-testid="text-company-name">{tenant.name}</h2>
            {tenant.tradingName && tenant.tradingName !== tenant.name && (
              <p className="text-sm text-muted-foreground">Trading as: {tenant.tradingName}</p>
            )}
            <Badge variant="outline" className="mt-2 capitalize">{tenant.industry || "Security"}</Badge>
            <Badge variant={tenant.isActive ? "default" : "outline"} className={`mt-2 ${tenant.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {tenant.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Details</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} data-testid="input-edit-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trading Name</Label>
                    <Input value={form.tradingName} onChange={(e) => setForm((p) => ({ ...p, tradingName: e.target.value }))} data-testid="input-edit-trading" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Company Registration Number</Label>
                  <div className="flex gap-2">
                    <Input value={form.companyRegNumber} onChange={(e) => setForm((p) => ({ ...p, companyRegNumber: e.target.value }))} data-testid="input-edit-reg" />
                    <Button type="button" variant="outline" onClick={lookupCompany} disabled={lookingUp || form.companyRegNumber.length < 6} data-testid="btn-lookup">
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-3">Address</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Address Line 1</Label>
                      <Input value={form.addressLine1} onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))} data-testid="input-edit-addr1" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Address Line 2</Label>
                      <Input value={form.addressLine2} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} data-testid="input-edit-addr2" />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} data-testid="input-edit-city" />
                    </div>
                    <div className="space-y-2">
                      <Label>County</Label>
                      <Input value={form.county} onChange={(e) => setForm((p) => ({ ...p, county: e.target.value }))} data-testid="input-edit-county" />
                    </div>
                    <div className="space-y-2">
                      <Label>Postcode</Label>
                      <Input value={form.postcode} onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))} data-testid="input-edit-postcode" />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-3">Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} data-testid="input-edit-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} data-testid="input-edit-email" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Website</Label>
                      <Input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} data-testid="input-edit-website" />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-3">Regulatory</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>VAT Number</Label>
                      <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} data-testid="input-edit-vat" />
                    </div>
                    <div className="space-y-2">
                      <Label>SIA ACS Number</Label>
                      <Input value={form.siaAcsNumber} onChange={(e) => setForm((p) => ({ ...p, siaAcsNumber: e.target.value }))} data-testid="input-edit-sia" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Company Name</p>
                    <p className="font-medium" data-testid="display-name">{tenant.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tenant ID</p>
                    <p className="font-mono text-xs" data-testid="display-tenant-id">{tenant.id}</p>
                  </div>
                  {tenant.tradingName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Trading Name</p>
                      <p data-testid="display-trading">{tenant.tradingName}</p>
                    </div>
                  )}
                  {tenant.companyRegNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Company Reg. Number</p>
                      <p data-testid="display-reg">{tenant.companyRegNumber}</p>
                    </div>
                  )}
                  {tenant.companyStatus && (
                    <div>
                      <p className="text-xs text-muted-foreground">Companies House Status</p>
                      <p className="capitalize" data-testid="display-ch-status">{tenant.companyStatus}</p>
                    </div>
                  )}
                </div>

                {(tenant.addressLine1 || tenant.city || tenant.postcode) && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />Registered Address</p>
                    <p className="text-sm" data-testid="display-address">
                      {[tenant.addressLine1, tenant.addressLine2, tenant.city, tenant.county, tenant.postcode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}

                <div className="border-t pt-3 grid grid-cols-2 gap-4 text-sm">
                  {tenant.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />Phone</p>
                      <p data-testid="display-phone">{tenant.phone}</p>
                    </div>
                  )}
                  {tenant.email && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />Email</p>
                      <p data-testid="display-email">{tenant.email}</p>
                    </div>
                  )}
                  {tenant.website && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />Website</p>
                      <p data-testid="display-website">{tenant.website}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 grid grid-cols-2 gap-4 text-sm">
                  {tenant.vatNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">VAT Number</p>
                      <p data-testid="display-vat">{tenant.vatNumber}</p>
                    </div>
                  )}
                  {tenant.siaAcsNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" />SIA ACS Number</p>
                      <p data-testid="display-sia">{tenant.siaAcsNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SelfBillingSignatorySection tenant={tenant} />
      <HrSignatorySection tenant={tenant} />
    </div>
  );
}

function SelfBillingSignatorySection({ tenant }: { tenant: Tenant }) {
  const { toast } = useToast();
  const [editingSignatory, setEditingSignatory] = useState(false);
  const [sigName, setSigName] = useState(tenant.selfBillingSignatoryName || "");
  const [sigPosition, setSigPosition] = useState(tenant.selfBillingSignatoryPosition || "");
  const [sigData, setSigData] = useState<string | null>(tenant.selfBillingSignatureData || null);

  useEffect(() => {
    if (!editingSignatory) {
      setSigName(tenant.selfBillingSignatoryName || "");
      setSigPosition(tenant.selfBillingSignatoryPosition || "");
      setSigData(tenant.selfBillingSignatureData || null);
    }
  }, [tenant, editingSignatory]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", {
        selfBillingSignatoryName: sigName || null,
        selfBillingSignatoryPosition: sigPosition || null,
        selfBillingSignatureData: sigData || null,
        selfBillingSignatureDate: sigName ? new Date().toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      setEditingSignatory(false);
      toast({ title: "Signatory saved", description: "Self-billing signatory details have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const hasExistingSignature = !!tenant.selfBillingSignatoryName;

  return (
    <Card data-testid="card-self-billing-signatory">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Self-Billing Signatory</CardTitle>
              <CardDescription>Your signature will appear on all supplier self-billing agreements</CardDescription>
            </div>
          </div>
          {!editingSignatory && (
            <Button variant="outline" size="sm" onClick={() => setEditingSignatory(true)} data-testid="btn-edit-signatory">
              <Pencil className="w-4 h-4 mr-1" />
              {hasExistingSignature ? "Update" : "Set Up"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editingSignatory ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signatory Name</Label>
                <Input
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Full name of authorised signatory"
                  data-testid="input-signatory-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Title</Label>
                <Input
                  value={sigPosition}
                  onChange={(e) => setSigPosition(e.target.value)}
                  placeholder="e.g. Managing Director"
                  data-testid="input-signatory-position"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <p className="text-xs text-muted-foreground">Draw your signature below using your mouse or touchscreen</p>
              <SignatoryPad onSignatureChange={setSigData} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSignatory(false)} data-testid="btn-cancel-signatory">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !sigName.trim()}
                data-testid="btn-save-signatory"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save Signatory
              </Button>
            </div>
          </div>
        ) : hasExistingSignature ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Signatory Name</p>
                <p className="font-medium" data-testid="display-signatory-name">{tenant.selfBillingSignatoryName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p data-testid="display-signatory-position">{tenant.selfBillingSignatoryPosition || "—"}</p>
              </div>
            </div>
            {tenant.selfBillingSignatureData && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Signature</p>
                <div className="border rounded-lg bg-white p-2 inline-block">
                  <img src={tenant.selfBillingSignatureData} alt="Signatory signature" className="h-16 object-contain" data-testid="img-signatory-signature" />
                </div>
              </div>
            )}
            {tenant.selfBillingSignatureDate && (
              <p className="text-xs text-muted-foreground">
                Set on {new Date(tenant.selfBillingSignatureDate).toLocaleDateString("en-GB", { dateStyle: "long" })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PenLine className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No signatory configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">Set up your signatory to have your signature appear on all supplier self-billing agreements</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HrSignatorySection({ tenant }: { tenant: Tenant }) {
  const { toast } = useToast();
  const [editingSignatory, setEditingSignatory] = useState(false);
  const [sigName, setSigName] = useState(tenant.hrSignatoryName || "");
  const [sigPosition, setSigPosition] = useState(tenant.hrSignatoryPosition || "");
  const [sigData, setSigData] = useState<string | null>(tenant.hrSignatureData || null);

  useEffect(() => {
    if (!editingSignatory) {
      setSigName(tenant.hrSignatoryName || "");
      setSigPosition(tenant.hrSignatoryPosition || "");
      setSigData(tenant.hrSignatureData || null);
    }
  }, [tenant, editingSignatory]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", {
        hrSignatoryName: sigName || null,
        hrSignatoryPosition: sigPosition || null,
        hrSignatureData: sigData || null,
        hrSignatureDate: sigName ? new Date().toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      setEditingSignatory(false);
      toast({ title: "HR signatory saved", description: "Your signature will appear on screening & vetting documents." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const hasExistingSignature = !!tenant.hrSignatoryName;

  return (
    <Card data-testid="card-hr-signatory">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">HR / Vetting Signatory</CardTitle>
              <CardDescription>
                Used on BS7858 screening documents (SF 17 completion certificate, reference letters, contracts)
              </CardDescription>
            </div>
          </div>
          {!editingSignatory && (
            <Button variant="outline" size="sm" onClick={() => setEditingSignatory(true)} data-testid="btn-edit-hr-signatory">
              <Pencil className="w-4 h-4 mr-1" />
              {hasExistingSignature ? "Update" : "Set Up"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editingSignatory ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signatory Name</Label>
                <Input
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="e.g. Vetting Officer name"
                  data-testid="input-hr-signatory-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Title</Label>
                <Input
                  value={sigPosition}
                  onChange={(e) => setSigPosition(e.target.value)}
                  placeholder="e.g. Vetting Officer"
                  data-testid="input-hr-signatory-position"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <p className="text-xs text-muted-foreground">Draw your signature below — appears on SF 17 and other vetting documents</p>
              <SignatoryPad onSignatureChange={setSigData} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSignatory(false)} data-testid="btn-cancel-hr-signatory">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !sigName.trim()}
                data-testid="btn-save-hr-signatory"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save Signatory
              </Button>
            </div>
          </div>
        ) : hasExistingSignature ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Signatory Name</p>
                <p className="font-medium" data-testid="display-hr-signatory-name">{tenant.hrSignatoryName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p data-testid="display-hr-signatory-position">{tenant.hrSignatoryPosition || "Vetting Officer"}</p>
              </div>
            </div>
            {tenant.hrSignatureData && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Signature</p>
                <div className="border rounded-lg bg-white p-2 inline-block">
                  <img src={tenant.hrSignatureData} alt="HR signatory signature" className="h-16 object-contain" data-testid="img-hr-signatory-signature" />
                </div>
              </div>
            )}
            {tenant.hrSignatureDate && (
              <p className="text-xs text-muted-foreground">
                Set on {new Date(tenant.hrSignatureDate).toLocaleDateString("en-GB", { dateStyle: "long" })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PenLine className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No HR / vetting signatory configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">Set this up so company name, address, and signature auto-fill on screening documents</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
