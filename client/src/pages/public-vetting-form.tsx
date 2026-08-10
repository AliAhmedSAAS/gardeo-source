import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, User, Mail, Phone, MapPin, ShieldCheck, Heart, CreditCard, Briefcase, Eraser } from "lucide-react";
import { AddressFieldsGroup } from "@/components/AddressFieldsGroup";

type VettingFormPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  secondPhone: string;
  maritalStatus: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalInsurance: string;
  placeOfBirth: string;
  ethnicOrigin: string;
  ethnicOriginSpecify: string;
  hasDisability: string;
  registeredDisabled: string;
  registeredDisabilityNumber: string;
  disabilityNature: string;
  jobTitle: string;
  officerType: string;
  heardAboutRole: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  livingFrom: string;
  previousAddressLine1: string;
  previousAddressLine2: string;
  previousCity: string;
  previousCounty: string;
  previousPostcode: string;
  previousLivingFrom: string;
  previousLivingTo: string;
  drivingLicenceNumber: string;
  carOwner: string;
  siaLicenseNumber: string;
  siaLicenseType: string;
  siaExpiryDate: string;
  height: string;
  weight: string;
  colourOfEyes: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactAlternatePhone: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  bankAccountName: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  buildingSocietyRef: string;
  criminalConviction: string;
  criminalConvictionDetails: string;
  beenBankrupt: string;
  hasCcj: string;
  objectToCreditAgency: string;
  schoolName: string;
  schoolTown: string;
  schoolLeftDate: string;
  collegeDetails: string;
  additionalInformation: string;
  agreeSiaCriminalCheck: string;
  understandConsequences: string;
  agreeCreditCheck: string;
  signaturePrintName: string;
  signatureData: string;
  signatureDate: string;
  employment1EmployerName: string;
  employment1EmployerAddress: string;
  employment1JobTitle: string;
  employment1DateFrom: string;
  employment1DateTo: string;
  employment1ReasonForLeaving: string;
  employment1RefereeName: string;
  employment1RefereePhone: string;
  employment1RefereeEmail: string;
  employment2EmployerName: string;
  employment2EmployerAddress: string;
  employment2JobTitle: string;
  employment2DateFrom: string;
  employment2DateTo: string;
  employment2ReasonForLeaving: string;
  employment2RefereeName: string;
  employment2RefereePhone: string;
  employment2RefereeEmail: string;
  employment3EmployerName: string;
  employment3EmployerAddress: string;
  employment3JobTitle: string;
  employment3DateFrom: string;
  employment3DateTo: string;
  employment3ReasonForLeaving: string;
  employment3RefereeName: string;
  employment3RefereePhone: string;
  employment3RefereeEmail: string;
  employment4EmployerName: string;
  employment4EmployerAddress: string;
  employment4JobTitle: string;
  employment4DateFrom: string;
  employment4DateTo: string;
  employment4ReasonForLeaving: string;
  employment4RefereeName: string;
  employment4RefereePhone: string;
  employment4RefereeEmail: string;
  employment5EmployerName: string;
  employment5EmployerAddress: string;
  employment5JobTitle: string;
  employment5DateFrom: string;
  employment5DateTo: string;
  employment5ReasonForLeaving: string;
  employment5RefereeName: string;
  employment5RefereePhone: string;
  employment5RefereeEmail: string;
};

type FormResponse = {
  companyName: string;
  expiresAt: string;
  submittedAt: string | null;
  lastSavedAt: string | null;
  acknowledgements: {
    equalOps: boolean;
    zeroHours: boolean;
    codeOfConduct: boolean;
    optOut: boolean;
  };
  form: VettingFormPayload;
};

const STEPS = [
  { id: "personalDetails", label: "Personal Details" },
  { id: "addressHistory", label: "Address History" },
  { id: "licencesContact", label: "Licences & Contact" },
  { id: "bankEmployment", label: "Bank & Employment" },
  { id: "screeningEducation", label: "Screening & Education" },
  { id: "declarationsSignature", label: "Declarations & Signature" },
  { id: "equalOps", label: "Equal Opportunities" },
  { id: "zeroHours", label: "Zero Hours Contract" },
  { id: "optOut", label: "OPT OUT Agreement" },
  { id: "conduct", label: "Code of Conduct" },
  { id: "review", label: "Review & Submit" },
] as const;

type StepId = typeof STEPS[number]["id"];

function formatExpiry(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 border-t border-border/40 first:border-t-0 first:pt-0">
      {children}
    </p>
  );
}

function ContractClause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

