import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare, Megaphone, Send, Plus, Hash, User,
  CheckCircle2, Clock, Loader2, Radio, Eye, AlertTriangle,
  Search, Paperclip, Download, Image, FileText, X, Check, CheckCheck,
  Users, Bell, BellOff,
} from "lucide-react";
import { io as socketIoClient, Socket } from "socket.io-client";

type TabKey = "broadcasts" | "channels" | "direct";

const TAB_CONFIG: { key: TabKey; label: string; icon: any }[] = [
  { key: "broadcasts", label: "Broadcasts", icon: Megaphone },
  { key: "channels", label: "Team Channels", icon: Hash },
  { key: "direct", label: "Direct Messages", icon: MessageSquare },
];

const ROLE_OPTIONS = [
  { value: "all", label: "All Staff" },
  { value: "employee", label: "Employees" },
  { value: "controller", label: "Controllers" },
  { value: "scheduler", label: "Schedulers" },
  { value: "hr_manager", label: "HR Managers" },
  { value: "operations_manager", label: "Operations Managers" },
  { value: "regional_manager", label: "Regional Managers" },
  { value: "admin", label: "Admins" },
];

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

function getDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isImageFile(fileType: string | null): boolean {
  return !!fileType && fileType.startsWith("image/");
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function Avatar({ name, imageUrl, size = "md", online }: { name: string; imageUrl?: string | null; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const sizeClasses = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const dotSizes = { sm: "w-2.5 h-2.5", md: "w-3 h-3", lg: "w-3.5 h-3.5" };
  return (
    <div className="relative flex-shrink-0">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className={`${sizeClasses[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white`}
          style={{ backgroundColor: "#1F3A5F" }}>
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-2 border-white ${online ? "bg-green-500" : "bg-gray-300"}`} />
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("broadcasts");
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNewBroadcast, setShowNewBroadcast] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<number, string[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const isManager = user && ["super_admin", "tenant_admin", "ceo", "operations_manager", "regional_manager", "admin", "hr_manager", "controller"].includes(user.role);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setNotificationsEnabled(true);
      });
    }
  }, []);

  useEffect(() => {
    const s = socketIoClient(window.location.origin, { path: "/socket.io", withCredentials: true });
    setSocket(s);

    s.on("user-online", (data: { userId: string }) => {
      setOnlineUsers(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
    });
    s.on("user-offline", (data: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });
    s.on("new-message", (msg: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/channels", msg.channelId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/dm-list"] });
    });
    s.on("new-broadcast", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/broadcasts"] });
    });
    s.on("user-typing", (data: { userId: string; username: string; channelId: number }) => {
      setTypingUsers(prev => {
        const current = prev[data.channelId] || [];
        if (!current.includes(data.username)) return { ...prev, [data.channelId]: [...current, data.username] };
        return prev;
      });
      setTimeout(() => {
        setTypingUsers(prev => {
          const current = prev[data.channelId] || [];
          return { ...prev, [data.channelId]: current.filter(u => u !== data.username) };
        });
      }, 3000);
    });
    s.on("message-read", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/dm-list"] });
    });

    return () => { s.disconnect(); };
  }, [notificationsEnabled, user?.id]);

  useEffect(() => {
    if (socket && selectedChannel) {
      socket.emit("join-channel", selectedChannel);
      apiRequest("POST", `/api/communications/channels/${selectedChannel}/read`).catch(() => {});
      return () => { socket.emit("leave-channel", selectedChannel); };
    }
  }, [socket, selectedChannel]);

  const { data: allChannels = [] } = useQuery<any[]>({
    queryKey: ["/api/communications/channels/all"],
    enabled: !!isManager,
  });

  const { data: userChannels = [] } = useQuery<any[]>({
    queryKey: ["/api/communications/channels"],
  });

  const { data: broadcastsList = [] } = useQuery<any[]>({
    queryKey: ["/api/communications/broadcasts"],
  });

  const { data: channelMessages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/communications/channels", selectedChannel, "messages"],
    enabled: !!selectedChannel,
    refetchInterval: 15000,
  });

  const { data: dmList = [], isLoading: dmListLoading } = useQuery<any[]>({
    queryKey: ["/api/communications/dm-list"],
    refetchInterval: 30000,
  });

  const { data: tenantUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/communications/users"],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { channelId: number; content: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }) => {
      const res = await apiRequest("POST", `/api/communications/channels/${data.channelId}/messages`, data);
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/communications/channels", selectedChannel, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/dm-list"] });
    },
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/communications/broadcasts", data);
      return res.json();
    },
    onSuccess: () => {
      setShowNewBroadcast(false);
      queryClient.invalidateQueries({ queryKey: ["/api/communications/broadcasts"] });
      toast({ title: "Broadcast sent", description: "Your message has been delivered to all recipients." });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/communications/channels", data);
      return res.json();
    },
    onSuccess: (channel: any) => {
      setShowNewChannel(false);
      setShowNewDM(false);
      queryClient.invalidateQueries({ queryKey: ["/api/communications/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/channels/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/dm-list"] });
      setSelectedChannel(channel.id);
      if (channel.type === "direct") {
        setActiveTab("direct");
        toast({ title: "Conversation started" });
      } else {
        setActiveTab("channels");
        toast({ title: "Channel created", description: `#${channel.name} is ready to use.` });
      }
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (broadcastId: number) => {
      const res = await apiRequest("POST", `/api/communications/broadcasts/${broadcastId}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/broadcasts"] });
    },
  });

  const handleSendMessage = () => {
    if (!selectedChannel || !messageText.trim()) return;
    sendMessageMutation.mutate({ channelId: selectedChannel, content: messageText });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;
    setUploadingFile(true);
    try {
      const urlRes = await apiRequest("POST", `/api/communications/channels/${selectedChannel}/upload`, {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await urlRes.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");
      sendMessageMutation.mutate({
        channelId: selectedChannel,
        content: "",
        fileUrl: objectPath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
    } catch (err) {
      toast({ title: "Upload failed", description: "Could not upload the file.", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (socket && selectedChannel) {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      socket.emit("typing", { channelId: selectedChannel });
      typingTimeout.current = setTimeout(() => {}, 3000);
    }
  };

  const toggleNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({ title: "Not supported", description: "Your browser doesn't support push notifications." });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (notificationsEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await apiRequest("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint });
        }
        setNotificationsEnabled(false);
        toast({ title: "Notifications disabled" });
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ title: "Permission denied", description: "Please allow notifications in your browser settings." });
        return;
      }
      const vapidRes = await fetch("/api/push/vapid-key", { credentials: "include" });
      if (!vapidRes.ok) throw new Error("Could not get push config");
      const { publicKey } = await vapidRes.json();
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      };
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });
      setNotificationsEnabled(true);
      toast({ title: "Notifications enabled", description: "You'll receive push alerts for new messages." });
    } catch (err) {
      toast({ title: "Error", description: "Could not set up notifications.", variant: "destructive" });
    }
  };

  const channelsToShow = isManager ? allChannels : userChannels;
  const teamChannels = channelsToShow.filter((c: any) => c.type === "team" || c.type === "site");

  const selectedChannelData = activeTab === "direct"
    ? dmList.find((c: any) => c.id === selectedChannel)
    : channelsToShow.find((c: any) => c.id === selectedChannel);

  const totalDMUnread = dmList.reduce((sum: number, dm: any) => sum + (dm.unreadCount || 0), 0);

  const renderMessages = () => {
    if (messagesLoading) {
      return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
    }
    if (channelMessages.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation!</p>;
    }

    let lastDate = "";
    let lastSenderId = "";

    return channelMessages.map((msg: any, idx: number) => {
      const isOwn = msg.senderId === user?.id;
      const msgDate = new Date(msg.createdAt).toDateString();
      const showDateSep = msgDate !== lastDate;
      const isGrouped = msg.senderId === lastSenderId && !showDateSep;
      lastDate = msgDate;
      lastSenderId = msg.senderId;

      return (
        <div key={msg.id}>
          {showDateSep && (
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium px-2">{getDateSeparator(msg.createdAt)}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}
          <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0.5" : "mt-3"}`} data-testid={`message-${msg.id}`}>
            {!isOwn && !isGrouped && (
              <Avatar name={msg.senderName} size="sm" />
            )}
            {!isOwn && isGrouped && <div className="w-8" />}
            <div className={`${!isOwn ? "ml-2" : ""} max-w-[70%]`}>
              {!isOwn && !isGrouped && (
                <p className="text-xs font-semibold mb-0.5 ml-1" style={{ color: "#FF8C42" }}>{msg.senderName}</p>
              )}
              <div className={`rounded-xl px-3 py-2 ${isOwn ? "text-white rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}
                style={isOwn ? { backgroundColor: "#1F3A5F" } : {}}>
                {msg.fileUrl && isImageFile(msg.fileType) && (
                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                    <img src={msg.fileUrl} alt={msg.fileName || "Image"} className="max-w-full max-h-48 rounded-lg" />
                  </a>
                )}
                {msg.fileUrl && !isImageFile(msg.fileType) && (
                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${isOwn ? "bg-white/10" : "bg-background"}`}>
                    <FileText className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{msg.fileName}</p>
                      {msg.fileSize && <p className="text-xs opacity-60">{formatFileSize(msg.fileSize)}</p>}
                    </div>
                    <Download className="w-4 h-4 flex-shrink-0 opacity-60" />
                  </a>
                )}
                {msg.content && !(msg.fileUrl && msg.content.startsWith("Sent a file")) && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
                  <span className={`text-[10px] ${isOwn ? "text-white/50" : "text-muted-foreground"}`}>
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  {isOwn && activeTab === "direct" && selectedChannelData?.otherUsers && (() => {
                    const otherLastReads = selectedChannelData.otherUsers
                      .map((u: any) => {
                        const memberInfo = selectedChannelData.members?.find((m: any) => m.id === u.id);
                        return memberInfo?.lastReadAt;
                      })
                      .filter(Boolean);
                    const msgTime = new Date(msg.createdAt);
                    const isRead = otherLastReads.some((lr: string) => new Date(lr) >= msgTime);
                    return isRead
                      ? <CheckCheck className="w-3 h-3 text-blue-300" />
                      : <Check className="w-3 h-3 text-white/50" />;
                  })()}
                  {isOwn && activeTab !== "direct" && (
                    <Check className="w-3 h-3 text-white/50" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="p-6 space-y-6" data-testid="communications-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}>
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Communications</h1>
            <p className="text-muted-foreground text-sm">Broadcast messages, team channels, and real-time coordination.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={toggleNotifications}
            className={notificationsEnabled ? "text-green-600" : "text-muted-foreground"}
            data-testid="button-toggle-notifications">
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </Button>
          {isManager && (
            <>
              <Button size="sm" onClick={() => setShowNewBroadcast(true)} data-testid="button-new-broadcast">
                <Megaphone className="w-4 h-4 mr-1" /> New Broadcast
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewChannel(true)} data-testid="button-new-channel">
                <Plus className="w-4 h-4 mr-1" /> New Channel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === "broadcasts" && broadcastsList.filter((b: any) => !b.isRead).length > 0 && (
                <Badge variant="destructive" className="text-xs ml-1">{broadcastsList.filter((b: any) => !b.isRead).length}</Badge>
              )}
              {tab.key === "direct" && totalDMUnread > 0 && (
                <Badge variant="destructive" className="text-xs ml-1">{totalDMUnread}</Badge>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "broadcasts" && (
        <div className="space-y-3" data-testid="section-broadcasts">
          {broadcastsList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No broadcasts yet.</p>
                {isManager && <p className="text-xs mt-1">Send a broadcast to communicate with your team.</p>}
              </CardContent>
            </Card>
          ) : (
            broadcastsList.map((broadcast: any) => (
              <Card
                key={broadcast.id}
                className={`transition-colors ${!broadcast.isRead ? "border-l-4" : ""}`}
                style={!broadcast.isRead ? { borderLeftColor: "#FF8C42" } : {}}
                data-testid={`broadcast-${broadcast.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{broadcast.title}</h3>
                        {broadcast.priority === "urgent" && (
                          <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-3 h-3 mr-0.5" />Urgent</Badge>
                        )}
                        {broadcast.priority === "high" && (
                          <Badge className="text-xs" style={{ backgroundColor: "#FF8C42" }}>High</Badge>
                        )}
                        {!broadcast.isRead && <Badge variant="secondary" className="text-xs">New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{broadcast.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{broadcast.senderName}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(broadcast.createdAt).toLocaleString("en-GB")}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{broadcast.readCount} read</span>
                      </div>
                    </div>
                    {!broadcast.isRead && (
                      <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(broadcast.id)} data-testid={`button-mark-read-${broadcast.id}`}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "channels" && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]" data-testid="section-channels">
          <div className="space-y-1 border rounded-lg p-2 max-h-[600px] overflow-y-auto">
            {teamChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No team channels yet.{isManager && " Create one to get started."}</p>
            ) : (
              teamChannels.map((channel: any) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={`w-full text-left p-2.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    selectedChannel === channel.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}
                  data-testid={`channel-${channel.id}`}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              ))
            )}
          </div>

          <Card className="min-h-[600px] flex flex-col">
            {selectedChannel ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold">{selectedChannelData?.name || "Channel"}</h3>
                  </div>
                  {selectedChannelData?.description && (
                    <p className="text-xs text-muted-foreground">{selectedChannelData.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <div className="flex-1 overflow-y-auto p-4 space-y-0">{renderMessages()}<div ref={messagesEndRef} /></div>
                  {typingUsers[selectedChannel]?.length > 0 && (
                    <div className="px-4 py-1 text-xs text-muted-foreground italic">
                      {typingUsers[selectedChannel].join(", ")} {typingUsers[selectedChannel].length === 1 ? "is" : "are"} typing...
                    </div>
                  )}
                  <div className="border-t p-3 flex gap-2">
                    <Input placeholder="Type a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown} className="flex-1" data-testid="input-message" />
                    <Button onClick={handleSendMessage} disabled={!messageText.trim() || sendMessageMutation.isPending} data-testid="button-send-message">
                      {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Select a channel to start messaging</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {activeTab === "direct" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]" data-testid="section-direct">
          <div className="border rounded-lg flex flex-col max-h-[700px]">
            <div className="p-3 border-b">
              <Button size="sm" className="w-full" onClick={() => setShowNewDM(true)} data-testid="button-new-dm">
                <Plus className="w-4 h-4 mr-1" /> New Message
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {dmListLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : dmList.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a new message to begin chatting.</p>
                </div>
              ) : (
                dmList.map((dm: any) => {
                  const displayName = dm.otherUsers?.length > 0
                    ? dm.otherUsers.map((u: any) => u.displayName).join(", ")
                    : dm.name;
                  const profileImg = dm.otherUsers?.length === 1 ? dm.otherUsers[0].profileImageUrl : null;
                  const isOnline = dm.otherUsers?.some((u: any) => onlineUsers.includes(u.id));
                  const isGroup = dm.memberCount > 2;
                  const lastMsgPreview = dm.lastMessage?.content
                    ? dm.lastMessage.content.substring(0, 50) + (dm.lastMessage.content.length > 50 ? "..." : "")
                    : "No messages yet";

                  return (
                    <button
                      key={dm.id}
                      onClick={() => setSelectedChannel(dm.id)}
                      className={`w-full text-left p-3 transition-colors flex items-center gap-3 border-b last:border-b-0 ${
                        selectedChannel === dm.id ? "bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      data-testid={`dm-${dm.id}`}
                    >
                      {isGroup ? (
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                            <Users className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                      ) : (
                        <Avatar name={displayName} imageUrl={profileImg} online={isOnline} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm truncate ${dm.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>{displayName}</span>
                          {dm.lastMessage && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(dm.lastMessage.createdAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className={`text-xs truncate ${dm.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {dm.lastMessage?.senderId === user?.id && <span className="text-muted-foreground">You: </span>}
                            {lastMsgPreview}
                          </p>
                          {dm.unreadCount > 0 && (
                            <Badge className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: "#FF8C42" }}>
                              {dm.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <Card className="min-h-[700px] flex flex-col">
            {selectedChannel && selectedChannelData ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center gap-3">
                    {selectedChannelData.memberCount > 2 ? (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center bg-muted flex-shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <Avatar
                        name={selectedChannelData.otherUsers?.[0]?.displayName || selectedChannelData.name}
                        imageUrl={selectedChannelData.otherUsers?.[0]?.profileImageUrl}
                        online={selectedChannelData.otherUsers?.some((u: any) => onlineUsers.includes(u.id))}
                        size="sm"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-sm">
                        {selectedChannelData.otherUsers?.map((u: any) => u.displayName).join(", ") || selectedChannelData.name}
                      </h3>
                      {selectedChannelData.otherUsers?.some((u: any) => onlineUsers.includes(u.id)) && (
                        <p className="text-xs text-green-600">Online</p>
                      )}
                      {selectedChannelData.memberCount > 2 && (
                        <p className="text-xs text-muted-foreground">{selectedChannelData.memberCount} members</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <div className="flex-1 overflow-y-auto p-4 space-y-0">{renderMessages()}<div ref={messagesEndRef} /></div>
                  {typingUsers[selectedChannel]?.length > 0 && (
                    <div className="px-4 py-1 text-xs text-muted-foreground italic">
                      {typingUsers[selectedChannel].join(", ")} {typingUsers[selectedChannel].length === 1 ? "is" : "are"} typing...
                    </div>
                  )}
                  <div className="border-t p-3 flex gap-2 items-center">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" data-testid="input-file-upload" />
                    <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} data-testid="button-attach-file">
                      {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </Button>
                    <Input placeholder="Type a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown} className="flex-1" data-testid="input-message" />
                    <Button onClick={handleSendMessage} disabled={!messageText.trim() || sendMessageMutation.isPending} data-testid="button-send-message">
                      {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select a conversation</p>
                  <p className="text-xs mt-1">or start a new message</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      <NewBroadcastDialog open={showNewBroadcast} onOpenChange={setShowNewBroadcast}
        onSubmit={(data: any) => createBroadcastMutation.mutate(data)} isPending={createBroadcastMutation.isPending} />
      <NewChannelDialog open={showNewChannel} onOpenChange={setShowNewChannel}
        onSubmit={(data: any) => createChannelMutation.mutate(data)} isPending={createChannelMutation.isPending} tenantUsers={tenantUsers} />
      <NewDMDialog open={showNewDM} onOpenChange={setShowNewDM}
        onSubmit={(data: any) => createChannelMutation.mutate(data)} isPending={createChannelMutation.isPending} />
    </div>
  );
}

function NewBroadcastDialog({ open, onOpenChange, onSubmit, isPending }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (d: any) => void; isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [priority, setPriority] = useState("normal");

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    onSubmit({
      title: title.trim(), content: content.trim(),
      targetRoles: targetRole === "all" ? null : [targetRole], priority,
    });
    setTitle(""); setContent(""); setTargetRole("all"); setPriority("normal");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-new-broadcast">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5" />Send Broadcast</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Important Update" data-testid="input-broadcast-title" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your broadcast message..." rows={4} data-testid="input-broadcast-content" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Audience</Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger data-testid="select-broadcast-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-broadcast-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !content.trim() || isPending} data-testid="button-send-broadcast">
            {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Send Broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewChannelDialog({ open, onOpenChange, onSubmit, isPending, tenantUsers }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (d: any) => void; isPending: boolean; tenantUsers: any[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("team");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), type, description: description.trim() || null, memberIds: selectedMembers });
    setName(""); setType("team"); setDescription(""); setSelectedMembers([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-new-channel">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hash className="w-5 h-5" />Create Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Channel Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. night-shift-team" data-testid="input-channel-name" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-channel-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team Channel</SelectItem>
                <SelectItem value="site">Site Channel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel for?" data-testid="input-channel-description" />
          </div>
          {tenantUsers.length > 0 && (
            <div>
              <Label>Add Members</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1 mt-1">
                {tenantUsers.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => {
                      setSelectedMembers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                    }} className="rounded" />
                    <span>{u.displayName}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">{u.role}</Badge>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-create-channel">
            {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDMDialog({ open, onOpenChange, onSubmit, isPending }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (d: any) => void; isPending: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const { data: searchResults = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/communications/users", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/communications/users?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && searchQuery.length >= 1,
  });

  const handleSelectUser = (user: any) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setSearchQuery("");
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleSubmit = () => {
    if (selectedUsers.length === 0) return;
    const name = selectedUsers.map(u => u.displayName).join(", ");
    onSubmit({ name, type: "direct", memberIds: selectedUsers.map(u => u.id) });
    setSelectedUsers([]);
    setSearchQuery("");
  };

  const filteredResults = searchResults.filter(u => !selectedUsers.find(s => s.id === u.id));

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSelectedUsers([]); setSearchQuery(""); } }}>
      <DialogContent className="max-w-md" data-testid="dialog-new-dm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map(u => (
                <Badge key={u.id} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                  <Avatar name={u.displayName} imageUrl={u.profileImageUrl} size="sm" />
                  <span className="text-xs ml-1">{u.displayName}</span>
                  <button onClick={() => handleRemoveUser(u.id)} className="ml-1 rounded-full hover:bg-muted p-0.5" data-testid={`remove-user-${u.id}`}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or email..."
              className="pl-9" data-testid="input-search-users" autoFocus />
          </div>
          {searchQuery.length >= 1 && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : filteredResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              ) : (
                filteredResults.map((u: any) => (
                  <button key={u.id} onClick={() => handleSelectUser(u)}
                    className="w-full text-left p-2.5 hover:bg-muted flex items-center gap-3 transition-colors border-b last:border-b-0"
                    data-testid={`select-user-${u.id}`}>
                    <Avatar name={u.displayName} imageUrl={u.profileImageUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email || u.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={selectedUsers.length === 0 || isPending} data-testid="button-start-dm">
            {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            {selectedUsers.length > 1 ? "Start Group Chat" : "Start Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
