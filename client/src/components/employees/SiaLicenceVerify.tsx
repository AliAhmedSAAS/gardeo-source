import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";

type SiaVerifyProps = {
  employeeId: number;
  licenceNumber?: string | null;
  lastVerifiedAt?: string | null;
  registerStatus?: string | null;
  registerHolderName?: string | null;
  /** Compact stacked block (e.g. BS7858 row) */
  compact?: boolean;
  /** Button only, for placing next to an input */
  inline?: boolean;
};

export function SiaLicenceVerify({
  employeeId,
  licenceNumber,
  lastVerifiedAt,
  registerStatus,
  registerHolderName,
  compact = false,
  inline = false,
}: SiaVerifyProps) {
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/employees/${employeeId}/sia/verify`, {
        licenceNumber: licenceNumber || undefined,
        updateEmployee: true,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "bs7858"] });
      toast({
        title: result.valid ? "SIA licence verified" : "SIA check failed",
        description: result.message,
        variant: result.valid ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "SIA check error", description: err.message, variant: "destructive" });
    },
  });

  const verifiedRecently = lastVerifiedAt && registerStatus;
  const isActive = registerStatus && /active|valid|current|licensed/i.test(registerStatus);

  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={inline ? "shrink-0 h-9" : undefined}
      disabled={verifyMutation.isPending || !licenceNumber}
      onClick={() => verifyMutation.mutate()}
      data-testid="button-verify-sia-licence"
    >
      {verifyMutation.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
      ) : (
        <Shield className="w-3.5 h-3.5 mr-1" />
      )}
      {verifiedRecently ? "Re-check SIA register" : "Verify SIA"}
    </Button>
  );

  if (inline) {
    return button;
  }

  return (
    <div className={compact ? "space-y-2" : "col-span-2 space-y-2 rounded-md border border-border/70 p-3 bg-muted/20"}>
      {!compact && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          SIA public register check
        </div>
      )}

      {verifiedRecently && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={isActive ? "default" : "destructive"} className="text-[10px]">
            {isActive ? (
              <><CheckCircle2 className="w-3 h-3 mr-1" /> Register verified</>
            ) : (
              <><XCircle className="w-3 h-3 mr-1" /> {registerStatus}</>
            )}
          </Badge>
          <span className="text-muted-foreground">
            {new Date(lastVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {registerHolderName && (
            <span className="text-muted-foreground">· {registerHolderName}</span>
          )}
        </div>
      )}

      {button}

      {!licenceNumber && (
        <p className="text-[11px] text-muted-foreground">Enter a 16-digit SIA licence number first.</p>
      )}
    </div>
  );
}

/** Status badge only — use under SIA fields when the button is inline */
export function SiaLicenceVerifyStatus({
  lastVerifiedAt,
  registerStatus,
  registerHolderName,
}: {
  lastVerifiedAt?: string | null;
  registerStatus?: string | null;
  registerHolderName?: string | null;
}) {
  if (!lastVerifiedAt || !registerStatus) return null;
  const isActive = /active|valid|current|licensed/i.test(registerStatus);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs col-span-2">
      <Badge variant={isActive ? "default" : "destructive"} className="text-[10px]">
        {isActive ? (
          <><CheckCircle2 className="w-3 h-3 mr-1" /> Register verified</>
        ) : (
          <><XCircle className="w-3 h-3 mr-1" /> {registerStatus}</>
        )}
      </Badge>
      <span className="text-muted-foreground">
        {new Date(lastVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </span>
      {registerHolderName && (
        <span className="text-muted-foreground">· {registerHolderName}</span>
      )}
    </div>
  );
}
