export type BroadcastChannel = "email" | "sms";
export type OfficerFilter = "all" | "previously_worked" | "car_owner" | "new";
export type MessageScope = "single" | "all";

export type BroadcastSite = {
  id: number;
  name: string;
  address: string | null;
  postcode: string | null;
};

export type BroadcastConfig = {
  emailEnabled: boolean;
  emailFrom: string | null;
  smsEnabled: boolean;
  radiusOptions: number[];
  maxRecipients: number;
};

export type ShiftMessage = {
  site: BroadcastSite;
  shiftIds: number[];
  subject: string;
  body: string;
};

export type BroadcastOfficer = {
  employeeId: number;
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  officerType: string | null;
  carOwner: boolean;
  distanceMiles: number;
  siteShifts: number;
  totalShifts: number;
  lastWorked: string | null;
  isNew: boolean;
};

export type OfficerSearchResult = {
  center: { lat: number; lng: number; source: string; postcode: string | null };
  officers: BroadcastOfficer[];
  truncated: boolean;
  geocodePending: number;
};

export type BroadcastStatus = {
  id: number;
  channel: BroadcastChannel;
  status: "sending" | "completed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failures: Array<{ employeeId: number | null; name: string | null; destination: string; error: string | null }>;
};
