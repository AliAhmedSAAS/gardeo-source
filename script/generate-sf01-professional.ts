/**
 * Generates a professional BS 7858 / SIA-ready SF 01 Application Form.
 * Content matches the legacy form; layout is modernised for HR / ACS presentation.
 *
 * Run: npx tsx script/generate-sf01-professional.ts
 */
import fs from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
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

const OUT = path.join(
  process.cwd(),
  "docs",
  "8 - SCREENING & VETTING",
  "SF 01 Application Form.docx",
);
const BACKUP = path.join(
  process.cwd(),
  "docs",
  "8 - SCREENING & VETTING",
  "SF 01 Application Form.legacy.docx",
);

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

function p(text: string, opts: Partial<ConstructorParameters<typeof Paragraph>[0]> = {}) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    ...opts,
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 20,
        ...(opts as any).run,
      }),
    ],
  });
}

function body(text: string, size = 20) {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size })],
  });
}

function muted(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 18, italics: true, color: "555555" })],
  });
}

function sectionTitle(num: string, title: string) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: STEEL, space: 4 } },
    children: [
      new TextRun({ text: `${num}  `, font: "Calibri", size: 22, bold: true, color: GOLD }),
      new TextRun({ text: title, font: "Calibri", size: 22, bold: true, color: NAVY }),
    ],
  });
}

function labelValueRow(label: string, valuePlaceholder: string, labelWidth = 2800, valueWidth = 6560) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: labelWidth, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, font: "Calibri", size: 18, bold: true, color: NAVY })],
          }),
        ],
      }),
      new TableCell({
        borders,
        width: { size: valueWidth, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: valuePlaceholder, font: "Calibri", size: 20 })],
          }),
        ],
      }),
    ],
  });
}

function twoColRow(
  l1: string,
  v1: string,
  l2: string,
  v2: string,
  w = [1800, 2880, 1800, 2880] as const,
) {
  const cell = (label: string, value: string, lw: number, vw: number) => [
    new TableCell({
      borders,
      width: { size: lw, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: LIGHT },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: label, font: "Calibri", size: 17, bold: true, color: NAVY })],
        }),
      ],
    }),
    new TableCell({
      borders,
      width: { size: vw, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: value, font: "Calibri", size: 19 })],
        }),
      ],
    }),
  ];
  return new TableRow({
    children: [...cell(l1, v1, w[0], w[1]), ...cell(l2, v2, w[2], w[3])],
  });
}

function fieldTable(rows: TableRow[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows,
  });
}

function employmentHeader() {
  const headers = [
    ["#", 500],
    ["Employer name, address & person reported to", 3200],
    ["Position held", 1600],
    ["Tele No.", 1200],
    ["Start", 1000],
    ["End", 1000],
    ["Reason for leaving", 860],
  ] as const;
  return new TableRow({
    children: headers.map(
      ([text, w]) =>
        new TableCell({
          borders,
          width: { size: w, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: STEEL },
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              children: [new TextRun({ text, font: "Calibri", size: 15, bold: true, color: WHITE })],
            }),
          ],
        }),
    ),
  });
}