function ZeroHoursContractContent({ companyName }: { companyName: string }) {
  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-slate-50 p-4 space-y-5">
      <div className="text-center space-y-1 pb-2 border-b">
        <p className="text-sm font-bold text-slate-900">Zero Hours Contract</p>
        <p className="text-xs text-muted-foreground">{companyName}</p>
      </div>

      <ContractClause title="1. Status of this agreement">
        <p>
          This contract governs your engagement from time to time by {companyName} (Company) as a casual
          worker. This is not an employment contract and does not confer any employment rights on you
          (other than those to which workers are entitled). In particular, it does not create any
          obligation on the Company to provide work to you and by entering into this contract you confirm
          your understanding that the Company makes no promise or guarantee of a minimum level of work to
          you and you will work on a flexible, &quot;as required&quot; basis. It is the intention of both
          you and the Company that there be no mutuality of obligation between the parties at any time
          when you are not performing an assignment.
        </p>
        <p>
          You warrant that you understand that as a casual worker you will not be entitled to bring any
          claims for certain legal rights conferred on employees including but not limited to unfair
          dismissal.
        </p>
      </ContractClause>

      <ContractClause title="2. Company's discretion as to work offered">
        <p>
          It is entirely at the Company&apos;s discretion whether to offer you work and it is under no
          obligation to provide work to you at any time.
        </p>
        <p>
          The Company reserves the right to give or not give work to any person at any time and is under
          no obligation to give any reasons for such decisions.
        </p>
      </ContractClause>

      <ContractClause title="3. No presumption of continuity">
        <p>
          Each offer of work by the Company which you accept shall be treated as an entirely separate and
          severable engagement (an assignment). The terms of this contract shall apply to each assignment
          but there shall be no relationship between the parties after the end of one assignment and
          before the start of any subsequent assignment.
        </p>
        <p>
          The fact that the Company has offered you work, or offers you work more than once, shall not
          confer any legal rights on you and should not be regarded as establishing an entitlement to
          regular work or conferring continuity of employment.
        </p>
      </ContractClause>

      <ContractClause title="4. Arrangements for work">
        <p>
          If the Company wants to offer you any work, it will contact you by telephone and/or text. You
          must provide accurate contact details to the Company when requested. You are under no obligation
          to accept any work offered by the Company at any time. If you accept an assignment, you must
          inform the Company immediately if you will be unable to complete it for any reason.
        </p>
        <p>
          The Company reserves the right to terminate an assignment at any time for operational reasons.
          You will be paid for all work done during the assignment up to the time it is terminated.
        </p>
      </ContractClause>

      <ContractClause title="5. Work">
        <p>
          The Company may offer you work from time to time as Security Operative. The precise description
          and nature of your work may be varied with each assignment, and you may be required to carry out
          other duties as necessary to meet business needs. You will be informed of the requirements at
          the start of each assignment.
        </p>
        <p>
          Before offering you an assignment the Company will require certain documents from you in order
          to satisfy itself that you are legally entitled to work in the UK.
        </p>
        <p>
          You confirm that you are legally entitled to work in the UK without any additional immigration
          approvals and agree to notify the Company immediately if you cease to be so entitled at any
          time.
        </p>
      </ContractClause>

      <ContractClause title="6. Place of work">
        <p>
          The Company may offer you work at various locations. You will be informed of the relevant place
          of work for each assignment.
        </p>
      </ContractClause>

      <ContractClause title="7. Hours of work">
        <p>
          Your hours of work will vary depending on the operational requirements of the Company. You will
          be informed of the required hours for each assignment.
        </p>
        <p>
          You will be entitled to a lunch break of one hour where your assignment requires you to work
          more than six hours in any one day.
        </p>
      </ContractClause>

      <ContractClause title="8. Pay">
        <p>
          You will only be paid for the hours that you work. Each assignment hourly rate of pay for casual
          workers will be given via booking text message/email. Each assignment hourly rate might vary.
          Current rate range depends on the assignment needs and position. You will be paid each Friday
          directly into your bank account for the hours worked in the previous two weeks. The Company will
          make all necessary deductions from your salary as required by law and shall be entitled to
          deduct from your pay or other payments due to you any money which you may owe to the Company at
          any time.
        </p>
      </ContractClause>

      <ContractClause title="9. Holidays">
        <p>
          Due to the nature of the work being mainly seasonal we include your holiday pay in your hourly
          rate. However, if you would prefer to receive a reduced hourly rate and take holidays then
          please let us know you wish to opt out of rolled-up holiday pay and we will arrange this for
          you.
        </p>
        <p>
          Holidays will be accrued at a rate of 12.07% in line with government guidelines. You can
          calculate your holidays using this HMRC tool:{" "}
          <a
            href="https://www.gov.uk/calculate-your-holiday-entitlement"
            target="_blank"
            rel="noreferrer"
            className="text-teal-700 underline"
          >
            https://www.gov.uk/calculate-your-holiday-entitlement
          </a>
        </p>
      </ContractClause>

      <ContractClause title="10. Pension">
        <p>Our Pension scheme is with Nest and information will be provided separately.</p>
      </ContractClause>

      <ContractClause title="11. Sickness">
        <p>
          If you have accepted an offer of work but are subsequently unable to work the hours agreed, you
          must notify the HR department of the reason for your absence as soon as possible.
        </p>
        <p>
          If you satisfy the qualifying conditions laid down by law, you will be entitled to receive
          statutory sick pay (SSP) at the prevailing rate in respect of any period of sickness or injury
          during an assignment, but you will not be entitled to any other payments from the Company during
          such period.
        </p>
      </ContractClause>

      <ContractClause title="12. Company rules and procedures">
        <p>
          During each assignment you are always required to comply with the relevant Company rules,
          policies, and procedures in force and which are available on site and at the {companyName}{" "}
          office, and each assignment instructions on customer site.
        </p>
      </ContractClause>

      <ContractClause title="13. Confidential information">
        <p>
          You shall not use or disclose to any person, either during or at any time after your engagement
          by the Company, any confidential information about the business or affairs of the Company, or
          about any other matters which may come to your knowledge as a result of carrying out
          assignments. For the purposes of this clause, confidential information means any information or
          matter which is not in the public domain and which relates to the affairs of the company.
        </p>
        <p>The restriction in this clause does not apply to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            prevent you from making a protected disclosure within the meaning of section 43A of the
            Employment Rights Act 1996; or
          </li>
          <li>
            use or disclosure that has been authorized by the Company or is required by law or in the
            course of your duties.
          </li>
        </ul>
      </ContractClause>

      <ContractClause title="14. Company property">
        <p>
          All documents, manuals, hardware and software provided for your use by the Company, and any data
          or documents (including copies) produced, maintained or stored on the Company&apos;s computer
          systems or other electronic equipment (including mobile phones), remain the property of the
          Company.
        </p>
        <p>
          Any Company property in your possession and any original or copy documents obtained by you in
          the course of your work for the Company shall be returned to the HR department at any time on
          request and in any event at the end of each assignment.
        </p>
      </ContractClause>

      <ContractClause title="15. Termination">
        <p>
          If you wish your name to be removed from the Company&apos;s staff bank of zero hours workers you
          should inform the HR department as soon as possible.
        </p>
        <p>
          The Company may remove your name from its staff bank of zero hours workers if you are unable to
          accept an assignment on five consecutive occasions.
        </p>
        <p>
          The Company may terminate this contract immediately by giving notice in writing to you if it
          reasonably considers that you have committed any serious breach of its terms or committed any
          act of gross misconduct. Non-exhaustive examples of gross misconduct include dishonesty, theft,
          fighting, misuse of drugs or alcohol or any other acts or omissions which might bring the
          Company into disrepute.
        </p>
      </ContractClause>

      <ContractClause title="16. Governing law">
        <p>This contract will be governed by the law of England and Wales.</p>
      </ContractClause>
    </div>
  );
}

