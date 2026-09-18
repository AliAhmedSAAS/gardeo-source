import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const NAVY = "0F2942";
const STEEL = "1F4E79";
const GOLD = "8B7355";
const LIGHT = "F4F6F8";
const RULE = "D0D5DD";
const WHITE = "FFFFFF";

const thin = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = { top: none, bottom: none, left: none, right: none };

export type ImsSe19CompletionDocxData = {
  companyName?: string | null;
  officerName: string;
  niNumber?: string | null;
  appointmentDate?: string | null;
  screeningCompletedDate?: string | null;
  signatoryName?: string | null;
  signatoryInitials?: string | null;
  signatoryPosition?: string | null;
  signatureImage?: string | null;
};

function headerCell(text: string, shade: boolean) {
  return new TableCell({
    borders,
    width: { size: 2340, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: shade ? LIGHT : WHITE },
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Calibri",
            size: 15,
            bold: shade,
            color: NAVY,
          }),
        ],
      }),
    ],
  });
}

function headerRow(a: string, b: string, c: string, d: string) {
  return new TableRow({
    children: [headerCell(a, true), headerCell(b, false), headerCell(c, true), headerCell(d, false)],
  });
}

function banner(text: string, fill = NAVY) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder,
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 80, bottom: 80, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text, font: "Calibri", size: 18, bold: true, color: WHITE, allCaps: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [] });
}

function fieldRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 3200, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, font: "Calibri", size: 20, bold: true, color: NAVY })],
          }),
        ],
      }),
      new TableCell({
        borders,
        width: { size: 6160, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value || " ", font: "Calibri", size: 22 })],
          }),
        ],
      }),
    ],
  });
}

function body(text: string, size = 20) {
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size })],
  });
}

function optionLine(checked: boolean, text: string, bold = false) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: `${checked ? "☑" : "☐"}  ${text}`,
        font: "Calibri",
        size: 21,
        bold,
        color: checked ? NAVY : "222222",
      }),
    ],
  });
}

function signatureImageRun(dataUrl: string): ImageRun | null {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
  if (!match) return null;
  const rawType = match[1].toLowerCase();
  const type = rawType === "jpg" || rawType === "jpeg" ? "jpg" : rawType === "gif" ? "gif" : "png";
  try {
    return new ImageRun({
      type,
      data: Buffer.from(match[2], "base64"),
      transformation: { width: 160, height: 48 },
    });
  } catch {
    return null;
  }
}

export async function generateImsSe19CompletionCertificateDocx(data: ImsSe19CompletionDocxData): Promise<Buffer> {
  const companyName = (data.companyName || "Guardian FM").trim() || "Guardian FM";
  const signature = data.signatureImage ? signatureImageRun(data.signatureImage) : null;
  const signChildren: Paragraph[] = [];
  if (signature) {
    signChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [signature],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [2340, 2340, 2340, 2340],
                rows: [
                  headerRow("Reference", "IMS SE 19", "Version", "1.0"),
                  headerRow("Issue Date", "04/08/2017", "Created by", "CAW Consultancy"),
                  headerRow("Approved by", "Guardian FM MD", "", ""),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
                spacing: { before: 60 },
                children: [
                  new TextRun({
                    text: "UNCONTROLLED WHEN PRINTED  ·  IMS SE 19 Completion of Screening  ·  Page ",
                    font: "Calibri",
                    size: 14,
                    color: "666666",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Calibri",
                    size: 14,
                    color: "666666",
                  }),
                  new TextRun({ text: " of ", font: "Calibri", size: 14, color: "666666" }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Calibri",
                    size: 14,
                    color: "666666",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: companyName, font: "Calibri", size: 32, bold: true, color: NAVY }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "CERTIFICATE FOR COMPLETION OF SCREENING",
                font: "Calibri",
                size: 26,
                bold: true,
                color: STEEL,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: "Satisfactory completion of screening enquiries  ·  IMS SE 19",
                font: "Calibri",
                size: 18,
                color: GOLD,
              }),
            ],
          }),
          banner("CONFIDENTIAL WHEN COMPLETED"),
          spacer(160),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3200, 6160],
            rows: [
              fieldRow("Name", data.officerName || ""),
              fieldRow("N.I.", (data.niNumber || "").toUpperCase()),
              fieldRow("Date of Appointment", data.appointmentDate || ""),
              fieldRow("Date Screening Completed", data.screeningCompletedDate || ""),
            ],
          }),
          spacer(200),
          body(
            "The above named person has, to date, been contracted on a provisional / temporary basis and has undergone:",
            21,
          ),
          optionLine(true, "(a) Satisfactory completion of screening", true),
          optionLine(false, "(b) Completion of Screening with the following exceptions: Satisfactory"),
          spacer(120),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "My reasons for discretion in relation to above, is/are:",
                font: "Calibri",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } },
            spacing: { after: 280 },
            children: [new TextRun({ text: " ", font: "Calibri", size: 20 })],
          }),
          ...signChildren,
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2800, 6560],
            rows: [
              fieldRow("Signed", data.signatoryInitials || ""),
              fieldRow("Name", data.signatoryName || ""),
              fieldRow("Position", data.signatoryPosition || ""),
              fieldRow("Date", data.screeningCompletedDate || ""),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
