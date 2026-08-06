import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Loader2, CheckCircle2, FileEdit, AlertCircle, Clock, FileWarning, CreditCard, PoundSterling, X, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function NotificationsDropdown() {
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
  });
  const unreadCount = unreadData?.count ?? 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) markReadMutation.mutate(n.id);
  };

  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt).slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground" data-testid="badge-unread-count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{unreadCount} unread</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <ScrollArea className="h-[320px]">
            {[...unread, ...read].map((n) => {
              const Icon =
                n.type === "supplier_change_pending" ? FileEdit
                : n.type === "shift_reminder" ? Clock
                : n.type === "document_expiry" ? FileWarning
                : n.type === "bank_change_request" ? CreditCard
                : n.type === "pay_processed" ? PoundSterling
                : n.type === "change_rejected" ? AlertCircle
                : n.type === "change_approved" || n.type === "field_request" ? CheckCircle2
                : n.type === "time_off_request" || n.type === "time_off_reviewed" ? CalendarOff
                : Bell;
              const content = (
                <>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="font-medium text-sm">{n.title}</span>
                    {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                  </div>
                  {!n.readAt && <span className="shrink-0 w-2 h-2 rounded-full bg-primary" />}
                </>
              );
              return (
                <div key={n.id} className="flex items-start group">
                  <DropdownMenuItem
                    onSelect={() => handleNotificationClick(n)}
                    className="flex items-start gap-2 py-3 cursor-pointer flex-1 min-w-0"
                    asChild
                  >
                    {n.link ? (
                      <Link href={n.link} className="flex items-start gap-2 w-full outline-none" data-testid={`notification-item-${n.id}`}>
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2 w-full" data-testid={`notification-item-${n.id}`}>{content}</div>
                    )}
                  </DropdownMenuItem>
                  <button
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 mt-1"
                    onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(n.id); }}
                    title="Dismiss notification"
                    data-testid={`button-dismiss-notification-${n.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
