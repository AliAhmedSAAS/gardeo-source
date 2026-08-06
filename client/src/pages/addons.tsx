import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Brain, Radio, Zap, MessageSquare, BarChart3, Loader2, Crown, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Addon {
  key: string;
  name: string;
  description: string;
  features: string[];
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  purchased: boolean;
  status: string;
  freeActivation?: boolean;
}

const featureIcons: Record<string, any> = {
  "AI Situational Awareness Dashboard": Brain,
  "Smart Alert & Auto-Triage System": Zap,
  "One-Click AI Quick Actions (Quick Fill, Auto-Reassign, Predict & Prevent)": Radio,
  "AI Chat Panel for workforce queries": MessageSquare,
  "AI-Generated KPI Commentary & Insights": BarChart3,
};

export default function AddOnsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const searchParams = new URLSearchParams(window.location.search);
  const successParam = searchParams.get("success");
  const addonParam = searchParams.get("addon");
  const sessionIdParam = searchParams.get("session_id");
  const cancelledParam = searchParams.get("cancelled");

  const { data: addons, isLoading, refetch } = useQuery<Addon[]>({
    queryKey: ["/api/addons/available"],
  });

  const activateMutation = useMutation({
    mutationFn: async ({ addonKey, sessionId }: { addonKey: string; sessionId?: string }) => {
      const res = await apiRequest("POST", "/api/addons/activate", { addonKey, sessionId });
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (successParam === "true" && addonParam) {
      activateMutation.mutate({ addonKey: addonParam, sessionId: sessionIdParam || undefined }, {
        onSuccess: () => {
          toast({ title: "Add-on purchased!", description: "Your add-on has been activated successfully." });
        },
        onError: () => {
          toast({ title: "Activation pending", description: "Payment received. Activation may take a moment.", variant: "destructive" });
        },
      });
      window.history.replaceState({}, "", "/addons");
    }
    if (cancelledParam === "true") {
      toast({ title: "Checkout cancelled", description: "No charges were made.", variant: "destructive" });
      window.history.replaceState({}, "", "/addons");
    }
  }, []);

  const checkoutMutation = useMutation({
    mutationFn: async ({ addonKey, billingPeriod: bp }: { addonKey: string; billingPeriod: string }) => {
      const res = await apiRequest("POST", "/api/addons/checkout", { addonKey, billingPeriod: bp });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const formatPrice = (amount: number) => {
    return `£${(amount / 100).toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-[#FF8C42]" />
          <h1 className="text-3xl font-bold text-[#1F3A5F]" data-testid="text-addons-title">Premium Add-Ons</h1>
        </div>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Unlock advanced AI-powered features to supercharge your workforce management.
          Each add-on integrates seamlessly with your existing Gardeo platform.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 bg-gray-50 rounded-xl p-2 w-fit mx-auto">
        <button
          onClick={() => setBillingPeriod("monthly")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billingPeriod === "monthly" ? "bg-white shadow-sm text-[#1F3A5F]" : "text-gray-500 hover:text-gray-700"}`}
          data-testid="button-monthly-billing"
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingPeriod("yearly")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billingPeriod === "yearly" ? "bg-white shadow-sm text-[#1F3A5F]" : "text-gray-500 hover:text-gray-700"}`}
          data-testid="button-yearly-billing"
        >
          Yearly
          <Badge className="ml-2 bg-green-100 text-green-700 hover:bg-green-100">Save 20%</Badge>
        </button>
      </div>

      <div className="grid gap-8">
        {addons?.map((addon) => (
          <Card key={addon.key} className="overflow-hidden border-2 border-gray-100 hover:border-[#FF8C42]/30 transition-all" data-testid={`card-addon-${addon.key}`}>
            <div className="grid md:grid-cols-3">
              <div className="md:col-span-2 p-6 space-y-4">
                <CardHeader className="p-0">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-[#1F3A5F]" data-testid={`text-addon-name-${addon.key}`}>{addon.name}</CardTitle>
                      <CardDescription>{addon.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid sm:grid-cols-2 gap-3 mt-4">
                    {addon.features.map((feature, idx) => {
                      const FeatureIcon = featureIcons[feature] || Check;
                      return (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <div className="h-5 w-5 rounded-full bg-[#FF8C42]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FeatureIcon className="h-3 w-3 text-[#FF8C42]" />
                          </div>
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-[#1F3A5F] to-[#162d4a] p-6 flex flex-col items-center justify-center text-white text-center space-y-4">
                {addon.purchased ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Crown className="h-8 w-8 text-green-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-400" data-testid={`status-addon-${addon.key}`}>Active</p>
                      <p className="text-sm text-gray-300">Currently enabled</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                      onClick={() => navigate(addon.key === "fm_services" ? "/fm-dashboard" : "/control-room")}
                      data-testid={`button-goto-${addon.key}`}
                    >
                      {addon.key === "fm_services" ? "Open FM Dashboard" : "Go to Control Room"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                ) : addon.freeActivation ? (
                  <>
                    <div>
                      <div className="text-4xl font-bold" data-testid={`text-price-${addon.key}`}>Free</div>
                      <p className="text-sm text-gray-300">Included with your plan</p>
                    </div>
                    <Button
                      size="lg"
                      className="bg-[#FF8C42] hover:bg-[#e67a35] text-white w-full"
                      onClick={() => activateMutation.mutate({ addonKey: addon.key }, {
                        onSuccess: () => toast({ title: "Add-on activated", description: `${addon.name} is now active for your organisation.` }),
                        onError: (e: any) => toast({ title: "Activation failed", description: e.message, variant: "destructive" }),
                      })}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-${addon.key}`}
                    >
                      {activateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Activate
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-4xl font-bold" data-testid={`text-price-${addon.key}`}>
                        {billingPeriod === "monthly"
                          ? formatPrice(addon.monthlyPrice)
                          : formatPrice(addon.yearlyPrice)}
                      </div>
                      <p className="text-sm text-gray-300">
                        per {billingPeriod === "monthly" ? "month" : "year"}
                      </p>
                      {billingPeriod === "yearly" && (
                        <p className="text-xs text-green-400 mt-1">
                          {formatPrice(addon.yearlyPrice / 12)}/mo (save {formatPrice(addon.monthlyPrice * 12 - addon.yearlyPrice)}/yr)
                        </p>
                      )}
                    </div>
                    <Button
                      size="lg"
                      className="bg-[#FF8C42] hover:bg-[#e67a35] text-white w-full"
                      onClick={() => checkoutMutation.mutate({ addonKey: addon.key, billingPeriod })}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-purchase-${addon.key}`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Subscribe Now
                    </Button>
                    <p className="text-xs text-gray-400">Cancel anytime. No lock-in.</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(!addons || addons.length === 0) && (
        <div className="text-center text-gray-500 py-12">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No add-ons available at this time.</p>
          <p className="text-sm mt-2">Check back soon for new premium features.</p>
        </div>
      )}
    </div>
  );
}
