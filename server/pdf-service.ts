import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export interface OfferLetterData {
  applicantName: string;
  jobTitle: string;
  salary: string | null;
  startDate: string | null;
  companyName: string;
  companyAddress?: string;
  offerDate: string;
  notes?: string | null;
  // Optional: template sections from document_templates table
  templateHeaderTitle?: string | null;
  templateHeaderSubtitle?: string | null;
  templateSections?: Array<{ heading: string; text: string }> | null;
  templateFooterText?: string | null;
  templateComplianceText?: string | null;
}

export function generateOfferLetterPdf(data: OfferLetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const primaryColor = "#1F3A5F";
    const accentColor = "#FF8C42";
    const pageWidth = 495;
    const leftMargin = 60;

    // Header bar
    doc.rect(0, 0, 595, 8).fill(accentColor);
    doc.moveDown(0.5);

    // Company name
    doc.fontSize(18).font("Helvetica-Bold").fillColor(primaryColor);
    doc.text(data.companyName, leftMargin, 30, { width: pageWidth });
    if (data.companyAddress) {
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(data.companyAddress, leftMargin, undefined, { width: pageWidth });
    }

    doc.moveDown(2);

    // Date
    doc.fontSize(9).font("Helvetica").fillColor("#555");
    doc.text(data.offerDate, leftMargin, undefined, { width: pageWidth });

    doc.moveDown(1);

    // Helper: replace placeholders in template text
    const merge = (text: string) => text
      .replace(/\{\{APPLICANT_NAME\}\}/g, data.applicantName)
      .replace(/\{\{JOB_TITLE\}\}/g, data.jobTitle)
      .replace(/\{\{SALARY\}\}/g, data.salary ? `£${parseFloat(data.salary).toLocaleString("en-GB")}` : "To be confirmed")
      .replace(/\{\{START_DATE\}\}/g, data.startDate ? new Date(data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "To be confirmed")
      .replace(/\{\{COMPANY_NAME\}\}/g, data.companyName)
      .replace(/\{\{OFFER_DATE\}\}/g, data.offerDate);

    // Salutation
    doc.fontSize(11).font("Helvetica-Bold").fillColor(primaryColor);
    doc.text(`Dear ${data.applicantName},`, leftMargin, undefined, { width: pageWidth });

    doc.moveDown(1);

    // Subject line from template or default
    const headerTitle = data.templateHeaderTitle || "OFFER OF EMPLOYMENT";
    doc.fontSize(13).font("Helvetica-Bold").fillColor(primaryColor);
    doc.text(`${headerTitle} — ${data.jobTitle}`, leftMargin, undefined, { width: pageWidth });
    if (data.templateHeaderSubtitle) {
      doc.fontSize(9).font("Helvetica").fillColor("#666").text(data.templateHeaderSubtitle, leftMargin, undefined, { width: pageWidth });
    }

    doc.moveDown(1);

    // Template sections OR built-in defaults
    if (data.templateSections && data.templateSections.length > 0) {
      for (const section of data.templateSections) {
        if (section.heading) {
          doc.fontSize(11).font("Helvetica-Bold").fillColor(primaryColor);
          doc.text(section.heading, leftMargin, undefined, { width: pageWidth });
          doc.moveDown(0.3);
          doc.rect(leftMargin, doc.y, pageWidth, 1).fill(accentColor);
          doc.moveDown(0.4);
        }
        if (section.text) {
          doc.fontSize(10).font("Helvetica").fillColor("#222");
          doc.text(merge(section.text), leftMargin, undefined, { width: pageWidth });
          doc.moveDown(0.8);
        }
      }
    } else {
      // Built-in default sections
      doc.fontSize(10).font("Helvetica").fillColor("#222");
      doc.text(
        `We are pleased to offer you the position of ${data.jobTitle} at ${data.companyName}. ` +
        `We were impressed by your qualifications and experience, and we believe you will be a valuable addition to our team.`,
        leftMargin, undefined, { width: pageWidth }
      );
      doc.moveDown(1);

      // Terms table
      doc.fontSize(11).font("Helvetica-Bold").fillColor(primaryColor);
      doc.text("Terms of Offer", leftMargin, undefined, { width: pageWidth });
      doc.moveDown(0.5);
      doc.rect(leftMargin, doc.y, pageWidth, 1).fill(accentColor);
      doc.moveDown(0.5);

      const termRow = (label: string, value: string) => {
        const y = doc.y;
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#333").text(label, leftMargin, y, { width: 160 });
        doc.fontSize(9).font("Helvetica").fillColor("#222").text(value, leftMargin + 170, y, { width: pageWidth - 170 });
        doc.moveDown(0.6);
      };
      termRow("Position:", data.jobTitle);
      if (data.salary) termRow("Annual Salary:", `£${parseFloat(data.salary).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`);
      if (data.startDate) termRow("Proposed Start Date:", new Date(data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
      termRow("Employment Type:", "Subject to employment contract");
      doc.moveDown(0.5);

      if (data.notes) {
        doc.fontSize(10).font("Helvetica").fillColor("#222");
        doc.text(data.notes, leftMargin, undefined, { width: pageWidth });
        doc.moveDown(1);
      }

      doc.fontSize(10).font("Helvetica").fillColor("#222");
      doc.text(
        "This offer is conditional upon the satisfactory completion of pre-employment checks, including but not limited to reference verification, " +
        "identity checks, and any applicable licensing requirements (e.g. SIA licence where required).",
        leftMargin, undefined, { width: pageWidth }
      );
      doc.moveDown(1);
      doc.text(
        "Please confirm your acceptance of this offer by signing and returning a copy of this letter. " +
        "If you have any questions, please do not hesitate to contact us.",
        leftMargin, undefined, { width: pageWidth }
      );
    }

    doc.moveDown(2);

    // Footer text from template or default
    const footerBody = data.templateFooterText
      ? merge(data.templateFooterText)
      : "Yours sincerely,";

    doc.fontSize(10).font("Helvetica").fillColor("#222");
    doc.text(footerBody, leftMargin, undefined, { width: pageWidth });
    doc.moveDown(2);
    doc.text("_______________________________", leftMargin, undefined, { width: pageWidth });
    doc.moveDown(0.3);
    doc.text(`${data.companyName}`, leftMargin, undefined, { width: pageWidth });

    // Compliance text from template
    if (data.templateComplianceText) {
      doc.moveDown(1);
      doc.fontSize(8).font("Helvetica").fillColor("#777");
      doc.text(merge(data.templateComplianceText), leftMargin, undefined, { width: pageWidth });
    }

    // Acceptance section
    doc.moveDown(3);
    doc.rect(leftMargin, doc.y, pageWidth, 1).fill("#ccc");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor).text("Acceptance of Offer", leftMargin, undefined, { width: pageWidth });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#444");
    doc.text(`I, ${data.applicantName}, accept the offer of employment as ${data.jobTitle} at ${data.companyName} on the terms described above.`, leftMargin, undefined, { width: pageWidth });
    doc.moveDown(2);
    doc.text("Signature: _______________________________        Date: ___________________", leftMargin, undefined, { width: pageWidth });

    // Footer bar
    doc.rect(0, 785, 595, 8).fill(accentColor);
    doc.fontSize(7).fillColor("#888").font("Helvetica");
    doc.text("Confidential — This offer letter is generated electronically by the Gardeo Workforce Management Platform.", leftMargin, 775, { align: "center", width: pageWidth });

    doc.end();
  });
}

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLtd\b/gi, "Ltd")
    .replace(/\bLimited\b/gi, "Limited")
    .replace(/\bPlc\b/gi, "Plc")
    .replace(/\bLlp\b/gi, "LLP")
    .replace(/\bUk\b/g, "UK")
    .replace(/\bSc\b/g, "SC")
    .replace(/\b([A-Za-z]{1,2}\d{1,2}[A-Za-z]?\s?\d[A-Za-z]{2})\b/g, (m) => m.toUpperCase());
}

interface InvoiceLineItem {
  description: string | null;
  hours: string;
  rate: string;
  subtotal: string;
  vatRate: string | null;
  vatAmount: string | null;
  lineTotal: string | null;
}

interface TimesheetItem {
  date: string;
  siteName: string;
  hours: string;
  rate: string;
  amount: string;
  officerName?: string;
  startTime?: string;
  endTime?: string;
}

interface RemittancePaymentItem {
  date: string;
  description: string;
  amount: string;
  type: string;
}

interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  taxPointDate?: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  buyerName: string;
  buyerAddress?: string;
  buyerVatNumber?: string;
  buyerCompanyRegNumber?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierCompanyRegNumber?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierVatRegistered: boolean;
  supplierBankName?: string;
  supplierAccountName?: string;
  supplierSortCode?: string;
  supplierAccountNumber?: string;
  selfBillingAgreementRef?: string;
  lineItems: InvoiceLineItem[];
  timesheetItems?: TimesheetItem[];
  remittanceItems?: RemittancePaymentItem[];
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  issuedAt?: string;
  acceptedAt?: string;
  paidAt?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
}

interface CreditNotePdfData {
  creditNoteNumber: string;
  date: string;
  originalInvoiceNumber: string;
  reason: string;
  buyerName: string;
  buyerAddress?: string;
  buyerVatNumber?: string;
  buyerCompanyRegNumber?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierCompanyRegNumber?: string;
  supplierVatRegistered?: boolean;
  selfBillingAgreementRef?: string;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  issuedAt?: string;
}

interface AgreementPdfData {
  agreementRef: string;
  buyerName: string;
  buyerAddress?: string;
  buyerVatNumber?: string;
  buyerCompanyRegNumber?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierCompanyRegNumber?: string;
  signatoryName: string;
  signatoryPosition: string;
  signedDate: string;
  expiryDate: string;
  signatureImage?: string;
  signedIp?: string;
  signedTimestamp?: string;
  buyerSignatoryName?: string;
  buyerSignatoryPosition?: string;
  buyerSignatureImage?: string;
  buyerSignatureDate?: string;
}

interface TemplateData {
  headerTitle?: string | null;
  headerSubtitle?: string | null;
  sections?: Array<{ heading: string; text: string }> | null;
  footerText?: string | null;
  complianceText?: string | null;
  paymentTermsText?: string | null;
  invoiceFormat?: string | null;
}

function formatGBP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function drawCompanyBlock(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  maxWidth: number,
  data: {
    name: string;
    address?: string;
    vatNumber?: string;
    companyRegNumber?: string;
    phone?: string;
    email?: string;
    vatRegistered?: boolean;
  }
) {
  const lineGap = 3;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#1F3A5F").text(label, x, y);
  doc.font("Helvetica").fillColor("#000").fontSize(9);
  doc.text(data.name, x, y + 16, { width: maxWidth, lineGap });
  if (data.address) doc.text(data.address, x, undefined, { width: maxWidth, lineGap });
  if (data.companyRegNumber) doc.text(`Company Reg: ${data.companyRegNumber}`, x, undefined, { width: maxWidth, lineGap });
  if (data.vatNumber) doc.text(`VAT Reg No: ${data.vatNumber}`, x, undefined, { width: maxWidth, lineGap });
  if (data.vatRegistered === false) doc.text("(Not VAT Registered)", x, undefined, { width: maxWidth, lineGap });
  if (data.phone) doc.text(`Tel: ${data.phone}`, x, undefined, { width: maxWidth, lineGap });
  if (data.email) doc.text(`Email: ${data.email}`, x, undefined, { width: maxWidth, lineGap });
}

