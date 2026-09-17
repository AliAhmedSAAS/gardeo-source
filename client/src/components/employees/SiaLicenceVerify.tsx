import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";

export type SiaVerifyResult = {
  valid: boolean;
  found: boolean;
  licenceNumber: string;
  status: string;
  holderName: string | null;
  licenceSector: string | null;
  licenceRole: string | null;
  expiryDate: string | null;
  checkedAt: string;
  message: string;
  nameMatch: boolean | null;
};

type SiaVerifyProps = {
  /** When set, verifies against employee record and can update it. */
  employeeId?: number;
  licenceNumber?: string | null;
  /** Optional name for register name-match when no employee yet. */
  employeeName?: string | null;
  lastVerifiedAt?: string | null;
  registerStatus?: string | null;
  registerHolderName?: string | null;
  /** Called with API result (useful on Add Employee before save). */
  onResult?: (result: SiaVerifyResult) => void;
  /** Compact stacked block (e.g. BS7858 row) */
  compact?: boolean;
  /** Button only, for placing next to an input */
  inline?: boolean;
};

export function SiaLicenceVerify({
  employeeId,
  licenceNumber,
  employeeName,
  lastVerifiedAt,
  registerStatus,
  registerHolderName,
  onResult,
  compact = false,
  inline = false,
}: SiaVerifyProps) {
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async (): Promise<SiaVerifyResult> => {
      if (employeeId) {
        const res = await apiRequest("POST", `/api/admin/employees/${employeeId}/sia/verify`, {
          licenceNumber: licenceNumber || undefined,
          updateEmployee: true,
        });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/sia/verify", {
        licenceNumber: licenceNumber || undefined,
        employeeName: employeeName || undefined,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees", employeeId, "bs7858"] });
      }
      onResult?.(result);
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
      {licenceNumber && (
        <a
          href="https://rolh.services.sia.homeoffice.gov.uk/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-600 hover:underline"
          data-testid="link-sia-register-manual"
        >
          Open official SIA register
        </a>
      )}
    </div>
  );
}

/** Status badge only — use under SIA fields when the button is inline */
export function SiaLicenceVerifyStatus({
  lastVerifiedAt,
  registerStatus,
  registerHolderName,
  currentFirstName,
  currentLastName,
  onApplyRegisterName,
}: {
  lastVerifiedAt?: string | null;
  registerStatus?: string | null;
  registerHolderName?: string | null;
  currentFirstName?: string | null;
  currentLastName?: string | null;
  /** Offer to copy register holder name into first/last name fields when they differ. */
  onApplyRegisterName?: (parts: { firstName: string; lastName: string }) => void;
}) {
  if (!lastVerifiedAt || !registerStatus) return null;
  const isActive = /active|valid|current|licensed/i.test(registerStatus);

  const namesMatch = (() => {
    if (!registerHolderName) return true;
    const emp = `${currentFirstName || ""} ${currentLastName || ""}`.toLowerCase().replace(/[^a-z]/g, "");
    const hold = registerHolderName.toLowerCase().replace(/[^a-z]/g, "");
    if (!emp || !hold) return true;
    return hold.includes(emp) || emp.includes(hold);
  })();

  const applyName = () => {
    if (!registerHolderName || !onApplyRegisterName) return;
    const parts = registerHolderName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;
    const toTitle = (s: string) =>
      s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    if (parts.length === 1) {
      onApplyRegisterName({ firstName: toTitle(parts[0]), lastName: "" });
      return;
    }
    onApplyRegisterName({
      firstName: toTitle(parts[0]),
      lastName: toTitle(parts.slice(1).join(" ")),
    });
  };

  return (
    <div className="flex flex-col gap-2 col-span-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
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
      {registerHolderName && onApplyRegisterName && !namesMatch && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <span>
            Register name does not match form name ({currentFirstName} {currentLastName}).
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={applyName}
            data-testid="button-apply-sia-register-name"
          >
            Update name from register
          </Button>
        </div>
      )}
    </div>
  );
}
