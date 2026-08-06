import { useLocation, Link } from "wouter";
import { Home, Clock, CreditCard, Menu, X, FileText, User, Banknote, MessageSquare, ClipboardList, ShieldCheck, Briefcase, Wrench } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

const officerMainTabs = [
  { label: "Home", icon: Home, path: "/officer" },
  { label: "Shifts", icon: Clock, path: "/my-shifts" },
  { label: "ID Card", icon: CreditCard, path: "/officer/id" },
  { label: "More", icon: Menu, path: "__more__" },
];

const fmWorkerMainTabs = [
  { label: "My Jobs", icon: Wrench, path: "/fm-worker" },
  { label: "Profile", icon: User, path: "/my-profile" },
  { label: "More", icon: Menu, path: "__more__" },
];

const fmWorkerMoreTabs = [
  { label: "Messages", icon: MessageSquare, path: "/communications" },
  { label: "Profile", icon: User, path: "/my-profile" },
];

const moreTabs = [
  { label: "Documents", icon: FileText, path: "/my-documents" },
  { label: "Compliance", icon: ShieldCheck, path: "/my-compliance" },
  { label: "My Pay", icon: Banknote, path: "/my-pay" },
  { label: "Profile", icon: User, path: "/my-profile" },
  { label: "History", icon: Briefcase, path: "/my-employment-history" },
  { label: "Messages", icon: MessageSquare, path: "/communications" },
  { label: "Onboarding", icon: ClipboardList, path: "/onboarding" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const { data: fmAddon } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/fm_services"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: fmWorker } = useQuery<any>({
    queryKey: ["/api/fm/me"],
    enabled: !!user && fmAddon?.active === true,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isFmWorker = !!fmWorker?.id;
  const showNav = !!user && (user.role === "employee" || isFmWorker);
  if (!showNav) return null;

  const mainTabs = isFmWorker ? fmWorkerMainTabs : officerMainTabs;
  const moreList = isFmWorker ? fmWorkerMoreTabs : moreTabs;

  const isActive = (path: string) => {
    if (path === "/officer") return location === "/officer" || location === "/" || location === "/dashboard";
    if (path === "/fm-worker") return location === "/fm-worker" || location === "/" || location === "/dashboard" || location.startsWith("/fm-worker/");
    return location === path || location.startsWith(path + "/");
  };

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-16 left-0 right-0 bg-background border-t rounded-t-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="mobile-more-menu"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">More</span>
              <button onClick={() => setShowMore(false)} data-testid="button-close-more">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreList.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.path);
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                      active ? "bg-[#1F3A5F] text-white" : "hover:bg-muted"
                    }`}
                    data-testid={`nav-more-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t md:hidden safe-area-bottom"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-stretch">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isMoreTab = tab.path === "__more__";
            const active = isMoreTab ? showMore : isActive(tab.path);

            if (isMoreTab) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                    active ? "text-[#FF8C42]" : "text-muted-foreground"
                  }`}
                  data-testid="nav-tab-more"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? "text-[#FF8C42]" : "text-muted-foreground"
                }`}
                data-testid={`nav-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