/** SF 02 — Working Time Regulations 48-hour weekly limit OPT OUT Agreement */
function OptOutAgreementContent({ companyName }: { companyName: string }) {
  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-slate-50 p-4 space-y-5">
      <div className="text-center space-y-1 pb-2 border-b">
        <p className="text-sm font-bold text-slate-900">OPT OUT Agreement</p>
        <p className="text-xs text-muted-foreground">
          Working Time Regulations — SF 02 · {companyName}
        </p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        I agree with <strong className="text-slate-800">{companyName}</strong> that:
      </p>

      <ol className="list-decimal pl-5 space-y-3 text-sm text-muted-foreground leading-relaxed">
        <li>
          The 48 hour weekly working time limit under the Working Time Regulations does not apply to
          me.
        </li>
        <li>This agreement applies for an indefinite period.</li>
        <li>
          This agreement is terminable by me giving three months&apos; notice in writing to the
          employer.
        </li>
        <li>I have read and understood all of the above and freely give my agreement to it.</li>
      </ol>

      <p className="text-xs text-muted-foreground border-t pt-3">
        By acknowledging below, you confirm you voluntarily opt out of the 48-hour average weekly
        working time limit. You may end this agreement by giving three months&apos; written notice.
      </p>
    </div>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (data: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

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
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
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
    if (!canvas) return;
    setHasDrawn(true);
    onChange(canvas.toDataURL("image/png"));
  }, [isDrawing, onChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasDrawn(false);
    onChange("");
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Applicant signature *</Label>
        <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="h-7 text-xs gap-1">
          <Eraser className="w-3 h-3" /> Clear
        </Button>
      </div>
      <div className={`border-2 rounded-lg overflow-hidden bg-white ${hasDrawn ? "border-teal-500" : "border-dashed border-gray-300"}`}>
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
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {hasDrawn ? "Signature captured — clear and redraw if needed" : "Draw your signature with mouse or finger"}
      </p>
    </div>
  );
}

