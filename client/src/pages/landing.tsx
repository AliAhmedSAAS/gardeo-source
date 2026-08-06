import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Users, CalendarDays, MapPin, Brain, PoundSterling,
  ChevronRight, CheckCircle2, ArrowRight, Zap, Lock, Globe2, BarChart3,
  Clock, ShieldCheck, Truck, Star, Menu, X, Sparkles, Cpu, Activity,
  TrendingUp, Eye, BotMessageSquare, Fingerprint, Network,
} from "lucide-react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const { ref, isVisible } = useInView();
  const [value, setValue] = useState("0");
  useEffect(() => {
    if (!isVisible) return;
    const num = parseInt(target.replace(/[^0-9]/g, ""));
    if (isNaN(num)) { setValue(target); return; }
    const duration = 1500;
    const steps = 40;
    const inc = num / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(inc * step), num);
      if (target.includes("k")) setValue(current >= 1000 ? `${(current / 1000).toFixed(0)}k` : `${current}`);
      else if (target.includes(".")) setValue((current / 10).toFixed(1));
      else setValue(current.toString());
      if (step >= steps) { setValue(target.replace(suffix, "")); clearInterval(timer); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isVisible, target, suffix]);
  return <span ref={ref}>{value}{suffix}</span>;
}

const aiFeatures = [
  {
    icon: Brain,
    title: "AI Shift Optimisation",
    description: "Machine learning analyses historical patterns, employee skills, and site requirements to generate optimal shift schedules in seconds.",
    gradient: "from-[hsl(216,52%,25%)] to-[hsl(250,60%,45%)]",
  },
  {
    icon: Eye,
    title: "Predictive Staffing",
    description: "Anticipate demand spikes and coverage gaps before they happen. Our AI forecasts staffing needs based on events, seasonality, and trends.",
    gradient: "from-[hsl(27,100%,55%)] to-[hsl(340,65%,55%)]",
  },
  {
    icon: BotMessageSquare,
    title: "Intelligent Compliance Alerts",
    description: "Automated monitoring of SIA licences, DBS checks, and certifications with smart notifications before anything expires.",
    gradient: "from-[hsl(160,60%,40%)] to-[hsl(200,70%,45%)]",
  },
  {
    icon: TrendingUp,
    title: "Smart Financial Insights",
    description: "AI-driven cost analysis identifies overtime trends, suggests budget optimisations, and flags billing anomalies automatically.",
    gradient: "from-[hsl(262,50%,50%)] to-[hsl(216,52%,35%)]",
  },
];

const features = [
  { icon: Users, title: "Employee Management", description: "Complete workforce lifecycle from recruitment to offboarding with digital onboarding wizards." },
  { icon: CalendarDays, title: "Smart Scheduling", description: "AI-powered shift planning that optimises coverage, reduces conflicts, and minimises overtime costs." },
  { icon: MapPin, title: "UK Deployment Map", description: "Interactive map visualisation showing real-time officer deployment across all your UK sites." },
  { icon: ShieldCheck, title: "Compliance & Vetting", description: "Automated SIA licence tracking, DBS checks, right-to-work verification, and expiry alerts." },
  { icon: PoundSterling, title: "Self-Billing & Finance", description: "HMRC-compliant VAT invoicing, automated self-billing, and complete financial reporting." },
  { icon: Truck, title: "Supplier Portal", description: "Streamlined supplier onboarding with approval workflows, audit trails, and performance tracking." },
  { icon: BarChart3, title: "Reports & Analytics", description: "Executive dashboards with workforce, scheduling, compliance, and financial performance metrics." },
  { icon: Lock, title: "Role-Based Access", description: "Seven distinct user roles with granular permissions ensuring data security across your organisation." },
  { icon: Network, title: "Multi-Tenant Platform", description: "Isolated tenant environments with shared infrastructure for scalable, cost-efficient deployments." },
];

const stats = [
  { value: "99.9", suffix: "%", label: "Uptime SLA" },
  { value: "60", suffix: "%", label: "Admin Time Saved" },
  { value: "10k", suffix: "+", label: "Officers Managed" },
  { value: "24", suffix: "/7", label: "Control Room Ready" },
];