export function generateInvoicePdf(data: InvoicePdfData, template?: TemplateData | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const invoiceSubtitle = template?.headerSubtitle || "SELF-BILLING";
    const invoiceTitle = template?.headerTitle || "SELF-BILLED INVOICE";

    doc.rect(50, 40, 510, 24).fill("#1F3A5F");
    doc.fillColor("#fff").fontSize(12).font("Helvetica-Bold").text(invoiceSubtitle, 50, 44, { align: "center", width: 510 });
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(18).font("Helvetica-Bold").text(invoiceTitle, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Invoice No: ${data.invoiceNumber}`, { align: "center" });
    doc.moveDown(1.2);

    const leftCol = 50;
    const rightCol = 310;
    const colWidth = 240;
    const y = doc.y;

    drawCompanyBlock(doc, "FROM (Buyer / Self-Biller):", leftCol, y, colWidth, {
      name: data.buyerName,
      address: data.buyerAddress,
      vatNumber: data.buyerVatNumber,
      companyRegNumber: data.buyerCompanyRegNumber,
      phone: data.buyerPhone,
      email: data.buyerEmail,
    });

    drawCompanyBlock(doc, "TO (Supplier):", rightCol, y, colWidth, {
      name: toTitleCase(data.supplierName),
      address: data.supplierAddress ? toTitleCase(data.supplierAddress) : undefined,
      vatNumber: data.supplierVatNumber,
      companyRegNumber: data.supplierCompanyRegNumber,
      vatRegistered: data.supplierVatRegistered,
    });

    doc.moveDown(3);

    doc.rect(50, doc.y - 4, 510, 1).fill("#ddd");
    doc.moveDown(0.5);

    const detailY = doc.y;
    const detailLineHeight = 14;
    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(`Invoice Date: ${formatDate(data.invoiceDate)}`, leftCol, detailY);
    const taxPoint = data.taxPointDate || data.periodEnd;
    doc.text(`Tax Point (Date of Supply): ${formatDate(taxPoint)}`, leftCol, detailY + detailLineHeight);
    doc.text(`Supply Period: ${formatDate(data.periodStart)} — ${formatDate(data.periodEnd)}`, leftCol, detailY + detailLineHeight * 2);
    doc.text(`Currency: ${data.currency || "GBP (£)"}`, leftCol, detailY + detailLineHeight * 3);

    doc.fontSize(9).font("Helvetica").fillColor("#000");
    let rightDetailY = detailY;
    if (data.issuedAt) { doc.text(`Issued: ${formatDate(data.issuedAt)}`, rightCol, rightDetailY); rightDetailY += detailLineHeight; }
    if (data.acceptedAt) { doc.text(`Accepted by Supplier: ${formatDate(data.acceptedAt)}`, rightCol, rightDetailY); rightDetailY += detailLineHeight; }
    if (data.dueDate) { doc.text(`Due: ${formatDate(data.dueDate)}`, rightCol, rightDetailY); rightDetailY += detailLineHeight; }
    doc.text(`Status: ${(data.status || "draft").toUpperCase()}`, rightCol, rightDetailY);

    doc.y = detailY + detailLineHeight * 4 + 8;
    doc.moveDown(0.5);

    const cols = { desc: 50, hours: 270, rate: 325, subtotal: 385, vat: 445, total: 505 };

    const drawInvoiceTableHeader = (y: number) => {
      doc.rect(50, y - 4, 510, 20).fill("#1F3A5F");
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      doc.text("Description of Services", cols.desc, y, { width: 210 });
      doc.text("Hours", cols.hours, y, { width: 55, align: "right" });
      doc.text("Rate (£)", cols.rate, y, { width: 55, align: "right" });
      doc.text("Net (£)", cols.subtotal, y, { width: 55, align: "right" });
      doc.text("VAT (£)", cols.vat, y, { width: 55, align: "right" });
      doc.text("Gross (£)", cols.total, y, { width: 55, align: "right" });
      doc.fillColor("#000").font("Helvetica").fontSize(8);
    };

    const tableTop = doc.y;
    drawInvoiceTableHeader(tableTop);
    let rowY = tableTop + 22;

    const hasTimesheet = data.timesheetItems && data.timesheetItems.length > 0;
    const timesheetRef = `TS-${data.invoiceNumber.replace("SBI-GUA", "SBIGUA")}`;

    const useSummaryFormat = (template?.invoiceFormat === "summary" || template?.invoiceFormat === "summary_with_remittance") && hasTimesheet;

    if (useSummaryFormat) {
      let totalHours = 0;
      const rateSet = new Set<string>();
      for (const ts of data.timesheetItems!) {
        totalHours += parseFloat(ts.hours);
        rateSet.add(parseFloat(ts.rate).toFixed(2));
      }
      const rateDisplay = rateSet.size === 1 ? formatGBP([...rateSet][0]) : "Various";
      const shiftCount = data.timesheetItems!.length;

      const isSummaryWithRemittance = template?.invoiceFormat === "summary_with_remittance";
      const descText = isSummaryWithRemittance
        ? `Provision of security guarding services in accordance with the contract — ${shiftCount} shifts totalling ${totalHours.toFixed(2)} hours`
        : `Provision of security guarding services in accordance with the contract, as detailed in timesheet ref ${timesheetRef}`;
      const descHeight = doc.heightOfString(descText, { width: 210, fontSize: 8 });
      const dataRowH = Math.max(descHeight + 6, 20);
      doc.rect(50, rowY - 2, 510, dataRowH).fill("#f8f9fa");
      doc.fillColor("#000");
      doc.text(descText, cols.desc, rowY, { width: 210 });
      doc.text(totalHours.toFixed(2), cols.hours, rowY, { width: 55, align: "right" });
      doc.text(rateDisplay, cols.rate, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.subtotal), cols.subtotal, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.vatAmount), cols.vat, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.totalAmount), cols.total, rowY, { width: 55, align: "right" });
      rowY += dataRowH + 2;

      if (rateSet.size > 1) {
        const tsRateMap = new Map<string, { rate: number; shifts: number; hours: number; amount: number }>();
        for (const ts of data.timesheetItems!) {
          const r = parseFloat(ts.rate);
          const key = r.toFixed(2);
          const ex = tsRateMap.get(key) || { rate: r, shifts: 0, hours: 0, amount: 0 };
          ex.shifts++;
          ex.hours = Math.round((ex.hours + parseFloat(ts.hours)) * 100) / 100;
          ex.amount = Math.round((ex.amount + parseFloat(ts.amount)) * 100) / 100;
          tsRateMap.set(key, ex);
        }
        const sortedRates = Array.from(tsRateMap.values()).sort((a, b) => a.rate - b.rate);
        rowY += 2;
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F");
        doc.text("Rate Breakdown:", 55, rowY);
        rowY += 10;
        doc.font("Helvetica").fontSize(7).fillColor("#333");
        for (const rb of sortedRates) {
          doc.text(`${rb.shifts} shift${rb.shifts !== 1 ? "s" : ""} @ ${formatGBP(rb.rate)}/hr — ${rb.hours.toFixed(2)} hrs = ${formatGBP(rb.amount)}`, 60, rowY, { width: 300 });
          rowY += 10;
        }
        rowY += 2;
      }

      doc.fillColor("#000").fontSize(8);
    } else if (data.lineItems.length === 0) {
      const descText = hasTimesheet
        ? `Provision of security guarding services in accordance with the contract, as detailed in timesheet ref ${timesheetRef}`
        : "Provision of security guarding services in accordance with the contract";
      const descHeight0 = doc.heightOfString(descText, { width: 210, fontSize: 8 });
      const dataRowH0 = Math.max(descHeight0 + 6, 20);
      doc.rect(50, rowY - 2, 510, dataRowH0).fill("#f8f9fa");
      doc.fillColor("#000");
      doc.text(descText, cols.desc, rowY, { width: 210 });
      doc.text("—", cols.hours, rowY, { width: 55, align: "right" });
      doc.text("—", cols.rate, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.subtotal), cols.subtotal, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.vatAmount), cols.vat, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.totalAmount), cols.total, rowY, { width: 55, align: "right" });
      rowY += dataRowH0 + 2;
    } else {
      let totalHoursAll = 0;
      const rateSetAll = new Set<string>();
      for (const item of data.lineItems) {
        totalHoursAll += parseFloat(item.hours);
        rateSetAll.add(parseFloat(item.rate).toFixed(2));
      }
      const rateDisplayAll = rateSetAll.size === 1 ? formatGBP([...rateSetAll][0]) : "Various";

      const descTextLI = `Provision of security guarding services in accordance with the contract, as detailed in timesheet ref ${timesheetRef}`;
      const descHeightLI = doc.heightOfString(descTextLI, { width: 210, fontSize: 8 });
      const dataRowHLI = Math.max(descHeightLI + 6, 20);
      doc.rect(50, rowY - 2, 510, dataRowHLI).fill("#f8f9fa");
      doc.fillColor("#000");
      doc.text(descTextLI, cols.desc, rowY, { width: 210 });
      doc.text(totalHoursAll.toFixed(2), cols.hours, rowY, { width: 55, align: "right" });
      doc.text(rateDisplayAll, cols.rate, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.subtotal), cols.subtotal, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.vatAmount), cols.vat, rowY, { width: 55, align: "right" });
      doc.text(formatGBP(data.totalAmount), cols.total, rowY, { width: 55, align: "right" });
      rowY += dataRowHLI + 2;

      if (rateSetAll.size > 1) {
        const liRateMap = new Map<string, { rate: number; shifts: number; hours: number; amount: number }>();
        for (const item of data.lineItems) {
          const r = parseFloat(item.rate);
          const key = r.toFixed(2);
          const ex = liRateMap.get(key) || { rate: r, shifts: 0, hours: 0, amount: 0 };
          ex.shifts++;
          ex.hours = Math.round((ex.hours + parseFloat(item.hours)) * 100) / 100;
          ex.amount = Math.round((ex.amount + parseFloat(item.subtotal)) * 100) / 100;
          liRateMap.set(key, ex);
        }
        const sortedRates = Array.from(liRateMap.values()).sort((a, b) => a.rate - b.rate);
        rowY += 2;
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F");
        doc.text("Rate Breakdown:", 55, rowY);
        rowY += 10;
        doc.font("Helvetica").fontSize(7).fillColor("#333");
        for (const rb of sortedRates) {
          doc.text(`${rb.shifts} shift${rb.shifts !== 1 ? "s" : ""} @ ${formatGBP(rb.rate)}/hr — ${rb.hours.toFixed(2)} hrs = ${formatGBP(rb.amount)}`, 60, rowY, { width: 300 });
          rowY += 10;
        }
        rowY += 2;
        doc.fillColor("#000").fontSize(8);
      }
    }

    const summaryBlockHeight = 80;
    if (rowY + summaryBlockHeight > 750) {
      doc.addPage();
      rowY = 50;
    }

    const summaryX = 400;
    const summaryY = rowY + 14;
    const summaryLineH = 18;

    doc.font("Helvetica").fontSize(9).fillColor("#000");
    doc.text("Net Amount:", summaryX, summaryY);
    doc.text(formatGBP(data.subtotal), summaryX + 60, summaryY, { width: 100, align: "right" });

    const vatLabel = parseFloat(data.vatRate) === 0 ? "VAT @ 0% (Supplier not VAT\nregistered):" : `VAT @ ${data.vatRate}%:`;
    doc.text(vatLabel, summaryX, summaryY + summaryLineH);
    doc.text(formatGBP(data.vatAmount), summaryX + 60, summaryY + summaryLineH, { width: 100, align: "right" });

    let summaryOffset = summaryLineH * 2 + 4;
    if (parseFloat(data.vatRate) === 0) {
      summaryOffset = summaryLineH * 2 + 14;
    }
    if (data.supplierVatRegistered && parseFloat(data.vatRate) > 0) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#1F3A5F");
      doc.text("This is your output VAT due to HMRC", summaryX, summaryY + summaryLineH * 2);
      doc.font("Helvetica").fontSize(9).fillColor("#000");
      summaryOffset = summaryLineH * 2 + 16;
    }

    doc.rect(summaryX, summaryY + summaryOffset, 160, 1).fill("#1F3A5F");
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1F3A5F");
    doc.text("TOTAL DUE:", summaryX, summaryY + summaryOffset + 8);
    doc.text(formatGBP(data.totalAmount), summaryX + 60, summaryY + summaryOffset + 8, { width: 100, align: "right" });

    doc.fillColor("#000");
    rowY = summaryY + summaryOffset + 32;

    const remainingForFooter = 130;
    if (rowY + 28 + remainingForFooter > 780) {
      doc.addPage();
      rowY = 50;
    }

    if (data.supplierBankName || data.supplierAccountName || data.supplierSortCode || data.supplierAccountNumber) {
      const bankBlockHeight = 70;
      if (rowY + bankBlockHeight > 750) {
        doc.addPage();
        rowY = 50;
      }

      doc.rect(50, rowY, 510, 1).fill("#1F3A5F");
      rowY += 10;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
      doc.text("Remittance Details", 50, rowY, { width: 510 });
      rowY += 16;

      doc.font("Helvetica").fontSize(8).fillColor("#000");
      if (data.supplierBankName) {
        doc.text(`Bank: ${data.supplierBankName}`, 60, rowY, { width: 200 });
        rowY += 14;
      }
      if (data.supplierAccountName) {
        doc.text(`Account Name: ${toTitleCase(data.supplierAccountName)}`, 60, rowY, { width: 200 });
        rowY += 14;
      }
      if (data.supplierSortCode) {
        const sc = data.supplierSortCode.replace(/[^0-9]/g, "");
        const formatted = sc.length === 6 ? `${sc.slice(0,2)}-${sc.slice(2,4)}-${sc.slice(4,6)}` : data.supplierSortCode;
        doc.text(`Sort Code: ${formatted}`, 60, rowY, { width: 200 });
        rowY += 14;
      }
      if (data.supplierAccountNumber) {
        doc.text(`Account Number: ${data.supplierAccountNumber}`, 60, rowY, { width: 200 });
        rowY += 14;
      }

    }

    if (template?.paymentTermsText) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#1F3A5F");
      doc.text("Payment Terms:", 50, rowY, { width: 510 });
      rowY += 14;
      doc.font("Helvetica").fontSize(7).fillColor("#333");
      doc.text(template.paymentTermsText, 50, rowY, { width: 510 });
      rowY += 16;
    }

    rowY += 8;
    doc.rect(50, rowY, 510, 1).fill("#ddd");
    rowY += 10;

    doc.font("Helvetica").fontSize(7).fillColor("#666");
    doc.text(`Generated electronically by Guardian Workforce Management Platform`, 50, rowY, { align: "center", width: 510 });
    rowY += 10;

    if (hasTimesheet && template?.invoiceFormat !== "summary_with_remittance") {
      doc.addPage();

      doc.rect(50, 40, 510, 24).fill("#1F3A5F");
      doc.fillColor("#fff").fontSize(10).font("Helvetica-Bold").text("ITEMISED TIMESHEET", 50, 44, { align: "center", width: 510 });
      doc.fillColor("#000");
      doc.moveDown(1);

      doc.fontSize(9).font("Helvetica").fillColor("#666").text(`Timesheet Ref: ${timesheetRef}`, { align: "center" });
      doc.text(`Invoice Ref: ${data.invoiceNumber}`, { align: "center" });
      doc.text(`Supply Period: ${formatDate(data.periodStart)} — ${formatDate(data.periodEnd)}`, { align: "center" });
      doc.text(`Supplier: ${toTitleCase(data.supplierName)}`, { align: "center" });
      doc.moveDown(1.5);

      const tsCols = { date: 50, site: 130, hours: 340, rate: 410, amount: 480 };

      const drawTimesheetHeader = (y: number) => {
        doc.rect(50, y - 2, 510, 16).fill("#1F3A5F");
        doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
        doc.text("Date", tsCols.date, y, { width: 75 });
        doc.text("Site", tsCols.site, y, { width: 200 });
        doc.text("Hours", tsCols.hours, y, { width: 60, align: "right" });
        doc.text("Rate (£)", tsCols.rate, y, { width: 60, align: "right" });
        doc.text("Amount (£)", tsCols.amount, y, { width: 80, align: "right" });
        doc.fillColor("#000").font("Helvetica").fontSize(8);
      };

      const tsTableTop = doc.y;
      drawTimesheetHeader(tsTableTop);
      let tsRowY = tsTableTop + 20;
      let tsTotal = 0;
      let tsTotalHours = 0;

      const sortedItems = [...data.timesheetItems!].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 0; i < sortedItems.length; i++) {
        if (tsRowY > 750) {
          doc.addPage();
          tsRowY = 50;
          drawTimesheetHeader(tsRowY);
          tsRowY += 20;
        }
        const item = sortedItems[i];
        if (i % 2 === 0) {
          doc.rect(50, tsRowY - 2, 510, 14).fill("#f8f9fa");
          doc.fillColor("#000");
        }
        const hrs = parseFloat(item.hours);
        const amt = parseFloat(item.amount);
        tsTotalHours += hrs;
        tsTotal += amt;
        doc.text(formatDate(item.date), tsCols.date, tsRowY, { width: 75 });
        doc.text(item.siteName ? toTitleCase(item.siteName) : "—", tsCols.site, tsRowY, { width: 200 });
        doc.text(hrs.toFixed(2), tsCols.hours, tsRowY, { width: 60, align: "right" });
        doc.text(formatGBP(item.rate), tsCols.rate, tsRowY, { width: 60, align: "right" });
        doc.text(formatGBP(amt), tsCols.amount, tsRowY, { width: 80, align: "right" });
        tsRowY += 14;
      }

      doc.rect(50, tsRowY, 510, 1).fill("#1F3A5F");
      tsRowY += 6;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
      doc.text("TOTAL", tsCols.date, tsRowY);
      doc.text(`${sortedItems.length} shifts`, tsCols.site, tsRowY, { width: 200 });
      doc.text(tsTotalHours.toFixed(2), tsCols.hours, tsRowY, { width: 60, align: "right" });
      doc.text("", tsCols.rate, tsRowY, { width: 60, align: "right" });
      doc.text(formatGBP(tsTotal), tsCols.amount, tsRowY, { width: 80, align: "right" });

      doc.moveDown(2);
      doc.fillColor("#666").font("Helvetica").fontSize(7);
      doc.text("This itemised timesheet is an integral part of the self-billed invoice and should be retained for record-keeping purposes.", 50, doc.y, { width: 510 });
    }

    doc.end();
  });
}

export type TimesheetPdfData = {
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  supplierName: string;
  timesheetItems: Array<{ date: string; siteName: string; hours: string; rate: string; amount: string; officerName?: string; startTime?: string; endTime?: string }>;
  format?: "without_officer" | "with_officer" | "detailed";
  includeOfficer?: boolean;
};

function parseTimeHHMM(t?: string): string {
  if (!t) return "—";
  if (/^\d{4}-\d{2}-\d{2} /.test(t)) return t.substring(11, 16);
  if (/^\d{2}:\d{2}/.test(t)) return t.substring(0, 5);
  return t;
}

export function generateTimesheetPdf(data: TimesheetPdfData): Promise<Buffer> {
  const fmt = data.format || (data.includeOfficer ? "with_officer" : "without_officer");

  if (fmt === "detailed") {
    return generateDetailedTimesheetPdf(data);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const timesheetRef = `TS-${data.invoiceNumber.replace("SBI-GUA", "SBIGUA")}`;
    const showOfficer = fmt === "with_officer";

    doc.rect(50, 40, 510, 24).fill("#1F3A5F");
    doc.fillColor("#fff").fontSize(10).font("Helvetica-Bold").text("ITEMISED TIMESHEET", 50, 44, { align: "center", width: 510 });
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(9).font("Helvetica").fillColor("#666").text(`Timesheet Ref: ${timesheetRef}`, { align: "center" });
    doc.text(`Invoice Ref: ${data.invoiceNumber}`, { align: "center" });
    doc.text(`Supply Period: ${formatDate(data.periodStart)} — ${formatDate(data.periodEnd)}`, { align: "center" });
    doc.text(`Supplier: ${toTitleCase(data.supplierName)}`, { align: "center" });
    doc.moveDown(1.5);

    const tsCols = showOfficer
      ? { date: 50, officer: 120, site: 230, hours: 370, rate: 430, amount: 490 }
      : { date: 50, officer: 0, site: 130, hours: 340, rate: 410, amount: 480 };

    const drawTimesheetHeader = (y: number) => {
      doc.rect(50, y - 2, 510, 16).fill("#1F3A5F");
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      doc.text("Date", tsCols.date, y, { width: 65 });
      if (showOfficer) {
        doc.text("Officer", tsCols.officer, y, { width: 105 });
        doc.text("Site", tsCols.site, y, { width: 135 });
      } else {
        doc.text("Site", tsCols.site, y, { width: 200 });
      }
      doc.text("Hours", tsCols.hours, y, { width: 55, align: "right" });
      doc.text("Rate (£)", tsCols.rate, y, { width: 55, align: "right" });
      doc.text("Amount (£)", tsCols.amount, y, { width: 70, align: "right" });
      doc.fillColor("#000").font("Helvetica").fontSize(8);
    };

    const tsTableTop = doc.y;
    drawTimesheetHeader(tsTableTop);
    let tsRowY = tsTableTop + 20;
    let tsTotal = 0;
    let tsTotalHours = 0;

    const sortedItems = [...data.timesheetItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sortedItems.length; i++) {
      if (tsRowY > 750) {
        doc.addPage();
        tsRowY = 50;
        drawTimesheetHeader(tsRowY);
        tsRowY += 20;
      }
      const item = sortedItems[i];
      if (i % 2 === 0) {
        doc.rect(50, tsRowY - 2, 510, 14).fill("#f8f9fa");
        doc.fillColor("#000");
      }
      const hrs = parseFloat(item.hours);
      const amt = parseFloat(item.amount);
      tsTotalHours += hrs;
      tsTotal += amt;
      doc.text(formatDate(item.date), tsCols.date, tsRowY, { width: 65, height: 14, ellipsis: true });
      if (showOfficer) {
        doc.text(item.officerName ? toTitleCase(item.officerName) : "—", tsCols.officer, tsRowY, { width: 105, height: 14, ellipsis: true });
        doc.text(item.siteName ? toTitleCase(item.siteName) : "—", tsCols.site, tsRowY, { width: 135, height: 14, ellipsis: true });
      } else {
        doc.text(item.siteName ? toTitleCase(item.siteName) : "—", tsCols.site, tsRowY, { width: 200, height: 14, ellipsis: true });
      }
      doc.text(hrs.toFixed(2), tsCols.hours, tsRowY, { width: 55, align: "right", height: 14, ellipsis: true });
      doc.text(formatGBP(item.rate), tsCols.rate, tsRowY, { width: 55, align: "right", height: 14, ellipsis: true });
      doc.text(formatGBP(amt), tsCols.amount, tsRowY, { width: 70, align: "right", height: 14, ellipsis: true });
      tsRowY += 14;
    }

    doc.rect(50, tsRowY, 510, 1).fill("#1F3A5F");
    tsRowY += 6;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
    doc.text("TOTAL", tsCols.date, tsRowY);
    if (showOfficer) {
      doc.text("", tsCols.officer, tsRowY, { width: 105 });
      doc.text(`${sortedItems.length} shifts`, tsCols.site, tsRowY, { width: 135 });
    } else {
      doc.text(`${sortedItems.length} shifts`, tsCols.site, tsRowY, { width: 200 });
    }
    doc.text(tsTotalHours.toFixed(2), tsCols.hours, tsRowY, { width: 55, align: "right" });
    doc.text("", tsCols.rate, tsRowY, { width: 55, align: "right" });
    doc.text(formatGBP(tsTotal), tsCols.amount, tsRowY, { width: 70, align: "right" });

    doc.moveDown(2);
    doc.fillColor("#666").font("Helvetica").fontSize(7);
    doc.text("This itemised timesheet is an integral part of the self-billed invoice and should be retained for record-keeping purposes.", 50, doc.y, { width: 510 });

    doc.end();
  });
}

function generateDetailedTimesheetPdf(data: TimesheetPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const timesheetRef = `TS-${data.invoiceNumber.replace("SBI-GUA", "SBIGUA")}`;
    const pageWidth = 842 - 80;

    doc.fontSize(14).font("Helvetica-Bold").text(`Timesheet — ${toTitleCase(data.supplierName)}`, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").text(`Invoice: ${data.invoiceNumber} | Period: ${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)} | Total Shifts: ${data.timesheetItems.length}`, { align: "center" });
    doc.moveDown(0.8);

    const colWidths = [75, 250, 50, 50, 55, 55, 65, 80];
    const headers = ["Date", "Site", "Start", "End", "Hours", "Rate", "Amount"];
    const startX = 40;
    const totalTableW = colWidths.slice(0, 7).reduce((a, b) => a + b, 0);

    const drawHeader = (y: number) => {
      doc.font("Helvetica-Bold").fontSize(7);
      doc.rect(startX, y, totalTableW, 16).fill("#1F3A5F");
      let x = startX;
      headers.forEach((h, i) => {
        doc.fillColor("#FFFFFF").text(h, x + 3, y + 4, { width: colWidths[i] - 6, align: "left" });
        x += colWidths[i];
      });
      doc.fillColor("#000").font("Helvetica").fontSize(7);
      return y + 18;
    };

    let y = drawHeader(doc.y);
    let totalHours = 0;
    let totalAmount = 0;

    const sortedItems = [...data.timesheetItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sortedItems.length; i++) {
      if (y > 520) {
        doc.addPage({ layout: "landscape" });
        y = drawHeader(40);
      }
      const item = sortedItems[i];
      const hrs = parseFloat(item.hours);
      const amt = parseFloat(item.amount);
      totalHours += hrs;
      totalAmount += amt;

      const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F8F9FA";
      doc.rect(startX, y, totalTableW, 14).fill(rowBg);
      doc.fillColor("#333");

      const vals = [
        formatDate(item.date),
        item.siteName ? toTitleCase(item.siteName) : "—",
        parseTimeHHMM(item.startTime),
        parseTimeHHMM(item.endTime),
        hrs.toFixed(2),
        formatGBP(item.rate),
        formatGBP(amt),
      ];
      let x = startX;
      vals.forEach((v, vi) => {
        doc.text(v, x + 3, y + 3, { width: colWidths[vi] - 6, align: "left", height: 14, ellipsis: true });
        x += colWidths[vi];
      });
      y += 14;
    }

    y += 4;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#1F3A5F");
    doc.text(`Total: ${totalHours.toFixed(2)} hours | ${formatGBP(totalAmount)}`, startX, y);

    doc.end();
  });
}

export function generateCreditNotePdf(data: CreditNotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(20).font("Helvetica-Bold").text("SELF-BILLED CREDIT NOTE", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Credit Note No: ${data.creditNoteNumber}`, { align: "center" });
    if (data.selfBillingAgreementRef) {
      doc.fontSize(10).text(`Self-Billing Agreement Ref: ${data.selfBillingAgreementRef}`, { align: "center" });
    }
    doc.moveDown(1.2);

    const leftCol = 50;
    const rightCol = 310;
    const colWidth = 240;
    const y = doc.y;

    drawCompanyBlock(doc, "FROM (Buyer / Self-Biller):", leftCol, y, colWidth, {
      name: data.buyerName,
      address: data.buyerAddress,
      vatNumber: data.buyerVatNumber,
      companyRegNumber: data.buyerCompanyRegNumber,
    });

    drawCompanyBlock(doc, "TO (Supplier):", rightCol, y, colWidth, {
      name: toTitleCase(data.supplierName),
      address: data.supplierAddress ? toTitleCase(data.supplierAddress) : undefined,
      vatNumber: data.supplierVatNumber,
      companyRegNumber: data.supplierCompanyRegNumber,
      vatRegistered: data.supplierVatRegistered,
    });

    doc.moveDown(2);

    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(`Date: ${formatDate(data.date)}`);
    doc.text(`Original Invoice: ${data.originalInvoiceNumber}`);
    if (data.issuedAt) doc.text(`Issued: ${formatDate(data.issuedAt)}`);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("Reason for Credit Note:");
    doc.font("Helvetica").text(data.reason);

    doc.moveDown(2);
    const summaryX = 350;
    const summaryY = doc.y;

    doc.font("Helvetica").fontSize(10);
    doc.text("Net Amount:", summaryX, summaryY);
    doc.text(formatGBP(data.subtotal), summaryX + 80, summaryY, { width: 100, align: "right" });

    const isNonVat = data.supplierVatRegistered === false || (!data.supplierVatNumber && parseFloat(data.vatRate) === 0);
    const vatLabel = isNonVat ? `VAT @ ${data.vatRate}% (Supplier not VAT registered):` : `VAT @ ${data.vatRate}%:`;
    doc.text(vatLabel, summaryX, summaryY + 18);
    doc.text(formatGBP(data.vatAmount), summaryX + 80, summaryY + 18, { width: 100, align: "right" });

    doc.rect(summaryX, summaryY + 36, 180, 1).fill("#c0392b");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#c0392b");
    doc.text("CREDIT TOTAL:", summaryX, summaryY + 42);
    doc.text(formatGBP(data.totalAmount), summaryX + 80, summaryY + 42, { width: 100, align: "right" });

    if (isNonVat) {
      doc.moveDown(3);
      doc.rect(50, doc.y, 510, 24).fill("#eef6ff");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F").text("VAT Rate: 0% — Supplier is not VAT registered", 55, doc.y - 20, { width: 500 });
      doc.font("Helvetica").fontSize(7).fillColor("#333").text("The Supplier must not issue their own credit notes for supplies covered by the self-billing agreement.", 55, undefined, { width: 500 });
    }

    doc.moveDown(4);
    doc.rect(50, doc.y, 510, 1).fill("#ddd");
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F");
    doc.text("HMRC Compliance:", 50, doc.y, { width: 510 });
    doc.font("Helvetica").fontSize(7).fillColor("#666");
    doc.text("This self-billed credit note is issued in accordance with HMRC VAT Notice 700/62, Section 4.5 and adjusts the VAT originally charged on the referenced invoice.", 50, doc.y, { width: 510 });
    doc.moveDown(0.2);
    doc.text("Compliant with: VAT Notice 700/62 | VAT Notice 700/21 | VAT Notice 700/63 | VATREC5010", 50, doc.y, { width: 510 });
    doc.moveDown(0.2);
    doc.text(`Generated electronically by Guardian Workforce Management Platform`, 50, doc.y, { align: "center", width: 510 });

    doc.end();
  });
}

