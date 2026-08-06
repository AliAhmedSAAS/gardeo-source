import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Users, Search, Pencil, Shield, Phone, Mail, Briefcase, UserCheck,
} from "lucide-react";

type Officer = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siaLicenseNumber: string | null;
  siaLicenseType: string | null;
  siaExpiryDate: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  hourlyRate: string | null;
  isActive: boolean;
  createdAt: string | null;
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  siaLicenseNumber: "",
  siaLicenseType: "",
  siaExpiryDate: "",
  jobTitle: "Security Officer",
};

export default function MyOfficersPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [searchQuery, setSearchQuery] = useState("");

  const { data: officers = [], isLoading } = useQuery<Officer[]>({
    queryKey: ["/api/supplier-portal/my-officers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/supplier-portal/my-officers", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        siaLicenseNumber: data.siaLicenseNumber || null,
        siaLicenseType: data.siaLicenseType || null,
        siaExpiryDate: data.siaExpiryDate || null,
        jobTitle: data.jobTitle || "Security Officer",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/my-officers"] });
      toast({ title: "Officer added", description: "New officer has been registered successfully." });
      setAddDialogOpen(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await apiRequest("PATCH", `/api/supplier-portal/my-officers/${id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        siaLicenseNumber: data.siaLicenseNumber || null,
        siaLicenseType: data.siaLicenseType || null,
        siaExpiryDate: data.siaExpiryDate || null,
        jobTitle: data.jobTitle || "Security Officer",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/my-officers"] });
      toast({ title: "Officer updated", description: "Officer details have been saved." });
      setEditDialogOpen(false);
      setEditingOfficer(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredOfficers = officers.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.firstName.toLowerCase().includes(q) ||
      o.lastName.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (o.siaLicenseNumber && o.siaLicenseNumber.toLowerCase().includes(q))
    );
  });

  const openEdit = (officer: Officer) => {
    setEditingOfficer(officer);
    setForm({
      firstName: officer.firstName,
      lastName: officer.lastName,
      email: officer.email,
      phone: officer.phone || "",
      siaLicenseNumber: officer.siaLicenseNumber || "",
      siaLicenseType: officer.siaLicenseType || "",
      siaExpiryDate: officer.siaExpiryDate || "",
      jobTitle: officer.jobTitle || "Security Officer",
    });
    setEditDialogOpen(true);
  };

  const renderOfficerForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="officer-first-name">First Name *</Label>
          <Input
            id="officer-first-name"
            data-testid="input-officer-first-name"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="officer-last-name">Last Name *</Label>
          <Input
            id="officer-last-name"
            data-testid="input-officer-last-name"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            placeholder="Smith"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="officer-email">Email *</Label>
        <Input
          id="officer-email"
          data-testid="input-officer-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="john.smith@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="officer-phone">Phone</Label>
        <Input
          id="officer-phone"
          data-testid="input-officer-phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="07700 900000"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="officer-sia">SIA Licence Number</Label>
          <Input
            id="officer-sia"
            data-testid="input-officer-sia"
            value={form.siaLicenseNumber}
            onChange={(e) => setForm((f) => ({ ...f, siaLicenseNumber: e.target.value }))}
            placeholder="1234567890123456"
          />
        </div>
        <div className="space-y-2">
          <Label>SIA Licence Type</Label>
          <Select value={form.siaLicenseType} onValueChange={(val) => setForm((f) => ({ ...f, siaLicenseType: val }))}>
            <SelectTrigger data-testid="select-officer-sia-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="door_supervisor">Door Supervisor</SelectItem>
              <SelectItem value="security_guard">Security Guard</SelectItem>
              <SelectItem value="close_protection">Close Protection</SelectItem>
              <SelectItem value="cctv_operator">CCTV Operator</SelectItem>
              <SelectItem value="key_holding">Key Holding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="officer-sia-expiry">SIA Expiry Date</Label>
          <Input
            id="officer-sia-expiry"
            data-testid="input-officer-sia-expiry"
            type="date"
            value={form.siaExpiryDate}
            onChange={(e) => setForm((f) => ({ ...f, siaExpiryDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="officer-job-title">Job Title</Label>
          <Input
            id="officer-job-title"
            data-testid="input-officer-job-title"
            value={form.jobTitle}
            onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
            placeholder="Security Officer"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6" data-testid="my-officers-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            My Officers
          </h1>
          <p className="text-muted-foreground text-sm">Manage your security officers and staff assigned to shifts.</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setAddDialogOpen(true); }} data-testid="button-add-officer">
          <Plus className="w-4 h-4 mr-1" /> Add Officer
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-officers">{officers.length}</div>
            <div className="text-xs text-muted-foreground">Total Officers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-officers">
              {officers.filter(o => o.isActive).length}
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600" data-testid="text-sia-licensed">
              {officers.filter(o => o.siaLicenseNumber).length}
            </div>
            <div className="text-xs text-muted-foreground">SIA Licensed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600" data-testid="text-expiring-sia">
              {officers.filter(o => {
                if (!o.siaExpiryDate) return false;
                const exp = new Date(o.siaExpiryDate);
                const inThirtyDays = new Date();
                inThirtyDays.setDate(inThirtyDays.getDate() + 30);
                return exp <= inThirtyDays && exp >= new Date();
              }).length}
            </div>
            <div className="text-xs text-muted-foreground">SIA Expiring Soon</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-officers"
            className="pl-9"
            placeholder="Search officers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredOfficers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No officers found</h3>
            <p className="text-sm text-muted-foreground">
              {officers.length > 0
                ? "Try adjusting your search."
                : "Add your first officer to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>SIA Licence</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOfficers.map((officer) => {
                  const siaExpired = officer.siaExpiryDate && new Date(officer.siaExpiryDate) < new Date();
                  return (
                    <TableRow key={officer.id} data-testid={`row-officer-${officer.id}`}>
                      <TableCell>
                        <div className="font-medium" data-testid={`text-officer-name-${officer.id}`}>
                          {officer.firstName} {officer.lastName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {officer.email}
                          </span>
                          {officer.phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" /> {officer.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {officer.siaLicenseNumber ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1 text-sm font-mono">
                              <Shield className="w-3 h-3" /> {officer.siaLicenseNumber}
                            </span>
                            {officer.siaExpiryDate && (
                              <span className={`text-xs ${siaExpired ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                Expires: {officer.siaExpiryDate}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Briefcase className="w-3 h-3" />
                          {officer.jobTitle || "Security Officer"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={officer.isActive ? "default" : "secondary"}
                          className={officer.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : ""}
                          data-testid={`badge-officer-status-${officer.id}`}
                        >
                          {officer.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(officer)}
                          data-testid={`button-edit-officer-${officer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Officer</DialogTitle>
          </DialogHeader>
          {renderOfficerForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add-officer">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.firstName || !form.lastName || !form.email}
              data-testid="button-submit-add-officer"
            >
              {createMutation.isPending ? "Adding..." : "Add Officer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Officer</DialogTitle>
          </DialogHeader>
          {renderOfficerForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit-officer">
              Cancel
            </Button>
            <Button
              onClick={() => editingOfficer && editMutation.mutate({ id: editingOfficer.id, data: form })}
              disabled={editMutation.isPending || !form.firstName || !form.lastName || !form.email}
              data-testid="button-submit-edit-officer"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
