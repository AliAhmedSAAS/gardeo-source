import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Check, ChevronLeft, ChevronRight, User, MapPin, Phone, Building2,
  FileText, ShieldCheck, Shirt, ScrollText, PartyPopper, Plus, Trash2,
  Upload, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { OnboardingRecord, Employee, EmergencyContact, BankDetail } from "@shared/schema";

const STEPS = [
  { id: 1, title: "Welcome", icon: PartyPopper, description: "Get started with onboarding" },
  { id: 2, title: "Personal Details", icon: User, description: "Your personal information" },
  { id: 3, title: "Contact & Address", icon: MapPin, description: "Your contact information" },
  { id: 4, title: "Emergency Contacts", icon: Phone, description: "Emergency contact details" },
  { id: 5, title: "Bank Details", icon: Building2, description: "Payroll information" },
  { id: 6, title: "Documents", icon: FileText, description: "Upload required documents" },
  { id: 7, title: "Vetting & Compliance", icon: ShieldCheck, description: "Security checks & references" },
  { id: 8, title: "Uniform & Equipment", icon: Shirt, description: "Sizing & equipment needs" },
  { id: 9, title: "Terms & Conditions", icon: ScrollText, description: "Review & accept policies" },
  { id: 10, title: "Completion", icon: CheckCircle2, description: "Review & submit" },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: onboarding, isLoading: onboardingLoading } = useQuery<OnboardingRecord | null>({
    queryKey: ["/api/onboarding"],
  });

  const { data: employee } = useQuery<Employee | null>({
    queryKey: ["/api/employee/profile"],
  });

  const { data: emergencyContacts = [] } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/emergency-contacts"],
  });

  const { data: bankDetails } = useQuery<BankDetail | null>({
    queryKey: ["/api/bank-details"],
  });

  const { data: employmentHistoryData = [] } = useQuery<any[]>({
    queryKey: ["/api/employment-history"],
  });

  const { data: referencesData = [] } = useQuery<any[]>({
    queryKey: ["/api/references"],
  });

  const [step, setStep] = useState(1);
  const [personalForm, setPersonalForm] = useState({
    dateOfBirth: "", nationalInsurance: "", gender: "", nationality: "",
  });
  const [contactForm, setContactForm] = useState({
    addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", country: "United Kingdom",
  });
  const [emergencyForm, setEmergencyForm] = useState({
    name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false,
  });
  const [bankForm, setBankForm] = useState({
    accountName: "", bankName: "", sortCode: "", accountNumber: "", buildingSocietyRef: "",
  });
  const [vettingForm, setVettingForm] = useState({
    siaLicenseNumber: "", siaLicenseType: "", siaExpiryDate: "",
    dbsCertificateNumber: "", dbsIssueDate: "",
    hasFirstAid: false, firstAidExpiry: "",
  });
  const [uniformForm, setUniformForm] = useState({
    uniformSize: "", bootSize: "", equipmentNotes: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [employmentForm, setEmploymentForm] = useState({
    employerName: "", jobTitle: "", dateFrom: "", dateTo: "", isCurrent: false, reasonForLeaving: "", duties: "",
  });
  const [referenceForm, setReferenceForm] = useState({
    refereeName: "", refereeEmail: "", refereePhone: "", company: "", jobTitle: "", relationship: "",
    dateFrom: "", dateTo: "",
  });

  useEffect(() => {
    if (onboarding?.currentStep) setStep(onboarding.currentStep);
  }, [onboarding?.currentStep]);

  useEffect(() => {
    if (employee) {
      setPersonalForm({
        dateOfBirth: employee.dateOfBirth || "",
        nationalInsurance: employee.nationalInsurance || "",
        gender: employee.gender || "",
        nationality: employee.nationality || "",
      });
      setContactForm({
        addressLine1: employee.addressLine1 || "",
        addressLine2: employee.addressLine2 || "",
        city: employee.city || "",
        county: employee.county || "",
        postcode: employee.postcode || "",
        country: employee.country || "United Kingdom",
      });
      setVettingForm({
        siaLicenseNumber: employee.siaLicenseNumber || "",
        siaLicenseType: employee.siaLicenseType || "",
        siaExpiryDate: employee.siaExpiryDate || "",
        dbsCertificateNumber: employee.dbsCertificateNumber || "",
        dbsIssueDate: employee.dbsIssueDate || "",
        hasFirstAid: employee.hasFirstAid || false,
        firstAidExpiry: employee.firstAidExpiry || "",
      });
      setUniformForm({
        uniformSize: employee.uniformSize || "",
        bootSize: employee.bootSize || "",
        equipmentNotes: employee.equipmentNotes || "",
      });
    }
  }, [employee]);

  useEffect(() => {
    if (bankDetails) {
      setBankForm({
        accountName: bankDetails.accountName || "",
        bankName: bankDetails.bankName || "",
        sortCode: bankDetails.sortCode || "",
        accountNumber: bankDetails.accountNumber || "",
        buildingSocietyRef: bankDetails.buildingSocietyRef || "",
      });
    }
  }, [bankDetails]);

  const updateProfileMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/employee/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/profile"] });
    },
  });

  const updateOnboardingMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/onboarding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const saveBankMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/bank-details", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-details"] });
    },
  });

  const addEmergencyMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/emergency-contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
    },
  });

  const deleteEmergencyMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/emergency-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
    },
  });

  const addEmploymentMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employment-history", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment-history"] });
    },
  });

  const deleteEmploymentMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employment-history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment-history"] });
    },
  });

  const addReferenceMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/references", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/references"] });
    },
  });

  const deleteReferenceMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/references/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/references"] });
    },
  });

  const submitOnboardingMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/submit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      toast({ title: "Onboarding Submitted", description: "Your application has been submitted for review." });
    },
  });

  const saveAndNext = async () => {
    try {
      if (step === 2) {
        await updateProfileMut.mutateAsync(personalForm);
        await updateOnboardingMut.mutateAsync({ currentStep: 3, personalDetailsComplete: true });
      } else if (step === 3) {
        await updateProfileMut.mutateAsync(contactForm);
        await updateOnboardingMut.mutateAsync({ currentStep: 4, contactDetailsComplete: true });
      } else if (step === 4) {
        await updateOnboardingMut.mutateAsync({ currentStep: 5, emergencyContactComplete: emergencyContacts.length > 0 });
      } else if (step === 5) {
        if (bankForm.accountName && bankForm.sortCode && bankForm.accountNumber) {
          await saveBankMut.mutateAsync(bankForm);
        }
        await updateOnboardingMut.mutateAsync({ currentStep: 6, bankDetailsComplete: true });
      } else if (step === 6) {
        await updateOnboardingMut.mutateAsync({ currentStep: 7, documentsComplete: true });
      } else if (step === 7) {
        await updateProfileMut.mutateAsync(vettingForm);
        await updateOnboardingMut.mutateAsync({ currentStep: 8, vettingComplete: true });
      } else if (step === 8) {
        await updateProfileMut.mutateAsync(uniformForm);
        await updateOnboardingMut.mutateAsync({ currentStep: 9, uniformComplete: true });
      } else if (step === 9) {
        if (!termsAccepted) {
          toast({ title: "Please accept the terms", description: "You must accept the terms and conditions to proceed.", variant: "destructive" });
          return;
        }
        await updateOnboardingMut.mutateAsync({ currentStep: 10, termsAccepted: true, termsAcceptedAt: new Date() });
      } else {
        await updateOnboardingMut.mutateAsync({ currentStep: step + 1 });
      }
      setStep((s) => Math.min(s + 1, 10));
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const progress = ((step - 1) / 9) * 100;

  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (onboarding?.status === "submitted") {
    return (
      <div className="p-6 max-w-2xl mx-auto" data-testid="onboarding-submitted">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold">Application Under Review</h2>
            <p className="text-muted-foreground">
              Your onboarding application has been submitted and is currently being reviewed by the HR team. You will be notified once a decision has been made.
            </p>
            <Badge variant="secondary">
              <Clock className="w-3 h-3 mr-1" /> Submitted for Review
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboarding?.status === "completed") {
    return (
      <div className="p-6 max-w-2xl mx-auto" data-testid="onboarding-completed">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Onboarding Complete</h2>
            <p className="text-muted-foreground">
              Your onboarding has been approved and completed. Welcome to the team!
            </p>
            <Badge>
              <Check className="w-3 h-3 mr-1" /> Completed
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" data-testid="onboarding-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Employee Onboarding</h1>
        <p className="text-muted-foreground text-sm">Complete all steps to finish your onboarding process.</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step {step} of 10</span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-onboarding" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="hidden lg:block">
          <nav className="space-y-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isComplete = step > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => s.id <= step && setStep(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                      ? "text-foreground/80 hover:bg-muted"
                      : "text-muted-foreground"
                  }`}
                  disabled={s.id > step}
                  data-testid={`step-nav-${s.id}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : isComplete
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <Check className="w-3 h-3" /> : s.id}
                  </div>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = STEPS[step - 1].icon;
                  return <Icon className="w-5 h-5 text-accent" />;
                })()}
                <div>
                  <h2 className="text-lg font-semibold">{STEPS[step - 1].title}</h2>
                  <p className="text-sm text-muted-foreground">{STEPS[step - 1].description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 1 && <StepWelcome user={user} />}
              {step === 2 && <StepPersonalDetails form={personalForm} setForm={setPersonalForm} />}
              {step === 3 && <StepContactAddress form={contactForm} setForm={setContactForm} />}
              {step === 4 && (
                <StepEmergencyContacts
                  contacts={emergencyContacts}
                  form={emergencyForm}
                  setForm={setEmergencyForm}
                  onAdd={async () => {
                    if (!emergencyForm.name || !emergencyForm.phone || !emergencyForm.relationship) {
                      toast({ title: "Required fields", description: "Please fill in name, relationship, and phone number.", variant: "destructive" });
                      return;
                    }
                    await addEmergencyMut.mutateAsync(emergencyForm);
                    setEmergencyForm({ name: "", relationship: "", phone: "", alternatePhone: "", email: "", isPrimary: false });
                  }}
                  onDelete={(id) => deleteEmergencyMut.mutateAsync(id)}
                  isAdding={addEmergencyMut.isPending}
                />
              )}
              {step === 5 && <StepBankDetails form={bankForm} setForm={setBankForm} />}
              {step === 6 && <StepDocuments />}
              {step === 7 && (
                <StepVetting
                  form={vettingForm}
                  setForm={setVettingForm}
                  employmentHistory={employmentHistoryData}
                  employmentForm={employmentForm}
                  setEmploymentForm={setEmploymentForm}
                  onAddEmployment={async () => {
                    if (!employmentForm.employerName || !employmentForm.jobTitle || !employmentForm.dateFrom) {
                      toast({ title: "Required fields", description: "Please fill in employer, job title, and start date.", variant: "destructive" });
                      return;
                    }
                    await addEmploymentMut.mutateAsync(employmentForm);
                    setEmploymentForm({ employerName: "", jobTitle: "", dateFrom: "", dateTo: "", isCurrent: false, reasonForLeaving: "", duties: "" });
                  }}
                  onDeleteEmployment={(id) => deleteEmploymentMut.mutateAsync(id)}
                  references={referencesData}
                  referenceForm={referenceForm}
                  setReferenceForm={setReferenceForm}
                  onAddReference={async () => {
                    if (!referenceForm.refereeName || !referenceForm.company) {
                      toast({ title: "Required fields", description: "Please fill in referee name and company.", variant: "destructive" });
                      return;
                    }
                    await addReferenceMut.mutateAsync(referenceForm);
                    setReferenceForm({ refereeName: "", refereeEmail: "", refereePhone: "", company: "", jobTitle: "", relationship: "", dateFrom: "", dateTo: "" });
                  }}
                  onDeleteReference={(id) => deleteReferenceMut.mutateAsync(id)}
                />
              )}
              {step === 8 && <StepUniform form={uniformForm} setForm={setUniformForm} />}
              {step === 9 && <StepTerms accepted={termsAccepted} setAccepted={setTermsAccepted} />}
              {step === 10 && (
                <StepCompletion
                  onboarding={onboarding}
                  onSubmit={() => submitOnboardingMut.mutateAsync()}
                  isSubmitting={submitOnboardingMut.isPending}
                />
              )}

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="secondary"
                  onClick={goBack}
                  disabled={step === 1}
                  data-testid="button-previous-step"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                {step < 10 ? (
                  <Button
                    onClick={saveAndNext}
                    disabled={updateProfileMut.isPending || updateOnboardingMut.isPending}
                    data-testid="button-next-step"
                  >
                    {updateProfileMut.isPending || updateOnboardingMut.isPending ? "Saving..." : "Save & Continue"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ user }: { user: any }) {
  return (
    <div className="text-center space-y-4 py-6" data-testid="step-welcome">
      <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
        <PartyPopper className="w-10 h-10 text-accent" />
      </div>
      <h3 className="text-xl font-bold">Welcome, {user?.firstName}!</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        We're excited to have you join our team. This onboarding process will guide you through
        providing all the necessary information we need to get you set up.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
        <div className="p-3 rounded-md bg-muted/50">
          <div className="text-sm font-medium">10 Steps</div>
          <div className="text-xs text-muted-foreground">Complete all sections</div>
        </div>
        <div className="p-3 rounded-md bg-muted/50">
          <div className="text-sm font-medium">Save Progress</div>
          <div className="text-xs text-muted-foreground">Resume anytime</div>
        </div>
        <div className="p-3 rounded-md bg-muted/50">
          <div className="text-sm font-medium">Secure</div>
          <div className="text-xs text-muted-foreground">Data protected</div>
        </div>
      </div>
    </div>
  );
}

function StepPersonalDetails({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4" data-testid="step-personal-details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            id="dob"
            data-testid="input-dob"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ni">National Insurance Number</Label>
          <Input
            id="ni"
            data-testid="input-ni"
            value={form.nationalInsurance}
            onChange={(e) => setForm({ ...form, nationalInsurance: e.target.value.toUpperCase() })}
            placeholder="e.g. QQ 12 34 56 C"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger data-testid="select-gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non_binary">Non-binary</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            data-testid="input-nationality"
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            placeholder="e.g. British"
          />
        </div>
      </div>
    </div>
  );
}

function StepContactAddress({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4" data-testid="step-contact-address">
      <div className="space-y-2">
        <Label htmlFor="address1">Address Line 1</Label>
        <Input
          id="address1"
          data-testid="input-address1"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          placeholder="e.g. 123 High Street"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address2">Address Line 2 (Optional)</Label>
        <Input
          id="address2"
          data-testid="input-address2"
          value={form.addressLine2}
          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          placeholder="e.g. Flat 4B"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City / Town</Label>
          <Input
            id="city"
            data-testid="input-city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="e.g. London"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="county">County</Label>
          <Input
            id="county"
            data-testid="input-county"
            value={form.county}
            onChange={(e) => setForm({ ...form, county: e.target.value })}
            placeholder="e.g. Greater London"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            data-testid="input-postcode"
            value={form.postcode}
            onChange={(e) => setForm({ ...form, postcode: e.target.value.toUpperCase() })}
            placeholder="e.g. SW1A 1AA"
          />
        </div>
      </div>
    </div>
  );
}

function StepEmergencyContacts({
  contacts, form, setForm, onAdd, onDelete, isAdding,
}: {
  contacts: EmergencyContact[];
  form: any;
  setForm: (f: any) => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  isAdding: boolean;
}) {
  return (
    <div className="space-y-4" data-testid="step-emergency-contacts">
      {contacts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Saved Contacts</Label>
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.relationship} - {c.phone}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)} data-testid={`button-delete-contact-${c.id}`}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator />
      <p className="text-sm text-muted-foreground">Add a new emergency contact:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <Input
            data-testid="input-ec-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Jane Smith"
          />
        </div>
        <div className="space-y-2">
          <Label>Relationship *</Label>
          <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
            <SelectTrigger data-testid="select-ec-relationship">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse/Partner</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="friend">Friend</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone Number *</Label>
          <Input
            data-testid="input-ec-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="e.g. 07700 900000"
          />
        </div>
        <div className="space-y-2">
          <Label>Email (Optional)</Label>
          <Input
            data-testid="input-ec-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
          />
        </div>
      </div>
      <Button onClick={onAdd} disabled={isAdding} variant="secondary" data-testid="button-add-contact">
        <Plus className="w-4 h-4 mr-1" /> {isAdding ? "Adding..." : "Add Contact"}
      </Button>
    </div>
  );
}