export function generateDebitNotePdf(data: CreditNotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(20).font("Helvetica-Bold").text("SELF-BILLED DEBIT NOTE", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Debit Note No: ${data.creditNoteNumber}`, { align: "center" });
    if (data.selfBillingAgreementRef) {
      doc.fontSize(10).text(`Self-Billing Agreement Ref: ${data.selfBillingAgreementRef}`, { align: "center" });
    }
    doc.moveDown(1.2);

    const leftCol = 50;
    const rightCol = 310;
    const colWidth = 240;
    const y = doc.y;

    drawCompanyBlock(doc, "FROM (Buyer / Self-Biller):", leftCol, y, colWidth, {
      name: data.buyerName,
      address: data.buyerAddress,
      vatNumber: data.buyerVatNumber,
      companyRegNumber: data.buyerCompanyRegNumber,
    });

    drawCompanyBlock(doc, "TO (Supplier):", rightCol, y, colWidth, {
      name: toTitleCase(data.supplierName),
      address: data.supplierAddress ? toTitleCase(data.supplierAddress) : undefined,
      vatNumber: data.supplierVatNumber,
      companyRegNumber: data.supplierCompanyRegNumber,
      vatRegistered: data.supplierVatRegistered,
    });

    doc.moveDown(2);

    doc.fontSize(9).font("Helvetica").fillColor("#000");
    doc.text(`Date: ${formatDate(data.date)}`);
    doc.text(`Original Invoice: ${data.originalInvoiceNumber}`);
    if (data.issuedAt) doc.text(`Issued: ${formatDate(data.issuedAt)}`);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("Reason for Debit Note:");
    doc.font("Helvetica").text(data.reason);

    doc.moveDown(2);
    const summaryX = 350;
    const summaryY = doc.y;

    doc.font("Helvetica").fontSize(10);
    doc.text("Net Amount:", summaryX, summaryY);
    doc.text(formatGBP(data.subtotal), summaryX + 80, summaryY, { width: 100, align: "right" });

    const dnIsNonVat = data.supplierVatRegistered === false || (!data.supplierVatNumber && parseFloat(data.vatRate) === 0);
    const dnVatLabel = dnIsNonVat ? `VAT @ ${data.vatRate}% (Supplier not VAT registered):` : `VAT @ ${data.vatRate}%:`;
    doc.text(dnVatLabel, summaryX, summaryY + 18);
    doc.text(formatGBP(data.vatAmount), summaryX + 80, summaryY + 18, { width: 100, align: "right" });

    doc.rect(summaryX, summaryY + 36, 180, 1).fill("#e67e22");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#e67e22");
    doc.text("DEBIT TOTAL:", summaryX, summaryY + 42);
    doc.text(formatGBP(data.totalAmount), summaryX + 80, summaryY + 42, { width: 100, align: "right" });

    if (dnIsNonVat) {
      doc.moveDown(3);
      doc.rect(50, doc.y, 510, 24).fill("#eef6ff");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F").text("VAT Rate: 0% — Supplier is not VAT registered", 55, doc.y - 20, { width: 500 });
      doc.font("Helvetica").fontSize(7).fillColor("#333").text("The Supplier must not issue their own debit notes for supplies covered by the self-billing agreement.", 55, undefined, { width: 500 });
    }

    doc.moveDown(4);
    doc.rect(50, doc.y, 510, 1).fill("#ddd");
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#1F3A5F");
    doc.text("HMRC Compliance:", 50, doc.y, { width: 510 });
    doc.font("Helvetica").fontSize(7).fillColor("#666");
    doc.text("This self-billed debit note is issued in accordance with HMRC VAT Notice 700/62, Section 4.5 and adjusts the value of the referenced invoice.", 50, doc.y, { width: 510 });
    doc.moveDown(0.2);
    doc.text("Compliant with: VAT Notice 700/62 | VAT Notice 700/21 | VAT Notice 700/63 | VATREC5010", 50, doc.y, { width: 510 });
    doc.moveDown(0.2);
    doc.text(`Generated electronically by Guardian Workforce Management Platform`, 50, doc.y, { align: "center", width: 510 });

    doc.end();
  });
}

export function generateSelfBillingAgreementPdf(data: AgreementPdfData, template?: TemplateData | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const agreementTitle = template?.headerTitle || "SELF-BILLING AGREEMENT";
    const agreementSubtitle = template?.headerSubtitle || "In accordance with HMRC VAT Notice 700/62";

    doc.fontSize(18).font("Helvetica-Bold").text(agreementTitle, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Reference: ${data.agreementRef}`, { align: "center" });
    doc.moveDown(1.2);

    doc.fillColor("#000");
    const leftCol = 50;
    const rightCol = 310;
    const colWidth = 240;
    const partyY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F").text("The Customer (Self-Biller):", leftCol, partyY);
    doc.font("Helvetica").fillColor("#000").fontSize(9);
    doc.text(data.buyerName, leftCol, partyY + 14, { width: colWidth });
    if (data.buyerAddress) doc.text(data.buyerAddress, leftCol, undefined, { width: colWidth });
    if (data.buyerCompanyRegNumber) doc.text(`Company Reg: ${data.buyerCompanyRegNumber}`, leftCol, undefined, { width: colWidth });
    if (data.buyerVatNumber) doc.text(`VAT Registration No: ${data.buyerVatNumber}`, leftCol, undefined, { width: colWidth });

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F").text("The Supplier (Self-Billee):", rightCol, partyY);
    doc.font("Helvetica").fillColor("#000").fontSize(9);
    doc.text(data.supplierName, rightCol, partyY + 14, { width: colWidth });
    if (data.supplierAddress) doc.text(data.supplierAddress, rightCol, undefined, { width: colWidth });
    if (data.supplierCompanyRegNumber) doc.text(`Company Reg: ${data.supplierCompanyRegNumber}`, rightCol, undefined, { width: colWidth });
    if (data.supplierVatNumber) {
      doc.text(`VAT Registration No: ${data.supplierVatNumber}`, rightCol, undefined, { width: colWidth });
    } else {
      doc.text("(Not VAT Registered — invoices at 0% VAT)", rightCol, undefined, { width: colWidth });
    }

    const partyEndY = Math.max(doc.y, partyY + 80);
    doc.y = partyEndY;
    doc.x = 50;

    doc.moveDown(1);
    doc.rect(50, doc.y - 4, 510, 1).fill("#ddd");
    doc.moveDown(0.5);

    const isVat = !!(data.supplierVatNumber && data.supplierVatNumber.trim().length > 0);

    doc.font("Helvetica").fontSize(8.5).fillColor("#000");
    doc.text(`This Self-Billing Agreement is entered into on ${formatDate(data.signedDate)} between the Customer (self-biller) and the Supplier (self-billee) named above:`, 50, doc.y, { width: 510 });
    doc.moveDown(0.8);

    const processVatConditionals = (text: string, vatRegistered: boolean): string => {
      let result = text;
      if (vatRegistered) {
        result = result.replace(/\{\{IF_VAT\}\}([\s\S]*?)\{\{\/IF_VAT\}\}/g, "$1");
        result = result.replace(/\{\{IF_NOT_VAT\}\}[\s\S]*?\{\{\/IF_NOT_VAT\}\}/g, "");
      } else {
        result = result.replace(/\{\{IF_NOT_VAT\}\}([\s\S]*?)\{\{\/IF_NOT_VAT\}\}/g, "$1");
        result = result.replace(/\{\{IF_VAT\}\}[\s\S]*?\{\{\/IF_VAT\}\}/g, "");
      }
      return result.replace(/\n{3,}/g, "\n\n").trim();
    };

    const rawTemplateSections = template?.sections && Array.isArray(template.sections) ? template.sections as Array<{ heading: string; text: string }> : null;
    const templateSections = rawTemplateSections
      ? rawTemplateSections.map(s => ({ heading: s.heading, text: processVatConditionals(s.text, isVat) }))
      : null;

    const terms = templateSections || [
      { heading: "1. Purpose and Legal Basis", text: `This agreement establishes a self-billing procedure as provided for under Section 29 of the Value Added Tax Act 1994 and Regulations 13(3) and 13(3A) to 13(3F) of the VAT Regulations 1995. Under this arrangement, the Customer shall prepare invoices on behalf of the Supplier for all supplies of goods and/or services covered by this agreement, in compliance with HMRC VAT Notice 700/62.\nVAT will be applied at the standard rate (currently 20%) where the Supplier is VAT registered, or at 0% where the Supplier is not VAT registered.` },
      { heading: "2. Scope of Supplies", text: `This agreement covers all supplies of security staffing, guarding services, and related labour services provided by the Supplier to the Customer, including but not limited to:\n  \u2022 Security officer deployments and shift-based labour supply\n  \u2022 Event security and temporary staffing\n  \u2022 Any ancillary services agreed between the parties` },
      { heading: "3. Obligations of the Customer (Self-Biller)", text: `The Customer (${data.buyerName}) agrees to:\n  \u2022 Issue self-billed invoices for all supplies made by the Supplier for the duration of this agreement (VAT Notice 700/62, Section 4.1)\n  \u2022 Issue a copy of each self-billed invoice to the Supplier\n  \u2022 Complete self-billed invoices showing the Supplier's name, address and VAT registration number, together with all the details that constitute a full VAT invoice as required by VATREC5010, including: a unique sequential invoice number, the time of supply (tax point), the Customer's and Supplier's details, a description of the services, the unit price, VAT rate and amounts, and the reference "SELF-BILLING" clearly marked on each invoice\n${isVat ? '  \u2022 Include the statement: "The VAT shown is your output tax due to HMRC"\n' : ""}  \u2022 Make a new self-billing agreement if the Customer's VAT registration number changes\n  \u2022 Keep the names, addresses and VAT registration numbers of all suppliers with whom self-billing agreements exist, and produce this information for HMRC inspection on request${isVat ? "\n  \u2022 Verify the Supplier's VAT registration number is valid before issuing self-billed invoices" : ""}\n  \u2022 Not issue self-billed VAT invoices on behalf of any supplier who is not registered for VAT (where VAT is being charged)\n  \u2022 Account for the VAT shown on all self-billed invoices in the appropriate VAT return\n  \u2022 Complete payment to the Supplier within the agreed payment terms` },
      { heading: "4. Obligations of the Supplier (Self-Billee)", text: `The Supplier (${data.supplierName}) agrees to:\n  \u2022 Accept invoices raised by the Customer on their behalf for the duration of this agreement\n  \u2022 Not raise ${isVat ? "sales invoices or VAT invoices" : "invoices"} for the transactions covered by this agreement\n${isVat ? "  \u2022 Notify the Customer immediately if there is any change to the Supplier's VAT registration number\n  \u2022 Notify the Customer immediately if the Supplier ceases to be VAT registered\n" : "  \u2022 Notify the Customer immediately if the Supplier becomes VAT registered, providing their VAT registration number\n"}  \u2022 Notify the Customer immediately if the Supplier sells or transfers their business as a going concern\n  \u2022 Accept each self-billed invoice created by the Customer\n  \u2022 Keep records of all self-billed invoices received for a minimum of 6 years\n  \u2022 Approve or dispute timesheet entries within the agreed timeframe` },
      { heading: "5. VAT Compliance", text: isVat ? `\u2022 The current rate of VAT applicable is 20% (standard rate) unless otherwise stated\n  \u2022 The Customer will verify the Supplier's VAT registration number before issuing any self-billed invoices and will re-verify at least every 12 months in accordance with VAT Notice 700/62, Section 3.3\n  \u2022 If the Supplier's VAT registration is cancelled, the Supplier must notify the Customer immediately\n  \u2022 Each self-billed invoice will include the statement: "The VAT shown is your output tax due to HMRC"\n  \u2022 The Customer must be VAT registered for the duration of this agreement\n  \u2022 Any changes to VAT status must be communicated in writing without delay\n  \u2022 Input tax may only be claimed on self-billed invoices where the conditions in VAT Notice 700/62 are met` : `\u2022 The Supplier is not currently VAT registered \u2014 all invoices will be issued at 0% VAT\n  \u2022 If the Supplier becomes VAT registered, the Supplier must immediately notify the Customer and provide their VAT registration number\n  \u2022 The Customer must be VAT registered for the duration of this agreement\n  \u2022 Any changes to VAT status must be communicated in writing without delay\n  \u2022 Input tax may only be claimed on self-billed invoices where the conditions in VAT Notice 700/62 are met` },
      { heading: "6. Adjustments: Debit Notes and Credit Notes", text: `In accordance with VAT Notice 700/62, Section 4.5:\n  \u2022 The Customer shall not reduce the value of a supply for which a self-billed invoice has already been raised by reducing the total shown on a subsequent invoice\n  \u2022 Where the value of a supply needs to be adjusted, the Customer shall issue a self-billed debit note\n  \u2022 Where a self-billed invoice overstates the amount due, the Customer shall issue a self-billed credit note referencing the original invoice\n  \u2022 The Supplier agrees not to issue credit notes, debit notes, or any adjusting documents for supplies covered by this agreement` },
      { heading: "7. Electronic Invoicing", text: `In accordance with HMRC VAT Notice 700/63 (Electronic Invoicing):\n  \u2022 The Supplier consents to receiving self-billed invoices in electronic format via the Guardian platform\n  \u2022 Electronic invoices issued under this agreement are the legal documents for VAT purposes\n  \u2022 The Guardian platform ensures the authenticity of origin, the integrity of content, and legibility through business controls that create a reliable audit trail between invoices and supplies\n  \u2022 All electronic invoices contain the same information as would be required on paper invoices as detailed in VATREC5010\n  \u2022 The total amount of VAT chargeable is expressed in sterling` },
      { heading: "8. Third Party Outsourcing", text: `In accordance with VAT Notice 700/62, Section 4.4: the Customer may use the Guardian workforce management platform as a third-party service provider to issue self-billed invoices on the Customer's behalf. The Customer remains responsible for ensuring that invoices are issued correctly, for maintaining self-billing agreements, and for producing records for HMRC inspection.` },
      { heading: "9. Duration and Renewal", text: `\u2022 This agreement is valid for 12 months from the date of signing\n  \u2022 The agreement may be renewed by mutual consent for further 12-month periods, in accordance with VAT Notice 700/62, Section 3.3.1\n  \u2022 The Customer will review this agreement before its expiry to confirm the Supplier is${isVat ? " still VAT-registered and" : ""} willing to continue the self-billing arrangement (VAT Notice 700/62, Section 3.3.2)${isVat ? "\n  \u2022 The Customer will verify the Supplier's VAT registration number at each renewal" : ""}\n  \u2022 Both parties must avoid self-billing at any time when a valid written agreement is not in place` },
      { heading: "10. Termination", text: `Either party may terminate this agreement by giving 30 days' written notice to the other party. Termination is automatic and immediate if:\n  \u2022 The Customer ceases to be VAT registered\n  \u2022 Either party goes into administration, receivership, or liquidation\n  \u2022 The Supplier transfers the business as a going concern${isVat ? "\n  \u2022 The Supplier ceases to be VAT registered or changes their VAT registration number" : ""}\nUpon termination, the Customer shall issue any outstanding self-billed invoices within 14 days.` },
      { heading: "11. Record Keeping", text: `In accordance with HMRC VAT Notice 700/21 (Record Keeping):\n  \u2022 Both parties agree to keep all self-billed invoices, credit notes, debit notes, and records relating to this agreement for a minimum of 6 years, or such longer period as may be required by HMRC\n  \u2022 Records must be complete, up to date, and allow correct calculation of VAT payable or claimable\n  \u2022 These records must be made available for inspection by HMRC visiting officers on request\n  \u2022 The Customer must keep a list of all suppliers with whom self-billing agreements are in place\n  \u2022 Digital records maintained through the Guardian platform satisfy the requirements for functional compatible software under Making Tax Digital` },
      { heading: "12. Governing Law", text: "This agreement shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising under this agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales." },
    ];

    for (const term of terms) {
      const pageBreakMarker = "{{PAGE_BREAK}}";
      if (term.text.includes(pageBreakMarker)) {
        const parts = term.text.split(pageBreakMarker);
        doc.font("Helvetica-Bold").fontSize(8.5).text(term.heading, 50, doc.y, { width: 510 });
        doc.font("Helvetica").fontSize(8).text(parts[0].trimEnd(), 50, doc.y, { width: 510 });
        doc.addPage();
        doc.font("Helvetica").fontSize(8).text(parts[1].trimStart(), 50, doc.y, { width: 510 });
      } else {
        doc.font("Helvetica-Bold").fontSize(8.5).text(term.heading, 50, doc.y, { width: 510 });
        doc.font("Helvetica").fontSize(8).text(term.text, 50, doc.y, { width: 510 });
      }
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);

    const signatureBlockHeight = 220;
    if (doc.y + signatureBlockHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    doc.rect(50, doc.y - 4, 510, 1).fill("#ddd");
    doc.moveDown(0.8);

    const sigStartY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F").text("Signed for and on behalf of the Supplier:", leftCol, sigStartY, { width: colWidth });
    doc.moveDown(0.3);

    if (data.signatureImage) {
      try {
        const base64Match = data.signatureImage.match(/^data:image\/\w+;base64,(.+)$/);
        if (base64Match) {
          const imgBuffer = Buffer.from(base64Match[1], "base64");
          doc.image(imgBuffer, leftCol, doc.y, { width: 180, height: 50 });
          doc.y += 55;
        }
      } catch {
      }
    }

    doc.font("Helvetica").fontSize(8).fillColor("#000");
    doc.text(`Name: ${data.signatoryName}`, leftCol, doc.y, { width: colWidth });
    doc.text(`Position: ${data.signatoryPosition}`, leftCol, undefined, { width: colWidth });
    doc.text(`Company: ${data.supplierName}`, leftCol, undefined, { width: colWidth });
    doc.text(`Date: ${formatDate(data.signedDate)}`, leftCol, undefined, { width: colWidth });
    if (data.signedTimestamp) {
      const ts = new Date(data.signedTimestamp);
      const formatted = !isNaN(ts.getTime()) ? ts.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "medium" }) : data.signedTimestamp;
      doc.text(`Time: ${formatted}`, leftCol, undefined, { width: colWidth });
    }
    if (data.signedIp) doc.text(`IP: ${data.signedIp}`, leftCol, undefined, { width: colWidth });
    doc.text("Method: Digital signature via Guardian platform", leftCol, undefined, { width: colWidth });
    const supplierSigEndY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F").text("Signed for and on behalf of the Buyer:", rightCol, sigStartY, { width: colWidth });
    const buyerSigContentY = sigStartY + 16;

    if (data.buyerSignatoryName) {
      if (data.buyerSignatureImage) {
        try {
          const base64Match = data.buyerSignatureImage.match(/^data:image\/\w+;base64,(.+)$/);
          if (base64Match) {
            const imgBuffer = Buffer.from(base64Match[1], "base64");
            doc.image(imgBuffer, rightCol, buyerSigContentY, { width: 180, height: 50 });
          }
        } catch {
        }
      }
      const buyerTextY = buyerSigContentY + (data.buyerSignatureImage ? 55 : 0);
      doc.font("Helvetica").fontSize(8).fillColor("#000");
      doc.text(`Name: ${data.buyerSignatoryName}`, rightCol, buyerTextY, { width: colWidth });
      if (data.buyerSignatoryPosition) doc.text(`Position: ${data.buyerSignatoryPosition}`, rightCol, undefined, { width: colWidth });
      doc.text(`Company: ${data.buyerName}`, rightCol, undefined, { width: colWidth });
      doc.text(`Date: ${formatDate(data.signedDate || data.buyerSignatureDate)}`, rightCol, undefined, { width: colWidth });
      doc.text("Method: Digital signature via Guardian platform", rightCol, undefined, { width: colWidth });
    } else {
      doc.font("Helvetica").fontSize(8).fillColor("#000");
      doc.text(`Company: ${data.buyerName}`, rightCol, buyerSigContentY, { width: colWidth });
      doc.text(`Date: ${formatDate(data.signedDate)}`, rightCol, undefined, { width: colWidth });
      doc.text("Method: Standing authorisation", rightCol, undefined, { width: colWidth });
    }
    const buyerSigEndY = doc.y;

    doc.y = Math.max(supplierSigEndY, buyerSigEndY);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text("Agreement Period:", 50);
    doc.font("Helvetica").fontSize(8).text("This agreement is for 12 months and will be renewed automatically provided the Supplier's VAT registration status remains unchanged.", 50, undefined, { width: 510 });

    doc.moveDown(1.5);
    doc.rect(50, doc.y - 4, 510, 1).fill("#ddd");
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(7).fillColor("#666");
    doc.text("This document was generated electronically by the Guardian Workforce Management Platform. Authenticity, integrity, and legibility are ensured through platform business controls.", 50, doc.y, { align: "center", width: 510 });

    doc.end();
  });
}

