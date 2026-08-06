import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, Loader2, ShieldCheck } from "lucide-react";

type ChecklistItem = {
  id: number;
  label: string;
  description: string | null;
};

type OpsCheckDialogProps = {
  open: boolean;
  onClose: () => void;
  shiftId: number;
  shiftTitle: string;
  onComplete: () => void;
};

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: -1, label: "SIA Licence", description: "Valid SIA badge carried and visible" },
  { id: -2, label: "DBS Certificate", description: "DBS clearance is current" },
  { id: -3, label: "Uniform", description: "Full uniform worn and presentable" },
  { id: -4, label: "Equipment", description: "All required equipment available (radio, torch, etc.)" },
  { id: -5, label: "Welfare Check", description: "Fit and well for duty" },
];

export function OpsCheckDialog({ open, onClose, shiftId, shiftTitle, onComplete }: OpsCheckDialogProps) {
  const { toast } = useToast();
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState("");

  const { data: tenantItems } = useQuery<ChecklistItem[]>({
    queryKey: ["/api/ops-check-items"],
    enabled: open,
  });

  const items = tenantItems && tenantItems.length > 0 ? tenantItems : DEFAULT_ITEMS;
  const allChecked = items.every((item) => checkedItems[item.id]);
  const checkedCount = items.filter((item) => checkedItems[item.id]).length;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const checklist = items.map((item) => ({
        itemId: item.id,
        label: item.label,
        checked: !!checkedItems[item.id],
      }));
      await apiRequest("POST", `/api/ops-checks`, {
        shiftId,
        checklist,
        allPassed: allChecked,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops-checks"] });
      toast({ title: "Ops check complete", description: "Pre-shift checks passed. Proceeding to check in." });
      setCheckedItems({});
      setNotes("");
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleItem = (id: number) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1F3A5F]" />
            Pre-Shift Ops Check
          </DialogTitle>
          <DialogDescription>
            Complete all checks before booking on to "{shiftTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1" data-testid="ops-check-list">
          <div className="text-xs text-muted-foreground mb-2">
            {checkedCount} of {items.length} completed
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-3">
            <div
              className="bg-[#FF8C42] h-2 rounded-full transition-all"
              style={{ width: `${(checkedCount / items.length) * 100}%` }}
            />
          </div>
          {items.map((item) => {
            const checked = !!checkedItems[item.id];
            return (
              <button
                key={item.id}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                  checked
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "hover:bg-muted/50 border-border"
                }`}
                onClick={() => toggleItem(item.id)}
                data-testid={`ops-check-item-${item.id}`}
              >
                {checked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
            data-testid="input-ops-check-notes"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-ops-check">
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!allChecked || submitMutation.isPending}
            className="bg-[#1F3A5F] hover:bg-[#162d4a]"
            data-testid="button-submit-ops-check"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting...</>
            ) : (
              "Complete & Book On"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
