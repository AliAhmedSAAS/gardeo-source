import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, MapPin, LogIn, LogOut, Loader2, ShieldCheck,
  FileText, AlertTriangle, Calendar, ChevronRight, Bell,
  CheckCircle2, MessageSquare, Briefcase, User, PhoneCall,
} from "lucide-react";
import { OpsCheckDialog } from "@/components/ops-check-dialog";
import { BookOffDialog } from "@/components/book-off-dialog";

type ShiftData = {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  siteName?: string;
  siteAddress?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

type DocumentData = {
  id: number;
  documentType: string;
  fileName: string;
  expiryDate: string | null;
  isVerified: boolean;
};

type NotificationData = {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  message?: string;
  isRead?: boolean;
  readAt?: string | null;
  createdAt: string;
};

function getGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error("Location permission denied. Please enable GPS."));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Location unavailable. Please enable GPS."));
            break;
          default:
            reject(new Error("Unable to get location. Please try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type CheckCallDue = {
  id: number;
  shiftId: number;
  dueAt: string;
  siteName: string;
  canTake?: boolean;
};

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDateKey(date: string) {
  return String(date).slice(0, 10);
}

function isOnDutyStatus(status: string) {
  return status === "in_progress" || status === "booked_on";
}

export default function OfficerHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [opsCheckShift, setOpsCheckShift] = useState<ShiftData | null>(null);
  const [bookOffShift, setBookOffShift] = useState<ShiftData | null>(null);

  const today = localToday();

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<ShiftData[]>({
    queryKey: ["/api/my-shifts"],
  });

  const { data: dueCheckCalls = [] } = useQuery<CheckCallDue[]>({
    queryKey: ["/api/my-shifts/check-calls"],
    refetchInterval: 30000,
  });

  const { data: documents = [] } = useQuery<DocumentData[]>({
    queryKey: ["/api/documents"],
  });

  const { data: notifications = [] } = useQuery<NotificationData[]>({
    queryKey: ["/api/notifications"],
  });

  const todayShifts = shifts.filter((s) => shiftDateKey(s.date) === today);
  const upcomingShifts = shifts
    .filter((s) => shiftDateKey(s.date) > today && s.status !== "completed" && s.status !== "cancelled")
    .sort((a, b) => shiftDateKey(a.date).localeCompare(shiftDateKey(b.date)) || a.startTime.localeCompare(b.startTime))
    .slice(0, 3);

  const activeShift = todayShifts.find((s) => isOnDutyStatus(s.status));
  const nextScheduledShift =
    todayShifts.find((s) => s.status === "scheduled") ||
    upcomingShifts.find((s) => s.status === "scheduled") ||
    null;
  const nextShiftIsToday = nextScheduledShift ? shiftDateKey(nextScheduledShift.date) === today : false;

  const expiringDocs = documents.filter((doc) => {
    const days = getDaysUntilExpiry(doc.expiryDate);
    return days !== null && days <= 30;
  });

  const unreadNotifications = notifications.filter((n) => !n.readAt && !n.isRead);

  const performCheckin = useCallback(async (shiftId: number) => {
    setGpsLoading(true);
    try {
      const coords = await getGeolocation();
      const res = await apiRequest("POST", `/api/my-shifts/${shiftId}/checkin`, coords);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts/check-calls"] });
      if (data.withinRange === false) {
        toast({
          title: "Booked on - Outside geofence",
          description: `${Math.round(data.distanceFromSite)}m from site (limit: ${data.geofenceRadius}m). Flagged.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Booked on", description: "You have been checked in to your shift." });
      }
    } catch (err: any) {
      toast({ title: "Book on failed", description: err.message, variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  }, [toast]);

  const performCheckout = useCallback(async (shiftId: number, handoverNotes: string) => {
    setGpsLoading(true);
    try {
      const coords = await getGeolocation();
      const res = await apiRequest("POST", `/api/my-shifts/${shiftId}/checkout`, {
        ...coords,
        handoverNotes,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts/check-calls"] });
      setBookOffShift(null);
      if (data.withinRange === false) {
        toast({
          title: "Booked off - Outside geofence",
          description: `${Math.round(data.distanceFromSite)}m from site. Flagged.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Booked off", description: "Shift completed. Have a safe journey home." });
      }
    } catch (err: any) {
      toast({ title: "Book off failed", description: err.message, variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  }, [toast]);

  const handleBookOn = (shift: ShiftData) => {
    setOpsCheckShift(shift);
  };

  const handleOpsCheckComplete = () => {
    if (opsCheckShift) {
      const shiftId = opsCheckShift.id;
      setOpsCheckShift(null);
      performCheckin(shiftId);
    }
  };

  const handleBookOff = (shift: ShiftData) => {
    setBookOffShift(shift);
  };

  const nextDueCheckCall = dueCheckCalls.find((c) => c.canTake !== false) || dueCheckCalls[0] || null;
  const canTakeCheckCall = Boolean(nextDueCheckCall && nextDueCheckCall.canTake !== false);

  const takeCheckCall = async () => {
    if (!nextDueCheckCall || !canTakeCheckCall) return;
    setGpsLoading(true);
    try {
      const coords = await getGeolocation();
      const res = await apiRequest(
        "POST",
        `/api/my-shifts/${nextDueCheckCall.shiftId}/check-calls/${nextDueCheckCall.id}/take`,
        coords,
      );
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts/check-calls"] });
      if (data.withinRange === false) {
        toast({
          title: "Check-call taken — outside geofence",
          description: `${Math.round(data.distanceFromSite)}m from site (limit: ${data.geofenceRadius}m). Flagged.`,
          variant: "destructive",
        });
      } else {
        const dist = data.distanceFromSite != null ? ` (${Math.round(data.distanceFromSite)}m from site)` : "";
        toast({ title: "Check-call taken", description: `Location recorded.${dist}` });
      }
    } catch (err: any) {
      toast({ title: "Check-call failed", description: err.message, variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <div className="p-4 pb-20 space-y-5 max-w-lg mx-auto" data-testid="officer-home-page">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-foreground" data-testid="text-greeting">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {activeShift && (
        <Card className="border-[#FF8C42] bg-gradient-to-r from-[#FF8C42]/5 to-transparent" data-testid="card-active-shift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-[#FF8C42] text-white border-[#FF8C42]">
                <Clock className="w-3 h-3 mr-1" /> On Duty
              </Badge>
            </div>
            <h3 className="font-semibold text-sm" data-testid="text-active-shift-title">{activeShift.title}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              {activeShift.startTime} - {activeShift.endTime}
              {activeShift.checkInTime && (
                <span className="ml-2 text-green-600">Booked on: {formatTime(activeShift.checkInTime)}</span>
              )}
            </div>
            {activeShift.siteName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3" /> {activeShift.siteName}
              </div>
            )}
            {nextDueCheckCall && (
              <Button
                className="mt-3 w-full bg-[#1F3A5F] hover:bg-[#1F3A5F]/90 text-white min-h-[44px]"
                onClick={takeCheckCall}
                disabled={gpsLoading || !canTakeCheckCall}
                data-testid="button-take-check-call"
              >
                {gpsLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PhoneCall className="w-4 h-4 mr-1" />}
                {canTakeCheckCall ? "Take Check-call (GPS)" : "Next Check-call"}
                <span className="ml-2 text-xs font-normal opacity-80">
                  due {new Date(nextDueCheckCall.dueAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Button>
            )}
            <Button
              className="mt-3 w-full bg-[#FF8C42] hover:bg-[#e67a30] text-white min-h-[44px]"
              onClick={() => handleBookOff(activeShift)}
              disabled={gpsLoading}
              data-testid="button-book-off"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
              Book Off
            </Button>
          </CardContent>
        </Card>
      )}

      {!activeShift && nextScheduledShift && (
        <Card className="border-[#1F3A5F]/30" data-testid="card-next-shift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-[#1F3A5F] text-white border-[#1F3A5F]">
                <Calendar className="w-3 h-3 mr-1" /> Next Shift
              </Badge>
            </div>
            <h3 className="font-semibold text-sm" data-testid="text-next-shift-title">{nextScheduledShift.title}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              {nextScheduledShift.startTime} - {nextScheduledShift.endTime}
            </div>
            {nextScheduledShift.siteName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3" /> {nextScheduledShift.siteName}
              </div>
            )}
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 space-y-2">
              <p className="text-xs font-medium text-green-800 dark:text-green-300">GPS Book On</p>
              <p className="text-[11px] text-muted-foreground">
                {nextShiftIsToday
                  ? "You must be at the site to book on. GPS is checked against the site location."
                  : `Book on opens on ${new Date(nextScheduledShift.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} from 10 minutes before ${nextScheduledShift.startTime}. You must be at the site.`}
              </p>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
                onClick={() => handleBookOn(nextScheduledShift)}
                disabled={gpsLoading || !nextShiftIsToday}
                data-testid="button-book-on"
              >
                {gpsLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogIn className="w-4 h-4 mr-1" />}
                Book On with GPS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeShift && !nextScheduledShift && todayShifts.length === 0 && (
        <Card data-testid="card-no-shifts">
          <CardContent className="p-6 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No shifts today</p>
            <p className="text-xs text-muted-foreground mt-1">Check upcoming shifts below</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3" data-testid="quick-actions">
        <Link href="/my-shifts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1F3A5F]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#1F3A5F]" />
              </div>
              <div>
                <p className="text-xs font-semibold">My Shifts</p>
                <p className="text-[10px] text-muted-foreground">{shifts.length} total</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-documents">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1F3A5F]/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#1F3A5F]" />
              </div>
              <div>
                <p className="text-xs font-semibold">Documents</p>
                <p className="text-[10px] text-muted-foreground">{documents.length} uploaded</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/communications">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FF8C42]/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#FF8C42]" />
              </div>
              <div>
                <p className="text-xs font-semibold">Messages</p>
                <p className="text-[10px] text-muted-foreground">
                  {unreadNotifications.length > 0 ? `${unreadNotifications.length} unread` : "All read"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-pay">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <span className="text-green-600 font-bold text-sm">&pound;</span>
              </div>
              <div>
                <p className="text-xs font-semibold">My Pay</p>
                <p className="text-[10px] text-muted-foreground">View payslips</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-compliance">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">Compliance</p>
                <p className="text-[10px] text-muted-foreground">SIA, DBS & more</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-employment-history">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">History</p>
                <p className="text-[10px] text-muted-foreground">Employment</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-profile">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" data-testid="card-quick-profile">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <User className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">My Profile</p>
                <p className="text-[10px] text-muted-foreground">Personal info</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {expiringDocs.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700" data-testid="card-compliance-alerts">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Compliance Alert</span>
            </div>
            <div className="space-y-2">
              {expiringDocs.map((doc) => {
                const days = getDaysUntilExpiry(doc.expiryDate)!;
                return (
                  <div key={doc.id} className="flex items-center justify-between text-xs" data-testid={`alert-doc-${doc.id}`}>
                    <span className="capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                    <Badge
                      variant={days < 0 ? "destructive" : "default"}
                      className={days >= 0 ? "bg-orange-500 border-orange-500" : ""}
                    >
                      {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <Link href="/my-documents">
              <Button variant="outline" size="sm" className="mt-3 w-full text-orange-600 border-orange-300" data-testid="button-view-documents">
                View Documents <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {upcomingShifts.length > 0 && (
        <div data-testid="upcoming-shifts-section">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Upcoming Shifts</h2>
            <Link href="/my-shifts" className="text-xs text-[#FF8C42] font-medium" data-testid="link-view-all-shifts">
              View all <ChevronRight className="w-3 h-3 inline" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingShifts.map((shift) => (
              <Card key={shift.id} data-testid={`card-upcoming-shift-${shift.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{shift.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(shift.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {shift.startTime} - {shift.endTime}
                        </span>
                      </div>
                      {shift.siteName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" /> {shift.siteName}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {unreadNotifications.length > 0 && (
        <div data-testid="notifications-section">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="w-4 h-4" /> Notifications
            </h2>
            <Badge variant="secondary" className="text-xs">{unreadNotifications.length}</Badge>
          </div>
          <div className="space-y-2">
            {unreadNotifications.slice(0, 3).map((n) => (
              <Card key={n.id} data-testid={`card-notification-${n.id}`}>
                <CardContent className="p-3">
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body || n.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {opsCheckShift && (
        <OpsCheckDialog
          open={!!opsCheckShift}
          onClose={() => setOpsCheckShift(null)}
          shiftId={opsCheckShift.id}
          shiftTitle={opsCheckShift.title}
          onComplete={handleOpsCheckComplete}
        />
      )}

      {bookOffShift && (
        <BookOffDialog
          open={!!bookOffShift}
          onClose={() => setBookOffShift(null)}
          shiftTitle={bookOffShift.title}
          isPending={gpsLoading}
          onConfirm={(notes) => performCheckout(bookOffShift.id, notes)}
        />
      )}
    </div>
  );
}
