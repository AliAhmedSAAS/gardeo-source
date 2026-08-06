import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Building2, ArrowLeft } from "lucide-react";

interface TenantOption {
  tenantId: number;
  tenantName: string;
  userId: string;
}

export default function LoginPage() {
  const { login, selectTenant, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login({ username: form.username.trim(), password: form.password.trim() });
      if (result.requiresTenantSelection && result.tenants) {
        setTenantOptions(result.tenants);
      } else {
        setLocation("/");
      }
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    }
  };

  const handleTenantSelect = async (option: TenantOption) => {
    try {
      await selectTenant({ userId: option.userId, password: form.password.trim() });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Could not log in", variant: "destructive" });
    }
  };

  const handleBack = () => {
    setTenantOptions(null);
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-md bg-accent flex items-center justify-center">
              <Shield className="w-10 h-10 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-4">
            Gardeo
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            Enterprise-grade workforce scheduling, compliance, and operations management.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent-foreground" />
              </div>
            </div>
            {tenantOptions ? (
              <>
                <h2 className="text-2xl font-bold" data-testid="text-select-company-title">Select Company</h2>
                <p className="text-muted-foreground text-sm">Your account is linked to multiple companies. Choose which one to sign into.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold" data-testid="text-login-title">Sign In</h2>
                <p className="text-muted-foreground text-sm">Enter your credentials to access the platform</p>
              </>
            )}
          </CardHeader>
          <CardContent>
            {tenantOptions ? (
              <div className="space-y-3">
                {tenantOptions.map((option) => (
                  <Button
                    key={option.tenantId}
                    variant="outline"
                    className="w-full justify-start gap-3 h-14 text-left"
                    onClick={() => handleTenantSelect(option)}
                    disabled={isLoggingIn}
                    data-testid={`button-select-tenant-${option.tenantId}`}
                  >
                    <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{option.tenantName}</span>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={handleBack}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username or email</Label>
                    <Input
                      id="username"
                      data-testid="input-username"
                      autoComplete="username"
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="Enter your username or email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        data-testid="input-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Enter your password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-0 no-default-hover-elevate no-default-active-elevate"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoggingIn}
                    data-testid="button-login"
                  >
                    {isLoggingIn ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">Forgot your password? </span>
                  <Link href="/reset-password" className="text-accent font-medium" data-testid="link-reset-password">
                    Reset Password
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