function StepBankDetails({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4" data-testid="step-bank-details">
      <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4 inline mr-1" />
        Your bank details are stored securely and used solely for payroll purposes.
      </div>
      <div className="space-y-2">
        <Label>Account Holder Name</Label>
        <Input
          data-testid="input-account-name"
          value={form.accountName}
          onChange={(e) => setForm({ ...form, accountName: e.target.value })}
          placeholder="e.g. John Smith"
        />
      </div>
      <div className="space-y-2">
        <Label>Bank Name</Label>
        <Input
          data-testid="input-bank-name"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          placeholder="e.g. Barclays"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sort Code</Label>
          <Input
            data-testid="input-sort-code"
            value={form.sortCode}
            onChange={(e) => setForm({ ...form, sortCode: e.target.value })}
            placeholder="e.g. 12-34-56"
            maxLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label>Account Number</Label>
          <Input
            data-testid="input-account-number"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            placeholder="e.g. 12345678"
            maxLength={8}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Building Society Reference (Optional)</Label>
        <Input
          data-testid="input-building-society"
          value={form.buildingSocietyRef}
          onChange={(e) => setForm({ ...form, buildingSocietyRef: e.target.value })}
          placeholder="If applicable"
        />
      </div>
    </div>
  );
}

function StepDocuments() {
  return (
    <div className="space-y-4" data-testid="step-documents">
      <p className="text-sm text-muted-foreground">
        Please upload the following documents. Accepted formats: PDF, JPG, PNG (max 10MB each).
      </p>
      {[
        { type: "passport_id", label: "Passport or Photo ID", required: true },
        { type: "right_to_work", label: "Right to Work in the UK", required: true },
        { type: "proof_of_address", label: "Proof of Address (e.g. utility bill)", required: true },
        { type: "cv", label: "CV / Resume", required: false },
        { type: "qualifications", label: "Relevant Qualifications / Certificates", required: false },
      ].map((doc) => (
        <div key={doc.type} className="flex items-center justify-between gap-4 p-4 rounded-md border bg-muted/30">
          <div>
            <div className="text-sm font-medium flex items-center gap-1 flex-wrap">
              {doc.label}
              {doc.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">No file uploaded yet</div>
          </div>
          <Button variant="secondary" size="sm" data-testid={`button-upload-${doc.type}`}>
            <Upload className="w-4 h-4 mr-1" /> Upload
          </Button>
        </div>
      ))}
    </div>
  );
}

function StepVetting({
  form, setForm,
  employmentHistory, employmentForm, setEmploymentForm, onAddEmployment, onDeleteEmployment,
  references, referenceForm, setReferenceForm, onAddReference, onDeleteReference,
}: {
  form: any; setForm: (f: any) => void;
  employmentHistory: any[]; employmentForm: any; setEmploymentForm: (f: any) => void;
  onAddEmployment: () => void; onDeleteEmployment: (id: number) => void;
  references: any[]; referenceForm: any; setReferenceForm: (f: any) => void;
  onAddReference: () => void; onDeleteReference: (id: number) => void;
}) {
  return (
    <div className="space-y-6" data-testid="step-vetting">
      <div>
        <h3 className="text-sm font-semibold mb-3">SIA License Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>License Number</Label>
            <Input
              data-testid="input-sia-number"
              value={form.siaLicenseNumber}
              onChange={(e) => setForm({ ...form, siaLicenseNumber: e.target.value })}
              placeholder="e.g. 1234-5678-9012-3456"
            />
          </div>
          <div className="space-y-2">
            <Label>License Type</Label>
            <Select value={form.siaLicenseType} onValueChange={(v) => setForm({ ...form, siaLicenseType: v })}>
              <SelectTrigger data-testid="select-sia-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="door_supervisor">Door Supervisor</SelectItem>
                <SelectItem value="security_guard">Security Guard</SelectItem>
                <SelectItem value="cctv">CCTV Operator</SelectItem>
                <SelectItem value="close_protection">Close Protection</SelectItem>
                <SelectItem value="key_holding">Key Holding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input
              data-testid="input-sia-expiry"
              type="date"
              value={form.siaExpiryDate}
              onChange={(e) => setForm({ ...form, siaExpiryDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">DBS Check</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Certificate Number</Label>
            <Input
              data-testid="input-dbs-number"
              value={form.dbsCertificateNumber}
              onChange={(e) => setForm({ ...form, dbsCertificateNumber: e.target.value })}
              placeholder="e.g. 001234567890"
            />
          </div>
          <div className="space-y-2">
            <Label>Issue Date</Label>
            <Input
              data-testid="input-dbs-date"
              type="date"
              value={form.dbsIssueDate}
              onChange={(e) => setForm({ ...form, dbsIssueDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">First Aid</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.hasFirstAid}
              onCheckedChange={(v) => setForm({ ...form, hasFirstAid: !!v })}
              data-testid="checkbox-first-aid"
            />
            <Label className="text-sm">I hold a valid First Aid certificate</Label>
          </div>
          {form.hasFirstAid && (
            <div className="space-y-2">
              <Label className="text-xs">Expiry Date</Label>
              <Input
                data-testid="input-first-aid-expiry"
                type="date"
                value={form.firstAidExpiry}
                onChange={(e) => setForm({ ...form, firstAidExpiry: e.target.value })}
                className="w-44"
              />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">5-Year Employment History</h3>
        {employmentHistory.length > 0 && (
          <div className="space-y-2 mb-4">
            {employmentHistory.map((eh: any) => (
              <div key={eh.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                <div>
                  <div className="font-medium text-sm">{eh.jobTitle} at {eh.employerName}</div>
                  <div className="text-xs text-muted-foreground">{eh.dateFrom} - {eh.isCurrent ? "Present" : eh.dateTo || "N/A"}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDeleteEmployment(eh.id)} data-testid={`button-delete-employment-${eh.id}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Employer Name *</Label>
            <Input
              data-testid="input-employer-name"
              value={employmentForm.employerName}
              onChange={(e) => setEmploymentForm({ ...employmentForm, employerName: e.target.value })}
              placeholder="Company name"
            />
          </div>
          <div className="space-y-2">
            <Label>Job Title *</Label>
            <Input
              data-testid="input-employment-title"
              value={employmentForm.jobTitle}
              onChange={(e) => setEmploymentForm({ ...employmentForm, jobTitle: e.target.value })}
              placeholder="Your role"
            />
          </div>
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input
              data-testid="input-employment-from"
              type="date"
              value={employmentForm.dateFrom}
              onChange={(e) => setEmploymentForm({ ...employmentForm, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              data-testid="input-employment-to"
              type="date"
              value={employmentForm.dateTo}
              onChange={(e) => setEmploymentForm({ ...employmentForm, dateTo: e.target.value })}
              disabled={employmentForm.isCurrent}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            checked={employmentForm.isCurrent}
            onCheckedChange={(v) => setEmploymentForm({ ...employmentForm, isCurrent: !!v, dateTo: "" })}
            data-testid="checkbox-current-job"
          />
          <Label className="text-sm">Currently employed here</Label>
        </div>
        <div className="space-y-2 mt-3">
          <Label>Reason for Leaving</Label>
          <Input
            data-testid="input-reason-leaving"
            value={employmentForm.reasonForLeaving}
            onChange={(e) => setEmploymentForm({ ...employmentForm, reasonForLeaving: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <Button onClick={onAddEmployment} variant="secondary" className="mt-3" data-testid="button-add-employment">
          <Plus className="w-4 h-4 mr-1" /> Add Employment Record
        </Button>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">References (minimum 2)</h3>
        {references.length > 0 && (
          <div className="space-y-2 mb-4">
            {references.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                <div>
                  <div className="font-medium text-sm">{r.refereeName}</div>
                  <div className="text-xs text-muted-foreground">{r.company} - {r.refereeEmail || r.refereePhone}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDeleteReference(r.id)} data-testid={`button-delete-reference-${r.id}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Referee Name *</Label>
            <Input
              data-testid="input-referee-name"
              value={referenceForm.refereeName}
              onChange={(e) => setReferenceForm({ ...referenceForm, refereeName: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Company *</Label>
            <Input
              data-testid="input-referee-company"
              value={referenceForm.company}
              onChange={(e) => setReferenceForm({ ...referenceForm, company: e.target.value })}
              placeholder="Company name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              data-testid="input-referee-email"
              type="email"
              value={referenceForm.refereeEmail}
              onChange={(e) => setReferenceForm({ ...referenceForm, refereeEmail: e.target.value })}
              placeholder="email@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              data-testid="input-referee-phone"
              value={referenceForm.refereePhone}
              onChange={(e) => setReferenceForm({ ...referenceForm, refereePhone: e.target.value })}
              placeholder="Contact number"
            />
          </div>
        </div>
        <Button onClick={onAddReference} variant="secondary" className="mt-3" data-testid="button-add-reference">
          <Plus className="w-4 h-4 mr-1" /> Add Reference
        </Button>
      </div>
    </div>
  );
}

function StepUniform({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4" data-testid="step-uniform">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Uniform Size</Label>
          <Select value={form.uniformSize} onValueChange={(v) => setForm({ ...form, uniformSize: v })}>
            <SelectTrigger data-testid="select-uniform-size">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="XS">XS (Extra Small)</SelectItem>
              <SelectItem value="S">S (Small)</SelectItem>
              <SelectItem value="M">M (Medium)</SelectItem>
              <SelectItem value="L">L (Large)</SelectItem>
              <SelectItem value="XL">XL (Extra Large)</SelectItem>
              <SelectItem value="XXL">XXL</SelectItem>
              <SelectItem value="3XL">3XL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Boot / Shoe Size (UK)</Label>
          <Select value={form.bootSize} onValueChange={(v) => setForm({ ...form, bootSize: v })}>
            <SelectTrigger data-testid="select-boot-size">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 13 }, (_, i) => i + 3).map((size) => (
                <SelectItem key={size} value={String(size)}>UK {size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Equipment Notes / Special Requirements</Label>
        <Textarea
          data-testid="input-equipment-notes"
          value={form.equipmentNotes}
          onChange={(e) => setForm({ ...form, equipmentNotes: e.target.value })}
          placeholder="Any special equipment requirements, allergies to certain materials, etc."
          className="resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}

function StepTerms({ accepted, setAccepted }: { accepted: boolean; setAccepted: (v: boolean) => void }) {
  return (
    <div className="space-y-4" data-testid="step-terms">
      <div className="max-h-64 overflow-y-auto p-4 rounded-md border bg-muted/30 text-sm space-y-3">
        <h4 className="font-semibold">Terms and Conditions of Employment</h4>
        <p>By accepting these terms, you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>All information provided during this onboarding process is accurate and complete.</li>
          <li>You understand that any false or misleading information may result in the withdrawal of an offer of employment or termination of contract.</li>
          <li>You consent to the company carrying out pre-employment checks including DBS checks, reference checks, and right to work verification.</li>
          <li>You agree to comply with all company policies and procedures as outlined in the employee handbook.</li>
          <li>You understand that your employment is subject to satisfactory completion of all vetting and compliance requirements.</li>
          <li>You consent to the processing of your personal data in accordance with the company's privacy policy and GDPR requirements.</li>
          <li>You agree to maintain the confidentiality of all company and client information.</li>
          <li>You understand the requirements of your role and agree to fulfil them to the best of your ability.</li>
        </ul>
        <h4 className="font-semibold mt-4">Data Protection Notice</h4>
        <p>Your personal data will be processed in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Data will be used solely for employment administration, payroll, and legal compliance purposes.</p>
        <h4 className="font-semibold mt-4">Health & Safety</h4>
        <p>You agree to comply with all health and safety regulations and to report any hazards or incidents promptly.</p>
      </div>
      <div className="flex items-start gap-3 p-4 rounded-md border">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(!!v)}
          data-testid="checkbox-accept-terms"
        />
        <Label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
          I have read, understood, and agree to the Terms and Conditions of Employment, Data Protection Notice, and Health & Safety requirements outlined above.
        </Label>
      </div>
    </div>
  );
}

function StepCompletion({
  onboarding, onSubmit, isSubmitting,
}: {
  onboarding: OnboardingRecord | null | undefined;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const checks = [
    { label: "Personal Details", complete: onboarding?.personalDetailsComplete },
    { label: "Contact & Address", complete: onboarding?.contactDetailsComplete },
    { label: "Emergency Contacts", complete: onboarding?.emergencyContactComplete },
    { label: "Bank Details", complete: onboarding?.bankDetailsComplete },
    { label: "Documents", complete: onboarding?.documentsComplete },
    { label: "Vetting & Compliance", complete: onboarding?.vettingComplete },
    { label: "Uniform & Equipment", complete: onboarding?.uniformComplete },
    { label: "Terms & Conditions", complete: onboarding?.termsAccepted },
  ];

  return (
    <div className="space-y-6" data-testid="step-completion">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Review & Submit</h3>
        <p className="text-sm text-muted-foreground">
          Please review the summary below before submitting your onboarding application.
        </p>
      </div>

      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30">
            <span className="text-sm">{c.label}</span>
            {c.complete ? (
              <Badge variant="default" className="bg-green-600"><Check className="w-3 h-3 mr-1" /> Complete</Badge>
            ) : (
              <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Incomplete</Badge>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-8"
          data-testid="button-submit-onboarding"
        >
          {isSubmitting ? "Submitting..." : "Submit Application for Review"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Once submitted, your application will be reviewed by the HR team.
        </p>
      </div>
    </div>
  );
}