const plans = [
  {
    name: "Starter", price: "49", period: "/month",
    description: "For small security firms getting started",
    features: ["Up to 50 employees", "Basic scheduling", "Compliance tracking", "Employee portal", "Email support"],
    cta: "Start Free Trial", highlighted: false,
  },
  {
    name: "Professional", price: "149", period: "/month",
    description: "For growing companies needing more power",
    features: ["Up to 500 employees", "AI-powered scheduling", "UK deployment map", "Self-billing & invoicing", "Supplier management", "Priority support"],
    cta: "Start Free Trial", highlighted: true,
  },
  {
    name: "Enterprise", price: "Custom", period: "",
    description: "For large organisations with complex needs",
    features: ["Unlimited employees", "Multi-tenant architecture", "Custom integrations", "Dedicated account manager", "On-premise option", "SLA guarantee"],
    cta: "Contact Sales", highlighted: false,
  },
];

const testimonials = [
  { quote: "Gardeo transformed how we manage our 200+ security officers. Scheduling that used to take days now takes minutes.", author: "James Richardson", role: "Operations Director", company: "SecureGuard UK" },
  { quote: "The compliance tracking alone saved us from costly SIA licence oversights. It pays for itself every month.", author: "Sarah Mitchell", role: "HR Manager", company: "Sentinel Security Services" },
  { quote: "Finally, a platform that understands UK security industry regulations. The HMRC-compliant self-billing is brilliant.", author: "David Thompson", role: "Managing Director", company: "Apex Protection Group" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes orbit { 0% { transform: rotate(0deg) translateX(140px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(140px) rotate(-360deg); } }
        @keyframes orbit-reverse { 0% { transform: rotate(0deg) translateX(100px) rotate(0deg); } 100% { transform: rotate(-360deg) translateX(100px) rotate(360deg); } }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes typing { 0% { width: 0; } 50% { width: 100%; } 100% { width: 100%; } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float 6s ease-in-out 2s infinite; }
        .animate-float-delayed-2 { animation: float 6s ease-in-out 4s infinite; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .animate-shimmer { background-size: 200% 100%; animation: shimmer 3s linear infinite; }
        .animate-orbit { animation: orbit 20s linear infinite; }
        .animate-orbit-reverse { animation: orbit-reverse 15s linear infinite; }
        .animate-gradient { background-size: 200% 200%; animation: gradient-shift 4s ease infinite; }
        .glass-card { backdrop-filter: blur(16px); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
      `}</style>

      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "hsl(var(--background) / 0.92)" : "transparent",
          borderBottom: scrolled ? "1px solid hsl(var(--border))" : "1px solid transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 63%)" }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg" data-testid="text-brand-name">Gardeo</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#ai" className="text-sm text-muted-foreground transition-colors" data-testid="link-ai">AI Features</a>
              <a href="#features" className="text-sm text-muted-foreground transition-colors" data-testid="link-features">Platform</a>
              <a href="#pricing" className="text-sm text-muted-foreground transition-colors" data-testid="link-pricing">Pricing</a>
              <a href="#testimonials" className="text-sm text-muted-foreground transition-colors" data-testid="link-testimonials">Testimonials</a>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login"><Button variant="ghost" data-testid="button-nav-login">Sign In</Button></Link>
              <Link href="/get-started"><Button data-testid="button-nav-register">Get Started</Button></Link>
            </div>
            <Button size="icon" variant="ghost" className="md:hidden no-default-hover-elevate no-default-active-elevate" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background px-4 py-4 space-y-3">
            <a href="#ai" className="block text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>AI Features</a>
            <a href="#features" className="block text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#pricing" className="block text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#testimonials" className="block text-sm text-muted-foreground py-2" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login"><Button variant="outline" className="w-full">Sign In</Button></Link>
              <Link href="/get-started"><Button className="w-full">Get Started</Button></Link>
            </div>
          </div>
        )}
      </nav>

      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-clip">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, hsl(216, 52%, 25%) 0%, transparent 60%)" }} />
          <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.05] animate-pulse-glow" style={{ background: "radial-gradient(circle, hsl(27, 100%, 63%) 0%, transparent 60%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="animate-orbit"><div className="w-2 h-2 rounded-full opacity-20" style={{ backgroundColor: "hsl(27, 100%, 63%)" }} /></div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="animate-orbit-reverse"><div className="w-1.5 h-1.5 rounded-full opacity-15" style={{ backgroundColor: "hsl(216, 52%, 45%)" }} /></div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <AnimatedSection>
              <Badge variant="secondary" className="mb-6 no-default-active-elevate">
                <Sparkles className="w-3 h-3 mr-1.5" style={{ color: "hsl(27, 100%, 63%)" }} />
                AI-Powered Workforce Management
              </Badge>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6" data-testid="text-hero-heading">
                The Future of
                <span className="block animate-gradient bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(216, 52%, 25%), hsl(27, 100%, 63%), hsl(216, 52%, 35%))" }}>
                  Workforce Intelligence
                </span>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-subheading">
                AI-driven scheduling, real-time compliance monitoring, and intelligent financial
                management — built for the UK security industry. Let artificial intelligence
                handle the complexity while you focus on growth.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/get-started">
                  <Button size="lg" className="text-base px-8 animate-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(216, 52%, 25%), hsl(216, 52%, 35%), hsl(216, 52%, 25%))", backgroundSize: "200% 200%" }} data-testid="button-hero-cta">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <a href="#ai">
                  <Button variant="outline" size="lg" className="text-base px-8" data-testid="button-hero-features">
                    <Brain className="w-4 h-4 mr-2" />
                    See AI in Action
                  </Button>
                </a>
              </div>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={0.4} className="mt-20 relative">
            <div className="max-w-4xl mx-auto rounded-md border p-1" style={{ background: "linear-gradient(135deg, hsl(216, 52%, 15%) 0%, hsl(216, 52%, 22%) 100%)" }}>
              <div className="rounded-md p-6 sm:p-8" style={{ background: "linear-gradient(180deg, hsl(216, 52%, 18%) 0%, hsl(216, 52%, 14%) 100%)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                  <span className="ml-3 text-xs text-white/30 font-mono">gardeo-ai-engine</span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(27, 100%, 63%)" }} />
                    <span className="text-white/70">Analysing workforce data for </span>
                    <span className="text-green-400">247 employees</span>
                    <span className="text-white/70">...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-white/70">SIA compliance check: </span>
                    <span className="text-green-400">98.2% compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(27, 100%, 63%)" }} />
                    <span className="text-white/70">Generating optimal shift schedule for </span>
                    <span style={{ color: "hsl(27, 100%, 63%)" }}>next 7 days</span>
                    <span className="text-white/70">...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-white/70">Predicted cost savings: </span>
                    <span className="text-blue-400">£4,230/month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-green-400">Schedule optimised. 12 conflicts resolved automatically.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block absolute -right-4 top-8 animate-float">
              <div className="glass-card rounded-md p-3 flex items-center gap-3" style={{ background: "rgba(31, 58, 95, 0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(160, 60%, 45%, 0.2)" }}>
                  <ShieldCheck className="w-4 h-4" style={{ color: "hsl(160, 60%, 45%)" }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Compliance Score</div>
                  <div className="text-lg font-bold text-green-400">98.2%</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block absolute -left-4 bottom-4 animate-float-delayed">
              <div className="glass-card rounded-md p-3 flex items-center gap-3" style={{ background: "rgba(31, 58, 95, 0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(27, 100%, 63%, 0.2)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "hsl(27, 100%, 63%)" }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Monthly Savings</div>
                  <div className="text-lg font-bold" style={{ color: "hsl(27, 100%, 63%)" }}>£4,230</div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map((stat, i) => (
              <AnimatedSection key={stat.label} delay={i * 0.1} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="text-3xl sm:text-4xl font-bold" style={{ color: "hsl(216, 52%, 25%)" }}>
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="rounded-md border p-6 sm:p-10" style={{ background: "linear-gradient(135deg, hsl(216, 52%, 18%) 0%, hsl(216, 52%, 28%) 100%)" }}>
              <div className="grid sm:grid-cols-3 gap-8 text-center">
                <div>
                  <Globe2 className="w-8 h-8 mx-auto mb-3 text-white/80" />
                  <h3 className="font-semibold text-white mb-1">Multi-Tenant Architecture</h3>
                  <p className="text-sm text-white/60">Isolated data per organisation with shared infrastructure for cost efficiency.</p>
                </div>
                <div>
                  <Fingerprint className="w-8 h-8 mx-auto mb-3 text-white/80" />
                  <h3 className="font-semibold text-white mb-1">Enterprise Security</h3>
                  <p className="text-sm text-white/60">Role-based access control, encrypted data, and complete audit trails.</p>
                </div>
                <div>
                  <Cpu className="w-8 h-8 mx-auto mb-3 text-white/80" />
                  <h3 className="font-semibold text-white mb-1">AI-Powered Engine</h3>
                  <p className="text-sm text-white/60">Machine learning models trained on workforce patterns to automate decisions.</p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section id="ai" className="py-20 sm:py-28 overflow-clip">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 no-default-active-elevate">
              <Brain className="w-3 h-3 mr-1.5" style={{ color: "hsl(27, 100%, 63%)" }} />
              AI-Powered Intelligence
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-ai-heading">
              Smart Features That Think
              <span className="animate-gradient bg-clip-text text-transparent ml-2" style={{ backgroundImage: "linear-gradient(135deg, hsl(216, 52%, 25%), hsl(27, 100%, 63%), hsl(216, 52%, 35%))" }}>
                Ahead of You
              </span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Our AI engine processes thousands of data points to deliver actionable insights,
              automate complex decisions, and predict what your operation needs next.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-6">
            {aiFeatures.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.1}>
                <Card className="group relative" data-testid={`card-ai-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${feature.gradient}`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection delay={0.4} className="mt-12">
            <div className="rounded-md p-8 sm:p-12 text-center relative" style={{ background: "linear-gradient(135deg, hsl(216, 52%, 15%), hsl(250, 50%, 20%))" }}>
              <div className="absolute inset-0 rounded-md opacity-30" style={{ background: "radial-gradient(circle at 30% 50%, hsl(27, 100%, 63%, 0.15), transparent 50%)" }} />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 animate-float" style={{ background: "linear-gradient(135deg, hsl(27, 100%, 63%), hsl(27, 100%, 50%))" }}>
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">AI That Learns Your Operation</h3>
                <p className="text-white/60 max-w-lg mx-auto mb-6">
                  The more you use Gardeo, the smarter it gets. Our AI continuously adapts to your
                  scheduling patterns, compliance needs, and financial workflows.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>Self-learning algorithms</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>Real-time adaptation</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>Predictive analytics</span>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 no-default-active-elevate">Platform Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-features-heading">
              Everything You Need to Run Your Operation
            </h2>
            <p className="text-muted-foreground text-lg">
              A complete suite of tools built for the demands of UK workforce management.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={Math.min(i * 0.06, 0.5)}>
                <Card className="h-full" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardContent className="p-6">
                    <div className="w-11 h-11 rounded-md flex items-center justify-center mb-4" style={{ backgroundColor: "hsl(27, 100%, 63%, 0.12)" }}>
                      <feature.icon className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
                    </div>
                    <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="compliance" className="py-20 sm:py-28 bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 no-default-active-elevate">Trust & Compliance</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-compliance-heading">
              Built to the Highest Industry Standards
            </h2>
            <p className="text-muted-foreground text-lg">
              Gardeo is designed to meet the rigorous regulatory and security requirements of the UK private security industry.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 mb-12">
            {[
              { abbr: "GDPR", title: "GDPR Compliant", description: "UK GDPR & Data Protection Act 2018" },
              { abbr: "ISO", title: "ISO 27001 Aligned", description: "International information security standard" },
              { abbr: "SIA", title: "SIA ACS Ready", description: "Approved Contractor Scheme compliant" },
              { abbr: "BS 7858", title: "BS 7858 Vetting", description: "Security personnel screening standard" },
              { abbr: "ICO", title: "ICO Registered", description: "Information Commissioner's Office" },
              { abbr: "CE", title: "Cyber Essentials", description: "UK Government cybersecurity framework" },
            ].map((badge, i) => (
              <AnimatedSection key={badge.abbr} delay={Math.min(i * 0.08, 0.5)}>
                <Card
                  className="flex flex-col items-center text-center p-5 h-full"
                  data-testid={`badge-${badge.abbr.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: "hsl(216, 52%, 25%, 0.08)" }}
                  >
                    <span className="text-sm font-bold tracking-tight" style={{ color: "hsl(216, 52%, 35%)" }}>
                      {badge.abbr}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold mb-1 leading-tight">{badge.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug">{badge.description}</p>
                </Card>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection delay={0.2}>
            <Card className="p-6 sm:p-8">
              <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 63%, 0.12)" }}>
                    <Lock className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">End-to-End Encryption</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">All data encrypted in transit (TLS 1.3) and at rest (AES-256) with secure key management.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 63%, 0.12)" }}>
                    <Fingerprint className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Role-Based Access Control</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">15 granular user roles with least-privilege access ensuring data is only visible to authorised personnel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 63%, 0.12)" }}>
                    <Activity className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Full Audit Trail</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">Every action logged with timestamps and user attribution for complete regulatory accountability.</p>
                  </div>
                </div>
              </div>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 no-default-active-elevate">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-pricing-heading">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg">
              Start with a 14-day free trial. No credit card required. Scale as you grow.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <AnimatedSection key={plan.name} delay={i * 0.1}>
                <Card
                  className={`relative h-full ${plan.highlighted ? "ring-2" : ""}`}
                  style={plan.highlighted ? { borderColor: "hsl(27, 100%, 63%)", boxShadow: "0 0 0 2px hsl(27, 100%, 63%, 0.2)" } : {}}
                  data-testid={`card-plan-${plan.name.toLowerCase()}`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge style={{ backgroundColor: "hsl(27, 100%, 63%)", color: "white" }}>Most Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6 pt-8">
                    <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      {plan.price !== "Custom" && <span className="text-sm text-muted-foreground">£</span>}
                      <span className="text-4xl font-bold">{plan.price}</span>
                      {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                    <Link href="/get-started">
                      <Button className="w-full mb-6" variant={plan.highlighted ? "default" : "outline"} data-testid={`button-plan-${plan.name.toLowerCase()}`}>
                        {plan.cta}
                      </Button>
                    </Link>
                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(160, 60%, 45%)" }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 no-default-active-elevate">Testimonials</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-testimonials-heading">
              Trusted by Security Firms Across the UK
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <AnimatedSection key={t.author} delay={i * 0.1}>
                <Card className="h-full" data-testid={`card-testimonial-${t.author.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-current" style={{ color: "hsl(27, 100%, 63%)" }} />
                      ))}
                    </div>
                    <blockquote className="text-sm leading-relaxed mb-5">"{t.quote}"</blockquote>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ backgroundColor: "hsl(216, 52%, 25%)" }}>
                        {t.author.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.author}</div>
                        <div className="text-xs text-muted-foreground">{t.role}, {t.company}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="rounded-md p-10 sm:p-16 text-center relative overflow-clip" style={{ background: "linear-gradient(135deg, hsl(216, 52%, 16%) 0%, hsl(216, 52%, 28%) 50%, hsl(250, 50%, 25%) 100%)" }}>
              <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 70% 30%, hsl(27, 100%, 63%, 0.3), transparent 50%)" }} />
              <div className="absolute top-0 right-0 w-80 h-80 opacity-10" style={{ background: "radial-gradient(circle, hsl(27, 100%, 63%) 0%, transparent 70%)" }} />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6" style={{ background: "linear-gradient(135deg, hsl(27, 100%, 63%), hsl(27, 100%, 50%))" }}>
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4" data-testid="text-cta-heading">
                  Ready to Transform Your
                  <br />Workforce Management?
                </h2>
                <p className="text-white/60 max-w-xl mx-auto mb-8 text-base leading-relaxed">
                  Join hundreds of UK security firms who have streamlined their operations with Gardeo.
                  Start your free 14-day trial today — no credit card required.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/get-started">
                    <Button size="lg" className="text-base px-8" style={{ backgroundColor: "hsl(27, 100%, 63%)", borderColor: "hsl(27, 100%, 55%)" }} data-testid="button-cta-trial">
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg" className="text-base px-8 border-white/20 text-white backdrop-blur-sm bg-white/5 no-default-hover-elevate no-default-active-elevate" data-testid="button-cta-signin">
                      Sign In to Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 63%)" }}>
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold">Gardeo</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered workforce management built for the UK security industry.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Platform</h4>
              <ul className="space-y-2">
                <li><a href="#ai" className="text-sm text-muted-foreground">AI Features</a></li>
                <li><a href="#features" className="text-sm text-muted-foreground">All Features</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Compliance</h4>
              <ul className="space-y-2">
                <li><span className="text-sm text-muted-foreground">HMRC VAT Compliant</span></li>
                <li><span className="text-sm text-muted-foreground">SIA Approved Contractor</span></li>
                <li><span className="text-sm text-muted-foreground">GDPR Compliant</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Account</h4>
              <ul className="space-y-2">
                <li><Link href="/login" className="text-sm text-muted-foreground">Sign In</Link></li>
                <li><Link href="/get-started" className="text-sm text-muted-foreground">Create Account</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground" data-testid="text-copyright">2026 Gardeo. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Privacy Policy</span>
              <span className="text-xs text-muted-foreground">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
