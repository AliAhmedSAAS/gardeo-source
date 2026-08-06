import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User, Mail, Phone, MapPin, ShieldCheck, FileCheck, Heart,
  Pencil, X, Save, Briefcase, Plus, Trash2, CreditCard, Clock, AlertCircle, Building,
  CalendarDays, TrendingDown, CheckCircle2,
} from "lucide-react";
import type { User as UserType, Employee, EmergencyContact, BankDetail, PendingBankChange } from "@shared/schema";

export default function MyProfilePage() {
  const { toast } = useToast();
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState<"phone" | "address" | null>(null);
  const [changeRequestData, setChangeRequestData] = useState<Record<string, string>>({});
  const [showEmergencyContactForm, setShowEmergencyContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactForm, setContactForm] = useState<Record<string, string>>({});
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState<Record<string, string>>({});

  const { data: user, isLoading: userLoading } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: profile, isLoading: profileLoading } = useQuery<Employee>({
    queryKey: ["/api/employee/profile"],
  });

  const { data: emergencyContacts = [], isLoading: contactsLoading } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/emergency-contacts"],
  });

  const { data: bankDetails, isLoading: bankLoading } = useQuery<BankDetail | null>({
    queryKey: ["/api/bank-details"],
  });

  const { data: pendingBankChanges = [] } = useQuery<PendingBankChange[]>({
    queryKey: ["/api/bank-details/pending"],
  });

  const { data: supplierData } = useQuery<{ companyName: string } | null>({
    queryKey: ["/api/employee/supplier"],
    enabled: !!profile?.supplierId,
  });

  const currentYear = new Date().getFullYear();
  const { data: leaveBalance, isLoading: leaveBalanceLoading } = useQuery<{
    entitlement: number; carriedForward: number; adjustments: number; used: number; remaining: number; year: number;
  }>({
    queryKey: ["/api/employee/leave-balance", currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/employee/leave-balance?year=${currentYear}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const latestPendingChange = pendingBankChanges.find((c) => c.status === "pending") ?? null;

  const requestChangeMutation = useMutation({
    mutationFn: async (data: { changeType: string; details: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/employee/request-change", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Change request submitted", description: "Your change request has been sent to an admin for review." });
      setShowChangeRequestDialog(null);
      setChangeRequestData({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit change request. Please try again.", variant: "destructive" });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/emergency-contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
      toast({ title: "Emergency contact added", description: "Your emergency contact has been saved." });
      setShowEmergencyContactForm(false);
      setContactForm({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add emergency contact.", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/emergency-contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
      toast({ title: "Emergency contact updated", description: "Your emergency contact has been saved." });
      setEditingContact(null);
      setContactForm({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update emergency contact.", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/emergency-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
      toast({ title: "Emergency contact removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete emergency contact.", variant: "destructive" });
    },
  });

  const saveBankDirectMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/bank-details", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-details"] });
      toast({ title: "Bank details saved", description: "Your bank details have been saved." });
      setShowBankForm(false);
      setBankForm({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save bank details.", variant: "destructive" });
    },
  });

  const requestBankChangeMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/bank-details/request-change", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-details/pending"] });
      toast({ title: "Bank details request submitted", description: "An admin will review and apply your bank details change." });
      setShowBankForm(false);
      setBankForm({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit bank details request.", variant: "destructive" });
    },
  });

  const openPhoneChangeRequest = () => {
    setChangeRequestData({ phone: user?.phone || "" });
    setShowChangeRequestDialog("phone");
  };

  const openAddressChangeRequest = () => {
    setChangeRequestData({
      addressLine1: profile?.addressLine1 || "",
      addressLine2: profile?.addressLine2 || "",
      city: profile?.city || "",
      county: profile?.county || "",
      postcode: profile?.postcode || "",
    });
    setShowChangeRequestDialog("address");
  };

  const handleSubmitChangeRequest = () => {
    if (showChangeRequestDialog) {
      requestChangeMutation.mutate({
        changeType: showChangeRequestDialog,
        details: changeRequestData,
      });
    }
  };

  const openAddContact = () => {
    setContactForm({ name: "", relationship: "", phone: "", alternatePhone: "", email: "" });
    setShowEmergencyContactForm(true);
  };

  const openEditContact = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      alternatePhone: contact.alternatePhone || "",
      email: contact.email || "",
    });
  };

  const handleSaveContact = () => {
    if (!contactForm.name || !contactForm.relationship || !contactForm.phone) {
      toast({ title: "Validation error", description: "Name, relationship, and phone are required.", variant: "destructive" });
      return;
    }
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: contactForm });
    } else {
      createContactMutation.mutate(contactForm);
    }
  };

  const openBankForm = () => {
    setBankForm({
      accountName: bankDetails?.accountName || "",
      bankName: bankDetails?.bankName || "",
      sortCode: bankDetails?.sortCode || "",
      accountNumber: bankDetails?.accountNumber || "",
      buildingSocietyRef: bankDetails?.buildingSocietyRef || "",
    });
    setShowBankForm(true);
  };

  const isLoading = userLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="my-profile-page">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm">View your personal information. Use "Request Change" for updates that require admin approval.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <User className="w-5 h-5 text-primary" />
            <span className="font-semibold">Personal Details</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">First Name</Label>
                <p className="text-sm font-medium" data-testid="text-first-name">{user?.firstName || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <p className="text-sm font-medium" data-testid="text-last-name">{user?.lastName || "N/A"}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Employee Number</Label>
              <p className="text-sm font-medium" data-testid="text-employee-number">{profile?.employeeNumber || "N/A"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Date of Birth</Label>
              <p className="text-sm font-medium" data-testid="text-dob">
                {profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-GB") : "N/A"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Gender</Label>
                <p className="text-sm font-medium capitalize" data-testid="text-gender">{profile?.gender || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nationality</Label>
                <p className="text-sm font-medium" data-testid="text-nationality">{profile?.nationality || "N/A"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Place of Birth</Label>
                <p className="text-sm font-medium" data-testid="text-place-of-birth">{profile?.placeOfBirth || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">NI Number</Label>
                <p className="text-sm font-medium" data-testid="text-ni-number">{profile?.nationalInsurance || "N/A"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Job Title</Label>
                <p className="text-sm font-medium" data-testid="text-job-title">{profile?.jobTitle || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Supplier / Agency</Label>
                <p className="text-sm font-medium" data-testid="text-supplier">
                  {profile?.supplierId ? (
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      {supplierData?.companyName || "N/A"}
                    </span>
                  ) : "Direct Employee"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="font-semibold">Contact Information</span>
            </div>
            <Button size="sm" variant="outline" onClick={openPhoneChangeRequest} data-testid="button-request-phone-change">
              <Pencil className="w-3.5 h-3.5 mr-1" /> Request Change
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium flex items-center gap-1" data-testid="text-email">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {user?.email || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <p className="text-sm font-medium flex items-center gap-1" data-testid="text-phone">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {user?.phone || "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="font-semibold">Address</span>
            </div>
            <Button size="sm" variant="outline" onClick={openAddressChangeRequest} data-testid="button-request-address-change">
              <Pencil className="w-3.5 h-3.5 mr-1" /> Request Change
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Address</Label>
              <p className="text-sm font-medium" data-testid="text-address">
                {[profile?.addressLine1, profile?.addressLine2, profile?.city, profile?.county, profile?.postcode]
                  .filter(Boolean)
                  .join(", ") || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Country</Label>
              <p className="text-sm font-medium" data-testid="text-country">{profile?.country || "N/A"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-semibold">Compliance Information</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">SIA License</Label>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" data-testid="text-sia-license">{profile?.siaLicenseNumber || "N/A"}</p>
                {profile?.siaLicenseNumber && (
                  <Badge variant="default" className="bg-green-600 border-green-600" data-testid="badge-sia-status">
                    <FileCheck className="w-3 h-3 mr-1" /> Active
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SIA Expiry</Label>
              <p className="text-sm font-medium" data-testid="text-sia-expiry">
                {profile?.siaExpiryDate ? new Date(profile.siaExpiryDate).toLocaleDateString("en-GB") : "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">DBS Certificate</Label>
              <p className="text-sm font-medium" data-testid="text-dbs-cert">{profile?.dbsCertificateNumber || "N/A"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">First Aid</Label>
              <div className="flex items-center gap-2">
                {profile?.hasFirstAid ? (
                  <Badge variant="default" className="bg-green-600 border-green-600" data-testid="badge-first-aid">
                    <Heart className="w-3 h-3 mr-1" /> Certified
                  </Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-first-aid">Not Certified</Badge>
                )}
                {profile?.firstAidExpiry && (
                  <span className="text-xs text-muted-foreground">
                    Expires {new Date(profile.firstAidExpiry).toLocaleDateString("en-GB")}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-leave-balance" className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <span className="font-semibold">Annual Leave Balance — {currentYear}</span>
        </CardHeader>
        <CardContent>
          {leaveBalanceLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : leaveBalance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Entitlement</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-leave-entitlement">{leaveBalance.entitlement}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
                {leaveBalance.carriedForward > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Carried Forward</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-leave-carried-forward">+{leaveBalance.carriedForward}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </div>
                )}
                {leaveBalance.adjustments !== 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Adjustments</p>
                    <p className={`text-2xl font-bold ${leaveBalance.adjustments > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-leave-adjustments">
                      {leaveBalance.adjustments > 0 ? "+" : ""}{leaveBalance.adjustments}
                    </p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </div>
                )}
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Used</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-leave-used">{leaveBalance.used}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
                <div className={`rounded-lg border p-3 text-center ${leaveBalance.remaining > 10 ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : leaveBalance.remaining > 5 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
                  <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                  <p className={`text-2xl font-bold ${leaveBalance.remaining > 10 ? "text-green-700 dark:text-green-400" : leaveBalance.remaining > 5 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`} data-testid="text-leave-remaining">{leaveBalance.remaining}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full rounded-full transition-all ${leaveBalance.remaining > 10 ? "bg-green-500" : leaveBalance.remaining > 5 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, (leaveBalance.used / (leaveBalance.entitlement + leaveBalance.carriedForward + leaveBalance.adjustments || 1)) * 100)}%` }}
                  data-testid="bar-leave-usage"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {leaveBalance.used} of {leaveBalance.entitlement + leaveBalance.carriedForward + leaveBalance.adjustments} days used
                {leaveBalance.carriedForward > 0 && ` (including ${leaveBalance.carriedForward} carried forward from ${currentYear - 1})`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Leave balance information is not available for your account.</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-emergency-contacts">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            <span className="font-semibold">Emergency Contacts</span>
          </div>
          <Button size="sm" variant="outline" onClick={openAddContact} data-testid="button-add-emergency-contact">
            <Plus className="w-4 h-4 mr-1" /> Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : emergencyContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emergency contacts added yet. Add one to keep your profile complete.</p>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div key={contact.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border" data-testid={`card-contact-${contact.id}`}>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-contact-name-${contact.id}`}>{contact.name}</span>
                      {contact.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      <span className="text-xs text-muted-foreground capitalize">{contact.relationship}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span data-testid={`text-contact-phone-${contact.id}`}>{contact.phone}</span>
                      {contact.alternatePhone && <span className="ml-2">{contact.alternatePhone}</span>}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditContact(contact)} data-testid={`button-edit-contact-${contact.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-contact-${contact.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Emergency Contact</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {contact.name} as an emergency contact?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteContactMutation.mutate(contact.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-contact-${contact.id}`}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-bank-details">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span className="font-semibold">Bank Details</span>
          </div>
          <Button size="sm" variant="outline" onClick={openBankForm} data-testid="button-update-bank-details">
            <Pencil className="w-4 h-4 mr-1" /> {bankDetails ? "Request Change" : "Add Bank Details"}
          </Button>
        </CardHeader>
        <CardContent>
          {bankLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {latestPendingChange && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 mb-3" data-testid="alert-bank-pending">
                  <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">Your bank details change request is pending admin approval. Requested: {latestPendingChange.bankName}, Account: ****{latestPendingChange.accountNumber.slice(-4)}</span>
                </div>
              )}
              {bankDetails ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Account Name</Label>
                      <p className="text-sm font-medium" data-testid="text-bank-account-name">{bankDetails.accountName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bank Name</Label>
                      <p className="text-sm font-medium" data-testid="text-bank-name">{bankDetails.bankName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Sort Code</Label>
                      <p className="text-sm font-medium" data-testid="text-sort-code">••-••-{bankDetails.sortCode.slice(-2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Account Number</Label>
                      <p className="text-sm font-medium" data-testid="text-account-number">••••{bankDetails.accountNumber.slice(-4)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Bank detail changes require admin approval for security. Click "Request Change" to submit a change request.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bank details on file. Add your bank details for payroll processing.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showChangeRequestDialog === "phone"} onOpenChange={(open) => {
        if (!open) { setShowChangeRequestDialog(null); setChangeRequestData({}); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Phone Number Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your change request will be sent to an admin for review before being applied.</span>
            </div>
            <div className="space-y-2">
              <Label>Current Phone</Label>
              <p className="text-sm text-muted-foreground">{user?.phone || "Not set"}</p>
            </div>
            <div className="space-y-2">
              <Label>New Phone Number *</Label>
              <Input
                data-testid="input-new-phone"
                value={changeRequestData.phone || ""}
                onChange={(e) => setChangeRequestData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter new phone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangeRequestDialog(null); setChangeRequestData({}); }} data-testid="button-cancel-phone-change">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitChangeRequest}
              disabled={requestChangeMutation.isPending || !changeRequestData.phone}
              data-testid="button-submit-phone-change"
            >
              <Save className="w-4 h-4 mr-1" />
              {requestChangeMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangeRequestDialog === "address"} onOpenChange={(open) => {
        if (!open) { setShowChangeRequestDialog(null); setChangeRequestData({}); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Address Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your change request will be sent to an admin for review before being applied.</span>
            </div>
            <div className="space-y-2">
              <Label>Address Line 1 *</Label>
              <Input
                data-testid="input-new-address-line1"
                value={changeRequestData.addressLine1 || ""}
                onChange={(e) => setChangeRequestData((prev) => ({ ...prev, addressLine1: e.target.value }))}
                placeholder="Address line 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input
                data-testid="input-new-address-line2"
                value={changeRequestData.addressLine2 || ""}
                onChange={(e) => setChangeRequestData((prev) => ({ ...prev, addressLine2: e.target.value }))}
                placeholder="Address line 2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  data-testid="input-new-city"
                  value={changeRequestData.city || ""}
                  onChange={(e) => setChangeRequestData((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>County</Label>
                <Input
                  data-testid="input-new-county"
                  value={changeRequestData.county || ""}
                  onChange={(e) => setChangeRequestData((prev) => ({ ...prev, county: e.target.value }))}
                  placeholder="County"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Postcode *</Label>
              <Input
                data-testid="input-new-postcode"
                value={changeRequestData.postcode || ""}
                onChange={(e) => setChangeRequestData((prev) => ({ ...prev, postcode: e.target.value }))}
                placeholder="Postcode"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangeRequestDialog(null); setChangeRequestData({}); }} data-testid="button-cancel-address-change">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitChangeRequest}
              disabled={requestChangeMutation.isPending || !changeRequestData.addressLine1}
              data-testid="button-submit-address-change"
            >
              <Save className="w-4 h-4 mr-1" />
              {requestChangeMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmergencyContactForm || !!editingContact} onOpenChange={(open) => {
        if (!open) { setShowEmergencyContactForm(false); setEditingContact(null); setContactForm({}); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  data-testid="input-contact-name"
                  value={contactForm.name || ""}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship *</Label>
                <Input
                  data-testid="input-contact-relationship"
                  value={contactForm.relationship || ""}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  data-testid="input-contact-phone"
                  value={contactForm.phone || ""}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Primary phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input
                  data-testid="input-contact-alternate-phone"
                  value={contactForm.alternatePhone || ""}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, alternatePhone: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                data-testid="input-contact-email"
                value={contactForm.email || ""}
                onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Optional"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEmergencyContactForm(false); setEditingContact(null); setContactForm({}); }} data-testid="button-cancel-contact">
              Cancel
            </Button>
            <Button
              onClick={handleSaveContact}
              disabled={createContactMutation.isPending || updateContactMutation.isPending}
              data-testid="button-save-contact"
            >
              <Save className="w-4 h-4 mr-1" />
              {(createContactMutation.isPending || updateContactMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBankForm} onOpenChange={(open) => !open && setShowBankForm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bankDetails ? "Request Bank Details Change" : "Add Bank Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {bankDetails && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-400">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Your change request will be sent to an admin for approval before being applied.</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                data-testid="input-bank-account-name"
                value={bankForm.accountName || ""}
                onChange={(e) => setBankForm((prev) => ({ ...prev, accountName: e.target.value }))}
                placeholder="Name on account"
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input
                data-testid="input-bank-name"
                value={bankForm.bankName || ""}
                onChange={(e) => setBankForm((prev) => ({ ...prev, bankName: e.target.value }))}
                placeholder="e.g. Lloyds, Barclays"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Code *</Label>
                <Input
                  data-testid="input-sort-code"
                  value={bankForm.sortCode || ""}
                  onChange={(e) => setBankForm((prev) => ({ ...prev, sortCode: e.target.value }))}
                  placeholder="00-00-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  data-testid="input-account-number"
                  value={bankForm.accountNumber || ""}
                  onChange={(e) => setBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="12345678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Building Society Roll No.</Label>
              <Input
                data-testid="input-building-society-ref"
                value={bankForm.buildingSocietyRef || ""}
                onChange={(e) => setBankForm((prev) => ({ ...prev, buildingSocietyRef: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankForm(false)} data-testid="button-cancel-bank">
              Cancel
            </Button>
            <Button
              onClick={() => bankDetails ? requestBankChangeMutation.mutate(bankForm) : saveBankDirectMutation.mutate(bankForm)}
              disabled={requestBankChangeMutation.isPending || saveBankDirectMutation.isPending || !bankForm.accountName || !bankForm.bankName || !bankForm.sortCode || !bankForm.accountNumber}
              data-testid="button-submit-bank-change"
            >
              <Save className="w-4 h-4 mr-1" />
              {(requestBankChangeMutation.isPending || saveBankDirectMutation.isPending) ? "Submitting..." : bankDetails ? "Submit Change Request" : "Save Bank Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
