import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 bg-[#1F3A5F] text-white rounded-xl p-4 shadow-2xl flex items-center gap-3 md:hidden"
      data-testid="pwa-install-prompt"
    >
      <Download className="w-6 h-6 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install Gardeo</p>
        <p className="text-xs text-white/70">Add to your home screen for quick access</p>
      </div>
      <Button
        size="sm"
        className="bg-[#FF8C42] hover:bg-[#e67a30] text-white border-0 shrink-0"
        onClick={handleInstall}
        data-testid="button-install-pwa"
      >
        Install
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 shrink-0"
        data-testid="button-dismiss-pwa"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
