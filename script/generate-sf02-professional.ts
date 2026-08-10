/**
 * Generates SF 02 OPT OUT Agreement in the same professional SIA style as SF 01.
 * Run: npx tsx script/generate-sf02-professional.ts
 */
import fs from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  VerticalAlign,
} from "docx";

const OUT = path.join(process.cwd(), "docs", "8 - SCREENING & VETTING", "SF 02 OPT OUT Agreement.docx");
const BACKUP = path.join(
  process.cwd(),
  "docs",
  "8 - SCREENING & VETTING",
  "SF 02 OPT OUT Agreement.legacy.docx",
);

const NAVY = "13233F";
const STEEL = "1F3864";
const GOLD = "B08D57";
const LIGHT = "F2F2F2";
const RULE = "D0D5DD";
const WHITE = "FFFFFF";
const TEXT = "1A1A1A";
const MUTED = "444444";

const thin = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = { top: none, bottom: none, left: none, right: none };

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [] });
}

function body(text: string, size = 20) {
  return new Paragraph({
    spacing: { after: 140, line: 300 },
    children: [new TextRun({ text, font: "Arial", size, color: TEXT })],
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
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text,
                    font: "Arial",
                    size: 18,
                    bold: true,
                    color: WHITE,
                    allCaps: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function labelValue(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 2800, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: NAVY })],
          }),
        ],
      }),
      new TableCell({
        borders,
        width: { size: 6560, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value, font: "Arial", size: 20, color: TEXT })],
          }),
        ],
      }),
    ],
  });
}

function metaCell(text: string, fill: string, bold = false) {
  return new TableCell({
    borders,
    width: { size: 2340, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: 15,
            bold,
            color: NAVY,
          }),
        ],
      }),
    ],
  });
}

async function main() {
  if (fs.existsSync(OUT) && !fs.existsSync(BACKUP)) {
    fs.copyFileSync(OUT, BACKUP);
    console.log("Backed up legacy SF02 to:", BACKUP);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 900, bottom: 900, left: 900 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: noBorder,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "CSTM SERVICES LTD",
                                font: "Arial",
                                size: 18,
                                bold: true,
                                color: NAVY,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        borders: noBorder,
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: "SF 02 — OPT OUT Agreement",
                                font: "Arial",
                                size: 16,
                                color: GOLD,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: STEEL, space: 4 } },
                spacing: { after: 120 },
                children: [],
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
                    text: "CONFIDENTIAL — FOR SIA VETTING PURPOSES ONLY   |   Page ",
                    font: "Arial",
                    size: 14,
                    color: MUTED,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 14, color: MUTED }),
                  new TextRun({ text: " of ", font: "Arial", size: 14, color: MUTED }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Arial",
                    size: 14,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Document control
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2340, 2340, 2340, 2340],
            rows: [
              new TableRow({
                children: [
                  metaCell("Reference", LIGHT, true),
                  metaCell("SF 02", WHITE),
                  metaCell("Version", LIGHT, true),
                  metaCell("2.0", WHITE),
                ],
              }),
              new TableRow({
                children: [
                  metaCell("Issue Date", LIGHT, true),
                  metaCell("10/02/2026", WHITE),
                  metaCell("Approved", LIGHT, true),
                  metaCell("MD", WHITE),
                ],
              }),
            ],
          }),

          spacer(200),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "CSTM SERVICES LTD",
                font: "Arial",
                size: 28,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "OPT OUT AGREEMENT",
                font: "Arial",
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
                text: "Working Time Regulations  ·  SF 02",
                font: "Arial",
                size: 18,
                color: GOLD,
              }),
            ],
          }),

          banner("CONFIDENTIAL WHEN COMPLETED"),
          spacer(180),

          new Paragraph({
            spacing: { after: 160, line: 300 },
            children: [
              new TextRun({
                text: "I _________________________ agree with CSTM SERVICES LTD that:",
                font: "Arial",
                size: 21,
                color: TEXT,
              }),
            ],
          }),

          // Agreement terms
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [600, 8760],
            rows: [
              [
                "1.",
                "The 48 hour weekly working time limit under the Working Time Regulations does not apply to me.",
              ],
              ["2.", "This agreement applies for an indefinite period."],
              [
                "3.",
                "This agreement is terminable by me giving three months' notice in writing to the employer.",
              ],
              [
                "4.",
                "I have read and understood all of the above and freely give my agreement to it.",
              ],
            ].map(
              ([num, text]) =>
                new TableRow({
                  children: [
                    new TableCell({
                      borders: noBorder,
                      width: { size: 600, type: WidthType.DXA },
                      margins: { top: 60, bottom: 60, left: 40, right: 40 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: num,
                              font: "Arial",
                              size: 20,
                              bold: true,
                              color: GOLD,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: noBorder,
                      width: { size: 8760, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      children: [
                        new Paragraph({
                          spacing: { after: 40, line: 300 },
                          children: [
                            new TextRun({ text, font: "Arial", size: 20, color: TEXT }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),

          spacer(240),
          banner("APPLICANT DECLARATION", STEEL),
          spacer(140),

          body(
            "By signing below I confirm that I freely agree to this OPT OUT Agreement and understand that I may terminate it by giving three months' written notice to the employer.",
            18,
          ),

          spacer(80),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2800, 6560],
            rows: [
              labelValue("Print Name:", "{{APPLICANT_PRINT_NAME}}"),
              labelValue("Signed:", "{{EMPLOYEE_NAME}} __APPLICANT_SIG_IMG__"),
              labelValue("Date:", "{{APPLICANT_SIGNATURE_DATE}}"),
            ],
          }),

          spacer(280),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "FOR OFFICE USE ONLY",
                font: "Arial",
                size: 16,
                bold: true,
                color: MUTED,
              }),
            ],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
              new TableRow({
                children: ["Received by:", "Date received:", "File ref:"].map(
                  (t) =>
                    new TableCell({
                      borders,
                      width: { size: 3120, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: LIGHT },
                      margins: { top: 80, bottom: 80, left: 80, right: 80 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: t, font: "Arial", size: 16, color: MUTED }),
                          ],
                        }),
                        spacer(200),
                      ],
                    }),
                ),
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log("Wrote professional SF02:", OUT, `(${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
