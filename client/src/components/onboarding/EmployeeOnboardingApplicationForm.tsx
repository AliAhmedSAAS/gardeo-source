import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, XCircle } from "lucide-react";
import { VettingApplicationForm } from "@/pages/public-vetting-form";

export function EmployeeOnboardingApplicationForm({
  tokenEndpoint,
  embedded = true,
}: {
  tokenEndpoint: string;
  embedded?: boolean;
}) {
  const { data, isLoading, error } = useQuery<{ token: string }>({
    queryKey: [tokenEndpoint],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="onboarding-application-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.token) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-2">
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold">Unable to open application form</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Try again after adding an email on the officer profile."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <VettingApplicationForm token={data.token} embedded={embedded} />;
}
