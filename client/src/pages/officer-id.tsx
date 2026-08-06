import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ShieldCheck, User, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Employee } from "@shared/schema";

export default function OfficerIdPage() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery<Employee>({
    queryKey: ["/api/employee/profile"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 max-w-lg mx-auto" data-testid="officer-id-page">
      <h1 className="text-xl font-bold mb-4">Virtual ID Card</h1>

      <Card className="overflow-hidden" data-testid="card-virtual-id">
        <div className="bg-gradient-to-r from-[#1F3A5F] to-[#2a5a8f] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              <span className="font-bold text-lg">GARDEO</span>
            </div>
            <Badge className="bg-white/20 text-white border-white/30">Security Officer</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-bold" data-testid="text-id-name">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-white/70" data-testid="text-id-number">
                {profile?.employeeNumber || "N/A"}
              </p>
            </div>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SIA Licence</p>
              <p className="text-sm font-medium" data-testid="text-id-sia">{profile?.siaLicenseNumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SIA Expiry</p>
              <p className="text-sm font-medium" data-testid="text-id-sia-expiry">
                {profile?.siaExpiryDate
                  ? new Date(profile.siaExpiryDate).toLocaleDateString("en-GB")
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">DBS Number</p>
              <p className="text-sm font-medium" data-testid="text-id-dbs">{profile?.dbsCertificateNumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Job Title</p>
              <p className="text-sm font-medium" data-testid="text-id-job-title">{profile?.jobTitle || "Security Officer"}</p>
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground text-center">
              This digital ID is for verification purposes only
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
