// Mirrors the backend response shapes (backend/src/**). Kept hand-written rather
// than generated so the frontend stays decoupled from Prisma's client types.

export type JobStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'TRANSCRIBED'
  | 'REVIEWED'
  | 'COMPLETED';

export type LocationType = 'PHYSICAL' | 'REMOTE';

export type WorkerStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

// Parties are included via Prisma `select`, so only these fields are present.
export interface JobReporter {
  reporter_id: string;
  name: string;
  city: string;
}

export interface JobEditor {
  editor_id: string;
  name: string;
}

export interface JobEarnings {
  reporter_amount: number | null;
  editor_amount: number | null;
  total: number;
}

export interface Job {
  job_id: string;
  case_name: string;
  duration_minutes: number;
  location_type: LocationType;
  city: string | null;
  status: JobStatus;
  reporter_id: string | null;
  editor_id: string | null;
  reporter_amount: number | null;
  editor_amount: number | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  deleted_at: string | null;
  reporter: JobReporter | null;
  editor: JobEditor | null;
  earnings: JobEarnings;
}

export interface Balance {
  current_balance: number;
}

export interface Reporter {
  reporter_id: string;
  name: string;
  city: string;
  status: WorkerStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  balance: Balance | null;
}

export interface Editor {
  editor_id: string;
  name: string;
  status: WorkerStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  balance: Balance | null;
}

export interface LedgerRow {
  ledger_id: string;
  job_id: string;
  amount: number;
  before_balance: number;
  description: string;
  created_at: string;
}

export interface PayeeSummary {
  name: string;
  current_balance: number;
  jobs: LedgerRow[];
}

export interface ReporterSummary extends PayeeSummary {
  reporter_id: string;
}

export interface EditorSummary extends PayeeSummary {
  editor_id: string;
}

export interface PaymentsSummary {
  total_payout: number;
  reporters: ReporterSummary[];
  editors: EditorSummary[];
}

// POST bodies.
export interface CreateJobInput {
  case_name: string;
  duration_minutes: number;
  location_type: LocationType;
  city?: string;
}

export interface CreateReporterInput {
  name: string;
  city: string;
}

export interface CreateEditorInput {
  name: string;
}