function CodeOfConductContent({ companyName }: { companyName: string }) {
  const rules = [
    `At all times, maintain the agreed standards of personal appearance and deportment appropriate to the event or establishment and not to act in a manner that is likely to bring discredit to ${companyName} or to the Customer.`,
    "Greet all visitors to the unit in a friendly and courteous manner.",
    "You should give assistance to any person on the premises who is injured or distressed.",
    "Use moderate language at all times when dealing with members of the public and other members of staff employed at the Client's establishment.",
    "Act fairly and not unlawfully, do not discriminate against any person on the grounds of colour, race, religion, sex or disability (and to be prepared to justify your actions).",
    "Never solicit or accept any bribes or other considerations from any person, nor fail to account for any money or property received during the course of an assignment.",
    "Not to drink alcohol, or be under the influence of alcohol or any illegal substance, when reporting for duty, or whilst on an assignment.",
    "Never abuse your position of authority and immediately report any incidents involving the police that may affect your continued ability to work on assignments as a Door Supervisor.",
    "You should give due consideration concerning the admission of persons suspected of being underage or under the influence of drink or drugs. The final decision will always lie with the licensees or his deputy.",
    "Never carry an offensive weapon.",
    "Only use mobile telephones in an emergency whilst on duty.",
    "Always sign in upon commencement and the end of your duties. You must always prominently display your registration badge at all times whilst on duty.",
    "Don't chew gum or eat any food whilst on duty.",
    "Only smoke during breaks in designated areas as instructed by the Client's representative; this includes vaping.",
    "You should prominently display your registration badge at all times.",
    "Every employee should be aware of the evacuation procedure and position of the fire points of the venue.",
    "Do not post on social media whilst on duty.",
  ];

  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-slate-50 p-4 space-y-4">
      <div className="text-center space-y-1 pb-2 border-b">
        <p className="text-sm font-bold text-slate-900">Code of Conduct</p>
        <p className="text-xs text-muted-foreground">{companyName}</p>
      </div>
      <ol className="list-decimal pl-5 space-y-2.5 text-sm text-muted-foreground leading-relaxed">
        {rules.map((rule) => (
          <li key={rule.slice(0, 40)}>{rule}</li>
        ))}
      </ol>
      <p className="text-sm font-medium text-slate-800 pt-2 border-t">
        Failure to comply with any of the above Codes may result in dismissal or disciplinary proceedings.
      </p>
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-3">
        {["yes", "no"].map((option) => (
          <label
            key={option}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm cursor-pointer capitalize ${
              value === option ? "border-teal-600 bg-teal-50" : "border-border"
            }`}
          >
            <input
              type="radio"
              className="accent-teal-700"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function EmploymentBlock({
  n,
  form,
  update,
}: {
  n: 1 | 2 | 3 | 4 | 5;
  form: VettingFormPayload;
  update: (key: keyof VettingFormPayload, value: string) => void;
}) {
  const name = `employment${n}EmployerName` as keyof VettingFormPayload;
  const address = `employment${n}EmployerAddress` as keyof VettingFormPayload;
  const title = `employment${n}JobTitle` as keyof VettingFormPayload;
  const from = `employment${n}DateFrom` as keyof VettingFormPayload;
  const to = `employment${n}DateTo` as keyof VettingFormPayload;
  const reason = `employment${n}ReasonForLeaving` as keyof VettingFormPayload;
  const referee = `employment${n}RefereeName` as keyof VettingFormPayload;
  const phone = `employment${n}RefereePhone` as keyof VettingFormPayload;
  const email = `employment${n}RefereeEmail` as keyof VettingFormPayload;
  return (
    <>
      <SectionTitle>Employment history — {n}</SectionTitle>
      <p className="text-xs text-muted-foreground -mt-2">
        Include employment, self-employment, unemployment, or military service. Give full address and the person you reported to.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldRow icon={<Briefcase className="w-4 h-4" />}>
          <Input placeholder="Employer / organisation name" value={form[name]} onChange={(e) => update(name, e.target.value)} />
        </FieldRow>
        <FieldRow icon={<Briefcase className="w-4 h-4" />}>
          <Input placeholder="Position held" value={form[title]} onChange={(e) => update(title, e.target.value)} />
        </FieldRow>
        <div className="sm:col-span-2">
          <FieldRow icon={<MapPin className="w-4 h-4" />}>
            <Input placeholder="Employer address" value={form[address]} onChange={(e) => update(address, e.target.value)} />
          </FieldRow>
        </div>
        <FieldRow icon={<User className="w-4 h-4" />}>
          <Input placeholder="Name of person you reported to" value={form[referee]} onChange={(e) => update(referee, e.target.value)} />
        </FieldRow>
        <FieldRow icon={<Phone className="w-4 h-4" />}>
          <Input placeholder="Telephone no." value={form[phone]} onChange={(e) => update(phone, e.target.value)} />
        </FieldRow>
        <FieldRow icon={<Mail className="w-4 h-4" />}>
          <Input type="email" placeholder="Referee email" value={form[email]} onChange={(e) => update(email, e.target.value)} />
        </FieldRow>
        <FieldRow icon={<Briefcase className="w-4 h-4" />}>
          <Input type="date" placeholder="Start" value={form[from]} onChange={(e) => update(from, e.target.value)} />
        </FieldRow>
        <FieldRow icon={<Briefcase className="w-4 h-4" />}>
          <Input type="date" placeholder="End" value={form[to]} onChange={(e) => update(to, e.target.value)} />
        </FieldRow>
        <div className="sm:col-span-2">
          <FieldRow icon={<Briefcase className="w-4 h-4" />}>
            <Textarea
              placeholder="Reason for leaving"
              value={form[reason]}
              onChange={(e) => update(reason, e.target.value)}
              rows={2}
              className="border-0 shadow-none focus-visible:ring-0 px-0"
            />
          </FieldRow>
        </div>
      </div>
    </>
  );
}

function FieldRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-white shadow-sm px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
        {icon}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function PublicVettingFormPage() {
  const [, params] = useRoute("/vetting-form/:token");
  const token = params?.token ?? "";
  const [step, setStep] = useState<StepId>(STEPS[0].id);
  const [form, setForm] = useState<VettingFormPayload | null>(null);
  const [ackEqualOps, setAckEqualOps] = useState(false);
  const [ackZeroHours, setAckZeroHours] = useState(false);
  const [ackOptOut, setAckOptOut] = useState(false);
  const [ackConduct, setAckConduct] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [employmentCount, setEmploymentCount] = useState(1);

  const [formHydrated, setFormHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<FormResponse>({
    queryKey: ["/api/public/vetting-form", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/vetting-form/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to load form");
      return body;
    },
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setFormHydrated(false);
    setForm(null);
  }, [token]);

  useEffect(() => {
    if (!data || formHydrated) return;
    setForm({ ...data.form });
    setAckEqualOps(data.acknowledgements.equalOps);
    setAckZeroHours(data.acknowledgements.zeroHours);
    setAckOptOut(!!data.acknowledgements.optOut);
    setAckConduct(data.acknowledgements.codeOfConduct);
    setLastSavedAt(data.lastSavedAt);
    if (data.submittedAt) setSubmitted(true);

    let initialEmploymentCount = 1;
    for (let n = 5; n >= 1; n--) {
      const key = `employment${n}EmployerName` as keyof VettingFormPayload;
      if ((data.form as Record<string, string>)[key]) {
        initialEmploymentCount = n;
        break;
      }
    }
    setEmploymentCount(initialEmploymentCount);

    setFormHydrated(true);
  }, [data, formHydrated]);

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<VettingFormPayload>) => {
      const res = await fetch(`/api/public/vetting-form/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to save");
      return body as { success: boolean; lastSavedAt?: string; form?: VettingFormPayload };
    },
    onSuccess: (body) => {
      if (body.lastSavedAt) setLastSavedAt(body.lastSavedAt);
      if (body.form) {
        setForm((prev) => (prev ? { ...prev, ...body.form } : body.form || null));
      }
      setSaveMessage("Saved");
      window.setTimeout(() => setSaveMessage(null), 2500);
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/vetting-form/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form,
          acknowledgeEqualOps: ackEqualOps,
          acknowledgeZeroHours: ackZeroHours,
          acknowledgeCodeOfConduct: ackConduct,
          acknowledgeOptOut: ackOptOut,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to submit");
      return body;
    },
    onSuccess: () => setSubmitted(true),
  });

  const update = (key: keyof VettingFormPayload, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveCurrent = async () => {
    if (!form) return;
    await saveMut.mutateAsync(form);
  };

  const goNext = async () => {
    if (!form) return;
    try {
      await saveMut.mutateAsync(form);
      const idx = STEPS.findIndex((s) => s.id === step);
      if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
    } catch {
      // toast handled by mutation error in UI
    }
  };

  const goBack = () => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(STEPS[idx - 1].id);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid link</h2>
            <p className="text-muted-foreground text-sm">Use the full link from your email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Link unavailable</h2>
            <p className="text-muted-foreground text-sm">{(error as Error)?.message || "This link may have expired."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showSubmittedBanner = Boolean(data.submittedAt || submitted);
  const currentIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4" data-testid="public-vetting-form">
      <div className="max-w-4xl mx-auto">
        {showSubmittedBanner && (
          <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-2 text-sm text-teal-900">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              Application submitted. You can still edit and resubmit until {formatExpiry(data.expiresAt)}.
            </span>
          </div>
        )}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{data?.companyName}</h1>
            <p className="text-sm text-muted-foreground">Vetting application form</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Link expires: <strong>{data ? formatExpiry(data.expiresAt) : ""}</strong>
            {lastSavedAt ? (
              <>
                {" · "}
                Last saved: <strong>{formatExpiry(lastSavedAt)}</strong>
              </>
            ) : null}
            {saveMessage ? <span className="ml-2 text-teal-700 font-medium">{saveMessage}</span> : null}
          </p>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Step {currentIdx + 1} of {STEPS.length}</span>
            <span className="font-medium text-slate-700">{STEPS[currentIdx]?.label}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all"
              style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="shadow-md">
          <CardContent className="p-4 sm:p-6 space-y-4">
            {step === "personalDetails" && (
              <div className="space-y-4">
                <SectionTitle>Personal information</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="First name *" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Last name *" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Phone className="w-4 h-4" />}>
                    <Input placeholder="Mobile no. *" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Phone className="w-4 h-4" />}>
                    <Input placeholder="Telephone" value={form.secondPhone} onChange={(e) => update("secondPhone", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Mail className="w-4 h-4" />}>
                    <Input type="email" placeholder="Email *" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Select value={form.maritalStatus || ""} onValueChange={(v) => update("maritalStatus", v)}>
                      <SelectTrigger><SelectValue placeholder="Marital status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single or other</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Select value={form.gender || ""} onValueChange={(v) => update("gender", v)}>
                      <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input type="date" placeholder="Date of birth" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Place of birth *" value={form.placeOfBirth} onChange={(e) => update("placeOfBirth", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Nationality" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="National Insurance no." value={form.nationalInsurance} onChange={(e) => update("nationalInsurance", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Briefcase className="w-4 h-4" />}>
                    <Input placeholder="Job title" value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<ShieldCheck className="w-4 h-4" />}>
                    <Input placeholder="Officer type / role (e.g. Security Officer)" value={form.officerType} onChange={(e) => update("officerType", e.target.value)} />
                  </FieldRow>
                  <div className="sm:col-span-2">
                    <FieldRow icon={<User className="w-4 h-4" />}>
                      <Input placeholder="How did you hear about the role?" value={form.heardAboutRole} onChange={(e) => update("heardAboutRole", e.target.value)} />
                    </FieldRow>
                  </div>
                </div>
              </div>
            )}

            {step === "addressHistory" && (
              <div className="space-y-4">
                <SectionTitle>Current address</SectionTitle>
                <AddressFieldsGroup
                  idPrefix="vetting-addr"
                  value={{
                    addressLine1: form.addressLine1,
                    addressLine2: form.addressLine2,
                    city: form.city,
                    county: form.county,
                    postcode: form.postcode,
                    country: form.country,
                  }}
                  onChange={(patch) =>
                    setForm((f) => ({
                      ...f,
                      ...(patch.addressLine1 !== undefined ? { addressLine1: patch.addressLine1 } : {}),
                      ...(patch.addressLine2 !== undefined ? { addressLine2: patch.addressLine2 } : {}),
                      ...(patch.city !== undefined ? { city: patch.city } : {}),
                      ...(patch.county !== undefined ? { county: patch.county } : {}),
                      ...(patch.postcode !== undefined ? { postcode: patch.postcode } : {}),
                      ...(patch.country !== undefined ? { country: patch.country } : {}),
                    }))
                  }
                  livingFrom={form.livingFrom}
                  onLivingFromChange={(v) => update("livingFrom", v)}
                />

                <SectionTitle>Previous address (if less than 3 years at current address)</SectionTitle>
                <AddressFieldsGroup
                  idPrefix="vetting-prev-addr"
                  value={{
                    addressLine1: form.previousAddressLine1,
                    addressLine2: form.previousAddressLine2,
                    city: form.previousCity,
                    county: form.previousCounty,
                    postcode: form.previousPostcode,
                    country: "United Kingdom",
                  }}
                  onChange={(patch) =>
                    setForm((f) => ({
                      ...f,
                      previousAddressLine1: patch.addressLine1 ?? f.previousAddressLine1,
                      previousAddressLine2: patch.addressLine2 ?? f.previousAddressLine2,
                      previousCity: patch.city ?? f.previousCity,
                      previousCounty: patch.county ?? f.previousCounty,
                      previousPostcode: patch.postcode ?? f.previousPostcode,
                    }))
                  }
                  livingFrom={form.previousLivingFrom}
                  livingTo={form.previousLivingTo}
                  onLivingFromChange={(v) => update("previousLivingFrom", v)}
                  onLivingToChange={(v) => update("previousLivingTo", v)}
                />
              </div>
            )}

            {step === "licencesContact" && (
              <div className="space-y-4">
                <SectionTitle>Driving &amp; SIA licence</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Driving licence no." value={form.drivingLicenceNumber} onChange={(e) => update("drivingLicenceNumber", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Select value={form.carOwner || ""} onValueChange={(v) => update("carOwner", v)}>
                      <SelectTrigger><SelectValue placeholder="Car owner?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow icon={<ShieldCheck className="w-4 h-4" />}>
                    <Input placeholder="SIA licence number" value={form.siaLicenseNumber} onChange={(e) => update("siaLicenseNumber", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<ShieldCheck className="w-4 h-4" />}>
                    <Input placeholder="SIA licence type" value={form.siaLicenseType} onChange={(e) => update("siaLicenseType", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<ShieldCheck className="w-4 h-4" />}>
                    <Input type="date" placeholder="SIA expiry date" value={form.siaExpiryDate} onChange={(e) => update("siaExpiryDate", e.target.value)} />
                  </FieldRow>
                </div>

                <SectionTitle>Emergency contact / next of kin</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow icon={<Heart className="w-4 h-4" />}>
                    <Input placeholder="Contact name" value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Heart className="w-4 h-4" />}>
                    <Input placeholder="Relationship" value={form.emergencyContactRelationship} onChange={(e) => update("emergencyContactRelationship", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Phone className="w-4 h-4" />}>
                    <Input placeholder="Telephone number" value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Phone className="w-4 h-4" />}>
                    <Input placeholder="Alternate phone" value={form.emergencyContactAlternatePhone} onChange={(e) => update("emergencyContactAlternatePhone", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Mail className="w-4 h-4" />}>
                    <Input type="email" placeholder="Email" value={form.emergencyContactEmail} onChange={(e) => update("emergencyContactEmail", e.target.value)} />
                  </FieldRow>
                  <div className="sm:col-span-2">
                    <FieldRow icon={<MapPin className="w-4 h-4" />}>
                      <Input placeholder="Address" value={form.emergencyContactAddress} onChange={(e) => update("emergencyContactAddress", e.target.value)} />
                    </FieldRow>
                  </div>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Height" value={form.height} onChange={(e) => update("height", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Weight" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input placeholder="Colour of eyes" value={form.colourOfEyes} onChange={(e) => update("colourOfEyes", e.target.value)} />
                  </FieldRow>
                </div>
              </div>
            )}

            {step === "bankEmployment" && (
              <div className="space-y-4">
                <SectionTitle>Bank details</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow icon={<CreditCard className="w-4 h-4" />}>
                    <Input placeholder="Name of account holder" value={form.bankAccountName} onChange={(e) => update("bankAccountName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<CreditCard className="w-4 h-4" />}>
                    <Input placeholder="Name of bank" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<CreditCard className="w-4 h-4" />}>
                    <Input placeholder="Sort code" value={form.bankSortCode} onChange={(e) => update("bankSortCode", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<CreditCard className="w-4 h-4" />}>
                    <Input placeholder="Bank account number" value={form.bankAccountNumber} onChange={(e) => update("bankAccountNumber", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<CreditCard className="w-4 h-4" />}>
                    <Input placeholder="Building society ref (optional)" value={form.buildingSocietyRef} onChange={(e) => update("buildingSocietyRef", e.target.value)} />
                  </FieldRow>
                </div>

                <SectionTitle>Personal history (Part A) — 5 year work history</SectionTitle>
                <p className="text-sm text-muted-foreground">
                  Please verify your personal history for a period of five years (or ten years if required),
                  or to date of leaving school. Include all periods of employment, self-employment,
                  unemployment, and military service.
                </p>
                {Array.from({ length: employmentCount }).map((_, i) => (
                  <EmploymentBlock key={i + 1} n={(i + 1) as 1 | 2 | 3 | 4 | 5} form={form} update={update} />
                ))}
                <div className="flex gap-2">
                  {employmentCount < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEmploymentCount((c) => Math.min(5, c + 1))}
                    >
                      + Add another employer
                    </Button>
                  )}
                  {employmentCount > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmploymentCount((c) => Math.max(1, c - 1))}
                    >
                      Remove last employer
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === "screeningEducation" && (
              <div className="space-y-4">
                <SectionTitle>Criminal / court history</SectionTitle>
                <YesNoRow
                  label="4) Have you ever appeared before a court charged with a criminal, civil or military offence and been convicted (including any motoring offences), or do you have any alleged offences outstanding?"
                  value={form.criminalConviction}
                  onChange={(v) => update("criminalConviction", v)}
                />
                {form.criminalConviction === "yes" && (
                  <Textarea
                    placeholder="If yes, give details"
                    value={form.criminalConvictionDetails}
                    onChange={(e) => update("criminalConvictionDetails", e.target.value)}
                    rows={3}
                  />
                )}

                <SectionTitle>Personal history (Part B)</SectionTitle>
                <div className="space-y-4">
                  <YesNoRow
                    label="Have you been made bankrupt?"
                    value={form.beenBankrupt}
                    onChange={(v) => update("beenBankrupt", v)}
                  />
                  <YesNoRow
                    label="Do you have any County Court Judgements (CCJs)?"
                    value={form.hasCcj}
                    onChange={(v) => update("hasCcj", v)}
                  />
                  <YesNoRow
                    label="Do you object to the company contacting a credit agency with reference to yourself?"
                    value={form.objectToCreditAgency}
                    onChange={(v) => update("objectToCreditAgency", v)}
                  />
                </div>

                <SectionTitle>Education — school &amp; college (last 10 years)</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow icon={<Briefcase className="w-4 h-4" />}>
                    <Input placeholder="School name (secondary only)" value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<MapPin className="w-4 h-4" />}>
                    <Input placeholder="Town / city" value={form.schoolTown} onChange={(e) => update("schoolTown", e.target.value)} />
                  </FieldRow>
                  <FieldRow icon={<Briefcase className="w-4 h-4" />}>
                    <Input type="date" placeholder="Date you left school" value={form.schoolLeftDate} onChange={(e) => update("schoolLeftDate", e.target.value)} />
                  </FieldRow>
                  <div className="sm:col-span-2">
                    <FieldRow icon={<Briefcase className="w-4 h-4" />}>
                      <Input placeholder="College &amp; dates (if attended in last 10 years)" value={form.collegeDetails} onChange={(e) => update("collegeDetails", e.target.value)} />
                    </FieldRow>
                  </div>
                </div>
              </div>
            )}

            {step === "declarationsSignature" && (
              <div className="space-y-4">
                <SectionTitle>Additional information</SectionTitle>
                <Textarea
                  placeholder="Please use this section to supply any other relevant information"
                  value={form.additionalInformation}
                  onChange={(e) => update("additionalInformation", e.target.value)}
                  rows={4}
                />

                <SectionTitle>Applicant declarations</SectionTitle>
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-muted-foreground space-y-2 mb-2">
                  <p>
                    If offered employment it will initially be for a probationary period of 16 weeks.
                    After a period of 12 weeks from start date for screening.
                  </p>
                  <p>
                    During the probationary period your contract may be terminable by the company by no
                    less than 24 hours notice in writing. Continued employment is conditional upon
                    satisfactory screening. We complete social media and internet searches on all
                    applicants.
                  </p>
                  <p>
                    I certify that to the best of my knowledge the information I have given is complete
                    and correct, and I understand that misrepresentation of facts is grounds for immediate
                    dismissal and renders me liable for prosecution. I authorise the company to approach
                    government agencies, former employers, credit agencies and personal referees to verify
                    the information given.
                  </p>
                </div>
                <div className="space-y-4">
                  <YesNoRow
                    label="Do you agree to a S.I.A. Criminal record check being carried out?"
                    value={form.agreeSiaCriminalCheck}
                    onChange={(v) => update("agreeSiaCriminalCheck", v)}
                  />
                  <YesNoRow
                    label="Do you fully understand the potential consequences?"
                    value={form.understandConsequences}
                    onChange={(v) => update("understandConsequences", v)}
                  />
                  <YesNoRow
                    label="Do you agree to a credit check taken via a credit agency regarding yourself?"
                    value={form.agreeCreditCheck}
                    onChange={(v) => update("agreeCreditCheck", v)}
                  />
                </div>

                <SectionTitle>Applicant signature</SectionTitle>
                <div className="space-y-3">
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input
                      placeholder="Print full name *"
                      value={form.signaturePrintName}
                      onChange={(e) => {
                        update("signaturePrintName", e.target.value);
                        if (!form.signatureDate) {
                          update("signatureDate", new Date().toISOString().slice(0, 10));
                        }
                      }}
                    />
                  </FieldRow>
                  <SignaturePad
                    value={form.signatureData}
                    onChange={(data) => {
                      update("signatureData", data);
                      if (data && !form.signatureDate) {
                        update("signatureDate", new Date().toISOString().slice(0, 10));
                      }
                    }}
                  />
                  <FieldRow icon={<User className="w-4 h-4" />}>
                    <Input
                      type="date"
                      value={form.signatureDate}
                      onChange={(e) => update("signatureDate", e.target.value)}
                    />
                  </FieldRow>
                </div>
              </div>
            )}

            {step === "equalOps" && (
              <div className="space-y-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-1">
                    Strictly private and confidential
                  </p>
                  <p className="text-sm text-muted-foreground">
                    It is the intention of {data?.companyName} to provide Equal Opportunities for everyone,
                    regardless of race, gender, marital status or disability. Please help us to monitor our
                    selection procedure by ticking the appropriate boxes below. The information that you
                    provide will be treated in the strictest confidence and has no part in the selection process.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    1) Ethnic Origin — to which ethnic group would you say you belong? Please tick one box.
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      "White",
                      "Indian",
                      "Black African",
                      "Pakistani",
                      "Black Caribbean",
                      "Bangladeshi",
                      "Black Other",
                      "Chinese",
                      "Other",
                    ].map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                          form.ethnicOrigin === option ? "border-teal-600 bg-teal-50" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ethnicOrigin"
                          className="accent-teal-700"
                          checked={form.ethnicOrigin === option}
                          onChange={() => update("ethnicOrigin", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Please specify</Label>
                    <Input
                      className="mt-1"
                      value={form.ethnicOriginSpecify}
                      onChange={(e) => update("ethnicOriginSpecify", e.target.value)}
                      placeholder="If Other, please specify"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">2) Do you have a disability?</Label>
                  <div className="flex gap-3">
                    {["yes", "no"].map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm cursor-pointer capitalize ${
                          form.hasDisability === option ? "border-teal-600 bg-teal-50" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="hasDisability"
                          className="accent-teal-700"
                          checked={form.hasDisability === option}
                          onChange={() => update("hasDisability", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">3) Are you registered disabled?</Label>
                  <div className="flex gap-3">
                    {["yes", "no"].map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm cursor-pointer capitalize ${
                          form.registeredDisabled === option ? "border-teal-600 bg-teal-50" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="registeredDisabled"
                          className="accent-teal-700"
                          checked={form.registeredDisabled === option}
                          onChange={() => update("registeredDisabled", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {form.registeredDisabled === "yes" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Registered No:</Label>
                      <Input
                        className="mt-1"
                        value={form.registeredDisabilityNumber}
                        onChange={(e) => update("registeredDisabilityNumber", e.target.value)}
                        placeholder="Registered disability number"
                      />
                    </div>
                  )}
                  {(form.hasDisability === "yes" || form.registeredDisabled === "yes") && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        If yes, what is the nature of your disability?
                      </Label>
                      <Textarea
                        className="mt-1"
                        rows={3}
                        value={form.disabilityNature}
                        onChange={(e) => update("disabilityNature", e.target.value)}
                        placeholder="Describe the nature of your disability"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox checked={ackEqualOps} onCheckedChange={(v) => setAckEqualOps(!!v)} id="ack-eq" />
                  <Label htmlFor="ack-eq" className="text-sm leading-snug">
                    I have read and understood the Equal Ops Review document provided by {data?.companyName}.
                  </Label>
                </div>
              </div>
            )}

            {step === "zeroHours" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please read the Zero Hours Contract terms below carefully. By acknowledging, you confirm
                  you understand and agree to the conditions of a zero-hours arrangement with{" "}
                  {data?.companyName}.
                </p>
                <ZeroHoursContractContent companyName={data?.companyName || "the Company"} />
                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox checked={ackZeroHours} onCheckedChange={(v) => setAckZeroHours(!!v)} id="ack-zh" />
                  <Label htmlFor="ack-zh" className="text-sm leading-snug">
                    I have read and agree to the Zero Hours Contract terms above, and understand this is
                    not an employment contract and does not guarantee a minimum level of work.
                  </Label>
                </div>
              </div>
            )}

            {step === "optOut" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please read the Working Time OPT OUT Agreement (SF 02) below carefully. By
                  acknowledging, you voluntarily agree that the 48-hour weekly working time limit does
                  not apply to your work with {data?.companyName}.
                </p>
                <OptOutAgreementContent companyName={data?.companyName || "the Company"} />
                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox checked={ackOptOut} onCheckedChange={(v) => setAckOptOut(!!v)} id="ack-optout" />
                  <Label htmlFor="ack-optout" className="text-sm leading-snug">
                    I have read and freely agree to the OPT OUT Agreement above. I understand the 48-hour
                    weekly working time limit does not apply to me, and that I may end this agreement by
                    giving three months&apos; written notice.
                  </Label>
                </div>
              </div>
            )}

            {step === "conduct" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please read the Code of Conduct below carefully. You must follow these standards for
                  behaviour and professional conduct while working for {data?.companyName}.
                </p>
                <CodeOfConductContent companyName={data?.companyName || "the Company"} />
                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox checked={ackConduct} onCheckedChange={(v) => setAckConduct(!!v)} id="ack-cc" />
                  <Label htmlFor="ack-cc" className="text-sm leading-snug">
                    I have read and agree to abide by the Code of Conduct above. I understand that failure
                    to comply may result in dismissal or disciplinary proceedings.
                  </Label>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-3 text-sm">
                <p className="font-medium">Review your details before final submission.</p>
                <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
                  <p><strong>Name:</strong> {form.firstName} {form.lastName}</p>
                  <p><strong>Email:</strong> {form.email}</p>
                  <p><strong>Phone:</strong> {form.phone}</p>
                  <p><strong>NI:</strong> {form.nationalInsurance || "—"}</p>
                  <p><strong>DOB:</strong> {form.dateOfBirth || "—"}</p>
                  <p><strong>Job title:</strong> {form.jobTitle || form.officerType || "—"}</p>
                  <p className="sm:col-span-2">
                    <strong>Address:</strong>{" "}
                    {[form.addressLine1, form.addressLine2, form.city, form.postcode].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p><strong>Ethnic origin:</strong> {form.ethnicOrigin || "—"}{form.ethnicOriginSpecify ? ` (${form.ethnicOriginSpecify})` : ""}</p>
                  <p><strong>Disability:</strong> {form.hasDisability || "—"}</p>
                  <p><strong>Heard about role:</strong> {form.heardAboutRole || "—"}</p>
                  <p><strong>Convictions:</strong> {form.criminalConviction || "—"}</p>
                  <p><strong>Bankrupt / CCJ:</strong> {form.beenBankrupt || "—"} / {form.hasCcj || "—"}</p>
                  <p><strong>School:</strong> {form.schoolName || "—"}</p>
                  <p><strong>SIA check agreed:</strong> {form.agreeSiaCriminalCheck || "—"}</p>
                  <p><strong>Credit check agreed:</strong> {form.agreeCreditCheck || "—"}</p>
                  <p><strong>Signed by:</strong> {form.signaturePrintName || "—"}</p>
                  <p><strong>Signature date:</strong> {form.signatureDate || "—"}</p>
                  <p><strong>Emergency contact:</strong> {form.emergencyContactName || "—"} ({form.emergencyContactPhone || "—"})</p>
                  <p><strong>Bank:</strong> {form.bankName ? `${form.bankName} · ${form.bankSortCode}` : "—"}</p>
                  <p className="sm:col-span-2"><strong>Employment 1:</strong> {form.employment1EmployerName || "—"}</p>
                  <p className="sm:col-span-2"><strong>Employment 2:</strong> {form.employment2EmployerName || "—"}</p>
                </div>
                {form.signatureData ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Signature</p>
                    <img src={form.signatureData} alt="Applicant signature" className="h-16 object-contain" />
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">Please add your signature on the Application Form step before submitting.</p>
                )}
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Acknowledgements</p>
                  <p>{ackEqualOps ? "✓" : "✗"} Equal Ops Review</p>
                  <p>{ackZeroHours ? "✓" : "✗"} Zero Hours Contract</p>
                  <p>{ackOptOut ? "✓" : "✗"} OPT OUT Agreement</p>
                  <p>{ackConduct ? "✓" : "✗"} Code of Conduct</p>
                </div>
              </div>
            )}

            {(saveMut.isError || submitMut.isError) && (
              <p className="text-sm text-red-600">
                {(saveMut.error as Error)?.message || (submitMut.error as Error)?.message}
              </p>
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={goBack} disabled={currentIdx === 0}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveCurrent} disabled={saveMut.isPending}>
                  {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                {step !== "review" ? (
                  <Button className="bg-teal-700 hover:bg-teal-800" onClick={goNext} disabled={saveMut.isPending}>
                    Save &amp; continue
                  </Button>
                ) : (
                  <Button
                    className="bg-teal-700 hover:bg-teal-800"
                    onClick={() => submitMut.mutate()}
                    disabled={
                      submitMut.isPending ||
                      !ackEqualOps ||
                      !ackZeroHours ||
                      !ackOptOut ||
                      !ackConduct ||
                      !form.signatureData ||
                      !form.signaturePrintName.trim()
                    }
                  >
                    {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Submit application
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
