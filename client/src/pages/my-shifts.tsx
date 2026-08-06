import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Calendar, Clock, MapPin, CalendarCheck, CalendarX, LogIn, LogOut, Loader2, Navigation, ChevronLeft, ChevronRight, List,
  CheckCircle2, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useCallback, useEffect } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { OpsCheckDialog } from "@/components/ops-check-dialog";
import { BookOffDialog } from "@/components/book-off-dialog";

type AvailabilityEntry = {
  id?: number;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ShiftData = {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";
  siteName?: string;
  siteAddress?: string;
  notes?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInDistanceMetres?: string | null;
  checkOutDistanceMetres?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-600",
  cancelled: "bg-gray-400",
  no_show: "bg-red-500",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  scheduled: "text-blue-700 dark:text-blue-300",
  in_progress: "text-orange-700 dark:text-orange-300",
  completed: "text-green-700 dark:text-green-300",
  cancelled: "text-gray-500",
  no_show: "text-red-700 dark:text-red-300",
};

function getShiftStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge variant="default" className="bg-blue-500 border-blue-500"><Clock className="w-3 h-3 mr-1" /> Scheduled</Badge>;
    case "in_progress":
      return <Badge variant="default" className="bg-orange-500 border-orange-500"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
    case "completed":
      return <Badge variant="default" className="bg-green-600 border-green-600"><CalendarCheck className="w-3 h-3 mr-1" /> Completed</Badge>;
    case "cancelled":
      return <Badge variant="secondary"><CalendarX className="w-3 h-3 mr-1" /> Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatTimestamp(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser. Please use a device with GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Location permission denied. Please enable location access in your browser settings to check in."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Location unavailable. Please ensure GPS is enabled on your device."));
            break;
          case error.TIMEOUT:
            reject(new Error("Location request timed out. Please try again."));
            break;
          default:
            reject(new Error("Unable to get your location. Please try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function WeeklyCalendarView({ shifts, today, gpsLoading, onCheckin, onCheckout }: {
  shifts: ShiftData[];
  today: string;
  gpsLoading: number | null;
  onCheckin: (id: number) => void;
  onCheckout: (id: number) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shiftsByDay: Record<string, ShiftData[]> = {};
  for (const shift of shifts) {
    if (!shiftsByDay[shift.date]) shiftsByDay[shift.date] = [];
    shiftsByDay[shift.date].push(shift);
  }

  const weekLabel = `${days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4" data-testid="weekly-calendar-view">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="button-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium" data-testid="text-week-label">{weekLabel}</span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = formatDateKey(day);
          const isToday = key === today;
          const dayShifts = shiftsByDay[key] || [];
          return (
            <div
              key={key}
              className={`min-h-[80px] rounded-lg border p-1 flex flex-col gap-1 ${isToday ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              data-testid={`calendar-day-${key}`}
            >
              <div className={`text-xs font-semibold text-center ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {day.getDate()}
              </div>
              {dayShifts.map((shift) => {
                const colorClass = STATUS_COLORS[shift.status] || "bg-gray-400";
                const canCheckIn = shift.status === "scheduled" && key === today;
                const canCheckOut = shift.status === "in_progress";
                const isLoadingGps = gpsLoading === shift.id;
                return (
                  <div
                    key={shift.id}
                    className={`${colorClass} text-white rounded px-1 py-0.5 text-[10px] leading-tight cursor-default`}
                    title={`${shift.title} | ${shift.startTime}–${shift.endTime}${shift.siteName ? ` | ${shift.siteName}` : ""}`}
                    data-testid={`calendar-shift-${shift.id}`}
                  >
                    <div className="font-medium truncate">{shift.startTime}</div>
                    <div className="truncate opacity-90">{shift.title}</div>
                    {(canCheckIn || canCheckOut) && (
                      <button
                        className="mt-0.5 w-full bg-white/20 hover:bg-white/30 rounded text-[9px] font-medium py-0.5 transition-colors"
                        disabled={!!isLoadingGps}
                        data-testid={canCheckIn ? `button-cal-checkin-${shift.id}` : `button-cal-checkout-${shift.id}`}
                        onClick={() => {
                          if (canCheckIn) onCheckin(shift.id);
                          else onCheckout(shift.id);
                        }}
                      >
                        {isLoadingGps ? "..." : canCheckIn ? "Check In" : "Check Out"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${color} inline-block`} />
            <span className="capitalize">{status.replace(/_/g, " ")}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MyShiftsPage() {
  const { toast } = useToast();
  const [gpsLoading, setGpsLoading] = useState<number | null>(null);
  const [localAvailability, setLocalAvailability] = useState<Record<number, AvailabilityEntry>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: shifts = [], isLoading } = useQuery<ShiftData[]>({
    queryKey: ["/api/my-shifts"],
  });

  useEffect(() => {
    apiRequest("GET", "/api/employee/notifications/trigger").catch(() => {});
  }, []);

  const { data: serverAvailability = [], isLoading: availLoading } = useQuery<AvailabilityEntry[]>({
    queryKey: ["/api/my-availability"],
  });

  useEffect(() => {
    if (serverAvailability.length >= 0 && !availLoading) {
      const map: Record<number, AvailabilityEntry> = {};
      for (let d = 0; d < 7; d++) {
        const existing = serverAvailability.find((a: AvailabilityEntry) => a.dayOfWeek === d);
        map[d] = existing || { dayOfWeek: d, isAvailable: true, startTime: null, endTime: null };
      }
      setLocalAvailability(map);
      setHasChanges(false);
    }
  }, [serverAvailability, availLoading]);

  const saveAvailabilityMutation = useMutation({
    mutationFn: async (entries: AvailabilityEntry[]) => {
      for (const entry of entries) {
        await apiRequest("PUT", "/api/my-availability", entry);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-availability"] });
      setHasChanges(false);
      toast({ title: "Availability saved", description: "Your weekly availability preferences have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleAvailabilityChange = (dayOfWeek: number, field: keyof AvailabilityEntry, value: any) => {
    setLocalAvailability(prev => ({
      ...prev,
      [dayOfWeek]: { ...prev[dayOfWeek], dayOfWeek, [field]: value },
    }));
    setHasChanges(true);
  };

  const handleSaveAvailability = () => {
    const entries = Object.values(localAvailability);
    saveAvailabilityMutation.mutate(entries);
  };

  const [opsCheckShift, setOpsCheckShift] = useState<{ id: number; title: string } | null>(null);
  const [bookOffShift, setBookOffShift] = useState<{ id: number; title: string } | null>(null);

  const performCheckin = useCallback(async (shiftId: number) => {
    setGpsLoading(shiftId);
    try {
      const coords = await getGeolocation();
      const res = await apiRequest("POST", `/api/my-shifts/${shiftId}/checkin`, coords);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts"] });
      const distMsg = data.distanceFromSite != null ? ` (${Math.round(data.distanceFromSite)}m from site)` : "";
      if (data.withinRange === false) {
        toast({ title: "Checked in - Outside geofence", description: `You checked in ${Math.round(data.distanceFromSite)}m from the site (limit: ${data.geofenceRadius}m). This has been flagged.`, variant: "destructive" });
      } else {
        toast({ title: "Checked in", description: `You have been checked in to your shift.${distMsg}` });
      }
    } catch (err: any) {
      let msg = err.message || "Could not check in.";
      try {
        if (err.message && err.message.includes("{")) {
          const parsed = JSON.parse(err.message);
          msg = parsed.message || msg;
        }
      } catch {}
      toast({ title: "Check-in failed", description: msg, variant: "destructive" });
    } finally {
      setGpsLoading(null);
    }
  }, [toast]);

  const performCheckout = useCallback(async (shiftId: number) => {
    setGpsLoading(shiftId);
    try {
      const coords = await getGeolocation();
      const res = await apiRequest("POST", `/api/my-shifts/${shiftId}/checkout`, coords);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/my-shifts"] });
      const distMsg = data.distanceFromSite != null ? ` (${Math.round(data.distanceFromSite)}m from site)` : "";
      if (data.withinRange === false) {
        toast({ title: "Checked out - Outside geofence", description: `You checked out ${Math.round(data.distanceFromSite)}m from the site (limit: ${data.geofenceRadius}m). This has been flagged.`, variant: "destructive" });
      } else {
        toast({ title: "Checked out", description: `You have been checked out of your shift.${distMsg}` });
      }
    } catch (err: any) {
      let msg = err.message || "Could not check out.";
      try {
        if (err.message && err.message.includes("{")) {
          const parsed = JSON.parse(err.message);
          msg = parsed.message || msg;
        }
      } catch {}
      toast({ title: "Check-out failed", description: msg, variant: "destructive" });
    } finally {
      setGpsLoading(null);
    }
  }, [toast]);

  const today = formatDateKey(new Date());
  const upcoming = shifts.filter((s) => s.date >= today && s.status !== "completed" && s.status !== "cancelled");
  const past = shifts.filter((s) => s.date < today || s.status === "completed" || s.status === "cancelled");

  function renderShiftCard(shift: ShiftData, section: "upcoming" | "past") {
    const isToday = shift.date === today;
    const canCheckIn = shift.status === "scheduled" && isToday;
    const canCheckOut = shift.status === "in_progress";
    const isLoadingGps = gpsLoading === shift.id;
    const isUpcomingIn24h = section === "upcoming" && (() => {
      const shiftDt = new Date(shift.date);
      const [h, m] = (shift.startTime || "00:00").split(":").map(Number);
      shiftDt.setHours(h, m, 0, 0);
      return shiftDt.getTime() - Date.now() < 24 * 60 * 60 * 1000 && shiftDt > new Date();
    })();

    return (
      <Card key={shift.id} data-testid={`card-shift-${shift.id}`} className={isUpcomingIn24h ? "border-orange-300 dark:border-orange-700" : ""}>
        <CardContent className="p-3 sm:p-4">
          {isUpcomingIn24h && (
            <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Starting within 24 hours
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`font-medium truncate ${section === "past" ? "text-muted-foreground" : ""}`} data-testid={`text-shift-title-${shift.id}`}>{shift.title}</span>
                <div className="sm:hidden" data-testid={`badge-shift-status-mobile-${shift.id}`}>
                  {getShiftStatusBadge(shift.status)}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{new Date(shift.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {shift.startTime} - {shift.endTime}
                </span>
                {shift.siteName && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{shift.siteName}</span>
                  </span>
                )}
              </div>
              {(shift.checkInTime || shift.checkOutTime) && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                  {shift.checkInTime && (
                    <span className="flex items-center gap-1.5" data-testid={`text-checkin-time-${shift.id}`}>
                      <LogIn className="w-3 h-3 shrink-0" />
                      Checked in: {formatTimestamp(shift.checkInTime)}
                      {shift.checkInDistanceMetres && (
                        <span className="flex items-center gap-0.5 ml-1">
                          <Navigation className="w-3 h-3" />
                          {Math.round(parseFloat(shift.checkInDistanceMetres))}m
                        </span>
                      )}
                    </span>
                  )}
                  {shift.checkOutTime && (
                    <span className="flex items-center gap-1.5" data-testid={`text-checkout-time-${shift.id}`}>
                      <LogOut className="w-3 h-3 shrink-0" />
                      Checked out: {formatTimestamp(shift.checkOutTime)}
                      {shift.checkOutDistanceMetres && (
                        <span className="flex items-center gap-0.5 ml-1">
                          <Navigation className="w-3 h-3" />
                          {Math.round(parseFloat(shift.checkOutDistanceMetres))}m
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {canCheckIn && (
                <Button
                  className="bg-green-600 border-green-600 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                  disabled={isLoadingGps}
                  data-testid={`button-checkin-${shift.id}`}
                  onClick={() => setOpsCheckShift({ id: shift.id, title: shift.title })}
                >
                  {isLoadingGps ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogIn className="w-4 h-4 mr-1" />}
                  {isLoadingGps ? "Getting location..." : "Check In"}
                </Button>
              )}
              {canCheckOut && (
                <Button
                  className="bg-orange-600 border-orange-600 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                  disabled={isLoadingGps}
                  data-testid={`button-checkout-${shift.id}`}
                  onClick={() => setBookOffShift({ id: shift.id, title: shift.title })}
                >
                  {isLoadingGps ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
                  {isLoadingGps ? "Getting location..." : "Check Out"}
                </Button>
              )}
              <div className="hidden sm:block" data-testid={`badge-shift-status-${shift.id}`}>
                {getShiftStatusBadge(shift.status)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="my-shifts-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">My Shifts</h1>
        <p className="text-muted-foreground text-sm">View your upcoming and past shifts, and set your availability preferences.</p>
      </div>

      <Card data-testid="card-availability">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Weekly Availability Preferences
            </CardTitle>
            {hasChanges && (
              <Button size="sm" onClick={handleSaveAvailability} disabled={saveAvailabilityMutation.isPending} data-testid="button-save-availability">
                {saveAvailabilityMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Save Preferences
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Let your employer know when you're generally available. This helps with scheduling but doesn't guarantee shifts.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {availLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (
            [0, 1, 2, 3, 4, 5, 6].map(day => {
              const entry = localAvailability[day] || { dayOfWeek: day, isAvailable: true };
              return (
                <div key={day} className={`grid grid-cols-[120px_1fr] sm:grid-cols-[140px_auto_auto_1fr] gap-2 items-center p-2 rounded-lg border ${entry.isAvailable ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : "border-muted bg-muted/20"}`} data-testid={`availability-row-${day}`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAvailabilityChange(day, "isAvailable", !entry.isAvailable)}
                      className="flex-shrink-0"
                      data-testid={`toggle-avail-${day}`}
                    >
                      {entry.isAvailable
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <XCircle className="w-5 h-5 text-muted-foreground" />
                      }
                    </button>
                    <span className="text-sm font-medium">{DAY_NAMES[day].slice(0, 3)}</span>
                  </div>
                  {entry.isAvailable ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground w-10 flex-shrink-0">From</Label>
                        <Input
                          type="time"
                          value={entry.startTime || ""}
                          onChange={e => handleAvailabilityChange(day, "startTime", e.target.value || null)}
                          className="h-7 text-xs"
                          data-testid={`input-avail-start-${day}`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground w-10 flex-shrink-0">To</Label>
                        <Input
                          type="time"
                          value={entry.endTime || ""}
                          onChange={e => handleAvailabilityChange(day, "endTime", e.target.value || null)}
                          className="h-7 text-xs"
                          data-testid={`input-avail-end-${day}`}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground col-span-2 sm:col-span-3">Marked as unavailable</span>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : shifts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No shifts assigned</h3>
            <p className="text-sm text-muted-foreground">Your shifts will appear here once they are scheduled.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="list" data-testid="shifts-tabs">
          <TabsList className="mb-4" data-testid="tabs-list-shifts">
            <TabsTrigger value="list" data-testid="tab-list-view"><List className="w-4 h-4 mr-1.5" />List</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar-view"><Calendar className="w-4 h-4 mr-1.5" />Weekly Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> Upcoming Shifts
                </h2>
                {upcoming.map((shift) => renderShiftCard(shift, "upcoming"))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5" /> Past Shifts
                </h2>
                {past.map((shift) => renderShiftCard(shift, "past"))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <WeeklyCalendarView
              shifts={shifts}
              today={today}
              gpsLoading={gpsLoading}
              onCheckin={(id: number) => {
                const s = shifts.find(x => x.id === id);
                if (s) setOpsCheckShift({ id: s.id, title: s.title });
              }}
              onCheckout={(id: number) => {
                const s = shifts.find(x => x.id === id);
                if (s) setBookOffShift({ id: s.id, title: s.title });
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      {opsCheckShift && (
        <OpsCheckDialog
          open={!!opsCheckShift}
          onClose={() => setOpsCheckShift(null)}
          shiftId={opsCheckShift.id}
          shiftTitle={opsCheckShift.title}
          onComplete={() => {
            setOpsCheckShift(null);
            performCheckin(opsCheckShift.id);
          }}
        />
      )}

      {bookOffShift && (
        <BookOffDialog
          open={!!bookOffShift}
          onClose={() => setBookOffShift(null)}
          shiftTitle={bookOffShift.title}
          isPending={gpsLoading === bookOffShift.id}
          onConfirm={async (handoverNotes: string) => {
            const shiftId = bookOffShift.id;
            setBookOffShift(null);
            setGpsLoading(shiftId);
            try {
              const coords = await getGeolocation();
              const res = await apiRequest("POST", `/api/my-shifts/${shiftId}/checkout`, { ...coords, handoverNotes });
              const data = await res.json();
              queryClient.invalidateQueries({ queryKey: ["/api/my-shifts"] });
              const distMsg = data.distanceFromSite != null ? ` (${Math.round(data.distanceFromSite)}m from site)` : "";
              if (data.withinRange === false) {
                toast({ title: "Checked out - Outside geofence", description: `You checked out ${Math.round(data.distanceFromSite)}m from the site (limit: ${data.geofenceRadius}m). This has been flagged.`, variant: "destructive" });
              } else {
                toast({ title: "Checked out", description: `You have been checked out of your shift.${distMsg}` });
              }
            } catch (err: any) {
              let msg = err.message || "Could not check out.";
              try {
                if (err.message && err.message.includes("{")) {
                  const parsed = JSON.parse(err.message);
                  msg = parsed.message || msg;
                }
              } catch {}
              toast({ title: "Check-out failed", description: msg, variant: "destructive" });
            } finally {
              setGpsLoading(null);
            }
          }}
        />
      )}
    </div>
  );
}
