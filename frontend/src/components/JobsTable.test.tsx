import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Job, JobStatus } from '../api/types';
import { JobsTable } from './JobsTable';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    job_id: 'J1',
    case_name: 'Case A',
    duration_minutes: 60,
    location_type: 'REMOTE',
    city: null,
    status: 'NEW',
    reporter_id: null,
    editor_id: null,
    reporter_amount: null,
    editor_amount: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    finished_at: null,
    deleted_at: null,
    reporter: null,
    editor: null,
    earnings: { reporter_amount: null, editor_amount: null, total: 0 },
    ...overrides,
  };
}

const handlers = {
  pending: false,
  onAssignReporter: vi.fn(),
  onMarkTranscribed: vi.fn(),
  onAssignEditor: vi.fn(),
  onMarkReviewed: vi.fn(),
  onComplete: vi.fn(),
};

describe('JobsTable', () => {
  it('renders the empty state when there are no jobs', () => {
    render(<JobsTable jobs={[]} {...handlers} />);
    expect(screen.getByText(/No jobs yet/i)).toBeInTheDocument();
  });

  it('shows the status-appropriate action for a NEW job', () => {
    render(<JobsTable jobs={[makeJob({ status: 'NEW' })]} {...handlers} />);
    expect(
      screen.getByRole('button', { name: 'Assign reporter' }),
    ).toBeInTheDocument();
  });

  it('disables "Mark reviewed" until an editor is assigned', () => {
    const status: JobStatus = 'TRANSCRIBED';
    render(
      <JobsTable jobs={[makeJob({ status, editor_id: null })]} {...handlers} />,
    );

    // Editor not yet assigned: the assign-editor action is available and the
    // review action is blocked (mirrors the backend REVIEWED guard).
    expect(
      screen.getByRole('button', { name: 'Assign editor' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark reviewed' }),
    ).toBeDisabled();
  });
});
