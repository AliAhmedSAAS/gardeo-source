import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, ClipboardList, MapPin, Clock, Calendar, ChevronRight, CheckCircle2, PlayCircle, AlertTriangle } from "lucide-react";

type MyJob = {
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
  site_name: string | null;
  site_address: string | null;
  assignment_id: number;
  assignment_status: string;
  check_in_at: string | null;
  check_out_at: string | null;
};

type FmWorker = {
  id: number;
  firstName: string;
  lastName: string;
  trade: string;
  serviceLine: string;
};

const statusColor: Record<string, string> = {
  raised: "bg-gray-500", assigned: "bg-blue-500", in_progress: "bg-[#FF8C42]",
  completed: "bg-green-600", signed_off: "bg-green-700", cancelled: "bg-gray-400", on_hold: "bg-yellow-500",
};

const priorityColor: Record<string, string> = {
  critical: "bg-red-600", high: "bg-orange-500", medium: "bg-blue-500", normal: "bg-blue-500", low: "bg-gray-400",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function FmWorkerPortalPage() {
  const { user } = useAuth();
  const { data: worker, isLoading: workerLoading, error: workerError } = useQuery<FmWorker>({
    queryKey: ["/api/fm/me"],
    retry: false,
  });
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<MyJob[]>({
    queryKey: ["/api/fm/my-jobs"],
    enabled: !!worker,
  });

  if (workerLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="fm-worker-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  if (workerError || !worker) {
    return (
      <div className="p-6 max-w-lg mx-auto" data-testid="fm-worker-not-linked">
        <Card className="border-orange-300">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h2 className="font-semibold mb-1">No FM worker profile</h2>
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to an FM worker record yet. Ask your manager to connect your email to your FM worker profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const openStatuses = ["raised", "assigned", "in_progress", "on_hold"];

  const todayJobs = jobs.filter(j => j.scheduled_date === today && openStatuses.includes(j.status));
  const activeJob = jobs.find(j => j.status === "in_progress");
  const upcomingJobs = jobs
    .filter(j => j.scheduled_date && j.scheduled_date > today && openStatuses.includes(j.status))
    .slice(0, 5);
  const backlogJobs = jobs.filter(j =>
    openStatuses.includes(j.status) &&
    (!j.scheduled_date || j.scheduled_date < today) &&
    !todayJobs.includes(j)
  );
  const recentlyCompleted = jobs.filter(j => j.status === "completed" || j.status === "signed_off").slice(0, 3);

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto" data-testid="fm-worker-portal">
      <div className="pt-2">
        <h1 className="text-xl font-bold" data-testid="text-greeting">
          {greeting()}, {user?.firstName || worker.firstName}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {worker.trade} · {worker.serviceLine}
        </p>
      </div>

      {activeJob && (
        <Card className="border-[#FF8C42] bg-gradient-to-r from-[#FF8C42]/5 to-transparent" data-testid="card-active-job">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-[#FF8C42] text-white border-[#FF8C42]">
                <Wrench className="w-3 h-3 mr-1" /> In Progress
              </Badge>
              <Badge variant="outline" className="capitalize text-xs">{activeJob.priority}</Badge>
            </div>
            <h3 className="font-semibold text-sm" data-testid="text-active-job-title">{activeJob.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{activeJob.job_number}</p>
            {activeJob.site_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3" /> {activeJob.site_name}
              </div>
            )}
            <Link href={`/fm-worker/jobs/${activeJob.id}`}>
              <Button
                className="mt-3 w-full bg-[#FF8C42] hover:bg-[#e67a30] text-white min-h-[44px]"
                data-testid="button-open-active-job"
              >
                Open & complete <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div data-testid="section-today">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Today
        </h2>
        {jobsLoading ? (
          <Card><CardContent className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42] mx-auto" />
          </CardContent></Card>
        ) : todayJobs.length === 0 ? (
          <Card data-testid="card-no-today">
            <CardContent className="p-6 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">No jobs scheduled today</p>
              <p className="text-xs text-muted-foreground mt-1">
                {backlogJobs.length > 0 ? `${backlogJobs.length} job${backlogJobs.length > 1 ? "s" : ""} to catch up on below.` : "Enjoy the quiet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayJobs.map(j => <JobRow key={j.id} job={j} />)}
          </div>
        )}
      </div>

      {backlogJobs.length > 0 && (
        <div data-testid="section-backlog">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="w-4 h-4" /> Overdue / unscheduled
          </h2>
          <div className="space-y-2">
            {backlogJobs.slice(0, 5).map(j => <JobRow key={j.id} job={j} />)}
          </div>
        </div>
      )}

      {upcomingJobs.length > 0 && (
        <div data-testid="section-upcoming">
          <h2 className="text-sm font-semibold mb-2">Upcoming</h2>
          <div className="space-y-2">
            {upcomingJobs.map(j => <JobRow key={j.id} job={j} />)}
          </div>
        </div>
      )}

      {recentlyCompleted.length > 0 && (
        <div data-testid="section-recent">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-600" /> Recently completed
          </h2>
          <div className="space-y-2">
            {recentlyCompleted.map(j => <JobRow key={j.id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: MyJob }) {
  return (
    <Link href={`/fm-worker/jobs/${job.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-job-${job.id}`}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={`${statusColor[job.status] || "bg-gray-400"} text-white text-[10px] capitalize`}>
                  {job.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={`text-[10px] capitalize ${priorityColor[job.priority] ? "border-transparent text-white " + priorityColor[job.priority] : ""}`}>
                  {job.priority}
                </Badge>
                <span className="text-[10px] text-muted-foreground capitalize">{job.service_line}</span>
              </div>
              <p className="text-sm font-medium mt-1 truncate" data-testid={`text-job-title-${job.id}`}>{job.title}</p>
              <p className="text-[10px] text-muted-foreground">{job.job_number}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                {job.scheduled_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(job.scheduled_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                )}
                {job.scheduled_start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.scheduled_start_time}{job.scheduled_end_time ? `–${job.scheduled_end_time}` : ""}
                  </span>
                )}
              </div>
              {job.site_name && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3" /> {job.site_name}
                </div>
              )}
            </div>
            {job.status === "in_progress" ? (
              <PlayCircle className="w-5 h-5 text-[#FF8C42] mt-1 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