interface RemittanceInvoiceItem {
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
}

interface RemittanceBankTransaction {
  date: string;
  reference: string;
  description: string;
  amount: string;
}

interface RemittancePdfData {
  buyerName: string;
  buyerAddress?: string;
  buyerVatNumber?: string;
  buyerCompanyRegNumber?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierCompanyRegNumber?: string;
  supplierBankName?: string;
  supplierSortCode?: string;
  supplierAccountNumber?: string;
  supplierAccountName?: string;
  remittanceDate: string;
  paymentMonth: string;
  invoices: RemittanceInvoiceItem[];
  bankTransactions: RemittanceBankTransaction[];
  totalPaid: string;
}

export function generateRemittancePdf(data: RemittancePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const pageWidth = 510;
    const leftMargin = 50;

    doc.rect(leftMargin, 40, pageWidth, 26).fill("#1F3A5F");
    doc.fillColor("#fff").fontSize(13).font("Helvetica-Bold").text("REMITTANCE ADVICE", leftMargin, 46, { align: "center", width: pageWidth });
    doc.fillColor("#000");

    doc.y = 80;
    doc.fontSize(18).font("Helvetica-Bold").text("Remittance Advice", { align: "center" });
    doc.moveDown(0.3);

    const pmParts = data.paymentMonth.split("-");
    const pmDate = new Date(parseInt(pmParts[0]), parseInt(pmParts[1]) - 1);
    const paymentPeriodLabel = pmDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Payment Period: ${paymentPeriodLabel}`, { align: "center" });
    doc.moveDown(1);

    const leftCol = leftMargin;
    const rightCol = 310;
    const colWidth = 240;
    let blockStartY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
    doc.text("FROM (Buyer):", leftCol, blockStartY);
    doc.font("Helvetica").fontSize(8.5).fillColor("#333");
    let cy = blockStartY + 14;
    doc.text(data.buyerName, leftCol, cy);
    cy += 12;
    if (data.buyerAddress) { doc.text(data.buyerAddress, leftCol, cy, { width: colWidth }); cy += Math.ceil(doc.heightOfString(data.buyerAddress, { width: colWidth }) / 12) * 12; }
    if (data.buyerCompanyRegNumber) { doc.text(`Company Reg: ${data.buyerCompanyRegNumber}`, leftCol, cy); cy += 12; }
    if (data.buyerVatNumber) { doc.text(`VAT Reg No: ${data.buyerVatNumber}`, leftCol, cy); cy += 12; }
    if (data.buyerPhone) { doc.text(`Tel: ${data.buyerPhone}`, leftCol, cy); cy += 12; }
    if (data.buyerEmail) { doc.text(`Email: ${data.buyerEmail}`, leftCol, cy); cy += 12; }
    const leftEndY = cy;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
    doc.text("TO (Supplier):", rightCol, blockStartY);
    doc.font("Helvetica").fontSize(8.5).fillColor("#333");
    let sy = blockStartY + 14;
    doc.text(toTitleCase(data.supplierName), rightCol, sy, { width: colWidth });
    sy += 12;
    if (data.supplierAddress) {
      const supAddr = toTitleCase(data.supplierAddress);
      doc.text(supAddr, rightCol, sy, { width: colWidth });
      sy += Math.ceil(doc.heightOfString(supAddr, { width: colWidth }) / 12) * 12;
    }
    if (data.supplierCompanyRegNumber) { doc.text(`Company Reg: ${data.supplierCompanyRegNumber}`, rightCol, sy, { width: colWidth }); sy += 12; }
    if (data.supplierVatNumber) { doc.text(`VAT Reg No: ${data.supplierVatNumber}`, rightCol, sy, { width: colWidth }); sy += 12; }
    const rightEndY = sy;

    doc.y = Math.max(leftEndY, rightEndY) + 12;

    doc.fontSize(9).font("Helvetica").fillColor("#555");
    doc.text(`Date: ${formatDate(data.remittanceDate)}`, leftCol);
    doc.moveDown(1);

    doc.rect(leftMargin, doc.y, pageWidth, 1).fill("#ddd");
    doc.y += 8;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#1F3A5F").text("Invoices Covered by This Payment", leftMargin);
    doc.moveDown(0.5);

    const cols = { inv: 50, period: 180, amount: 330, paid: 420, status: 490 };
    const headerH = 18;

    function drawTableHeader(y: number) {
      doc.rect(leftMargin, y, pageWidth, headerH).fill("#1F3A5F");
      const textY = y + 4;
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      doc.text("Invoice No", cols.inv + 4, textY, { width: 120 });
      doc.text("Period", cols.period, textY, { width: 140 });
      doc.text("Amount (£)", cols.amount, textY, { width: 80, align: "right" });
      doc.text("Paid (£)", cols.paid, textY, { width: 60, align: "right" });
      doc.text("Status", cols.status, textY, { width: 60, align: "center" });
      doc.fillColor("#000").font("Helvetica").fontSize(8);
      return y + headerH + 4;
    }

    let rowY = drawTableHeader(doc.y);

    if (data.invoices.length === 0) {
      doc.fillColor("#666").fontSize(8).font("Helvetica-Oblique");
      doc.text("No invoices with payments found for this period.", cols.inv + 4, rowY, { width: 400 });
      rowY += 18;
    }

    for (let i = 0; i < data.invoices.length; i++) {
      const inv = data.invoices[i];

      if (rowY > 700) {
        doc.addPage();
        rowY = drawTableHeader(50);
      }

      if (i % 2 === 0) {
        doc.rect(leftMargin, rowY - 2, pageWidth, 16).fill("#f5f5f5");
      }

      doc.fillColor("#000").fontSize(8).font("Helvetica");
      doc.text(inv.invoiceNumber, cols.inv + 4, rowY, { width: 120 });
      doc.text(`${formatDate(inv.periodStart)} — ${formatDate(inv.periodEnd)}`, cols.period, rowY, { width: 140 });
      doc.text(formatGBP(inv.totalAmount), cols.amount, rowY, { width: 80, align: "right" });
      doc.text(formatGBP(inv.amountPaid), cols.paid, rowY, { width: 60, align: "right" });

      const paid = parseFloat(inv.amountPaid) > 0;
      const fullyPaid = inv.status === "paid" || Math.abs(parseFloat(inv.amountPaid) - parseFloat(inv.totalAmount)) < 0.01;
      doc.font("Helvetica-Bold").fontSize(7);
      if (fullyPaid && paid) {
        doc.fillColor("#16a34a");
        doc.text("PAID", cols.status, rowY + 1, { width: 60, align: "center" });
      } else if (paid) {
        doc.fillColor("#ea580c");
        doc.text("PARTIAL", cols.status, rowY + 1, { width: 60, align: "center" });
      } else {
        doc.fillColor("#888");
        doc.text("UNPAID", cols.status, rowY + 1, { width: 60, align: "center" });
      }

      rowY += 18;
    }

    doc.rect(leftMargin, rowY, pageWidth, 1.5).fill("#1F3A5F");
    rowY += 8;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1F3A5F");
    doc.text("TOTAL PAID:", cols.amount - 80, rowY, { width: 160, align: "right" });
    doc.text(formatGBP(data.totalPaid), cols.paid, rowY, { width: 60, align: "right" });
    doc.y = rowY + 28;

    if (data.bankTransactions.length > 0) {
      if (doc.y > 620) { doc.addPage(); doc.y = 50; }

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1F3A5F").text("Bank Transaction References", leftMargin);
      doc.moveDown(0.5);

      const txCols = { date: 50, ref: 140, desc: 280, amt: 460 };

      doc.rect(leftMargin, doc.y, pageWidth, headerH).fill("#1F3A5F");
      const txHeaderY = doc.y + 4;
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      doc.text("Date", txCols.date + 4, txHeaderY, { width: 80 });
      doc.text("Reference", txCols.ref, txHeaderY, { width: 130 });
      doc.text("Description", txCols.desc, txHeaderY, { width: 170 });
      doc.text("Amount (£)", txCols.amt, txHeaderY, { width: 90, align: "right" });
      doc.fillColor("#000").font("Helvetica").fontSize(8);

      let txY = doc.y + headerH + 4;
      for (let i = 0; i < data.bankTransactions.length; i++) {
        const tx = data.bankTransactions[i];

        if (txY > 720) {
          doc.addPage();
          txY = 50;
        }

        if (i % 2 === 0) {
          doc.rect(leftMargin, txY - 2, pageWidth, 16).fill("#f5f5f5");
        }

        doc.fillColor("#000").fontSize(7.5).font("Helvetica");
        doc.text(formatDate(tx.date), txCols.date + 4, txY, { width: 80 });
        doc.text(tx.reference || "—", txCols.ref, txY, { width: 130 });
        doc.text(tx.description || "—", txCols.desc, txY, { width: 170 });
        doc.text(formatGBP(tx.amount), txCols.amt, txY, { width: 90, align: "right" });

        txY += 16;
      }
      doc.y = txY + 10;
    }

    if (data.supplierBankName || data.supplierSortCode || data.supplierAccountNumber) {
      if (doc.y > 680) { doc.addPage(); doc.y = 50; }

      doc.moveDown(0.5);
      doc.rect(leftMargin, doc.y, pageWidth, 1).fill("#ddd");
      doc.y += 8;

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1F3A5F").text("Supplier Bank Details (for reference)", leftMargin);
      doc.moveDown(0.4);
      doc.fontSize(9).font("Helvetica").fillColor("#333");
      if (data.supplierBankName) doc.text(`Bank: ${data.supplierBankName}`, leftMargin);
      if (data.supplierAccountName) doc.text(`Account Name: ${toTitleCase(data.supplierAccountName)}`, leftMargin);
      if (data.supplierSortCode) {
        const sc = data.supplierSortCode.replace(/[^0-9]/g, "");
        const formatted = sc.length === 6 ? `${sc.slice(0,2)}-${sc.slice(2,4)}-${sc.slice(4,6)}` : data.supplierSortCode;
        doc.text(`Sort Code: ${formatted}`, leftMargin);
      }
      if (data.supplierAccountNumber) doc.text(`Account Number: ${data.supplierAccountNumber}`, leftMargin);
    }

    doc.moveDown(2);
    doc.rect(leftMargin, doc.y, pageWidth, 1).fill("#ddd");
    doc.y += 6;
    doc.font("Helvetica").fontSize(7).fillColor("#888");
    doc.text("This remittance advice was generated electronically by the Guardian Workforce Management Platform.", leftMargin, doc.y, { align: "center", width: pageWidth });

    doc.end();
  });
}

interface RemittanceSummaryInvoiceItem {
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  invoiceAmount: string;
  bankRef: string;
  amountPaid: string;
  datePaid: string;
  status: string;
}

interface RemittanceSummaryPdfData {
  buyerName: string;
  buyerAddress?: string;
  buyerVatNumber?: string;
  buyerCompanyRegNumber?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierCompanyRegNumber?: string;
  periodFrom: string;
  periodTo: string;
  invoices: RemittanceSummaryInvoiceItem[];
  totalInvoiced: string;
  totalPaid: string;
  outstanding: string;
}

export function generateRemittanceSummaryPdf(data: RemittanceSummaryPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const pageWidth = 700;
    const leftMargin = 50;

    doc.rect(leftMargin, 40, pageWidth, 26).fill("#1F3A5F");
    doc.fillColor("#fff").fontSize(13).font("Helvetica-Bold").text("REMITTANCE SUMMARY", leftMargin, 46, { align: "center", width: pageWidth });
    doc.fillColor("#000");

    doc.y = 80;
    doc.fontSize(16).font("Helvetica-Bold").text("Remittance Summary Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Period: ${formatDate(data.periodFrom)} — ${formatDate(data.periodTo)}`, { align: "center" });
    doc.moveDown(1);

    const leftCol = leftMargin;
    const rightCol = 420;
    const colWidth = 300;
    let blockStartY = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
    doc.text("FROM (Buyer):", leftCol, blockStartY);
    doc.font("Helvetica").fontSize(8.5).fillColor("#333");
    let cy = blockStartY + 14;
    doc.text(data.buyerName, leftCol, cy);
    cy += 12;
    if (data.buyerAddress) { doc.text(data.buyerAddress, leftCol, cy, { width: colWidth }); cy += Math.ceil(doc.heightOfString(data.buyerAddress, { width: colWidth }) / 12) * 12; }
    if (data.buyerCompanyRegNumber) { doc.text(`Company Reg: ${data.buyerCompanyRegNumber}`, leftCol, cy); cy += 12; }
    if (data.buyerVatNumber) { doc.text(`VAT Reg No: ${data.buyerVatNumber}`, leftCol, cy); cy += 12; }
    if (data.buyerPhone) { doc.text(`Tel: ${data.buyerPhone}`, leftCol, cy); cy += 12; }
    if (data.buyerEmail) { doc.text(`Email: ${data.buyerEmail}`, leftCol, cy); cy += 12; }
    const leftEndY = cy;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F");
    doc.text("TO (Supplier):", rightCol, blockStartY);
    doc.font("Helvetica").fontSize(8.5).fillColor("#333");
    let sy = blockStartY + 14;
    doc.text(toTitleCase(data.supplierName), rightCol, sy, { width: colWidth });
    sy += 12;
    if (data.supplierAddress) {
      const supAddr = toTitleCase(data.supplierAddress);
      doc.text(supAddr, rightCol, sy, { width: colWidth });
      sy += Math.ceil(doc.heightOfString(supAddr, { width: colWidth }) / 12) * 12;
    }
    if (data.supplierCompanyRegNumber) { doc.text(`Company Reg: ${data.supplierCompanyRegNumber}`, rightCol, sy, { width: colWidth }); sy += 12; }
    if (data.supplierVatNumber) { doc.text(`VAT Reg No: ${data.supplierVatNumber}`, rightCol, sy, { width: colWidth }); sy += 12; }
    const rightEndY = sy;

    doc.y = Math.max(leftEndY, rightEndY) + 12;

    doc.rect(leftMargin, doc.y, pageWidth, 1).fill("#ddd");
    doc.y += 8;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#1F3A5F").text("Invoice-to-Payment Mapping", leftMargin);
    doc.moveDown(0.5);

    const cols = { inv: 50, period: 155, invAmt: 290, bankRef: 380, amtPaid: 490, datePaid: 580, status: 670 };
    const headerH = 18;

    function drawTableHeader(y: number) {
      doc.rect(leftMargin, y, pageWidth, headerH).fill("#1F3A5F");
      const textY = y + 4;
      doc.fillColor("#fff").fontSize(7.5).font("Helvetica-Bold");
      doc.text("Invoice No", cols.inv + 4, textY, { width: 95 });
      doc.text("Period", cols.period, textY, { width: 125 });
      doc.text("Invoice Amt (\u00a3)", cols.invAmt, textY, { width: 80, align: "right" });
      doc.text("Bank Reference", cols.bankRef, textY, { width: 100 });
      doc.text("Amount Paid (\u00a3)", cols.amtPaid, textY, { width: 80, align: "right" });
      doc.text("Date Paid", cols.datePaid, textY, { width: 80 });
      doc.text("Status", cols.status, textY, { width: 70, align: "center" });
      doc.fillColor("#000").font("Helvetica").fontSize(7.5);
      return y + headerH + 4;
    }

    let rowY = drawTableHeader(doc.y);

    if (data.invoices.length === 0) {
      doc.fillColor("#666").fontSize(8).font("Helvetica-Oblique");
      doc.text("No invoices found for this supplier and period.", cols.inv + 4, rowY, { width: 500 });
      rowY += 18;
    }

    for (let i = 0; i < data.invoices.length; i++) {
      const inv = data.invoices[i];

      if (rowY > 500) {
        doc.addPage();
        rowY = drawTableHeader(50);
      }

      if (i % 2 === 0) {
        doc.rect(leftMargin, rowY - 2, pageWidth, 16).fill("#f5f5f5");
      }

      doc.fillColor("#000").fontSize(7.5).font("Helvetica");
      doc.text(inv.invoiceNumber, cols.inv + 4, rowY, { width: 95 });
      doc.text(`${formatDate(inv.periodStart)} — ${formatDate(inv.periodEnd)}`, cols.period, rowY, { width: 125 });
      doc.text(formatGBP(inv.invoiceAmount), cols.invAmt, rowY, { width: 80, align: "right" });
      doc.text(inv.bankRef || "\u2014", cols.bankRef, rowY, { width: 100 });
      doc.text(formatGBP(inv.amountPaid), cols.amtPaid, rowY, { width: 80, align: "right" });
      doc.text(inv.datePaid ? formatDate(inv.datePaid) : "\u2014", cols.datePaid, rowY, { width: 80 });

      doc.font("Helvetica-Bold").fontSize(7);
      const statusLower = (inv.status || "").toLowerCase();
      if (statusLower === "paid") {
        doc.fillColor("#16a34a");
        doc.text("PAID", cols.status, rowY + 1, { width: 70, align: "center" });
      } else if (statusLower === "partial") {
        doc.fillColor("#ea580c");
        doc.text("PARTIAL", cols.status, rowY + 1, { width: 70, align: "center" });
      } else {
        doc.fillColor("#888");
        doc.text("UNPAID", cols.status, rowY + 1, { width: 70, align: "center" });
      }

      doc.font("Helvetica").fontSize(7.5);
      rowY += 18;
    }

    doc.rect(leftMargin, rowY, pageWidth, 1.5).fill("#1F3A5F");
    rowY += 10;

    const summaryBlockNeeded = 60;
    if (rowY + summaryBlockNeeded > 530) {
      doc.addPage();
      rowY = 50;
    }

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1F3A5F");
    doc.text("Summary Totals", leftMargin, rowY);
    rowY += 18;

    doc.font("Helvetica").fontSize(9).fillColor("#000");

    doc.text("Total Invoiced:", cols.invAmt - 100, rowY, { width: 100 });
    doc.font("Helvetica-Bold").text(formatGBP(data.totalInvoiced), cols.invAmt, rowY, { width: 80, align: "right" });
    doc.font("Helvetica");

    doc.text("Total Paid:", cols.amtPaid - 100, rowY, { width: 100 });
    doc.font("Helvetica-Bold").text(formatGBP(data.totalPaid), cols.amtPaid, rowY, { width: 80, align: "right" });
    doc.font("Helvetica");

    rowY += 16;

    const outstanding = parseFloat(data.outstanding);
    doc.text("Outstanding:", cols.amtPaid - 100, rowY, { width: 100 });
    doc.font("Helvetica-Bold").fillColor(outstanding > 0 ? "#dc2626" : "#16a34a");
    doc.text(formatGBP(data.outstanding), cols.amtPaid, rowY, { width: 80, align: "right" });

    rowY += 24;
    doc.rect(leftMargin, rowY, pageWidth, 1).fill("#ddd");
    rowY += 8;
    doc.font("Helvetica").fontSize(7).fillColor("#888");
    doc.text("This remittance summary was generated electronically by the Guardian Workforce Management Platform.", leftMargin, rowY, { align: "center", width: pageWidth });

    doc.end();
  });
}

