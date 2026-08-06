import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Shield, ArrowRight, ArrowLeft, Building2, Globe2, CreditCard,
  Users, Rocket, CheckCircle2, Search, MapPin, CalendarDays,
  ShieldCheck, PoundSterling, BarChart3, Brain, Radio, Truck,
  Eye, EyeOff, UserPlus, Briefcase, Settings, Sparkles,
  Check, X, Loader2, Crown, Zap, Star,
} from "lucide-react";

const STEPS = [
  { label: "Create Account", icon: UserPlus },
  { label: "Company Details", icon: Building2 },
  { label: "Your Subdomain", icon: Globe2 },
  { label: "Choose Plan", icon: CreditCard },
  { label: "Build Team", icon: Users },
  { label: "Launch!", icon: Rocket },
];

const ROLE_INFO: Record<string, { label: string; description: string; icon: any; features: string[]; color: string }> = {
  tenant_admin: { label: "Admin", description: "Full company access, billing & settings", icon: Crown, features: ["All Features", "Billing", "Settings", "User Management"], color: "hsl(27, 100%, 55%)" },
  ceo: { label: "CEO", description: "Executive overview & strategic reports", icon: Crown, features: ["Dashboard", "Reports", "Audit Trail", "All Views"], color: "hsl(280, 60%, 50%)" },
  operations_manager: { label: "Operations Manager", description: "Operations, scheduling & deployment", icon: Radio, features: ["Control Room", "Scheduling", "Deployment Map", "Incidents"], color: "hsl(216, 52%, 35%)" },
  regional_manager: { label: "Regional Manager", description: "Regional sites & employees", icon: MapPin, features: ["Control Room", "Scheduling", "Employees", "Sites"], color: "hsl(195, 55%, 42%)" },
  admin: { label: "Admin", description: "Settings, users & configuration", icon: Settings, features: ["Settings", "Users", "Data Import", "Company Profile"], color: "hsl(290, 50%, 50%)" },
  controller: { label: "Controller", description: "Live control room & shift monitoring", icon: Radio, features: ["Control Room", "Active Shifts", "Check-ins", "Incidents"], color: "hsl(200, 60%, 40%)" },
  scheduler: { label: "Scheduler", description: "Shift scheduling & rota management", icon: CalendarDays, features: ["Scheduling", "AI Scheduling", "Sites", "Employees"], color: "hsl(170, 50%, 40%)" },
  hr_manager: { label: "HR Manager", description: "Employees, recruitment & compliance", icon: Users, features: ["Employees", "Recruitment", "Vetting", "Compliance"], color: "hsl(160, 60%, 40%)" },
  compliance_manager: { label: "Compliance Manager", description: "SIA, DBS & compliance tracking", icon: ShieldCheck, features: ["Compliance", "Vetting", "Documents", "Reports"], color: "hsl(140, 55%, 38%)" },
  accountant: { label: "Accountant", description: "Finance, invoicing & self-billing", icon: PoundSterling, features: ["Finance", "Invoices", "Self-Billing", "Reports"], color: "hsl(262, 50%, 50%)" },
  payroll_manager: { label: "Payroll Manager", description: "Payroll processing & timesheets", icon: PoundSterling, features: ["Finance", "Employees", "Timesheets", "Reports"], color: "hsl(30, 70%, 50%)" },
  training_manager: { label: "Training Manager", description: "Training records & development", icon: Users, features: ["Employees", "Compliance", "Training", "Reports"], color: "hsl(330, 55%, 48%)" },
  employee: { label: "Security Officer", description: "Shifts, documents & personal portal", icon: Shield, features: ["My Shifts", "My Documents", "My Profile"], color: "hsl(340, 65%, 50%)" },
};

