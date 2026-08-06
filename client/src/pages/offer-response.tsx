import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Briefcase, Building2, Calendar, DollarSign, ShieldCheck } from "lucide-react";

type OfferDetails = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  offerDate: string | null;
  offerSalary: string | null;
  offerStatus: string | null;
  offerRespondedAt: string | null;
  jobTitle: string | null;
  companyName: string;
};

export default function OfferResponsePage() {
  const [, params] = useRoute("/offer-response/:token");
  const token = params?.token ?? "";
  const [responded, setResponded] = useState<"accepted" | "declined" | null>(null);

  const { data: offer, isLoading, isError } = useQuery<OfferDetails>({
    queryKey: ["/api/offer-response", token],
    queryFn: async () => {
      const res = await fetch(`/api/offer-response/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load offer");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (response: "accepted" | "declined") => {
      const res = await fetch(`/api/offer-response/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to submit response");
      return response;
    },
    onSuccess: (response) => {
      setResponded(response);
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid link</h2>
            <p className="text-muted-foreground text-sm">This link is missing a required token. Please use the full link from your email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F3A5F]" />
      </div>
    );
  }

  if (isError || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Offer not found</h2>
            <p className="text-muted-foreground text-sm">This offer link is invalid or has expired. Please contact the recruiter for assistance.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyResponded = offer.offerStatus !== "pending" || responded !== null;
  const finalStatus = responded ?? offer.offerStatus;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[#1F3A5F] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1F3A5F]">{offer.companyName}</span>
        </div>

        <Card className="shadow-md border-0">
          <CardHeader className="bg-[#1F3A5F] rounded-t-lg px-6 py-5">
            <h1 className="text-white text-xl font-bold">Your Job Offer</h1>
            <p className="text-blue-200 text-sm mt-1">
              {offer.firstName} {offer.lastName} — please review and respond below
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Position</p>
                  <p className="font-semibold text-sm mt-0.5">{offer.jobTitle || "Position"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company</p>
                  <p className="font-semibold text-sm mt-0.5">{offer.companyName}</p>
                </div>
              </div>
              {offer.offerSalary && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Salary</p>
                    <p className="font-semibold text-sm mt-0.5">£{parseFloat(offer.offerSalary).toLocaleString()} / year</p>
                  </div>
                </div>
              )}
              {offer.offerDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Offer Date</p>
                    <p className="font-semibold text-sm mt-0.5">
                      {new Date(offer.offerDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              {alreadyResponded ? (
                <div className="text-center py-4 space-y-3">
                  {finalStatus === "accepted" ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" data-testid="icon-offer-accepted" />
                      <h3 className="text-lg font-bold text-green-700">Offer Accepted</h3>
                      <p className="text-muted-foreground text-sm">
                        Congratulations! You have accepted this offer. {offer.companyName} will be in touch with next steps.
                      </p>
                      <Badge className="bg-green-100 text-green-800 border-green-300">Accepted</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-14 h-14 text-red-500 mx-auto" data-testid="icon-offer-declined" />
                      <h3 className="text-lg font-bold text-red-700">Offer Declined</h3>
                      <p className="text-muted-foreground text-sm">
                        You have declined this offer. Thank you for your time. Please contact {offer.companyName} if you have any questions.
                      </p>
                      <Badge className="bg-red-100 text-red-800 border-red-300">Declined</Badge>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Please review your offer details above and indicate your decision below.
                  </p>
                  {respondMutation.isError && (
                    <p className="text-sm text-red-600 text-center">{(respondMutation.error as Error)?.message}</p>
                  )}
                  <div className="flex gap-3 justify-center">
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white px-8"
                      onClick={() => respondMutation.mutate("accepted")}
                      disabled={respondMutation.isPending}
                      data-testid="button-accept-offer-portal"
                    >
                      {respondMutation.isPending && respondMutation.variables === "accepted" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Accept Offer
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 px-8"
                      onClick={() => respondMutation.mutate("declined")}
                      disabled={respondMutation.isPending}
                      data-testid="button-decline-offer-portal"
                    >
                      {respondMutation.isPending && respondMutation.variables === "declined" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Secure offer portal powered by {offer.companyName}. If you have any questions, please contact your recruiter.
        </p>
      </div>
    </div>
  );
}