export interface PreAuditCheckResult {
  categories: {
    name: string;
    checks: {
      name: string;
      description: string;
      status: "pass" | "warning" | "fail";
      count: number;
      details: Record<string, any>[];
    }[];
  }[];
  summary: { pass: number; warning: number; fail: number };
  checkedAt: string;
  supplierNames: string[];
}

export function generatePreAuditPdf(data: PreAuditCheckResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const leftMargin = 50;
    const pageWidth = 495;
    const statusColors: Record<string, string> = { pass: "#22c55e", warning: "#f59e0b", fail: "#ef4444" };

    doc.rect(0, 0, 595.28, 80).fill("#1F3A5F");
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff");
    doc.text("Pre-Audit Check Report", leftMargin, 25, { width: pageWidth });
    doc.fontSize(10).font("Helvetica").fillColor("#ccc");
    doc.text(`Generated: ${new Date(data.checkedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, leftMargin, 52, { width: pageWidth });

    let y = 100;

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1F3A5F");
    doc.text("Suppliers Checked:", leftMargin, y);
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    doc.text(data.supplierNames.join(", "), leftMargin, y, { width: pageWidth });
    y = doc.y + 12;

    doc.rect(leftMargin, y, pageWidth, 36).fill("#f0f4f8");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1F3A5F");
    doc.text("Summary", leftMargin + 10, y + 5);
    doc.font("Helvetica").fontSize(9);
    const sumX = leftMargin + 100;
    doc.fillColor(statusColors.pass).text(`Pass: ${data.summary.pass}`, sumX, y + 12);
    doc.fillColor(statusColors.warning).text(`Warning: ${data.summary.warning}`, sumX + 90, y + 12);
    doc.fillColor(statusColors.fail).text(`Fail: ${data.summary.fail}`, sumX + 200, y + 12);
    y += 48;

    for (const category of data.categories) {
      if (y > 720) { doc.addPage(); y = 50; }

      doc.rect(leftMargin, y, pageWidth, 22).fill("#1F3A5F");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#fff");
      doc.text(category.name, leftMargin + 8, y + 5, { width: pageWidth - 16 });
      y += 28;

      for (const check of category.checks) {
        if (y > 720) { doc.addPage(); y = 50; }

        const badgeColor = statusColors[check.status] || "#888";
        doc.rect(leftMargin, y, 6, 14).fill(badgeColor);
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#333");
        doc.text(check.name, leftMargin + 12, y + 1, { width: 340 });
        doc.font("Helvetica").fontSize(8).fillColor(badgeColor);
        doc.text(`${check.status.toUpperCase()} (${check.count})`, leftMargin + 380, y + 1, { width: 115, align: "right" });
        y += 14;
        if (check.description) {
          doc.font("Helvetica").fontSize(7).fillColor("#888");
          doc.text(check.description, leftMargin + 12, y, { width: pageWidth - 20 });
          y = doc.y + 2;
        }
        y += 4;

        if (check.details.length > 0 && check.status !== "pass") {
          const detailKeys = Object.keys(check.details[0] || {});
          if (detailKeys.length === 0) continue;

          const narrowKeys = new Set(["txId", "lineId", "count", "duplicates", "invoices", "unassignedShifts", "unknownSiteShifts", "shiftCount"]);
          const amountKeys = new Set(["amount", "total", "allocated", "txAmount", "vatAmount", "expectedVat", "vatRate"]);
          const wideKeys = new Set(["supplier", "supplierName", "description", "previousNames", "times"]);

          const totalAvail = pageWidth - 10;
          let totalWeight = 0;
          const weights: number[] = detailKeys.map(k => {
            if (narrowKeys.has(k)) { totalWeight += 1; return 1; }
            if (amountKeys.has(k)) { totalWeight += 1.5; return 1.5; }
            if (wideKeys.has(k)) { totalWeight += 3; return 3; }
            totalWeight += 2; return 2;
          });
          const colWidths = weights.map(w => Math.floor((w / totalWeight) * totalAvail));

          doc.font("Helvetica-Bold").fontSize(7).fillColor("#666");
          let cx = leftMargin + 10;
          detailKeys.forEach((key, i) => {
            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
            doc.text(label, cx, y, { width: colWidths[i] - 4 });
            cx += colWidths[i];
          });
          y += 12;

          const maxRows = Math.min(check.details.length, 15);
          for (let r = 0; r < maxRows; r++) {
            if (y > 750) { doc.addPage(); y = 50; }
            const row = check.details[r];
            doc.font("Helvetica").fontSize(7).fillColor("#333");

            let maxLineHeight = 11;
            cx = leftMargin + 10;
            const cellPositions: { x: number; w: number; val: string }[] = [];
            detailKeys.forEach((key, i) => {
              const val = String(row[key] ?? "");
              const truncVal = val.length > 60 ? val.substring(0, 57) + "..." : val;
              cellPositions.push({ x: cx, w: colWidths[i] - 4, val: truncVal });
              cx += colWidths[i];
            });
            cellPositions.forEach(cell => {
              doc.text(cell.val, cell.x, y, { width: cell.w });
            });
            const afterY = doc.y;
            maxLineHeight = Math.max(maxLineHeight, afterY - y + 2);
            y += maxLineHeight;
          }
          if (check.details.length > 15) {
            doc.font("Helvetica").fontSize(7).fillColor("#888");
            doc.text(`... and ${check.details.length - 15} more records`, leftMargin + 10, y);
            y += 12;
          }
          y += 6;
        }
      }
      y += 8;
    }

    doc.font("Helvetica").fontSize(7).fillColor("#888");
    doc.text("This report was generated electronically by the Gardeo Workforce Management Platform.", leftMargin, y + 10, { align: "center", width: pageWidth });

    doc.end();
  });
}

export interface PurchaseLedgerEntry {
  source: string;
  entry_id: string;
  source_id: number;
  purchase_date: string;
  vendor_name: string;
  vendor_vat_number: string | null;
  description: string;
  net_amount: string | number;
  vat_rate: string | number;
  vat_amount: string | number;
  gross_amount: string | number;
  expense_category: string | null;
  vat_status: string;
  payment_status: string;
  bank_reference: string | null;
}

export interface PurchaseLedgerPdfData {
  tenantName: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  entries: PurchaseLedgerEntry[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  vatReturnInputVat?: number | null;
}

const SOURCE_LABELS: Record<string, string> = {
  supplier_invoice: "Supplier Invoice",
  bank_general_purchase: "Bank Purchase",
  manual: "Bank Feed",
  financial_document: "Document/Receipt",
};

export function generatePurchaseLedgerPdf(data: PurchaseLedgerPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, layout: "landscape" });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const primaryColor = "#1F3A5F";
    const accentColor = "#FF8C42";
    const pageW = 751;
    const lm = 40;
    const usableW = pageW - lm * 2;

    doc.rect(0, 0, pageW + 100, 36).fill(primaryColor);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#fff");
    doc.text("HMRC PURCHASE LEDGER", lm, 10, { width: usableW });
    doc.fontSize(9).font("Helvetica").fillColor("#ccc");
    doc.text(`${data.tenantName}   |   Period: ${data.periodLabel}   |   Generated: ${data.generatedAt}`, lm, 24, { width: usableW });

    let y = 50;

    doc.fontSize(8).font("Helvetica").fillColor("#555");
    doc.text(`Report Period: ${data.dateFrom} to ${data.dateTo}   |   Total Entries: ${data.entries.length}`, lm, y);
    y += 12;

    if (data.vatReturnInputVat != null) {
      const diff = Math.abs(data.totalVat - data.vatReturnInputVat);
      const reconciled = diff < 0.02;
      const label = reconciled ? "✓ Reconciled with VAT Return" : `⚠ Difference vs VAT Return: £${diff.toFixed(2)}`;
      doc.fontSize(8).font("Helvetica-Bold").fillColor(reconciled ? "#15803d" : "#b91c1c");
      doc.text(`Input VAT: £${data.totalVat.toFixed(2)}   VAT Return Input VAT: £${data.vatReturnInputVat.toFixed(2)}   ${label}`, lm, y, { width: usableW });
      y += 14;
    }

    y += 4;

    // Landscape A4 usable width ~751px. Column layout (full audit trail):
    // Date(55) Vendor(110) VATNo(70) Desc(115) Cat(65) Net(48) VAT%(30) VAT(48) Gross(50) VATSts(45) Pymt(42) BankRef(55) Src(58)
    // Total = 791 — fits within landscape page
    const cols = {
      date:     { x: lm,       w: 55  },
      vendor:   { x: lm + 55,  w: 110 },
      vatNo:    { x: lm + 165, w: 70  },
      desc:     { x: lm + 235, w: 115 },
      category: { x: lm + 350, w: 65  },
      net:      { x: lm + 415, w: 48  },
      vatRate:  { x: lm + 463, w: 30  },
      vatAmt:   { x: lm + 493, w: 48  },
      gross:    { x: lm + 541, w: 50  },
      vatSts:   { x: lm + 591, w: 45  },
      pmtSts:   { x: lm + 636, w: 42  },
      bankRef:  { x: lm + 678, w: 55  },
      source:   { x: lm + 733, w: 58  },
    };
    const totalColsW = 791;

    const drawTableHeader = (headerY: number) => {
      doc.rect(lm, headerY - 3, totalColsW, 18).fill(primaryColor);
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#fff");
      doc.text("Date",          cols.date.x + 1,     headerY, { width: cols.date.w - 1 });
      doc.text("Vendor/Suppl.", cols.vendor.x + 1,   headerY, { width: cols.vendor.w - 1 });
      doc.text("VAT Number",    cols.vatNo.x + 1,    headerY, { width: cols.vatNo.w - 1 });
      doc.text("Description",   cols.desc.x + 1,     headerY, { width: cols.desc.w - 1 });
      doc.text("Category",      cols.category.x + 1, headerY, { width: cols.category.w - 1 });
      doc.text("Net (£)",       cols.net.x + 1,      headerY, { width: cols.net.w - 1,     align: "right" });
      doc.text("VAT%",          cols.vatRate.x + 1,  headerY, { width: cols.vatRate.w - 1, align: "right" });
      doc.text("VAT (£)",       cols.vatAmt.x + 1,   headerY, { width: cols.vatAmt.w - 1,  align: "right" });
      doc.text("Gross (£)",     cols.gross.x + 1,    headerY, { width: cols.gross.w - 1,   align: "right" });
      doc.text("VAT Status",    cols.vatSts.x + 1,   headerY, { width: cols.vatSts.w - 1  });
      doc.text("Payment",       cols.pmtSts.x + 1,   headerY, { width: cols.pmtSts.w - 1  });
      doc.text("Bank Ref",      cols.bankRef.x + 1,  headerY, { width: cols.bankRef.w - 1 });
      doc.text("Source",        cols.source.x + 1,   headerY, { width: cols.source.w - 1  });
      return headerY + 18;
    };

    y = drawTableHeader(y);

    const VAT_STATUS_SHORT: Record<string, string> = {
      standard: "Standard", zero: "Zero", exempt: "Exempt",
      reverse_charge: "Rev.Chg", unknown: "—",
    };

    let rowCount = 0;
    for (const entry of data.entries) {
      if (y > 525) {
        doc.addPage({ layout: "landscape" });
        y = 20;
        y = drawTableHeader(y);
      }

      const rowH = 13;
      if (rowCount % 2 === 0) {
        doc.rect(lm, y - 1, totalColsW, rowH).fill("#f8f9fa");
      }

      const net = parseFloat(String(entry.net_amount || 0));
      const vatAmt = parseFloat(String(entry.vat_amount || 0));
      const gross = parseFloat(String(entry.gross_amount || 0));
      const vatRate = parseFloat(String(entry.vat_rate || 0));

      const isManual = entry.source === "manual";
      doc.fontSize(6).font(isManual ? "Helvetica-Bold" : "Helvetica").fillColor("#111");

      const trunc = (s: string | null | undefined, max: number) =>
        (s && s.length > max) ? s.substring(0, max - 1) + "…" : (s || "—");

      const formatDateUK = (d: any): string => {
        if (!d) return "—";
        const s = d.toString();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) {
          const day = String(dt.getDate()).padStart(2, "0");
          const month = String(dt.getMonth() + 1).padStart(2, "0");
          return `${day}/${month}/${dt.getFullYear()}`;
        }
        return s.substring(0, 10);
      };
      const dateStr = formatDateUK(entry.purchase_date);
      doc.text(dateStr,                              cols.date.x + 1,     y, { width: cols.date.w - 1 });
      doc.text(trunc(entry.vendor_name, 19),         cols.vendor.x + 1,   y, { width: cols.vendor.w - 1 });
      doc.text(trunc(entry.vendor_vat_number, 12),   cols.vatNo.x + 1,    y, { width: cols.vatNo.w - 1 });
      doc.text(entry.source === "supplier_invoice" ? trunc(entry.description, 21) : "", cols.desc.x + 1,     y, { width: cols.desc.w - 1 });
      doc.text(trunc(entry.expense_category, 12),    cols.category.x + 1, y, { width: cols.category.w - 1 });
      doc.fillColor(net > 0 ? "#111" : "#888");
      doc.text(net.toFixed(2),                       cols.net.x + 1,      y, { width: cols.net.w - 1,     align: "right" });
      doc.fillColor("#111");
      doc.text(`${vatRate > 0 ? vatRate.toFixed(0) : 0}%`, cols.vatRate.x + 1, y, { width: cols.vatRate.w - 1, align: "right" });
      doc.text(vatAmt.toFixed(2),                    cols.vatAmt.x + 1,   y, { width: cols.vatAmt.w - 1,  align: "right" });
      doc.text(gross.toFixed(2),                     cols.gross.x + 1,    y, { width: cols.gross.w - 1,   align: "right" });
      doc.fillColor("#444");
      doc.text(VAT_STATUS_SHORT[entry.vat_status] || trunc(entry.vat_status, 8), cols.vatSts.x + 1, y, { width: cols.vatSts.w - 1 });
      doc.text(entry.payment_status || "—",          cols.pmtSts.x + 1,   y, { width: cols.pmtSts.w - 1 });
      doc.text(trunc(entry.bank_reference, 10),      cols.bankRef.x + 1,  y, { width: cols.bankRef.w - 1 });
      doc.fontSize(5.5).fillColor("#666");
      doc.text(SOURCE_LABELS[entry.source] || entry.source, cols.source.x + 1, y + 1, { width: cols.source.w - 1 });

      y += rowH;
      rowCount++;
    }

    y += 6;
    doc.rect(lm, y, usableW, 1).fill(accentColor);
    y += 6;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(primaryColor);
    doc.text(`TOTALS  (${data.entries.length} entries)`, lm, y, { width: 400 });
    doc.fontSize(9).fillColor("#111");
    doc.text(`Net: £${data.totalNet.toFixed(2)}`, lm + 400, y, { width: 100, align: "right" });
    doc.text(`VAT: £${data.totalVat.toFixed(2)}`, lm + 520, y, { width: 80, align: "right" });
    doc.text(`Gross: £${data.totalGross.toFixed(2)}`, lm + 618, y, { width: 82, align: "right" });

    y += 20;
    doc.fontSize(7).font("Helvetica").fillColor("#888");
    doc.text(
      "This purchase ledger is generated for HMRC audit purposes. All figures are in GBP. " +
      "Sources: Supplier Invoice = self-billed invoice; Bank Purchase = general purchase from bank statement; " +
      "Bank Feed = purchase imported from bank feed; Document/Receipt = uploaded financial document.",
      lm, y, { width: usableW }
    );

    doc.end();
  });
}

export function generatePurchaseLedgerAccountingPdf(data: PurchaseLedgerPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages:true lets us loop back over every page after rendering
    // to stamp per-page footers with "Page X of Y" totals.
    const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape", bufferPages: true });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const primaryColor = "#1F3A5F";
    const pageW = 751;
    const lm = 36;
    const usableW = pageW - lm * 2;
    const footerY = 530;

    const formatDateUK = (d: any): string => {
      if (!d) return "—";
      const s = d.toString();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      const dt = new Date(s);
      if (!isNaN(dt.getTime())) {
        return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
      }
      return s.substring(0, 10);
    };

    // Adds a number of days to a date and returns it UK-formatted (dd/mm/yyyy).
    const addDaysUK = (d: any, days: number): string => {
      if (!d) return "—";
      const s = d.toString();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
      if (isNaN(dt.getTime())) return formatDateUK(d);
      dt.setDate(dt.getDate() + days);
      return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
    };

    const money = (n: number) => n.toFixed(2);
    const trunc = (s: string | null | undefined, max: number) =>
      (s && s.length > max) ? s.substring(0, max - 1) + "…" : (s || "—");

    // ── Column definitions ─────────────────────────────────────
    // Invoice Date(52) | Contact(105) | Source(75) | Reference(140) | Due Date(50) | Net(52) | Gross(56) | VAT(52) | Pmts/Debits(60) | Balance(55)
    const cols = {
      invoiceDate:  { x: lm,        w: 52  },
      contact:      { x: lm + 52,   w: 105 },
      source:       { x: lm + 157,  w: 75  },
      reference:    { x: lm + 232,  w: 140 },
      dueDate:      { x: lm + 372,  w: 50  },
      net:          { x: lm + 422,  w: 52  },
      gross:        { x: lm + 474,  w: 56  },
      vat:          { x: lm + 530,  w: 52  },
      payments:     { x: lm + 582,  w: 60  },
      balance:      { x: lm + 642,  w: 55  },
    };
    const tableW = 697;

    // ── Page 1 header ─────────────────────────────────────────
    doc.rect(0, 0, pageW + 100, 52).fill(primaryColor);
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#fff");
    doc.text("Purchase Ledger", lm, 8, { width: usableW });
    doc.fontSize(9).font("Helvetica").fillColor("#ccd");
    doc.text(data.tenantName, lm, 30, { width: usableW / 2 });
    doc.fontSize(9).fillColor("#aac");
    doc.text(`For the period ${formatDateUK(data.dateFrom)} to ${formatDateUK(data.dateTo)}`, lm, 41, { width: usableW / 2 });
    doc.fontSize(8).fillColor("#bbb");
    doc.text(`Status contains: Accepted, Approved, Billed, Current, Invoiced, Paid, Sent`, lm + usableW / 2, 30, { width: usableW / 2, align: "right" });
    doc.fontSize(8).fillColor("#bbb");
    doc.text(`Generated: ${data.generatedAt}`, lm + usableW / 2, 41, { width: usableW / 2, align: "right" });

    let y = 60;

    const drawTableHeader = (headerY: number) => {
      doc.rect(lm, headerY - 2, tableW, 16).fill(primaryColor);
      doc.fontSize(6).font("Helvetica-Bold").fillColor("#fff");
      doc.text("Invoice Date",     cols.invoiceDate.x + 1, headerY, { width: cols.invoiceDate.w - 1 });
      doc.text("Contact",          cols.contact.x + 1,     headerY, { width: cols.contact.w - 1 });
      doc.text("Source",           cols.source.x + 1,      headerY, { width: cols.source.w - 1 });
      doc.text("Reference",        cols.reference.x + 1,   headerY, { width: cols.reference.w - 1 });
      doc.text("Due Date",         cols.dueDate.x + 1,     headerY, { width: cols.dueDate.w - 1 });
      doc.text("Net",              cols.net.x + 1,         headerY, { width: cols.net.w - 1,      align: "right" });
      doc.text("Gross",            cols.gross.x + 1,       headerY, { width: cols.gross.w - 1,    align: "right" });
      doc.text("VAT",              cols.vat.x + 1,         headerY, { width: cols.vat.w - 1,      align: "right" });
      doc.text("Payments/Debits",  cols.payments.x + 1,    headerY, { width: cols.payments.w - 1, align: "right" });
      doc.text("Balance",          cols.balance.x + 1,     headerY, { width: cols.balance.w - 1,  align: "right" });
      return headerY + 16;
    };

    y = drawTableHeader(y);

    let sumNet = 0, sumGross = 0, sumVat = 0, sumPayments = 0, sumBalance = 0;
    let rowCount = 0;

    for (const entry of data.entries) {
      if (y > footerY - 20) {
        doc.addPage({ layout: "landscape" });
        y = 20;
        y = drawTableHeader(y);
      }

      const rowH = 12;
      if (rowCount % 2 === 0) {
        doc.rect(lm, y - 1, tableW, rowH).fill("#f2f4f8");
      }

      const net   = parseFloat(String(entry.net_amount   || 0));
      const gross = parseFloat(String(entry.gross_amount || 0));
      const vat   = parseFloat(String(entry.vat_amount   || 0));
      const paid  = entry.payment_status === "paid" ? gross : 0;
      const balance = gross - paid;

      sumNet      += net;
      sumGross    += gross;
      sumVat      += vat;
      sumPayments += paid;
      sumBalance  += balance;

      const dateStr = formatDateUK(entry.purchase_date);

      doc.fontSize(6).font("Helvetica").fillColor("#111");
      doc.text(dateStr,                                  cols.invoiceDate.x + 1, y, { width: cols.invoiceDate.w - 1 });
      doc.text(trunc(entry.vendor_name, 20),             cols.contact.x + 1,    y, { width: cols.contact.w - 1 });
      doc.fontSize(5.5).fillColor("#555");
      doc.text(SOURCE_LABELS[entry.source] || entry.source, cols.source.x + 1, y, { width: cols.source.w - 1 });
      doc.fontSize(6).fillColor("#111");
      doc.text(trunc(entry.bank_reference || (entry.source === "supplier_invoice" ? entry.description : ""), 38), cols.reference.x + 1, y, { width: cols.reference.w - 1 });
      const dueDateStr = entry.source === "supplier_invoice" ? addDaysUK(entry.purchase_date, 30) : dateStr;
      doc.text(dueDateStr,                               cols.dueDate.x + 1,     y, { width: cols.dueDate.w - 1 });
      doc.fillColor(net > 0 ? "#111" : "#888");
      doc.text(money(net),   cols.net.x + 1,      y, { width: cols.net.w - 1,      align: "right" });
      doc.fillColor("#111");
      doc.text(money(gross), cols.gross.x + 1,    y, { width: cols.gross.w - 1,    align: "right" });
      doc.text(money(vat),   cols.vat.x + 1,      y, { width: cols.vat.w - 1,      align: "right" });
      doc.fillColor(paid > 0 ? "#15803d" : "#888");
      doc.text(paid > 0 ? money(paid) : "—",      cols.payments.x + 1, y, { width: cols.payments.w - 1, align: "right" });
      doc.fillColor(balance > 0.01 ? "#b91c1c" : "#15803d");
      doc.text(money(balance), cols.balance.x + 1, y, { width: cols.balance.w - 1, align: "right" });

      y += rowH;
      rowCount++;
    }

    // ── Total row (on last content page) ──────────────────────
    if (y > footerY - 40) {
      doc.addPage({ layout: "landscape" });
      y = 20;
    }
    y += 4;
    doc.rect(lm, y - 2, tableW, 17).fill(primaryColor);
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#fff");
    const labelCols = cols.invoiceDate.w + cols.contact.w + cols.source.w + cols.reference.w + cols.dueDate.w - 4;
    doc.text(`Total  (${data.entries.length} entries)`, cols.invoiceDate.x + 1, y + 1, { width: labelCols });
    doc.text(money(sumNet),      cols.net.x + 1,      y + 1, { width: cols.net.w - 1,      align: "right" });
    doc.text(money(sumGross),    cols.gross.x + 1,    y + 1, { width: cols.gross.w - 1,    align: "right" });
    doc.text(money(sumVat),      cols.vat.x + 1,      y + 1, { width: cols.vat.w - 1,      align: "right" });
    doc.text(money(sumPayments), cols.payments.x + 1, y + 1, { width: cols.payments.w - 1, align: "right" });
    doc.text(money(sumBalance),  cols.balance.x + 1,  y + 1, { width: cols.balance.w - 1,  align: "right" });

    // ── Per-page footers with "Page X of Y" ───────────────────
    // bufferPages:true means doc.bufferedPageRange() is available.
    // We flush all buffered pages and write a footer on each one.
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      doc.rect(lm, footerY, usableW, 1).fill("#dde");
      doc.fontSize(7).font("Helvetica").fillColor("#888");
      doc.text(
        `Approved and paid  |  ${data.tenantName}  |  Generated: ${data.generatedAt}`,
        lm,
        footerY + 4,
        { width: usableW - 90 }
      );
      doc.text(
        `Page ${i + 1} of ${totalPages}`,
        lm,
        footerY + 4,
        { width: usableW, align: "right" }
      );
    }

    doc.end();
  });
}

export interface VatReturnPdfData {
  tenantName: string;
  quarter: string;
  periodStart: string;
  periodEnd: string;
  vatCalculationType: string;
  generatedAt: string;
  salesVat: number;
  generalPurchasesVat: number;
  supplierVat: number;
  netVat: number;
  salesNet: number;
  supplierNet: number;
  generalNet: number;
  box7: number;
  wagesTotal: number;
  wagesCount: number;
}

export function generateVatReturnPdf(data: VatReturnPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const primaryColor = "#1F3A5F";
    const accentColor = "#FF8C42";
    const pageW = 595;
    const lm = 40;
    const usableW = pageW - lm * 2;

    doc.rect(0, 0, pageW, 50).fill(primaryColor);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#fff");
    doc.text("VAT RETURN SUMMARY", lm, 13, { width: usableW });
    doc.fontSize(9).font("Helvetica").fillColor("#ccd");
    doc.text(
      `${data.tenantName}   |   Quarter: ${data.quarter}   |   Generated: ${data.generatedAt}`,
      lm,
      33,
      { width: usableW },
    );

    let y = 66;
    doc.fontSize(9).font("Helvetica").fillColor("#555");
    doc.text(
      `Period: ${data.periodStart} to ${data.periodEnd}    |    Basis: ${data.vatCalculationType === "cash" ? "Cash Accounting" : "Accrual Accounting"}`,
      lm,
      y,
    );
    y += 22;

    const money = (n: number) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const money0 = (n: number) => `£${Math.round(Number(n || 0)).toLocaleString("en-GB")}`;

    const drawRow = (label: string, value: string, opts?: { bold?: boolean; fill?: string; valueColor?: string }) => {
      const rowH = 20;
      if (opts?.fill) {
        doc.rect(lm, y - 4, usableW, rowH).fill(opts.fill);
      }
      doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(opts?.fill ? "#fff" : "#222");
      doc.text(label, lm + 8, y, { width: usableW - 130 });
      doc.font("Helvetica-Bold").fillColor(opts?.valueColor || (opts?.fill ? "#fff" : "#222"));
      doc.text(value, lm + usableW - 130, y, { width: 122, align: "right" });
      y += rowH;
    };

    doc.font("Helvetica-Bold").fontSize(11).fillColor(primaryColor);
    doc.text("HMRC VAT Return Boxes", lm, y);
    y += 18;

    drawRow("Box 1 — VAT due on sales (output VAT)", money(data.salesVat), { fill: primaryColor });
    drawRow("Box 4 — VAT reclaimed on purchases (input VAT)", money(data.generalPurchasesVat + data.supplierVat));
    drawRow(
      "Box 5 — Net VAT " + (data.netVat >= 0 ? "due to HMRC" : "reclaimed from HMRC"),
      money(Math.abs(data.netVat)),
      { fill: accentColor },
    );
    drawRow("Box 6 — Total value of sales (ex VAT)", money0(data.salesNet));
    drawRow("Box 7 — Total value of purchases (ex VAT)", money0(data.box7));

    y += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(primaryColor);
    doc.text("Input VAT Breakdown", lm, y);
    y += 18;
    drawRow("Supplier VAT (self-billing)", money(data.supplierVat));
    drawRow("General purchases VAT", money(data.generalPurchasesVat));
    drawRow("Supplier net (ex VAT)", money0(data.supplierNet));
    drawRow("General purchases net (ex VAT)", money0(data.generalNet));

    y += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(primaryColor);
    doc.text("Memo — Excluded from VAT", lm, y);
    y += 18;
    drawRow(
      `Wages excluded from VAT${data.wagesCount > 0 ? ` (${data.wagesCount} ledger entr${data.wagesCount === 1 ? "y" : "ies"})` : ""}`,
      money(data.wagesTotal),
      { fill: "#e2e8f0", valueColor: "#1e293b" },
    );
    doc.font("Helvetica").fontSize(7.5).fillColor("#666");
    doc.text(
      "Wages are not included in Box 7 (total value of purchases) and carry no input VAT. " +
        "This line is shown for reconciliation completeness only.",
      lm + 8,
      y,
      { width: usableW - 16 },
    );
    y += 24;

    doc.font("Helvetica").fontSize(7).fillColor("#888");
    doc.text(
      "This VAT return summary was generated electronically by the Gardeo Workforce Management Platform for HMRC reporting purposes. All figures are in GBP.",
      lm,
      y + 10,
      { width: usableW },
    );

    doc.end();
  });
}

export function generateStaffProfilePdf(data: {
  title: string;
  employeeName: string;
  employeeNumber?: string | null;
  companyName?: string;
  lines?: Array<{ label: string; value: string }>;
  bodyText?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.rect(0, 0, 595, 8).fill("#FF8C42");
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1F3A5F").text(data.title);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#666").text(data.companyName || "Gardeo Workforce Platform");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`);
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1F3A5F").text(data.employeeName);
    if (data.employeeNumber) {
      doc.font("Helvetica").fontSize(10).fillColor("#444").text(`PIN / Employee #: ${data.employeeNumber}`);
    }
    doc.moveDown(1);
    for (const line of data.lines || []) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1F3A5F").text(`${line.label} `, { continued: true });
      doc.font("Helvetica").fillColor("#333").text(line.value);
    }
    if (data.bodyText) {
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(10).fillColor("#333").text(data.bodyText, { align: "left" });
    }
    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).fillColor("#888").text("This document was generated by Gardeo for internal HR / vetting use.");
    doc.end();
  });
}

