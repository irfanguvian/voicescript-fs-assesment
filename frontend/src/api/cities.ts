// Fixed set of operating cities (Indonesia). Kept hand-synced with the backend
// source of truth at backend/src/config/cities.ts — the backend @IsIn(CITIES)
// validation rejects anything off this list.
export const CITIES = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Medan',
  'Denpasar',
] as const;

export type City = (typeof CITIES)[number];
