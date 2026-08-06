import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText, CheckCircle2, AlertTriangle, Clock, Shield,
  Loader2, PenLine, Building2, CalendarDays, Eraser, Globe, Download, Type,
} from "lucide-react";

interface AgreementData {
  agreementStatus: string;
  signatoryName: string | null;
  signatoryPosition: string | null;
  acceptedAt: string | null;
  expiryDate: string | null;
  agreementRef: string | null;
  signatureData: string | null;
  signedIp: string | null;
  supplier: {
    id: number;
    companyName: string;
    contactName: string;
    address: string | null;
    city: string | null;
    postcode: string | null;
    vatNumber: string | null;
    vatStatus: string | null;
    companyRegNumber: string | null;
    approvedAt: string | null;
    createdAt: string | null;
  };
  buyer: {
    companyName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    county: string;
    postcode: string;
    vatNumber: string;
    companyRegNumber: string;
    signatoryName: string | null;
    signatoryPosition: string | null;
    signatureData: string | null;
    signatureDate: string | null;
  };
}

function SignaturePad({ onSignatureChange }: { onSignatureChange: (data: string | null) => void }) {
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
    ctx.strokeStyle = "#1F3A5F";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }, [isDrawing, getPos, hasDrawn]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      onSignatureChange(canvas.toDataURL("image/png"));
    }
  }, [isDrawing, hasDrawn, onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1F3A5F";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasDrawn(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Draw Your Signature *</Label>
        <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="h-7 text-xs gap-1" data-testid="button-clear-signature">
          <Eraser className="w-3 h-3" /> Clear
        </Button>
      </div>
      <div className={`border-2 rounded-lg overflow-hidden ${hasDrawn ? "border-green-400" : "border-dashed border-gray-300"} bg-white`}>
        <canvas
          ref={canvasRef}
          width={600}
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
          data-testid="canvas-signature"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {hasDrawn ? "Signature captured — you can clear and redraw if needed" : "Use your mouse or finger to draw your signature above"}
      </p>
    </div>
  );
}