export function generateVettingCompletionCertPdf(data: {
  companyName: string;
  companyAddress?: string;
  employeeName: string;
  niNumber?: string;
  appointmentDate?: string;
  completedDate?: string;
  signatoryName?: string;
  signatoryPosition?: string;
  signatureImage?: string;
  screeningExceptions?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const primaryColor = "#1F3A5F";
    const accentColor = "#FF8C42";
    const pageWidth = 495;
    const left = 50;

    doc.rect(0, 0, 595, 8).fill(accentColor);
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold").fontSize(16).fillColor(primaryColor).text(data.companyName, left, 30, { width: pageWidth });
    if (data.companyAddress) {
      doc.font("Helvetica").fontSize(9).fillColor("#555").text(data.companyAddress, left, undefined, { width: pageWidth });
    }
    doc.moveDown(2);

    doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor).text("SATISFACTORY COMPLETION OF SCREENING ENQUIRIES", left, undefined, { align: "center", width: pageWidth });
    doc.moveDown(1.5);

    doc.font("Helvetica").fontSize(11).fillColor("#222");
    doc.text(`NAME: ${data.employeeName}`, left, undefined, { width: pageWidth });
    if (data.niNumber) doc.text(`N.I: ${data.niNumber}`, left, undefined, { width: pageWidth });
    doc.moveDown(0.5);
    if (data.appointmentDate) doc.text(`Date of Appointment: ${data.appointmentDate}`, left, undefined, { width: pageWidth });
    if (data.completedDate) doc.text(`Date Completed: ${data.completedDate}`, left, undefined, { width: pageWidth });
    doc.moveDown(1);

    doc.text(
      "The above named person has, to date, been employed on a provisional and temporary basis and has undergone:",
      left,
      undefined,
      { width: pageWidth },
    );
    doc.moveDown(0.8);

    const hasExceptions = !!(data.screeningExceptions && data.screeningExceptions.trim());
    doc.font("Helvetica").fontSize(11);
    doc.text(hasExceptions ? "(b) Completion of Screening with the following exceptions" : "(a) Satisfactory completion of screening", left, undefined, { width: pageWidth });
    doc.moveDown(1);

    if (hasExceptions) {
      doc.font("Helvetica-Bold").fontSize(10).text("My reasons for discretion in relation to above, is/are:", left, undefined, { width: pageWidth });
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10).text(data.screeningExceptions!.trim(), left, undefined, { width: pageWidth });
      doc.moveDown(1.5);
    } else {
      doc.moveDown(1);
    }

    const sigY = doc.y;
    if (data.signatureImage) {
      try {
        const base64Match = data.signatureImage.match(/^data:image\/\w+;base64,(.+)$/);
        if (base64Match) {
          doc.image(Buffer.from(base64Match[1], "base64"), left, sigY, { width: 180, height: 55 });
          doc.y = sigY + 60;
        }
      } catch {
        doc.y = sigY;
      }
    }

    doc.font("Helvetica").fontSize(10).fillColor("#222");
    doc.text(`Name: ${data.signatoryName || "____________________________"}`, left, doc.y, { width: pageWidth });
    doc.text(`Position: ${data.signatoryPosition || "Vetting Officer"}`, left, undefined, { width: pageWidth });
    doc.text(`Date: ${data.completedDate || new Date().toLocaleDateString("en-GB")}`, left, undefined, { width: pageWidth });

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(
      "Generated electronically by Gardeo — BS7858 Screening & Vetting (SF 17 Completion Certificate).",
      left,
      undefined,
      { align: "center", width: pageWidth },
    );

    doc.end();
  });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  fontSize = 9.5,
): void {
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#000").text(label, x, y, { lineBreak: false });
  const lw = doc.widthOfString(label);
  doc.font("Helvetica-Oblique").fontSize(fontSize).fillColor("#000").text(value || "—", x + lw + 5, y, { lineBreak: false });
}

