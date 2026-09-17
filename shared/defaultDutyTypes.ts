/** Default duty types seeded for every tenant. `requiresLicense` controls SIA checks on shift assign. */
export const DEFAULT_DUTY_TYPES = [
  { name: "Door Supervisor", requiresLicense: true },
  { name: "Security Guard", requiresLicense: true },
  { name: "CCTV Operator", requiresLicense: true },
  { name: "Close Protection", requiresLicense: true },
  { name: "Steward", requiresLicense: false },
  { name: "Construction", requiresLicense: false },
  { name: "Cleaners", requiresLicense: false },
  { name: "Fire Marshall", requiresLicense: false },
  { name: "LFT Tester", requiresLicense: false },
] as const;
