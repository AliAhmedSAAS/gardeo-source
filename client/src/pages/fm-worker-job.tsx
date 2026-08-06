import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Loader2, MapPin, Calendar, Clock, CheckCircle2, PlayCircle,
  Camera, X, AlertTriangle, FileText, PauseCircle,
} from "lucide-react";

type JobDetail = {
  id: number;
  job_number: string;
  title: string;
  description: string | null;
  job_type: string;
  service_line: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  estimated_hours: string | null;
  site_name: string | null;
  site_address: string | null;
  completion_notes: string | null;
  photo_urls: string[] | null;
  started_at: string | null;
  completed_at: string | null;
  assignment_id: number;
  check_in_at: string | null;
  check_out_at: string | null;
};

const statusColor: Record<string, string> = {
  raised: "bg-gray-500", assigned: "bg-blue-500", in_progress: "bg-[#FF8C42]",
  completed: "bg-green-600", signed_off: "bg-green-700", cancelled: "bg-gray-400", on_hold: "bg-yellow-500",
};

export default function FmWorkerJobPage() {
  const [, params] = useRoute<{ id: string }>("/fm-worker/jobs/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: job, isLoading } = useQuery<JobDetail>({
    queryKey: ["/api/fm/my-jobs", id],
    queryFn: async () => {
      const r = await fetch(`/api/fm/my-jobs/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message || "Not found");
      return r.json();
    },
    enabled: !!id,
  });

  // Sync notes/photos from the (possibly cached) job data so reopening a paused
  // job instantly restores the saved draft, even when React Query serves the
  // cached result without rerunning queryFn. A ref tracks the last server values
  // we synced so background refetches don't clobber the operative's in-progress edits.
  const syncedRef = useRef<{ id: number; notes: string; photos: string } | null>(null);
  useEffect(() => {
    if (!job) return;
    const serverNotes = job.completion_notes || "";
    const serverPhotos = job.photo_urls || [];
    const photosKey = JSON.stringify(serverPhotos);
    const prev = syncedRef.current;
    if (!prev || prev.id !== job.id || prev.notes !== serverNotes || prev.photos !== photosKey) {
      setNotes(serverNotes);
      setPendingPhotos(serverPhotos);
      syncedRef.current = { id: job.id, notes: serverNotes, photos: photosKey };
    }
  }, [job]);

  const [locating, setLocating] = useState(false);

  const update = useMutation({
    mutationFn: async (body: { status?: string; completionNotes?: string; photoUrls?: string[]; lat?: number; lng?: number }) => {
      const r = await apiRequest("PATCH", `/api/fm/my-jobs/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fm/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fm/my-jobs", id] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const getGeolocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error("Location permission denied. Please enable GPS and try again.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handleStart = async () => {
    setLocating(true);
    let coords: { lat: number; lng: number };
    try {
      coords = await getGeolocation();
    } catch (e: any) {
      setLocating(false);
      toast({ title: "Location needed", description: e.message, variant: "destructive" });
      return;
    }
    setLocating(false);
    const result = await update.mutateAsync({ status: "in_progress", lat: coords.lat, lng: coords.lng });
    if (result?.withinRange === false) {
      toast({
        title: "Started — but you're off-site",
        description: `You're ${Math.round(result.distanceFromSite)}m from the site (limit ${result.geofenceRadius}m). This has been flagged to your manager.`,
        variant: "destructive",
      });
    } else {
      toast({ title: "Job started", description: "Work in progress. Take photos as you go." });
    }
  };

  const handlePause = async () => {
    await update.mutateAsync({ status: "on_hold", completionNotes: notes, photoUrls: pendingPhotos });
    toast({ title: "Job paused" });
  };

  const handleComplete = async () => {
    if (!notes.trim()) {
      toast({ title: "Notes required", description: "Add a short completion note before finishing.", variant: "destructive" });
      return;
    }
    setLocating(true);
    let coords: { lat: number; lng: number };
    try {
      coords = await getGeolocation();
    } catch (e: any) {
      setLocating(false);
      toast({ title: "Location needed", description: e.message, variant: "destructive" });
      return;
    }
    setLocating(false);
    const result = await update.mutateAsync({ status: "completed", completionNotes: notes, photoUrls: pendingPhotos, lat: coords.lat, lng: coords.lng });
    if (result?.withinRange === false) {
      toast({
        title: "Completed — but you're off-site",
        description: `You're ${Math.round(result.distanceFromSite)}m from the site (limit ${result.geofenceRadius}m). This has been flagged to your manager.`,
        variant: "destructive",
      });
    } else {
      toast({ title: "Job completed", description: "Thanks — your manager has been notified." });
    }
  };

  const handleSaveProgress = async () => {
    await update.mutateAsync({ completionNotes: notes, photoUrls: pendingPhotos });
    toast({ title: "Saved" });
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (pendingPhotos.length + files.length > 12) {
      toast({ title: "Too many photos", description: "Maximum 12 photos per job.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const res = await fetch("/api/uploads/upload", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": file.name,
          },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploaded.push(data.objectPath);
      }
      setPendingPhotos(prev => [...prev, ...uploaded]);
      toast({ title: `${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} added` });
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (url: string) => {
    setPendingPhotos(prev => prev.filter(p => p !== url));
  };

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="fm-job-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  const isOpen = !["completed", "signed_off", "cancelled"].includes(job.status);
  const isInProgress = job.status === "in_progress";

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto" data-testid="fm-worker-job-page">
      <Link href="/fm-worker">
        <Button variant="ghost" size="sm" className="-ml-2" data-testid="link-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> My jobs
        </Button>
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge className={`${statusColor[job.status] || "bg-gray-400"} text-white capitalize`} data-testid="badge-status">
            {job.status.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">{job.priority}</Badge>
          <Badge variant="outline" className="capitalize">{job.service_line}</Badge>
        </div>
        <h1 className="text-lg font-bold" data-testid="text-job-title">{job.title}</h1>
        <p className="text-xs text-muted-foreground">{job.job_number} · {job.job_type.replace("_", " ")}</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          {job.site_name && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#1F3A5F] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium" data-testid="text-site-name">{job.site_name}</p>
                {job.site_address && <p className="text-xs text-muted-foreground">{job.site_address}</p>}
              </div>
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1F3A5F]" />
              <span>{new Date(job.scheduled_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
          )}
          {(job.scheduled_start_time || job.scheduled_end_time) && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1F3A5F]" />
              <span>
                {job.scheduled_start_time || "?"}{job.scheduled_end_time ? ` – ${job.scheduled_end_time}` : ""}
                {job.estimated_hours && <span className="text-muted-foreground"> · ~{job.estimated_hours}h</span>}
              </span>
            </div>
          )}
          {job.description && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                <FileText className="w-3 h-3" /> Brief
              </div>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-description">{job.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!isOpen && job.completed_at && (
        <Card className="border-green-300 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold text-sm">Completed</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(job.completed_at).toLocaleString("en-GB")}
            </p>
            {job.completion_notes && (
              <p className="text-sm mt-2 whitespace-pre-wrap" data-testid="text-completion-notes">{job.completion_notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isOpen && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label htmlFor="notes" className="text-sm">Completion notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was done, any issues, follow-up needed…"
                rows={4}
                className="mt-1"
                data-testid="input-notes"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Photos ({pendingPhotos.length}/12)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || pendingPhotos.length >= 12}
                  data-testid="button-add-photo"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
                  {uploading ? "" : "Add photo"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handlePhotoPick}
                  data-testid="input-photo-file"
                />
              </div>
              {pendingPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {pendingPhotos.map((url) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden border" data-testid={`photo-${url}`}>
                      <img src={url} alt="Job photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
                        data-testid={`button-remove-photo-${url}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No photos yet. Tap "Add photo" to capture work in progress and completion shots.</p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {!isInProgress && (
                <Button
                  className="w-full bg-[#1F3A5F] hover:bg-[#152a47] text-white min-h-[44px]"
                  onClick={handleStart}
                  disabled={update.isPending || locating}
                  data-testid="button-start"
                >
                  {update.isPending || locating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1" />}
                  {locating ? "Getting location…" : "Start work"}
                </Button>
              )}
              {isInProgress && (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white min-h-[48px]"
                    onClick={handleComplete}
                    disabled={update.isPending || locating}
                    data-testid="button-complete"
                  >
                    {update.isPending || locating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    {locating ? "Getting location…" : "Mark complete"}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSaveProgress}
                      disabled={update.isPending || locating}
                      data-testid="button-save"
                    >
                      Save draft
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePause}
                      disabled={update.isPending || locating}
                      data-testid="button-pause"
                    >
                      <PauseCircle className="w-4 h-4 mr-1" /> Pause
                    </Button>
                  </div>
                </>
              )}
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
                <MapPin className="w-3 h-3" /> Your location is captured when you start and complete a job.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isOpen && job.status === "on_hold" && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5" /> Job paused — start again when you're ready to resume.
        </div>
      )}
    </div>
  );
}
