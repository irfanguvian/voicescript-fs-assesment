// Fixed set of operating cities (Indonesia). Source of truth for same-city
// reporter matching — job.city and reporter.city are validated against this list
// so they can't drift (free-text "jakarta" vs "Jakarta" would break matching).
export const CITIES = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Medan',
  'Denpasar',
] as const;

export type City = (typeof CITIES)[number];
