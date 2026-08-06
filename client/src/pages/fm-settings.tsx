import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Sparkles, Wrench, Users, ClipboardList, CalendarDays, Truck } from "lucide-react";

export default function FmSettingsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7 text-[#FF8C42]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-settings-title">FM Services Settings</h1>
          <p className="text-sm text-gray-500">Configure your facilities management module</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#FF8C42]" />
              <CardTitle className="text-[#1F3A5F]">FM Services Add-on</CardTitle>
            </div>
            <Badge className="bg-green-600" data-testid="badge-addon-status">Active</Badge>
          </div>
          <CardDescription>
            Manage facilities workforce — cleaning, maintenance, and engineering — alongside your security operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate("/addons")} data-testid="button-manage-addon">
            Manage add-ons
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1F3A5F]">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "FM Dashboard", url: "/fm-dashboard", icon: Wrench },
              { label: "FM Workers", url: "/fm-workers", icon: Users },
              { label: "FM Jobs", url: "/fm-jobs", icon: ClipboardList },
              { label: "PPM Schedules", url: "/fm-ppm", icon: CalendarDays },
              { label: "FM Suppliers", url: "/fm-suppliers", icon: Truck },
            ].map((l) => (
              <Button key={l.url} variant="outline" onClick={() => navigate(l.url)} className="justify-start h-auto py-3" data-testid={`link-${l.url.slice(1)}`}>
                <l.icon className="h-4 w-4 mr-2 text-[#FF8C42]" />
                {l.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1F3A5F]">Service Lines</CardTitle>
          <CardDescription>The FM module supports three service lines out of the box.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 text-center" data-testid="card-service-cleaning">
              <Badge className="bg-blue-500 mb-2">Cleaning</Badge>
              <p className="text-xs text-gray-500">Daily, periodic and deep cleans</p>
            </div>
            <div className="border rounded-lg p-3 text-center" data-testid="card-service-maintenance">
              <Badge className="bg-[#FF8C42] mb-2">Maintenance</Badge>
              <p className="text-xs text-gray-500">Reactive repairs and PPM</p>
            </div>
            <div className="border rounded-lg p-3 text-center" data-testid="card-service-engineering">
              <Badge className="bg-purple-600 mb-2">Engineering</Badge>
              <p className="text-xs text-gray-500">M&amp;E inspections and projects</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
