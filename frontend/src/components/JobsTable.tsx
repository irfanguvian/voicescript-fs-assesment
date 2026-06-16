import type { Job } from '../api/types';
import { formatIdr } from '../format';
import { StatusBadge } from './StatusBadge';

interface JobsTableProps {
  jobs: Job[];
  pending: boolean;
  onAssignReporter: (jobId: string) => void;
  onMarkTranscribed: (jobId: string) => void;
  onAssignEditor: (jobId: string) => void;
  onMarkReviewed: (jobId: string) => void;
  onComplete: (jobId: string) => void;
}

// Renders the contextual action buttons for a job based on its status. Mirrors
// the backend workflow guards: REVIEWED needs an editor first; COMPLETED is
// terminal.
function JobActions({
  job,
  pending,
  onAssignReporter,
  onMarkTranscribed,
  onAssignEditor,
  onMarkReviewed,
  onComplete,
}: { job: Job } & Omit<JobsTableProps, 'jobs'>) {
  switch (job.status) {
    case 'NEW':
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() => onAssignReporter(job.job_id)}
        >
          Assign reporter
        </button>
      );
    case 'ASSIGNED':
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() => onMarkTranscribed(job.job_id)}
        >
          Mark transcribed
        </button>
      );
    case 'TRANSCRIBED':
      return (
        <>
          {!job.editor_id && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAssignEditor(job.job_id)}
            >
              Assign editor
            </button>
          )}
          <button
            type="button"
            disabled={pending || !job.editor_id}
            title={
              job.editor_id ? undefined : 'Assign an editor before reviewing'
            }
            onClick={() => onMarkReviewed(job.job_id)}
          >
            Mark reviewed
          </button>
        </>
      );
    case 'REVIEWED':
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() => onComplete(job.job_id)}
        >
          Complete
        </button>
      );
    default:
      return <span className="muted">—</span>;
  }
}

export function JobsTable({ jobs, ...actions }: JobsTableProps) {
  if (jobs.length === 0) {
    return <p className="muted">No jobs yet. Create one to get started.</p>;
  }

  return (
    <div className="jobs-table-wrap">
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Duration</th>
            <th>Location</th>
            <th>Status</th>
            <th>Reporter</th>
            <th>Editor</th>
            <th>Earnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.job_id}>
              <td>{job.case_name}</td>
              <td>{job.duration_minutes} min</td>
              <td>
                {job.location_type}
                {job.city ? ` · ${job.city}` : ''}
              </td>
              <td>
                <StatusBadge status={job.status} />
              </td>
              <td>{job.reporter?.name ?? <span className="muted">—</span>}</td>
              <td>{job.editor?.name ?? <span className="muted">—</span>}</td>
              <td>
                {job.earnings.total > 0 ? (
                  formatIdr(job.earnings.total)
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="actions">
                <div className="actions-group">
                  <JobActions job={job} {...actions} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
