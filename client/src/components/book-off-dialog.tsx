import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { LogOut, Loader2 } from "lucide-react";

type BookOffDialogProps = {
  open: boolean;
  onClose: () => void;
  shiftTitle: string;
  isPending: boolean;
  onConfirm: (handoverNotes: string) => void;
};

export function BookOffDialog({ open, onClose, shiftTitle, isPending, onConfirm }: BookOffDialogProps) {
  const [handoverNotes, setHandoverNotes] = useState("");

  const handleSubmit = () => {
    onConfirm(handoverNotes);
    setHandoverNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-[#FF8C42]" />
            Book Off - End of Shift
          </DialogTitle>
          <DialogDescription>
            Check out of "{shiftTitle}". Your GPS location will be recorded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Handover Notes</label>
            <Textarea
              placeholder="Any incidents, handover information, or notes for the next officer..."
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              className="text-sm min-h-[100px]"
              data-testid="input-handover-notes"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required - please note any incidents, handover details, or observations.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-book-off">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!handoverNotes.trim() || isPending}
            className="bg-[#FF8C42] hover:bg-[#e67a30]"
            data-testid="button-confirm-book-off"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Getting location...</>
            ) : (
              "Confirm Book Off"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