function employmentRow(n: number) {
  const widths = [500, 3200, 1600, 1200, 1000, 1000, 860];
  const values = [
    String(n),
    `{{EMPLOYMENT_${n}_NAME}}\n{{EMPLOYMENT_${n}_ADDRESS}}\n{{EMPLOYMENT_${n}_REFEREE}}`,
    `{{EMPLOYMENT_${n}_TITLE}}`,
    `{{EMPLOYMENT_${n}_PHONE}}`,
    `{{EMPLOYMENT_${n}_START}}`,
    `{{EMPLOYMENT_${n}_END}}`,
    `{{EMPLOYMENT_${n}_REASON}}`,
  ];
  return new TableRow({
    children: values.map((text, i) => {
      const lines = text.split("\n");
      return new TableCell({
        borders,
        width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 50, bottom: 50, left: 40, right: 40 },
        children: lines.map(
          (line) =>
            new Paragraph({
              spacing: { after: 20 },
              children: [new TextRun({ text: line, font: "Calibri", size: 16 })],
            }),
        ),
      });
    }),
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

async function main() {
  if (fs.existsSync(OUT) && !fs.existsSync(BACKUP)) {
    fs.copyFileSync(OUT, BACKUP);
    console.log("Backed up legacy template to:", BACKUP);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [2340, 2340, 2340, 2340],
                rows: [
                  new TableRow({
                    children: [
                      ...(["Reference", "SF 01", "Version", "2.0"] as const).map((t, i) =>
                        new TableCell({
                          borders,
                          width: { size: 2340, type: WidthType.DXA },
                          shading: {
                            type: ShadingType.CLEAR,
                            fill: i % 2 === 0 ? LIGHT : WHITE,
                          },
                          margins: { top: 30, bottom: 30, left: 60, right: 60 },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: t,
                                  font: "Calibri",
                                  size: 15,
                                  bold: i % 2 === 0,
                                  color: NAVY,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ),
                    ],
                  }),
                  new TableRow({
                    children: [
                      ...(["Issue Date", "10/02/2026", "Approved", "MD"] as const).map((t, i) =>
                        new TableCell({
                          borders,
                          width: { size: 2340, type: WidthType.DXA },
                          shading: {
                            type: ShadingType.CLEAR,
                            fill: i % 2 === 0 ? LIGHT : WHITE,
                          },
                          margins: { top: 30, bottom: 30, left: 60, right: 60 },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: t,
                                  font: "Calibri",
                                  size: 15,
                                  bold: i % 2 === 0,
                                  color: NAVY,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ),
                    ],
                  }),
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
                    text: "UNCONTROLLED WHEN PRINTED  ·  BS 7858:2019 Security Screening  ·  Page ",
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
          // Title block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: "CSTM SERVICES LTD",
                font: "Calibri",
                size: 32,
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
                text: "APPLICATION FORM",
                font: "Calibri",
                size: 28,
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
                text: "Security Screening & Vetting  ·  SF 01",
                font: "Calibri",
                size: 18,
                color: GOLD,
              }),
            ],
          }),

          banner("CONFIDENTIAL WHEN COMPLETED"),
          spacer(140),

          // Cover meta
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [6200, 3160],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders,
                    width: { size: 6200, type: WidthType.DXA },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [
                      body("CSTM SERVICES LTD"),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({
                            text: "VETTING FROM: {{VETTING_START_DAY}} / {{VETTING_START_MONTH}} / {{VETTING_START_YEAR}}",
                            font: "Calibri",
                            size: 19,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "VETTED BY: {{HR_SIGNATORY_NAME}}",
                            font: "Calibri",
                            size: 19,
                          }),
                        ],
                      }),
                      muted("(12/16 weeks from the above date)"),
                      new Paragraph({
                        spacing: { before: 80, after: 40 },
                        children: [
                          new TextRun({
                            text: "S.I.A. LICENCE NUMBER: {{SIA_LICENCE}}",
                            font: "Calibri",
                            size: 19,
                            bold: true,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "EMPLOYMENT AS: {{OFFICER_TYPE}}",
                            font: "Calibri",
                            size: 19,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    borders,
                    width: { size: 3160, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: LIGHT },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 120, bottom: 120, left: 80, right: 80 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: "PLEASE AFFIX",
                            font: "Calibri",
                            size: 16,
                            bold: true,
                            color: NAVY,
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: "PHOTOGRAPH",
                            font: "Calibri",
                            size: 16,
                            bold: true,
                            color: NAVY,
                          }),
                        ],
                      }),
                      muted("Passport-size"),
                    ],
                  }),
                ],
              }),
            ],
          }),

          spacer(100),
          muted("PLEASE ANSWER ALL QUESTIONS USING BLOCK CAPITALS"),

          // 1. Personal
          sectionTitle("1.", "PERSONAL INFORMATION"),
          fieldTable([
            labelValueRow("SURNAME:", "{{EMPLOYEE_SURNAME}}"),
            labelValueRow("FIRST NAMES:", "{{EMPLOYEE_FIRST_NAMES}}"),
            labelValueRow("CURRENT ADDRESS:", "{{EMPLOYEE_ADDRESS}}"),
            labelValueRow("TELEPHONE:", "{{EMPLOYEE_PHONE}}"),
            labelValueRow("MOBILE NO:", "{{EMPLOYEE_MOBILE}}"),
            labelValueRow(
              "PREVIOUS ADDRESS (if less than 3 years at above):",
              "{{PREVIOUS_ADDRESS}}",
            ),
            labelValueRow("DRIVING LICENCE:", "{{DRIVING_LICENCE}}"),
            labelValueRow("CAR OWNER:", "{{CAR_OWNER}}"),
            labelValueRow("NATIONAL INSURANCE No:", "{{NI_NUMBER}}"),
            labelValueRow("Place of birth:", "{{PLACE_OF_BIRTH}}"),
            labelValueRow("MARITAL STATUS:", "{{MARITAL_STATUS}}"),
            labelValueRow("HOW DID YOU HEAR ABOUT THE ROLE:", "{{HEARD_ABOUT_ROLE}}"),
          ]),

          // 2. Bank
          sectionTitle("2.", "BANK DETAILS (complete at interview)"),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2340, 2340, 2340, 2340],
            rows: [
              twoColRow(
                "BANK ACCOUNT NUMBER",
                "{{BANK_ACCOUNT_NUMBER}}",
                "SORT CODE",
                "{{BANK_SORT_CODE}}",
              ),
              twoColRow(
                "NAME OF BANK",
                "{{BANK_NAME}}",
                "NAME OF ACCOUNT HOLDER",
                "{{BANK_ACCOUNT_NAME}}",
              ),
            ],
          }),

          // 3. Emergency
          sectionTitle("3.", "PERSON/NEXT OF KIN TO BE CONTACTED IN ANY EMERGENCY"),
          fieldTable([
            labelValueRow("NAME:", "{{EMERGENCY_CONTACT_NAME}}"),
            labelValueRow("ADDRESS:", "{{EMERGENCY_CONTACT_ADDRESS}}"),
            labelValueRow("RELATIONSHIP:", "{{EMERGENCY_CONTACT_RELATIONSHIP}}"),
            labelValueRow("TELEPHONE NUMBER:", "{{EMERGENCY_CONTACT_PHONE}}"),
          ]),
          spacer(80),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
              new TableRow({
                children: [
                  "HEIGHT: {{HEIGHT}}",
                  "WEIGHT: {{WEIGHT}}",
                  "COLOUR OF EYES: {{COLOUR_OF_EYES}}",
                ].map(
                  (t) =>
                    new TableCell({
                      borders,
                      width: { size: 3120, type: WidthType.DXA },
                      margins: { top: 60, bottom: 60, left: 80, right: 80 },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: t, font: "Calibri", size: 18 })],
                        }),
                      ],
                    }),
                ),
              }),
            ],
          }),

          // 4. Court
          sectionTitle(
            "4.",
            "COURT APPEARANCES / CONVICTIONS / OUTSTANDING OFFENCES",
          ),
          muted(
            "Have you ever appeared before a court charged with a criminal, civil or military offence and been convicted including any motoring offences? Have you any alleged offences outstanding?",
          ),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "4. HAVE YOU EVER APPEARED BEFORE A COURT — YES/NO",
                font: "Calibri",
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "IF YES, GIVE DETAILS: {{CRIMINAL_CONVICTION_DETAILS}}",
                font: "Calibri",
                size: 19,
              }),
            ],
          }),

          // 5. Personal history
          sectionTitle("5.", "PERSONAL HISTORY (PART A)"),
          body(
            "The security screening process requires that we are able to verify your personal history for a period of ten OR FIVE years or to date of leaving school. Please give details of your personal history, identify in the space provided all periods of EMPLOYMENT, self-employment, registered or unregistered unemployment (state the unemployment office which you reported to), military service. Be sure to give full addresses including telephone numbers and dates.",
            18,
          ),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [500, 3200, 1600, 1200, 1000, 1000, 860],
            rows: [employmentHeader(), ...[1, 2, 3, 4, 5, 6, 7].map(employmentRow)],
          }),

          spacer(160),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "PERSONAL HISTORY (PART B)",
                font: "Calibri",
                size: 20,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          body(
            "IN THE CASE OF PERIODS OF SELF-EMPLOYMENT PLEASE GIVE NAMES AND ADDRESSES OF SOMEONE WHO CAN CONFIRM YOUR DETAILS (i.e., BOOKKEEPER, ACCOUNTANT, and OR SOLICITOR).",
            18,
          ),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "HAVE YOU BEEN MADE BANKRUPT? YES/NO                          DO YOU HAVE ANY COUNTY COURT JUDGEMENTS? YES/NO",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "DO YOU OBJECT TO THE COMPANY CONTACTING A CREDIT AGENCY WITH REFERENCE TO YOURSELF? YES/NO",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),

          // 7. Education (legacy numbering kept)
          sectionTitle("7.", "DETAILS OF WHEN YOU LEFT SCHOOL & IF YOU ATTENDED COLLEGE IN THE LAST 10 YEARS"),
          fieldTable([
            labelValueRow("School name (secondary only):", "{{SCHOOL_NAME}}"),
            labelValueRow("Town / city:", "{{SCHOOL_TOWN}}"),
            labelValueRow("Date left school:", "{{SCHOOL_LEFT}}"),
            labelValueRow("College & dates:", "{{COLLEGE_DETAILS}}"),
          ]),
          muted(
            "Employees working on night duties may be required to undertake a medical, for further information contact head office",
          ),

          // Terms
          sectionTitle("", "READ THIS SECTION CAREFULLY BEFORE YOU SIGN THE STATEMENT"),
          body(
            "1. IF OFFERED EMPLOYMENT IT WILL BE INITIALLY FOR A PROBATIONARY PERIOD OF 16 WEEKS. AFTER A PERIOD OF 12 WEEKS FROM START DATE FOR SCREENING:",
            18,
          ),
          body(
            '2. DURING THE PROBATIONARY PERIOD YOUR CONTRACT OF EMPLOYMENT MAY BE TERMINABLE BY THE "COMPANY" BY NO LESS THAN 24 HOURS NOTICE IN WRITING. THIS APPLIES TO SCREENING PERIOD ALSO.',
            18,
          ),
          body("CONTINUED EMPLOYMENT IS CONDITIONAL UPON SATISFACTORY SCREENING.", 18),
          body(
            "WE COMPLETE SOCIAL MEDIA AND INTERNET SEARCHES ON ALL APPLICANTS TO IDENTIFY ILLEGAL ACTIVITY INCLUDING BUT NOT EXCLUSIVELY HATE CRIME",
            18,
          ),

          spacer(80),
          banner("STATEMENT TO BE SIGNED BY APPLICANT", STEEL),
          spacer(100),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "I _________________________CERTIFY THAT TO THE BEST OF MY KNOWLEDGE, THE INFORMATION I HAVE GIVEN IS COMPLETE AND CORRECT, AND I UNDERSTAND THAT MISREPRESENTATION OF FACTS IS GROUNDS FOR IMMEDIATE DISMISSAL AND RENDERS ME LIABLE FOR PROSECUTION.",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          body(
            "I AUTHORISE THE COMPANY TO APPROACH ANY GOVERNMENT AGENCIES, FORMER EMPLOYERS, CREDIT AGENCIES AND PERSONAL REFEREES TO VERIFY THE INFORMATION GIVEN AND WILL SUPPLY A STATUTORY DECLARATION IF REQUIRED (I GIVE PERMISSION FOR MY PRESENT EMPLOYER TO BE APPROACHED). I CONFIRM IF SUCCESSFUL",
            18,
          ),
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({
                text: "APPLICANTS SIGNATURE: _______________________________________DATE:_______________________",
                font: "Calibri",
                size: 19,
                bold: true,
              }),
            ],
          }),

          spacer(120),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "ADDITIONAL INFORMATION",
                font: "Calibri",
                size: 20,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          muted("(PLEASE USE THIS SECTION TO SUPPLY ANY OTHER RELEVANT INFORMATION)"),
          ...Array.from({ length: 6 }, () =>
            new Paragraph({
              spacing: { after: 40 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
              children: [],
            }),
          ),

          // Notice
          spacer(160),
          banner("Notice to all Applicants"),
          spacer(100),
          body(
            "CSTM SERVICES LTD Conforms to the Standard of BS 7858:2019 and as such all applicants must undergo a security screening process.",
            18,
          ),
          body("The application must be completed in full.", 18),
          body(
            "A full 5 year work history (or in the case of a younger applicant a 10 year if the company requires the later for client or insurance reasons).",
            18,
          ),
          body("Personal references · Proof of ID · Proof of address · Medical history · National Insurance Check · Criminal Records Bureau Screening via the S.I.A.", 18),
          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({
                text: "As to enable us to process your application please supply the following in full",
                font: "Calibri",
                size: 18,
                bold: true,
              }),
            ],
          }),
          body("• Full names, addresses and telephone numbers of previous employers", 18),
          body("• Full names, addresses and telephone numbers of personal references", 18),
          body("• Full details of any unemployment", 18),
          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({
                text: "Please bring the following items to your interview",
                font: "Calibri",
                size: 18,
                bold: true,
              }),
            ],
          }),
          body(
            "Birth certificate · Passport (if held) · Two recent utility bills · Driving licence (if held) · Two passport size photographs · Bank details · P45 if you have one",
            18,
          ),
          body(
            "Failure to complete this application form could result in your application being delayed or rejected. Any information supplied that is found to be fraudulent would result in dismissal or in some cases legal action being taken.",
            18,
          ),

          spacer(100),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Before proceeding with this application",
                font: "Calibri",
                size: 20,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "Do you agree to a S.I.A. Criminal record check being carried out? YES/NO",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "Do you fully understand the potential consequences? YES/NO",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "Do you agree to a credit check taken via a credit agency regards to yourself YES/NO?",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: "Print Name_______________________", font: "Calibri", size: 19 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: "Signature________________________", font: "Calibri", size: 19 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({ text: "Date ___________________________", font: "Calibri", size: 19 }),
            ],
          }),

          // Office use
          banner("FOR OFFICE USE ONLY", "4A5568"),
          spacer(100),
          body("Associated Documents:           Seen:Date:       Copy Retained:", 17),
          body("Birth Certificate/Passport", 17),
          body("S.I.A. Licence", 17),
          body("Service Record", 17),
          body("Utility Bill/Bank Statement", 17),
          muted(
            "NOTE: PHOTOCOPIES OF ONE THE ABOVE DOCUMENTS ARE TO BE INCLUDED WITHIN VETTING PAPERS.",
          ),
          spacer(80),
          body(
            "I HAVE CHECKED THE DETAILS OF THIS APPLICATION FORM AND CONFIRM THAT ALL INFORMATION IS CORRECT AT TIME OF INTERVIEW.",
            18,
          ),
          new Paragraph({
            spacing: { before: 80, after: 120 },
            children: [
              new TextRun({
                text: "PRINT NAME……………………………………………… SIGN………………………………………",
                font: "Calibri",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: "SOCIAL MEDIA CHECK FINDINGS",
                font: "Calibri",
                size: 18,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          ...Array.from({ length: 4 }, () =>
            new Paragraph({
              spacing: { after: 40 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
              children: [],
            }),
          ),
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: "INTERNET SEARCH FINDINGS",
                font: "Calibri",
                size: 18,
                bold: true,
                color: NAVY,
              }),
            ],
          }),
          ...Array.from({ length: 4 }, () =>
            new Paragraph({
              spacing: { after: 40 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
              children: [],
            }),
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log("Wrote professional SF01:", OUT, `(${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
