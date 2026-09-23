import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

const NAVY = "#1F3A5F";
const ACCENT = "#FF8C42";

function gbp(v: unknown): string {
  const n = parseFloat(String(v || 0)) || 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function pdfBuffer(build: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export type PayslipData = {
  companyName: string;
  billNumber: string;
  officerName: string;
  niNumber?: string | null;
  periodFrom: string;
  periodTo: string;
  hours: number;
  rate: string;
  expense: number;
  gross: number;
  remarks?: string | null;
  provider?: string | null;
  paymentDate?: string | null;
  lines: Array<{ date: string; site: string; inTime: string; outTime: string; hours: number; rate: string; wages: number }>;
};

export function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.rect(0, 0, 595, 8).fill(ACCENT);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(NAVY).text(data.companyName, 48, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#666").text("PAYSLIP", 48, 52);
    doc.fontSize(9).fillColor("#333");
    doc.text(`Bill ${data.billNumber}`, 400, 28, { width: 150, align: "right" });
    if (data.paymentDate) doc.text(`Paid ${data.paymentDate}`, 400, 42, { width: 150, align: "right" });

    let y = 78;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(data.officerName, 48, y);
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    if (data.niNumber) doc.text(`NI: ${data.niNumber}`, 48, y);
    doc.text(`Period: ${data.periodFrom} – ${data.periodTo}`, 220, y);
    y += 22;

    doc.rect(48, y, 500, 18).fill(NAVY);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8);
    doc.text("Date", 52, y + 5, { width: 70 });
    doc.text("Site", 122, y + 5, { width: 140 });
    doc.text("In", 270, y + 5, { width: 40 });
    doc.text("Out", 310, y + 5, { width: 40 });
    doc.text("Hrs", 355, y + 5, { width: 40 });
    doc.text("Rate", 400, y + 5, { width: 50 });
    doc.text("Wages", 470, y + 5, { width: 70, align: "right" });
    y += 20;

    doc.font("Helvetica").fontSize(8).fillColor("#222");
    for (const line of data.lines) {
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
      doc.text(String(line.date).slice(0, 10), 52, y, { width: 70 });
      doc.text(line.site || "—", 122, y, { width: 140 });
      doc.text(line.inTime || "", 270, y, { width: 40 });
      doc.text(line.outTime || "", 310, y, { width: 40 });
      doc.text(String(line.hours), 355, y, { width: 40 });
      doc.text(gbp(line.rate), 400, y, { width: 50 });
      doc.text(gbp(line.wages), 470, y, { width: 70, align: "right" });
      y += 14;
    }

    y += 10;
    doc.rect(48, y, 500, 1).fill(NAVY);
    y += 10;
    doc.font("Helvetica").fontSize(9);
    doc.text(`Hours: ${data.hours}`, 48, y);
    doc.text(`Rate: ${gbp(data.rate)}`, 180, y);
    doc.text(`Expense: ${gbp(data.expense)}`, 300, y);
    doc.font("Helvetica-Bold").text(`Gross: ${gbp(data.gross)}`, 430, y, { width: 118, align: "right" });
    y += 18;
    if (data.provider) doc.font("Helvetica").fontSize(8).fillColor("#555").text(`Provider: ${data.provider}`, 48, y);
    if (data.remarks) doc.text(`Remarks: ${data.remarks}`, 220, y, { width: 320 });
  });
}

export type RemittanceData = {
  companyName: string;
  billNumber: string;
  officerName: string;
  amount: number;
  postDate: string;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
};

export function generateRemittanceAdvicePdf(data: RemittanceData): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.rect(0, 0, 595, 8).fill(ACCENT);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(NAVY).text(data.companyName, 48, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#666").text("REMITTANCE ADVICE", 48, 52);
    doc.moveDown(2);
    doc.font("Helvetica").fontSize(11).fillColor("#222");
    doc.text(`Payee: ${data.officerName}`);
    doc.text(`Bill: ${data.billNumber}`);
    doc.text(`Payment date: ${data.postDate}`);
    doc.text(`Amount: ${gbp(data.amount)}`);
    if (data.bankName) doc.text(`Bank: ${data.bankName}`);
    if (data.accountTitle) doc.text(`Account: ${data.accountTitle}`);
    if (data.accountNumber) doc.text(`Account no: ${data.accountNumber}`);
    if (data.sortCode) doc.text(`Sort code: ${data.sortCode}`);
    doc.moveDown();
    doc.fontSize(9).fillColor("#555").text("This remittance confirms that the amount above has been posted against the listed bill.");
  });
}