interface TeamMember {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Plan {
  id: number;
  name: string;
  slug: string;
  price: string;
  maxEmployees: number;
  maxSites: number;
  maxAdminUsers: number;
  features: string[];
}

export default function TenantOnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [account, setAccount] = useState({ firstName: "", lastName: "", email: "", username: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [company, setCompany] = useState({ name: "", tradingName: "", companyRegNumber: "", companyStatus: "", addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", phone: "", website: "", vatNumber: "", siaAcsNumber: "" });
  const [lookingUp, setLookingUp] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<{ available?: boolean; reason?: string; checked?: boolean }>({});
  const [checkingSub, setCheckingSub] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ email: "", firstName: "", lastName: "", role: "employee" }]);

  useEffect(() => {
    fetch("/api/subscription-plans").then(r => r.json()).then(setPlans).catch(() => {});
  }, []);

  const lookupCompany = async () => {
    if (!company.companyRegNumber || company.companyRegNumber.length < 6) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/companies-house/lookup/${encodeURIComponent(company.companyRegNumber)}`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Lookup failed", variant: "destructive" }); return; }
      const data = await res.json();
      setCompany(prev => ({
        ...prev,
        name: data.companyName || prev.name,
        companyStatus: data.companyStatus || "",
        addressLine1: data.addressLine1 || prev.addressLine1,
        addressLine2: data.addressLine2 || prev.addressLine2,
        city: data.city || prev.city,
        county: data.county || prev.county,
        postcode: data.postcode || prev.postcode,
      }));
      toast({ title: "Company found", description: data.companyName });
    } catch { toast({ title: "Lookup error", variant: "destructive" }); }
    finally { setLookingUp(false); }
  };

  const checkSubdomain = useCallback(async (val: string) => {
    const normalized = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSubdomain(normalized);
    if (normalized.length < 3) { setSubdomainStatus({ available: false, reason: "At least 3 characters", checked: true }); return; }
    setCheckingSub(true);
    try {
      const res = await fetch(`/api/subdomain-check/${normalized}`);
      const data = await res.json();
      setSubdomainStatus({ available: data.available, reason: data.reason, checked: true });
    } catch { setSubdomainStatus({ available: false, reason: "Check failed", checked: true }); }
    finally { setCheckingSub(false); }
  }, []);

  useEffect(() => {
    if (!subdomain) { setSubdomainStatus({}); return; }
    const timer = setTimeout(() => checkSubdomain(subdomain), 500);
    return () => clearTimeout(timer);
  }, [subdomain, checkSubdomain]);

  const canProceed = () => {
    switch (step) {
      case 0: return account.firstName && account.lastName && account.email && account.password && account.password === account.confirmPassword && account.password.length >= 6;
      case 1: return !!company.name;
      case 2: return true;
      case 3: return selectedPlan !== null;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const validTeam = teamMembers.filter(m => m.email.trim());
      const res = await fetch("/api/tenant-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          account: { ...account, username: account.username || account.email.split("@")[0] },
          company,
          subdomain: subdomain || null,
          planId: selectedPlan,
          teamMembers: validTeam,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.user) {
        queryClient.setQueryData(["/api/auth/user"], data.user);
      }
      setStep(5);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 4) { handleSubmit(); return; }
    if (canProceed()) setStep(s => Math.min(s + 1, 5));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const planIcons: Record<string, { icon: any; gradient: string }> = {
    starter: { icon: Zap, gradient: "from-blue-500 to-blue-600" },
    professional: { icon: Star, gradient: "from-[hsl(27,100%,55%)] to-[hsl(27,100%,45%)]" },
    enterprise: { icon: Crown, gradient: "from-purple-600 to-indigo-600" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" data-testid="tenant-onboarding-page">
      <style>{`
        @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(255,140,66,0.4); } 70% { box-shadow: 0 0 0 12px rgba(255,140,66,0); } 100% { box-shadow: 0 0 0 0 rgba(255,140,66,0); } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-pulse-ring { animation: pulse-ring 2s ease infinite; }
      `}</style>

      <nav className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(27,100%,63%)" }}>
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg" data-testid="text-brand">Gardeo</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="button-back-login">
            Already have an account? Sign In
          </Button>
        </div>
      </nav>

      {step < 5 && (
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      i < step ? "bg-green-500 text-white" :
                      i === step ? "text-white animate-pulse-ring" : "bg-slate-200 text-slate-500 dark:bg-slate-700"
                    }`}
                    style={i === step ? { backgroundColor: "hsl(27,100%,55%)" } : undefined}
                    data-testid={`step-indicator-${i}`}
                  >
                    {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${i < step ? "bg-green-400" : "bg-slate-200 dark:bg-slate-700"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {step === 0 && (
          <div className="animate-slide-up grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-step-title">Create Your Account</h2>
              <p className="text-muted-foreground mb-6">Start your 14-day free trial. No credit card required.</p>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" data-testid="input-first-name" value={account.firstName} onChange={e => setAccount({ ...account, firstName: e.target.value })} placeholder="James" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" data-testid="input-last-name" value={account.lastName} onChange={e => setAccount({ ...account, lastName: e.target.value })} placeholder="Richardson" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Work Email</Label>
                    <Input id="email" data-testid="input-email" type="email" value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} placeholder="james@securityfirm.co.uk" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" data-testid="input-username" value={account.username} onChange={e => setAccount({ ...account, username: e.target.value })} placeholder={account.email ? account.email.split("@")[0] : "james"} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input id="password" data-testid="input-password" type={showPassword ? "text" : "password"} value={account.password} onChange={e => setAccount({ ...account, password: e.target.value })} placeholder="At least 6 characters" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" data-testid="input-confirm-password" type="password" value={account.confirmPassword} onChange={e => setAccount({ ...account, confirmPassword: e.target.value })} placeholder="Re-enter your password" />
                    {account.confirmPassword && account.password !== account.confirmPassword && (
                      <p className="text-xs text-red-500">Passwords don't match</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-xl border p-6 space-y-4" style={{ background: "linear-gradient(135deg, hsl(216,52%,18%) 0%, hsl(216,52%,28%) 100%)" }}>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: "hsl(27,100%,63%)" }} />
                  What You'll Get
                </h3>
                <div className="space-y-3">
                  {[
                    { icon: CalendarDays, text: "AI-Powered Shift Scheduling", sub: "Optimise rosters in seconds" },
                    { icon: Radio, text: "Live Control Room", sub: "Real-time shift monitoring & pre-checks" },
                    { icon: ShieldCheck, text: "Compliance Dashboard", sub: "SIA, DBS, First Aid tracking" },
                    { icon: MapPin, text: "UK Deployment Map", sub: "Visualise your entire operation" },
                    { icon: PoundSterling, text: "HMRC-Compliant Self-Billing", sub: "Automated invoicing at 20% VAT" },
                    { icon: Brain, text: "AI-Driven Insights", sub: "Predict staffing needs & costs" },
                  ].map(item => (
                    <div key={item.text} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,140,66,0.15)" }}>
                        <item.icon className="w-4 h-4" style={{ color: "hsl(27,100%,63%)" }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{item.text}</div>
                        <div className="text-xs text-white/50">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-slide-up grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-step-title">Company Details</h2>
              <p className="text-muted-foreground mb-6">Enter your company registration number to auto-fill details from Companies House.</p>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Company Registration Number</Label>
                    <div className="flex gap-2">
                      <Input data-testid="input-reg-number" value={company.companyRegNumber} onChange={e => setCompany({ ...company, companyRegNumber: e.target.value })} placeholder="e.g. 08259136" />
                      <Button variant="outline" onClick={lookupCompany} disabled={lookingUp || !company.companyRegNumber} data-testid="button-lookup">
                        {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name *</Label>
                    <Input data-testid="input-company-name" value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} placeholder="Your Security Company Ltd" />
                  </div>
                  {company.companyStatus && (
                    <div className="flex items-center gap-2">
                      <Badge variant={company.companyStatus === "Active" ? "default" : "secondary"} data-testid="badge-company-status">
                        {company.companyStatus}
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Trading Name</Label>
                    <Input data-testid="input-trading-name" value={company.tradingName} onChange={e => setCompany({ ...company, tradingName: e.target.value })} placeholder="If different from company name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Address Line 1</Label>
                      <Input data-testid="input-address1" value={company.addressLine1} onChange={e => setCompany({ ...company, addressLine1: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Address Line 2</Label>
                      <Input data-testid="input-address2" value={company.addressLine2} onChange={e => setCompany({ ...company, addressLine2: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input data-testid="input-city" value={company.city} onChange={e => setCompany({ ...company, city: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>County</Label>
                      <Input data-testid="input-county" value={company.county} onChange={e => setCompany({ ...company, county: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postcode</Label>
                      <Input data-testid="input-postcode" value={company.postcode} onChange={e => setCompany({ ...company, postcode: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input data-testid="input-phone" value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} placeholder="+44 ..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Website</Label>
                      <Input data-testid="input-website" value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>VAT Number</Label>
                      <Input data-testid="input-vat" value={company.vatNumber} onChange={e => setCompany({ ...company, vatNumber: e.target.value })} placeholder="GB123456789" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SIA ACS Number</Label>
                      <Input data-testid="input-sia" value={company.siaAcsNumber} onChange={e => setCompany({ ...company, siaAcsNumber: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-xl border overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(216,52%,15%) 0%, hsl(216,52%,22%) 100%)" }}>
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                  <span className="ml-2 text-xs text-white/40 font-mono">Dashboard Preview</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(27,100%,55%)" }}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{company.name || "Your Company"}</div>
                      <div className="text-white/40 text-xs">Workforce Management Platform</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Active Officers", value: "0", color: "hsl(160,60%,45%)" },
                      { label: "Sites", value: "0", color: "hsl(27,100%,55%)" },
                      { label: "Compliance", value: "100%", color: "hsl(216,52%,45%)" },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="text-lg font-bold text-white">{stat.value}</div>
                        <div className="text-[10px] text-white/50">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {["Dashboard", "Employees", "Scheduling", "Control Room", "Compliance"].map(item => (
                      <div key={item} className="flex items-center gap-2 p-2 rounded text-xs text-white/60" style={{ background: item === "Dashboard" ? "rgba(255,140,66,0.15)" : "transparent" }}>
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: item === "Dashboard" ? "hsl(27,100%,55%)" : "transparent" }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-step-title">Choose Your Subdomain</h2>
              <p className="text-muted-foreground mb-6">Pick a custom URL for your team to access the platform. You can skip this step.</p>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Subdomain</Label>
                    <div className="flex items-center gap-0 rounded-md border bg-background overflow-hidden">
                      <Input
                        data-testid="input-subdomain"
                        value={subdomain}
                        onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="your-company"
                        className="border-0 focus-visible:ring-0"
                      />
                      <span className="text-sm text-muted-foreground px-3 whitespace-nowrap bg-muted h-full flex items-center py-2">.gardeo.app</span>
                    </div>
                    {checkingSub && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking availability...</p>}
                    {subdomainStatus.checked && !checkingSub && subdomain && (
                      <p className={`text-xs flex items-center gap-1 ${subdomainStatus.available ? "text-green-600" : "text-red-500"}`}>
                        {subdomainStatus.available ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {subdomainStatus.available ? `${subdomain}.gardeo.app is available!` : (subdomainStatus.reason || "Not available")}
                      </p>
                    )}
                  </div>

                  {subdomain && subdomainStatus.available && (
                    <div className="rounded-lg p-4 border bg-green-50 dark:bg-green-950/30">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">Your platform will be accessible at:</p>
                      <p className="text-lg font-bold text-green-800 dark:text-green-300 mt-1">https://{subdomain}.gardeo.app</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-xl border overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(216,52%,18%) 0%, hsl(216,52%,28%) 100%)" }}>
                <div className="p-6">
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5" style={{ color: "hsl(27,100%,63%)" }} />
                    UK Deployment Map
                  </h3>
                  <div className="relative rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", height: 280 }}>
                    <svg viewBox="0 0 400 500" className="w-full h-full opacity-60">
                      <path d="M200 50 C150 80, 130 120, 140 160 C120 180, 110 220, 130 260 C100 280, 90 320, 120 360 C130 380, 160 400, 180 420 C200 440, 220 450, 240 440 C260 430, 280 400, 290 380 C310 360, 300 320, 280 280 C300 260, 310 220, 290 180 C280 160, 270 120, 250 80 C230 60, 210 50, 200 50Z" fill="rgba(31,58,95,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      {[
                        { x: 200, y: 150, label: "London" },
                        { x: 180, y: 200, label: "Birmingham" },
                        { x: 160, y: 280, label: "Bristol" },
                        { x: 200, y: 120, label: "Leeds" },
                        { x: 170, y: 110, label: "Manchester" },
                      ].map((pin, i) => (
                        <g key={pin.label}>
                          <circle cx={pin.x} cy={pin.y} r="6" fill="hsl(27,100%,55%)" opacity="0.8">
                            <animate attributeName="r" values="4;8;4" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                          </circle>
                          <circle cx={pin.x} cy={pin.y} r="3" fill="white" />
                          <text x={pin.x + 12} y={pin.y + 4} fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="Inter">{pin.label}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <p className="text-white/50 text-xs mt-3 text-center">Visualise all your deployment sites across the UK</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2" data-testid="text-step-title">Choose Your Plan</h2>
              <p className="text-muted-foreground">All plans include a 14-day free trial. Upgrade or downgrade anytime.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map(plan => {
                const meta = planIcons[plan.slug] || { icon: Zap, gradient: "from-blue-500 to-blue-600" };
                const isSelected = selectedPlan === plan.id;
                const isPro = plan.slug === "professional";
                return (
                  <Card
                    key={plan.id}
                    className={`relative cursor-pointer transition-all duration-300 ${isSelected ? "ring-2 ring-offset-2 scale-[1.02]" : "hover:shadow-lg"} ${isPro ? "border-2" : ""}`}
                    style={isPro && !isSelected ? { borderColor: "hsl(27,100%,55%)" } : undefined}
                    onClick={() => setSelectedPlan(plan.id)}
                    data-testid={`card-plan-${plan.slug}`}
                  >
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge style={{ backgroundColor: "hsl(27,100%,55%)" }} className="text-white text-xs">Most Popular</Badge>
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${meta.gradient}`}>
                        <meta.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-bold">{plan.price === "349" ? "£349" : `£${plan.price}`}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span>Up to {plan.maxEmployees > 9999 ? "Unlimited" : plan.maxEmployees} employees</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Up to {plan.maxSites > 9999 ? "Unlimited" : plan.maxSites} sites</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Crown className="w-3.5 h-3.5" />
                          <span>{plan.maxAdminUsers > 9999 ? "Unlimited" : plan.maxAdminUsers} admin users</span>
                        </div>
                      </div>
                      <div className="border-t pt-4 space-y-2">
                        {(plan.features as string[])?.map((f: string) => (
                          <div key={f} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        className={`w-full mt-6 ${isSelected ? "" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}
                        style={isSelected ? { backgroundColor: "hsl(27,100%,55%)" } : undefined}
                        data-testid={`button-select-plan-${plan.slug}`}
                      >
                        {isSelected ? <><Check className="w-4 h-4 mr-1" /> Selected</> : "Select Plan"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-slide-up grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-step-title">Build Your Team</h2>
              <p className="text-muted-foreground mb-6">Invite team members and assign their roles. You can add more later.</p>
              <Card>
                <CardContent className="p-6 space-y-4">
                  {teamMembers.map((member, idx) => (
                    <div key={idx} className="p-4 rounded-lg border space-y-3 relative" data-testid={`team-member-${idx}`}>
                      {teamMembers.length > 1 && (
                        <Button variant="ghost" size="icon" className="absolute right-2 top-2 w-6 h-6" onClick={() => setTeamMembers(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-remove-member-${idx}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="First name" value={member.firstName} onChange={e => { const t = [...teamMembers]; t[idx].firstName = e.target.value; setTeamMembers(t); }} data-testid={`input-member-first-${idx}`} />
                        <Input placeholder="Last name" value={member.lastName} onChange={e => { const t = [...teamMembers]; t[idx].lastName = e.target.value; setTeamMembers(t); }} data-testid={`input-member-last-${idx}`} />
                      </div>
                      <Input placeholder="Email address" type="email" value={member.email} onChange={e => { const t = [...teamMembers]; t[idx].email = e.target.value; setTeamMembers(t); }} data-testid={`input-member-email-${idx}`} />
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ROLE_INFO).filter(([k]) => k !== "tenant_admin").map(([key, role]) => (
                          <button
                            key={key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${member.role === key ? "text-white border-transparent" : "text-muted-foreground hover:border-foreground/20"}`}
                            style={member.role === key ? { backgroundColor: role.color } : undefined}
                            onClick={() => { const t = [...teamMembers]; t[idx].role = key; setTeamMembers(t); }}
                            data-testid={`button-role-${key}-${idx}`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setTeamMembers(prev => [...prev, { email: "", firstName: "", lastName: "", role: "employee" }])}
                    data-testid="button-add-member"
                  >
                    <UserPlus className="w-4 h-4 mr-2" /> Add Another Team Member
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="hidden lg:block space-y-4">
              <h3 className="font-semibold text-lg">Role Access Guide</h3>
              {Object.entries(ROLE_INFO).map(([key, role]) => (
                <div key={key} className="rounded-xl border p-4 flex items-start gap-4 transition-all hover:shadow-md" data-testid={`role-card-${key}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${role.color}20` }}>
                    <role.icon className="w-5 h-5" style={{ color: role.color }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{role.label}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{role.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.features.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px] px-2 py-0">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-slide-up text-center max-w-2xl mx-auto py-12">
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-sm"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ["hsl(27,100%,55%)", "hsl(216,52%,35%)", "hsl(160,60%,45%)", "hsl(340,65%,55%)", "hsl(262,50%,55%)"][i % 5],
                    animation: `confetti-fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s forwards`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-pulse-ring" style={{ backgroundColor: "hsl(27,100%,55%)" }}>
                <Rocket className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl font-bold mb-3" data-testid="text-launch-title">You're All Set!</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Welcome to Gardeo. Your {company.name || "company"} workspace is ready.
                {subdomain && <><br />Access your platform at <strong>{subdomain}.gardeo.app</strong></>}
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
                <div className="rounded-xl border p-4 text-center">
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-semibold">{company.name || "Company"}</div>
                  <div className="text-xs text-muted-foreground">Organisation</div>
                </div>
                <div className="rounded-xl border p-4 text-center">
                  <CreditCard className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-semibold">{plans.find(p => p.id === selectedPlan)?.name || "Free Trial"}</div>
                  <div className="text-xs text-muted-foreground">Plan</div>
                </div>
                <div className="rounded-xl border p-4 text-center">
                  <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-semibold">{teamMembers.filter(m => m.email).length + 1}</div>
                  <div className="text-xs text-muted-foreground">Team Members</div>
                </div>
              </div>

              <Button
                size="lg"
                className="text-base px-10"
                style={{ backgroundColor: "hsl(27,100%,55%)" }}
                onClick={() => setLocation("/dashboard")}
                data-testid="button-launch-dashboard"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Launch Dashboard
              </Button>
            </div>
          </div>
        )}

        {step < 5 && (
          <div className="flex items-center justify-between mt-8 max-w-5xl mx-auto">
            <Button variant="outline" onClick={prevStep} disabled={step === 0} data-testid="button-prev-step">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button
              onClick={nextStep}
              disabled={!canProceed() || submitting}
              style={{ backgroundColor: "hsl(27,100%,55%)" }}
              data-testid="button-next-step"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {step === 4 ? "Create Account & Launch" : "Continue"}
              {step < 4 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