function drawInlineChoices(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  options: { value: string; label: string }[],
  selected: string,
  fontSize = 9.5,
): void {
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#000").text(label, x, y, { lineBreak: false });
  let cx = x + doc.widthOfString(label) + 6;
  for (const opt of options) {
    const isSelected = opt.value === selected;
    const font = isSelected ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(fontSize);
    const w = doc.widthOfString(opt.label);
    if (isSelected) {
      doc.fillColor("#FFF176").rect(cx - 2, y - 2, w + 4, fontSize + 4).fill();
    }
    doc.fillColor("#000").font(font).fontSize(fontSize).text(opt.label, cx, y, { lineBreak: false });
    cx += w + 16;
  }
}

function drawBlankOrValue(doc: PDFKit.PDFDocument, x: number, y: number, value: string | null, width = 80): void {
  if (value) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#000").text(value, x, y, { lineBreak: false });
  } else {
    doc.moveTo(x, y + 10).lineTo(x + width, y + 10).lineWidth(0.5).strokeColor("#999").stroke();
  }
}

export function generateEmploymentReferenceConfirmationPdf(data: {
  companyName: string;
  applicantName: string;
  dateOfBirth?: string | null;
  address?: string | null;
  postcode?: string | null;
  nationalInsurance?: string | null;
  appliedPosition?: string | null;
  employerName: string;
  statedRole?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  informationConfirmed: boolean;
  detailsIfDifferent?: string | null;
  confirmedFrom?: string | null;
  confirmedTo?: string | null;
  attitude: "good" | "average" | "poor";
  timeKeeping: "good" | "poor";
  timeOff: "average" | "more_than_average";
  reasonForLeaving: "own_accord" | "dismissed";
  wouldReemploy: "yes" | "no" | "cannot_comment";
  refereePrintName: string;
  refereeCompany: string;
  refereePosition: string;
  refereeSignature: string;
  submittedAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const left = 40;
    const right = 555;
    const width = right - left;
    const mid = left + width / 2;

    const dob = data.dateOfBirth ? formatDate(data.dateOfBirth) : "";
    const dateFrom = data.dateFrom ? formatDate(data.dateFrom) : "";
    const dateTo = data.dateTo ? formatDate(data.dateTo) : "Present";
    const confirmedFrom = data.confirmedFrom ? formatDate(data.confirmedFrom) : "";
    const confirmedTo = data.confirmedTo ? formatDate(data.confirmedTo) : "";
    const detailsIfDifferent = data.detailsIfDifferent?.trim() || "";

    // ── Document control header table ─────────────────────────────
    const headerLabelW = 68;
    const headerBoxW = 230;
    const headerRowH = 15;
    const headerTop = 40;
    const headerRows: [string, string][] = [
      ["Reference", "REF 02"],
      ["Version", "1.0"],
      ["Issue Date", formatDate(data.submittedAt.toISOString())],
      ["Approved", "MD"],
    ];
    doc.lineWidth(0.7).strokeColor("#000");
    headerRows.forEach(([label, value], i) => {
      const y = headerTop + i * headerRowH;
      doc.rect(left, y, headerBoxW, headerRowH).stroke();
      doc.moveTo(left + headerLabelW, y).lineTo(left + headerLabelW, y + headerRowH).stroke();
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#000").text(label, left + 4, y + 3.5, { lineBreak: false });
      doc.font("Helvetica").fontSize(8.5).text(value, left + headerLabelW + 4, y + 3.5, { lineBreak: false });
    });
    const headerBottom = headerTop + headerRows.length * headerRowH;

    const companyX = left + headerBoxW + 15;
    const companyW = right - companyX;
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#000").text(data.companyName, companyX, headerTop + 6, { width: companyW, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("#222").text("Confirmation Form (Ex-Employer)", companyX, headerTop + 28, { width: companyW, align: "center" });

    const dividerY = headerBottom + 12;
    doc.lineWidth(2.2).strokeColor("#000").moveTo(left, dividerY).lineTo(right, dividerY).stroke();

    // ── Main form box ──────────────────────────────────────────────
    type RowSpec = { height: number; twoCol?: boolean; draw: (topY: number) => void };
    const rows: RowSpec[] = [];

    rows.push({
      height: 34,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000");
        doc.text("THE INFORMATION PROVIDED IS STRICTLY CONFIDENTIAL — WE WOULD BE GRATEFUL IF", left + 10, topY + 6, { width: width - 20, align: "center" });
        doc.text("YOU WOULD SUPPLY US WITH THE FOLLOWING INFORMATION:", left + 10, topY + 19, { width: width - 20, align: "center" });
      },
    });

    rows.push({
      height: 24,
      twoCol: true,
      draw: (topY) => {
        drawLabelValue(doc, left + 8, topY + 8, "Name of Applicant:", data.applicantName);
        drawLabelValue(doc, mid + 8, topY + 8, "Date of Birth:", dob);
      },
    });

    rows.push({
      height: 34,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000").text("Address:", left + 8, topY + 6, { lineBreak: false });
        doc.font("Helvetica-Oblique").fontSize(9.5).text(data.address || "—", left + 8, topY + 20, { width: width - 16 });
      },
    });

    rows.push({
      height: 24,
      twoCol: true,
      draw: (topY) => {
        drawLabelValue(doc, left + 8, topY + 8, "Post Code:", data.postcode || "");
        drawLabelValue(doc, mid + 8, topY + 8, "N.I. No:", data.nationalInsurance || "");
      },
    });

    rows.push({
      height: 20,
      draw: (topY) => {
        const label = "Who has applied for the position of: ";
        const value = data.appliedPosition || "—";
        doc.font("Helvetica-Bold").fontSize(9.5);
        const lw = doc.widthOfString(label);
        doc.font("Helvetica-Oblique").fontSize(9.5);
        const vw = doc.widthOfString(value);
        const startX = left + (width - lw - vw) / 2;
        doc.font("Helvetica-Bold").fillColor("#000").text(label, startX, topY + 6, { lineBreak: false });
        doc.font("Helvetica-Oblique").text(value, startX + lw, topY + 6, { lineBreak: false });
      },
    });

    rows.push({
      height: 50,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000").text("Stated that they were employed by you from: -", left + 8, topY + 6, { lineBreak: false });
        let x = left + 8 + doc.widthOfString("Stated that they were employed by you from: -") + 5;
        doc.font("Helvetica-Oblique").fontSize(9.5).text(dateFrom || "—", x, topY + 6, { lineBreak: false });
        x += doc.widthOfString(dateFrom || "—") + 10;
        doc.font("Helvetica-Bold").text("to: -", x, topY + 6, { lineBreak: false });
        x += doc.widthOfString("to: -") + 5;
        doc.font("Helvetica-Oblique").text(dateTo, x, topY + 6, { lineBreak: false });

        doc.font("Helvetica-Bold").fontSize(9.5).text("as a", left + 8, topY + 21, { lineBreak: false });
        doc.font("Helvetica-Oblique").fontSize(10).text(data.statedRole || "—", left + 8, topY + 35, { width: width - 16 });
      },
    });

    rows.push({
      height: 20,
      draw: (topY) => {
        drawInlineChoices(
          doc,
          left + 8,
          topY + 6,
          "Please confirm that the above information is correct: ",
          [
            { value: "yes", label: "YES" },
            { value: "no", label: "NO" },
          ],
          data.informationConfirmed ? "yes" : "no",
        );
      },
    });

    const hasGivenDetails = !!(confirmedFrom || confirmedTo || detailsIfDifferent);
    rows.push({
      height: detailsIfDifferent ? 34 : 20,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000").text("Please give details of employment  ", left + 8, topY + 6, { lineBreak: false });
        let x = left + 8 + doc.widthOfString("Please give details of employment  ");
        doc.font("Helvetica-Bold").text("from:- ", x, topY + 6, { lineBreak: false });
        x += doc.widthOfString("from:- ");
        drawBlankOrValue(doc, x, topY + 6, confirmedFrom || null, 70);
        x += 78;
        doc.font("Helvetica-Bold").text("to:- ", x, topY + 6, { lineBreak: false });
        x += doc.widthOfString("to:- ");
        drawBlankOrValue(doc, x, topY + 6, confirmedTo || null, 70);
        if (detailsIfDifferent) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#333").text(detailsIfDifferent, left + 8, topY + 21, { width: width - 16 });
        }
      },
    });

    rows.push({
      height: 18,
      draw: (topY) => {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(hasGivenDetails ? "#000" : "#888").text("(if different from above)", left + 10, topY + 4, { width: width - 20, align: "center" });
      },
    });

    rows.push({
      height: 20,
      draw: (topY) => {
        drawInlineChoices(doc, left + 8, topY + 6, "Attitude to work: ", [
          { value: "good", label: "Good" },
          { value: "average", label: "Average" },
          { value: "poor", label: "Poor" },
        ], data.attitude);
      },
    });

    rows.push({
      height: 20,
      twoCol: true,
      draw: (topY) => {
        drawInlineChoices(doc, left + 8, topY + 6, "Time Keeping: ", [
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ], data.timeKeeping);
        drawInlineChoices(doc, mid + 8, topY + 6, "Time off: ", [
          { value: "average", label: "Average" },
          { value: "more_than_average", label: "More than average" },
        ], data.timeOff);
      },
    });

    rows.push({
      height: 20,
      draw: (topY) => {
        drawInlineChoices(doc, left + 8, topY + 6, "Reason for leaving Company: ", [
          { value: "own_accord", label: "Own accord" },
          { value: "dismissed", label: "Dismissed" },
        ], data.reasonForLeaving);
      },
    });

    rows.push({
      height: 20,
      draw: (topY) => {
        drawInlineChoices(doc, left + 8, topY + 6, "Would you re-employ this person: ", [
          { value: "yes", label: "YES" },
          { value: "no", label: "NO" },
          { value: "cannot_comment", label: "Cannot comment" },
        ], data.wouldReemploy);
      },
    });

    rows.push({
      height: 26,
      twoCol: true,
      draw: (topY) => {
        drawLabelValue(doc, left + 8, topY + 9, "Print Name:", data.refereePrintName);
        drawLabelValue(doc, mid + 8, topY + 9, "Company:", data.refereeCompany);
      },
    });

    rows.push({
      height: 46,
      twoCol: true,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000").text("Signature:", left + 8, topY + 9, { lineBreak: false });
        const sigMatch = data.refereeSignature.match(/^data:image\/\w+;base64,(.+)$/);
        if (sigMatch) {
          try {
            doc.image(Buffer.from(sigMatch[1], "base64"), left + 8, topY + 21, { width: 150, height: 22 });
          } catch {
            // fall through — leave signature area blank if the image data is malformed
          }
        } else if (data.refereeSignature) {
          doc.font("Helvetica-Oblique").fontSize(13).text(data.refereeSignature, left + 8, topY + 24, { lineBreak: false });
        }
        drawLabelValue(doc, mid + 8, topY + 9, "Position:", data.refereePosition);
      },
    });

    rows.push({
      height: 22,
      draw: (topY) => {
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("THANK YOU FOR YOUR CO-OPERATION", left + 10, topY + 6, { width: width - 20, align: "center" });
      },
    });

    const boxTop = dividerY + 10;
    let y = boxTop;
    const boundaries: number[] = [boxTop];
    for (const row of rows) {
      row.draw(y);
      y += row.height;
      boundaries.push(y);
    }
    const boxBottom = y;

    doc.lineWidth(1.6).strokeColor("#000").rect(left, boxTop, width, boxBottom - boxTop).stroke();
    doc.lineWidth(0.6);
    for (let i = 1; i < boundaries.length - 1; i++) {
      doc.moveTo(left, boundaries[i]).lineTo(right, boundaries[i]).stroke();
    }
    rows.forEach((row, i) => {
      if (row.twoCol) {
        doc.moveTo(mid, boundaries[i]).lineTo(mid, boundaries[i + 1]).stroke();
      }
    });

    doc.font("Helvetica").fontSize(7.5).fillColor("#888").text(
      "Generated electronically via the Gardeo vetting portal — BS7858 Employment Reference Confirmation (REF 02).",
      left,
      boxBottom + 10,
      { width, align: "center" },
    );
    doc.text("This document forms part of the pre-employment screening record and is confidential.", left, boxBottom + 22, { width, align: "center" });

    const submittedBoxTop = boxBottom + 38;
    const submittedText = `Submitted On: ${data.submittedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${data.submittedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    doc.fillColor("#FFF176").rect(left, submittedBoxTop, width, 22).fill();
    doc.lineWidth(0.7).strokeColor("#000").rect(left, submittedBoxTop, width, 22).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(submittedText, left, submittedBoxTop + 6, { width, align: "center" });

    doc.end();
  });
}

function drawYesNoLine(doc: PDFKit.PDFDocument, left: number, answerX: number, width: number, y: number, label: string, answer: string): void {
  doc.font("Helvetica").fontSize(10).fillColor("#000").text(label, left, y, { width: answerX - left - 10 });
  doc.font("Helvetica-Bold").fontSize(10).text(answer.toUpperCase(), answerX, y, { lineBreak: false });
}

export function generatePersonalReferenceConfirmationPdf(data: {
  companyName: string;
  applicantName: string;
  refereeName: string;
  refereeAddress?: string | null;
  relationship?: string | null;
  howLongKnown?: string | null;
  illegalActivity: "yes" | "no";
  honestPerson: "yes" | "no";
  politeConduct: "yes" | "no";
  ableToWorkInTeam: "yes" | "no";
  trustworthyAndLoyal: "yes" | "no";
  goodChoiceForPosition: "yes" | "no";
  reasonIfNo?: string | null;
  refereePrintName: string;
  refereeOccupation?: string | null;
  refereeSignature: string;
  submittedAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const left = 40;
    const right = 555;
    const width = right - left;
    const answerX = 470;

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#1F3A5F").text(data.companyName, left, 40, { width });
    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#000").text("Personal Reference Request", left, undefined, { width, align: "center" });
    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").fontSize(10).text(`Dear ${data.refereeName} ,`, left, undefined, { width });
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10).text(`Address: ${data.refereeAddress || "—"}`, left, undefined, { width });
    doc.moveDown(0.8);

    doc.text(
      `${data.applicantName} has given your name as somebody who would be willing to provide a Character / Personal reference.`,
      left,
      undefined,
      { width },
    );
    doc.moveDown(0.8);

    doc.text(
      "Due to the nature of our work as a provider of security personnel and in compliance with the British Standard (BS 7858:2012) regarding vetting and screening of employees we must screen all employees background and character.",
      left,
      undefined,
      { width },
    );
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(11).text("Personal Reference Check", left, undefined, { width, align: "center" });
    doc.moveDown(1);

    doc.font("Helvetica").fontSize(10).text("Relationship with the Applicant: ", left, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(data.relationship || "—");
    doc.moveDown(0.6);

    doc.font("Helvetica").fontSize(10).text("How long have you known Applicant? ", left, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(data.howLongKnown || "—");
    doc.moveDown(0.8);

    drawYesNoLine(doc, left, answerX, width, doc.y, "Is the Applicant involved in any illegal activity?", data.illegalActivity);
    doc.moveDown(0.8);
    drawYesNoLine(doc, left, answerX, width, doc.y, "Is Applicant an honest person?", data.honestPerson);
    doc.moveDown(0.8);
    drawYesNoLine(doc, left, answerX, width, doc.y, "Is the Applicant nice and polite in general conduct?", data.politeConduct);
    doc.moveDown(0.8);
    drawYesNoLine(doc, left, answerX, width, doc.y, "Is the Applicant able to work within a team?", data.ableToWorkInTeam);
    doc.moveDown(0.8);
    drawYesNoLine(doc, left, answerX, width, doc.y, "Do you think that Applicant is trustworthy and loyal?", data.trustworthyAndLoyal);
    doc.moveDown(1);

    drawYesNoLine(doc, left, answerX, width, doc.y, "Do you think Applicant would be a good choice for this position?", data.goodChoiceForPosition);
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10).text(`If no, please state reason: ${data.goodChoiceForPosition === "no" ? (data.reasonIfNo || "—") : ""}`, left, undefined, { width });
    doc.moveDown(0.8);

    doc.text("Information provided by:", left, undefined, { width });
    doc.moveDown(1.2);

    const infoY = doc.y;
    doc.font("Helvetica").fontSize(10).text("Name: ", left, infoY, { continued: true });
    doc.font("Helvetica-Bold").text(data.refereePrintName);
    doc.font("Helvetica").text("Occupation: ", answerX - 60, infoY, { continued: true });
    doc.font("Helvetica-Bold").text(data.refereeOccupation || "—");
    doc.moveDown(1.4);

    const sigY = doc.y;
    doc.font("Helvetica").fontSize(10).text("Signature: ", left, sigY, { lineBreak: false });
    const sigLabelWidth = doc.widthOfString("Signature: ");
    const sigMatch = data.refereeSignature.match(/^data:image\/\w+;base64,(.+)$/);
    if (sigMatch) {
      try {
        doc.image(Buffer.from(sigMatch[1], "base64"), left + sigLabelWidth + 4, sigY - 8, { width: 130, height: 22 });
      } catch {
        // leave blank if signature image data is malformed
      }
    } else if (data.refereeSignature) {
      doc.font("Helvetica-Oblique").fontSize(12).text(data.refereeSignature, left + sigLabelWidth + 4, sigY, { lineBreak: false });
    }
    doc.font("Helvetica").fontSize(10).text("Date Received: ", answerX - 60, sigY, { continued: true });
    doc.font("Helvetica-Bold").text(formatDate(data.submittedAt.toISOString()));
    doc.moveDown(2);

    doc.font("Helvetica").fontSize(10).text("Thank you for your cooperation", left, undefined, { width });
    doc.moveDown(0.6);
    doc.text("Yours Faithfully,", left, undefined, { width });
    doc.moveDown(0.6);
    doc.text("HR Representative", left, undefined, { width });
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text(data.companyName, left, undefined, { width });

    doc.moveDown(2.5);
    doc.font("Helvetica").fontSize(7.5).fillColor("#888").text(
      "Generated electronically via the Gardeo vetting portal — BS7858 Personal Reference Confirmation.",
      left,
      undefined,
      { width, align: "center" },
    );
    doc.text(
      `Submitted On: ${data.submittedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${data.submittedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      left,
      undefined,
      { width, align: "center" },
    );

    doc.end();
  });
}