function InitialsPad({ onSignatureChange }: { onSignatureChange: (data: string | null) => void }) {
  const [initials, setInitials] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderInitials = useCallback((text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (text.trim().length < 2) {
      onSignatureChange(null);
      return;
    }
    ctx.fillStyle = "#1F3A5F";
    ctx.font = "italic 72px 'Georgia', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
    onSignatureChange(canvas.toDataURL("image/png"));
  }, [onSignatureChange]);

  const handleChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^a-zA-Z]/g, "").slice(0, 4);
    setInitials(cleaned);
    renderInitials(cleaned);
  }, [renderInitials]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Type Your Initials *</Label>
      <Input
        value={initials}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="e.g. JS"
        maxLength={4}
        className="text-lg font-semibold uppercase tracking-widest max-w-[200px]"
        data-testid="input-initials"
      />
      <div className={`border-2 rounded-lg overflow-hidden ${initials.trim().length >= 2 ? "border-green-400" : "border-dashed border-gray-300"} bg-white`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full"
          style={{ height: "120px" }}
          data-testid="canvas-initials"
        />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="text-initials-preview">
        {initials.trim().length >= 2 ? "Initials captured — your initials will be used as your signature" : "Enter at least 2 characters (letters only, max 4)"}
      </p>
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function AgreementText({ supplier, buyer, signedDate }: { supplier: AgreementData["supplier"]; buyer: AgreementData["buyer"]; signedDate?: string | null }) {
  const agreementDate = signedDate
    ? new Date(signedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const isVatRegistered = supplier.vatStatus === "vat_registered";
  return (
    <div className="space-y-4 text-sm leading-relaxed text-gray-800 dark:text-gray-200" data-testid="agreement-text">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold uppercase tracking-wide">Self-Billing Agreement</h2>
        <p className="text-xs text-muted-foreground mt-1">In accordance with HMRC VAT Notice 700/62</p>
        <p className="text-xs text-muted-foreground">Value Added Tax Act 1994, Section 29 | VAT Regulations 1995, Regulations 13(3) and 13(3A) to 13(3F)</p>
      </div>

      <div className="grid grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">The Customer (Self-Biller)</p>
          <p className="font-medium">{buyer.companyName}</p>
          {(buyer.addressLine1 || buyer.city || buyer.postcode) && (
            <p className="text-xs">{[buyer.addressLine1, buyer.addressLine2, buyer.city, buyer.county, buyer.postcode].filter(Boolean).join(", ")}</p>
          )}
          {buyer.vatNumber && <p className="text-xs">VAT Registration No: {buyer.vatNumber}</p>}
          {buyer.companyRegNumber && <p className="text-xs">Company Reg: {buyer.companyRegNumber}</p>}
        </div>
        <div>
          <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">The Supplier (Self-Billee)</p>
          <p className="font-medium">{supplier.companyName}</p>
          {supplier.address && <p className="text-xs">{supplier.address}{supplier.city ? `, ${supplier.city}` : ""}{supplier.postcode ? ` ${supplier.postcode}` : ""}</p>}
          {supplier.vatNumber ? <p className="text-xs">VAT Registration No: {supplier.vatNumber}</p> : <p className="text-xs text-amber-600 dark:text-amber-400">Not VAT Registered (0% VAT)</p>}
          {supplier.companyRegNumber && <p className="text-xs">Company Reg: {supplier.companyRegNumber}</p>}
        </div>
      </div>

      <p>This Self-Billing Agreement is entered into on <strong>{agreementDate}</strong> between the Customer (self-biller) and the Supplier (self-billee) named above, in accordance with HMRC VAT Notice 700/62.</p>

      <div>
        <h3 className="font-semibold mb-2">1. Purpose and Legal Basis</h3>
        <p>This agreement establishes a self-billing procedure as provided for under Section 29 of the Value Added Tax Act 1994 and Regulations 13(3) and 13(3A) to 13(3F) of the VAT Regulations 1995. Under this arrangement, the Customer shall prepare invoices on behalf of the Supplier for all supplies of goods and/or services covered by this agreement, in compliance with HMRC VAT Notice 700/62.</p>
        <p className="mt-1">VAT will be applied at the standard rate (currently 20%) where the Supplier is VAT registered, or at 0% where the Supplier is not VAT registered.</p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">2. Scope of Supplies</h3>
        <p>This agreement covers all supplies of security staffing, guarding services, and related labour services provided by the Supplier to the Customer, including but not limited to:</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>Security officer deployments and shift-based labour supply</li>
          <li>Event security and temporary staffing</li>
          <li>Any ancillary services agreed between the parties</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">3. Obligations of the Customer (Self-Biller)</h3>
        <p>The Customer ({buyer.companyName}) agrees to:</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>Issue self-billed invoices for all supplies made by the Supplier to the Customer for the duration of this agreement (VAT Notice 700/62, Section 4.1)</li>
          <li>Issue a copy of each self-billed invoice to the Supplier</li>
          <li>Complete self-billed invoices showing the Supplier's name, address and VAT registration number, together with all the details that constitute a full VAT invoice as required by VATREC5010, including:
            <ul className="list-disc ml-6 mt-0.5 space-y-0.5">
              <li>A unique sequential invoice number based on one or more series</li>
              <li>The time of supply (tax point) and the date of issue</li>
              <li>The Customer's name, address, and VAT registration number</li>
              <li>The Supplier's name, address, and VAT registration number (where applicable)</li>
              <li>A description sufficient to identify the services supplied</li>
              <li>The quantity of services and the unit price</li>
              <li>The rate of VAT and the amount payable, excluding VAT</li>
              <li>The gross total amount payable, excluding VAT</li>
              <li>The rate of any cash discount offered</li>
              <li>The total amount of VAT chargeable, expressed in sterling</li>
              <li>The reference <strong>"SELF-BILLING"</strong> clearly marked on each invoice (this has force of law under VAT Regulations 1995)</li>
              {isVatRegistered && <li>The statement: <strong>"The VAT shown is your output tax due to HMRC"</strong></li>}
            </ul>
          </li>
          <li>Make a new self-billing agreement if the Customer's VAT registration number changes</li>
          <li>Set up a new agreement if the Supplier transfers their business as a going concern, and both parties wish to continue self-billing</li>
          <li>Keep the names, addresses and VAT registration numbers of all suppliers with whom self-billing agreements exist, and produce this information for HMRC inspection on request (VAT Notice 700/62, Section 4.1)</li>
          {isVatRegistered && <li>Verify the Supplier's VAT registration number is valid before issuing self-billed invoices, using the HMRC "Check a VAT number" service where appropriate</li>}
          <li>Not issue self-billed VAT invoices on behalf of any supplier who is not registered for VAT, or who has cancelled their VAT registration (where VAT is being charged)</li>
          <li>Account for the VAT shown on all self-billed invoices in the appropriate VAT return</li>
          <li>Complete payment to the Supplier within the agreed payment terms</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">4. Obligations of the Supplier (Self-Billee)</h3>
        <p>The Supplier ({supplier.companyName}) agrees to:</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>Accept invoices raised by the Customer on their behalf for the duration of this agreement</li>
          <li><strong>Not raise {isVatRegistered ? "sales invoices or VAT invoices" : "invoices"}</strong> for the transactions covered by this agreement — the Customer will issue self-billed invoices instead</li>
          {isVatRegistered ? (
            <>
              <li>Notify the Customer immediately if there is any change to the Supplier's VAT registration number</li>
              <li>Notify the Customer immediately if the Supplier ceases to be VAT registered</li>
            </>
          ) : (
            <li>Notify the Customer immediately if the Supplier becomes VAT registered, providing their VAT registration number so that future invoices can include VAT at the applicable rate</li>
          )}
          <li>Notify the Customer immediately if the Supplier sells or transfers their business, or any part of their business, as a going concern</li>
          <li>Accept each self-billed invoice created by the Customer for supplies made to them by the Supplier</li>
          <li>Keep records of all self-billed invoices received from the Customer for a minimum of 6 years</li>
          <li>Approve or dispute timesheet entries within the agreed timeframe to facilitate accurate self-billing</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">5. VAT Compliance</h3>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          {isVatRegistered ? (
            <>
              <li>The current rate of VAT applicable is <strong>20%</strong> (standard rate) unless otherwise stated</li>
              <li>The Customer will verify the Supplier's VAT registration number before issuing any self-billed invoices and will re-verify at least every 12 months in accordance with VAT Notice 700/62, Section 3.3</li>
              <li>If the Supplier's VAT registration is cancelled, the Supplier must notify the Customer immediately — the Customer cannot claim back VAT on self-billed invoices raised to a supplier who is not VAT-registered</li>
              <li>Each self-billed invoice will include the statement: "The VAT shown is your output tax due to HMRC" to prevent the Supplier from claiming VAT back on these invoices by mistake (VAT Notice 700/62, Section 4.2)</li>
            </>
          ) : (
            <>
              <li>The Supplier is not currently VAT registered — all invoices will be issued at <strong>0% VAT</strong></li>
              <li>If the Supplier becomes VAT registered, the Supplier must immediately notify the Customer and provide their VAT registration number so that future invoices can include VAT at the standard rate (20%)</li>
            </>
          )}
          <li>The Customer must be VAT registered for the duration of this agreement</li>
          <li>Any changes to VAT status must be communicated in writing without delay</li>
          <li>Input tax may only be claimed on self-billed invoices where the conditions in VAT Notice 700/62 are met</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">6. Adjustments: Debit Notes and Credit Notes</h3>
        <p>In accordance with VAT Notice 700/62, Section 4.5:</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>The Customer shall not reduce the value of a supply for which a self-billed invoice has already been raised by reducing the total shown on a subsequent invoice</li>
          <li>Where the value of a supply needs to be adjusted, the Customer shall issue a <strong>self-billed debit note</strong> for the amount by which the value has changed</li>
          <li>Where a self-billed invoice overstates the amount due, the Customer shall issue a <strong>self-billed credit note</strong> referencing the original invoice and containing all information required by HMRC</li>
          <li>The Supplier agrees not to issue credit notes, debit notes, or any adjusting documents for supplies covered by this agreement</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">7. Electronic Invoicing</h3>
        <p>In accordance with HMRC VAT Notice 700/63 (Electronic Invoicing):</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>The Supplier consents to receiving self-billed invoices in electronic format via the Gardeo platform</li>
          <li>Electronic invoices issued under this agreement are the legal documents for VAT purposes — no duplicate paper invoices will be issued</li>
          <li>The Gardeo platform ensures the <strong>authenticity of origin</strong> (the identity of the issuer is verifiable), the <strong>integrity of content</strong> (invoice data cannot be altered after issue), and <strong>legibility</strong> (invoices can be easily read) through business controls that create a reliable audit trail between invoices and supplies</li>
          <li>All electronic invoices contain the same information as would be required on paper invoices as detailed in VATREC5010</li>
          <li>The total amount of VAT chargeable is expressed in sterling</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">8. Third Party Outsourcing</h3>
        <p>In accordance with VAT Notice 700/62, Section 4.4: the Customer may use the Gardeo workforce management platform as a third-party service provider to issue self-billed invoices on the Customer's behalf. The Customer remains responsible for ensuring that invoices are issued correctly, for maintaining self-billing agreements, and for producing records for HMRC inspection.</p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">9. Duration and Renewal</h3>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>This agreement is valid for <strong>12 months</strong> from the date of signing</li>
          <li>The agreement may be renewed by mutual consent for further 12-month periods, in accordance with VAT Notice 700/62, Section 3.3.1</li>
          <li>The Customer will review this agreement before its expiry to confirm the Supplier is still {isVatRegistered ? "VAT-registered and " : ""}willing to continue the self-billing arrangement (VAT Notice 700/62, Section 3.3.2)</li>
          {isVatRegistered && <li>The Customer will verify the Supplier's VAT registration number at each renewal</li>}
          <li>Both parties must avoid self-billing at any time when a valid written agreement is not in place</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">10. Termination</h3>
        <p>Either party may terminate this agreement by giving <strong>30 days' written notice</strong> to the other party. Termination is automatic and immediate if:</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>The Customer ceases to be VAT registered</li>
          <li>Either party goes into administration, receivership, or liquidation</li>
          <li>The Supplier transfers the business as a going concern (a new agreement must be established with the new owner if both parties wish to continue)</li>
          {isVatRegistered && <li>The Supplier ceases to be VAT registered or changes their VAT registration number (a new agreement must be drawn up)</li>}
        </ul>
        <p className="mt-1">Upon termination, the Customer shall issue any outstanding self-billed invoices within 14 days.</p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">11. Record Keeping</h3>
        <p>In accordance with HMRC VAT Notice 700/21 (Record Keeping):</p>
        <ul className="list-disc ml-6 mt-1 space-y-0.5">
          <li>Both parties agree to keep all self-billed invoices, credit notes, debit notes, and records relating to this agreement for a minimum of <strong>6 years</strong>, or such longer period as may be required by HMRC</li>
          <li>Records must be complete, up to date, and allow correct calculation of VAT payable or claimable</li>
          <li>These records must be made available for inspection by HMRC visiting officers on request</li>
          <li>The Customer must keep a list of all suppliers with whom self-billing agreements are in place, including names, addresses, and VAT registration numbers</li>
          <li>Digital records maintained through the Gardeo platform satisfy the requirements for functional compatible software under Making Tax Digital</li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">12. Governing Law</h3>
        <p>This agreement shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising under this agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
      </div>

      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          <strong>Legal Basis:</strong> This agreement is made pursuant to Section 29 of the Value Added Tax Act 1994 and Regulations 13(3) and 13(3A) to 13(3F) of the VAT Regulations 1995.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>HMRC Compliance References:</strong>
        </p>
        <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc ml-4 space-y-0.5">
          <li>VAT Notice 700/62 — Self-billing</li>
          <li>VAT Notice 700/21 — Record keeping</li>
          <li>VAT Notice 700/63 — Electronic invoicing</li>
          <li>VATREC5010 — VAT invoice: Details which must be shown on a full VAT invoice</li>
        </ul>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          Both parties confirm they understand and agree to the conditions set out herein and the requirements of HMRC for self-billing arrangements. Parts of this agreement that have force of law under the VAT Regulations 1995 are identified where applicable.
        </p>
      </div>
    </div>
  );
}

function SignedAgreementView({ data }: { data: AgreementData }) {
  const { toast } = useToast();
  const isExpired = data.expiryDate && new Date(data.expiryDate) < new Date();
  const daysRemaining = data.expiryDate
    ? Math.ceil((new Date(data.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">Self-Billing Agreement Active</h3>
                {isExpired ? (
                  <Badge variant="destructive" data-testid="badge-expired">Expired</Badge>
                ) : daysRemaining <= 30 ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-600" data-testid="badge-expiring-soon">Expiring Soon</Badge>
                ) : (
                  <Badge variant="outline" className="border-green-500 text-green-600" data-testid="badge-active">Active</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.buyer.companyName || "GuardianFM"} will issue self-billed VAT invoices on your behalf. You do not need to send invoices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span>Agreement Reference</span>
            </div>
            <p className="font-mono font-semibold text-sm" data-testid="text-agreement-ref">{data.agreementRef}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <PenLine className="h-4 w-4" />
              <span>Signed By</span>
            </div>
            <p className="font-semibold text-sm" data-testid="text-signatory">{data.signatoryName}</p>
            <p className="text-xs text-muted-foreground">{data.signatoryPosition}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CalendarDays className="h-4 w-4" />
              <span>Date Signed</span>
            </div>
            <p className="font-semibold text-sm" data-testid="text-signed-date">{formatDate(data.acceptedAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Expiry Date</span>
            </div>
            <p className="font-semibold text-sm" data-testid="text-expiry-date">{formatDate(data.expiryDate)}</p>
            {!isExpired && daysRemaining > 0 && (
              <p className="text-xs text-muted-foreground">{daysRemaining} days remaining</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Full Agreement</CardTitle>
              <CardDescription>HMRC-compliant self-billing agreement as signed</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-download-agreement-pdf"
              onClick={async () => {
                try {
                  const res = await fetch("/api/supplier-portal/self-billing-agreement/pdf", { credentials: "include" });
                  if (!res.ok) {
                    const errData = await res.json().catch(() => ({ message: "Failed to download agreement" }));
                    throw new Error(errData.message || "Failed to download agreement");
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Self-Billing-Agreement-${data.agreementRef || "agreement"}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  toast({
                    title: "Download failed",
                    description: err.message || "Could not download the agreement PDF",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AgreementText supplier={data.supplier} buyer={data.buyer} signedDate={data.acceptedAt} />
          <Separator className="my-6" />
          <div className="grid grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Signed for and on behalf of the Supplier</p>
              {data.signatureData && (
                <div className="mb-3 border rounded-lg bg-white p-2 inline-block">
                  <img src={data.signatureData} alt="Signature" className="h-16 object-contain" data-testid="img-signature" />
                </div>
              )}
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> <strong>{data.signatoryName}</strong></p>
                <p><span className="text-muted-foreground">Position:</span> {data.signatoryPosition}</p>
                <p><span className="text-muted-foreground">Company:</span> {data.supplier.companyName}</p>
                <p><span className="text-muted-foreground">Date & Time:</span> {data.acceptedAt ? new Date(data.acceptedAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "medium" }) : "—"}</p>
                {data.signedIp && (
                  <p className="flex items-center gap-1"><Globe className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">IP Address:</span> <span className="font-mono text-xs">{data.signedIp}</span></p>
                )}
                <p><span className="text-muted-foreground">Method:</span> Digital signature via Gardeo platform</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Signed for and on behalf of the Buyer</p>
              {data.buyer.signatureData && (
                <div className="mb-3 border rounded-lg bg-white p-2 inline-block">
                  <img src={data.buyer.signatureData} alt="Buyer Signature" className="h-16 object-contain" data-testid="img-buyer-signature" />
                </div>
              )}
              <div className="space-y-1 text-sm">
                {data.buyer.signatoryName ? (
                  <>
                    <p><span className="text-muted-foreground">Name:</span> <strong>{data.buyer.signatoryName}</strong></p>
                    {data.buyer.signatoryPosition && <p><span className="text-muted-foreground">Position:</span> {data.buyer.signatoryPosition}</p>}
                    <p><span className="text-muted-foreground">Company:</span> {data.buyer.companyName}</p>
                    <p><span className="text-muted-foreground">Date:</span> {formatDate(data.acceptedAt || data.buyer.signatureDate)}</p>
                    <p><span className="text-muted-foreground">Method:</span> Digital signature via Gardeo platform</p>
                  </>
                ) : (
                  <>
                    <p><span className="text-muted-foreground">Company:</span> <strong>{data.buyer.companyName}</strong></p>
                    <p><span className="text-muted-foreground">Date:</span> {formatDate(data.acceptedAt)}</p>
                    <p><span className="text-muted-foreground">Method:</span> Standing authorisation</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1F3A5F]" />
            HMRC Compliance References
          </CardTitle>
          <CardDescription>This agreement and all associated invoices comply with the following HMRC notices and legislation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
              <p className="font-semibold text-sm text-blue-800 dark:text-blue-200" data-testid="text-ref-70062">VAT Notice 700/62 — Self-billing</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Governs the self-billing arrangement, agreement requirements, invoice rules, and obligations of both parties</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 dark:border-green-900">
              <p className="font-semibold text-sm text-green-800 dark:text-green-200" data-testid="text-ref-70021">VAT Notice 700/21 — Record keeping</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Records retained for minimum 6 years, complete and up to date, available for HMRC inspection</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900">
              <p className="font-semibold text-sm text-purple-800 dark:text-purple-200" data-testid="text-ref-70063">VAT Notice 700/63 — Electronic invoicing</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Authenticity of origin, integrity of content, and legibility ensured through platform controls and audit trail</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900">
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-200" data-testid="text-ref-vatrec5010">VATREC5010 — Full VAT invoice details</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">All 14 mandatory data elements included on every self-billed invoice as required by VAT Regulations 1995</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Legal Basis:</strong> Value Added Tax Act 1994, Section 29 | VAT Regulations 1995, Regulations 13(3) and 13(3A) to 13(3F)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SelfBillingAgreementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryPosition, setSignatoryPosition] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureMethod, setSignatureMethod] = useState<"draw" | "initials">("draw");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [vatConfirmed, setVatConfirmed] = useState(false);
  const [noInvoiceConfirmed, setNoInvoiceConfirmed] = useState(false);
  const [electronicInvoiceConsent, setElectronicInvoiceConsent] = useState(false);
  const [recordKeepingConfirmed, setRecordKeepingConfirmed] = useState(false);

  const { data, isLoading } = useQuery<AgreementData>({
    queryKey: ["/api/supplier-portal/self-billing-agreement"],
  });

  const companyRegNumber = data?.supplier?.companyRegNumber;
  const { data: officersData } = useQuery<{
    officers: Array<{ name: string; role: string; appointedOn: string | null; resignedOn: string | null; isActive: boolean }>;
  }>({
    queryKey: ["/api/companies-house", companyRegNumber, "officers"],
    queryFn: async () => {
      const res = await fetch(`/api/companies-house/${encodeURIComponent(companyRegNumber!)}/officers`);
      if (!res.ok) throw new Error("Failed to fetch officers");
      return res.json();
    },
    enabled: !!companyRegNumber && data?.agreementStatus !== "active",
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!officersData?.officers?.length || signatoryName || data?.agreementStatus === "active") return;
    const referenceDate = data?.supplier?.approvedAt || data?.supplier?.createdAt;
    if (referenceDate) {
      const refStr = referenceDate.split("T")[0];
      const director = officersData.officers.find(o =>
        o.role === "director" &&
        o.appointedOn && o.appointedOn <= refStr &&
        (!o.resignedOn || o.resignedOn > refStr)
      );
      if (director) {
        setSignatoryName(director.name);
        setSignatoryPosition("Director");
      }
    } else {
      const activeDirector = officersData.officers.find(o => o.role === "director" && o.isActive);
      if (activeDirector) {
        setSignatoryName(activeDirector.name);
        setSignatoryPosition("Director");
      }
    }
  }, [officersData, data]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/supplier-portal/self-billing-agreement/accept", {
        signatoryName: signatoryName.trim(),
        signatoryPosition: signatoryPosition.trim(),
        signatureData,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Agreement Signed", description: "Your self-billing agreement is now active. A copy has been saved to your documents." });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/self-billing-agreement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/documents"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to sign agreement", variant: "destructive" });
    },
  });

  const canSign = signatoryName.trim().length >= 2 && signatoryPosition.trim().length >= 2 && !!signatureData && termsAccepted && vatConfirmed && noInvoiceConfirmed && electronicInvoiceConsent && recordKeepingConfirmed;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F3A5F]" />
      </div>
    );
  }

  const isActive = data?.agreementStatus === "active";
  const buyer = data?.buyer || { companyName: "Company", addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", vatNumber: "", companyRegNumber: "", signatoryName: null, signatoryPosition: null, signatureData: null, signatureDate: null };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#1F3A5F] rounded-lg">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F] dark:text-white" data-testid="text-page-title">Self-Billing Agreement</h1>
          <p className="text-sm text-muted-foreground">HMRC-compliant self-billing arrangement (VAT Notice 700/62)</p>
        </div>
      </div>

      {isActive && data ? (
        <SignedAgreementView data={data} />
      ) : (
        <div className="space-y-6">
          {data?.supplier.vatStatus !== "vat_registered" && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your company is not VAT registered. You can still enter into a self-billing agreement — invoices will be generated at <strong>0% VAT</strong>. If you become VAT registered in the future, please update your company profile and notify {buyer.companyName} immediately.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#1F3A5F]" />
                <CardTitle className="text-base">About Self-Billing</CardTitle>
              </div>
              <CardDescription>
                Under a self-billing arrangement, {buyer.companyName} will create invoices on your behalf based on approved timesheets{data?.supplier.vatStatus !== "vat_registered" ? " (at 0% VAT as you are not VAT registered)" : ""}.
                This means you do not need to send invoices — we handle the entire billing process.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="font-semibold text-sm text-blue-800 dark:text-blue-200">No Invoice Hassle</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">We create invoices for you based on approved timesheets</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="font-semibold text-sm text-green-800 dark:text-green-200">Faster Payment</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Self-billing streamlines payment processing</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p className="font-semibold text-sm text-purple-800 dark:text-purple-200">HMRC Compliant</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Fully compliant with VAT Notice 700/62</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Self-Billing Agreement Terms</CardTitle>
              <CardDescription>Please read the full agreement carefully before signing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto border rounded-lg p-6 bg-white dark:bg-gray-950">
                <AgreementText
                  supplier={data?.supplier || { id: 0, companyName: "", contactName: "", address: null, city: null, postcode: null, vatNumber: null, vatStatus: null, companyRegNumber: null }}
                  buyer={buyer}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-[#1F3A5F]" />
                <CardTitle className="text-base">Sign the Agreement</CardTitle>
              </div>
              <CardDescription>
                By signing below, you confirm that you have read and agree to all terms of this self-billing agreement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signatoryName">Full Name of Signatory *</Label>
                  <Input
                    id="signatoryName"
                    placeholder="e.g. John Smith"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    data-testid="input-signatory-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signatoryPosition">Position / Title *</Label>
                  <Input
                    id="signatoryPosition"
                    placeholder="e.g. Managing Director"
                    value={signatoryPosition}
                    onChange={(e) => setSignatoryPosition(e.target.value)}
                    data-testid="input-signatory-position"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={signatureMethod === "draw" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSignatureMethod("draw"); setSignatureData(null); }}
                    data-testid="button-tab-draw"
                  >
                    <PenLine className="w-4 h-4 mr-1" /> Draw Signature
                  </Button>
                  <Button
                    type="button"
                    variant={signatureMethod === "initials" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSignatureMethod("initials"); setSignatureData(null); }}
                    data-testid="button-tab-initials"
                  >
                    <Type className="w-4 h-4 mr-1" /> Type Initials
                  </Button>
                </div>
                {signatureMethod === "draw" ? (
                  <SignaturePad onSignatureChange={setSignatureData} />
                ) : (
                  <InitialsPad onSignatureChange={setSignatureData} />
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="termsAccepted"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="termsAccepted" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the terms of this self-billing agreement in accordance with HMRC VAT Notice 700/62
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="vatConfirmed"
                    checked={vatConfirmed}
                    onCheckedChange={(checked) => setVatConfirmed(checked === true)}
                    data-testid="checkbox-vat"
                  />
                  <Label htmlFor="vatConfirmed" className="text-sm leading-relaxed cursor-pointer">
                    {data?.supplier.vatStatus === "vat_registered"
                      ? `I confirm that ${data?.supplier.companyName || "our company"} is VAT registered (VAT No: ${data?.supplier.vatNumber || "—"}) and will notify ${buyer.companyName} immediately of any changes to our VAT registration`
                      : `I confirm that ${data?.supplier.companyName || "our company"} is not VAT registered and understand that all self-billed invoices will be issued at 0% VAT. I will notify ${buyer.companyName} immediately if we become VAT registered`}
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="noInvoiceConfirmed"
                    checked={noInvoiceConfirmed}
                    onCheckedChange={(checked) => setNoInvoiceConfirmed(checked === true)}
                    data-testid="checkbox-no-invoice"
                  />
                  <Label htmlFor="noInvoiceConfirmed" className="text-sm leading-relaxed cursor-pointer">
                    I understand that we must <strong>not issue {data?.supplier.vatStatus === "vat_registered" ? "VAT invoices" : "invoices"}</strong> for supplies covered by this agreement — {buyer.companyName} will issue self-billed invoices on our behalf
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="electronicInvoiceConsent"
                    checked={electronicInvoiceConsent}
                    onCheckedChange={(checked) => setElectronicInvoiceConsent(checked === true)}
                    data-testid="checkbox-electronic-consent"
                  />
                  <Label htmlFor="electronicInvoiceConsent" className="text-sm leading-relaxed cursor-pointer">
                    I consent to receiving self-billed invoices in <strong>electronic format</strong> via the Gardeo platform, in accordance with HMRC VAT Notice 700/63 (Electronic Invoicing). I understand that electronic invoices are the legal documents for VAT purposes.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="recordKeepingConfirmed"
                    checked={recordKeepingConfirmed}
                    onCheckedChange={(checked) => setRecordKeepingConfirmed(checked === true)}
                    data-testid="checkbox-record-keeping"
                  />
                  <Label htmlFor="recordKeepingConfirmed" className="text-sm leading-relaxed cursor-pointer">
                    I understand that all self-billing records must be retained for a minimum of <strong>6 years</strong> and made available for HMRC inspection on request, in accordance with VAT Notice 700/21 (Record Keeping)
                  </Label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => acceptMutation.mutate()}
                  disabled={!canSign || acceptMutation.isPending}
                  className="bg-[#1F3A5F] hover:bg-[#2a4d7a] px-8"
                  data-testid="button-sign-agreement"
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4 mr-2" />
                      Sign Self-Billing Agreement
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
