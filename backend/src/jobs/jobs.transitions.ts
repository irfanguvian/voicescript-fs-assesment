import { JobStatus } from '@prisma/client';

// Single source of truth for the job lifecycle. Each key lists the statuses
// that are legal to move to from that state. Reused by the status endpoint and
// by the parametrized transition test (Phase 6).
export const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.NEW]: [JobStatus.ASSIGNED],
  [JobStatus.ASSIGNED]: [JobStatus.TRANSCRIBED],
  [JobStatus.TRANSCRIBED]: [JobStatus.REVIEWED],
  [JobStatus.REVIEWED]: [JobStatus.COMPLETED],
  [JobStatus.COMPLETED]: [],
};

// Statuses the public status endpoint is allowed to set directly. ASSIGNED is
// reached via assign-reporter, COMPLETED via the complete endpoint (Phase 4).
export const MANUAL_STATUS_TARGETS: JobStatus[] = [
  JobStatus.TRANSCRIBED,
  JobStatus.REVIEWED,
];

// Returns true when moving `from` -> `to` is allowed. Moving to REVIEWED also
// requires an editor to have been assigned first.
export function isLegalTransition(
  from: JobStatus,
  to: JobStatus,
  opts: { hasEditor: boolean },
): boolean {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    return false;
  }
  if (to === JobStatus.REVIEWED && !opts.hasEditor) {
    return false;
  }
  return true;
}
