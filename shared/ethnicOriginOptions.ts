/** UK ethnic origin categories (ONS-style), stored as display labels in employees.ethnic_origin */
export const ETHNIC_ORIGIN_OPTIONS = [
  "White - British",
  "White - Irish",
  "White - Other",
  "Mixed - White and Black Caribbean",
  "Mixed - White and Black African",
  "Mixed - White and Asian",
  "Mixed - Other",
  "Asian or Asian British - Indian",
  "Asian or Asian British - Pakistani",
  "Asian or Asian British - Bangladeshi",
  "Asian or Asian British - Chinese",
  "Asian or Asian British - Other",
  "Black or Black British - Caribbean",
  "Black or Black British - African",
  "Black or Black British - Other",
  "Other ethnic group",
  "Prefer not to say",
] as const;

export type EthnicOriginOption = (typeof ETHNIC_ORIGIN_OPTIONS)[number];

export function isKnownEthnicOrigin(value: string | null | undefined): value is EthnicOriginOption {
  if (!value) return false;
  return (ETHNIC_ORIGIN_OPTIONS as readonly string[]).includes(value);
}
