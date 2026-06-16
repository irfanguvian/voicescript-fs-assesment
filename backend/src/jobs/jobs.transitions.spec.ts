import { JobStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isLegalTransition } from './jobs.transitions';

// Thin unit layer: the lifecycle guard is the one piece of pure logic worth
// covering exhaustively, so a single parametrized matrix walks every from/to
// pair (× hasEditor) instead of one test per edge.
const STATUSES: JobStatus[] = [
  JobStatus.NEW,
  JobStatus.ASSIGNED,
  JobStatus.TRANSCRIBED,
  JobStatus.REVIEWED,
  JobStatus.COMPLETED,
];

// Expected verdict for (from, to, hasEditor). REVIEWED is the only edge gated on
// an editor; every other legal edge ignores it.
function expected(from: JobStatus, to: JobStatus, hasEditor: boolean): boolean {
  if (from === JobStatus.NEW && to === JobStatus.ASSIGNED) return true;
  if (from === JobStatus.ASSIGNED && to === JobStatus.TRANSCRIBED) return true;
  if (from === JobStatus.TRANSCRIBED && to === JobStatus.REVIEWED) {
    return hasEditor;
  }
  if (from === JobStatus.REVIEWED && to === JobStatus.COMPLETED) return true;
  return false;
}

const cases = STATUSES.flatMap((from) =>
  STATUSES.flatMap((to) =>
    [false, true].map((hasEditor) => ({ from, to, hasEditor })),
  ),
);

describe('isLegalTransition (matrix)', () => {
  it.each(cases)(
    '$from -> $to (hasEditor=$hasEditor)',
    ({ from, to, hasEditor }) => {
      expect(isLegalTransition(from, to, { hasEditor })).toBe(
        expected(from, to, hasEditor),
      );
    },
  );

  // Spot-check the headline cases from the acceptance criteria explicitly so a
  // regression in the matrix helper itself can't mask them.
  it('blocks TRANSCRIBED -> REVIEWED without an editor but allows it with one', () => {
    expect(
      isLegalTransition(JobStatus.TRANSCRIBED, JobStatus.REVIEWED, {
        hasEditor: false,
      }),
    ).toBe(false);
    expect(
      isLegalTransition(JobStatus.TRANSCRIBED, JobStatus.REVIEWED, {
        hasEditor: true,
      }),
    ).toBe(true);
  });

  it('rejects the NEW -> REVIEWED skip', () => {
    expect(
      isLegalTransition(JobStatus.NEW, JobStatus.REVIEWED, { hasEditor: true }),
    ).toBe(false);
  });
});
