import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api/client';
import type {
  CreateEditorInput,
  CreateJobInput,
  CreateReporterInput,
  Editor,
  Job,
  PaymentsSummary,
  Reporter,
} from './api/types';
import { CreateJobForm } from './components/CreateJobForm';
import { JobsTable } from './components/JobsTable';
import { PaymentsSummaryCard } from './components/PaymentsSummaryCard';
import { WorkersPanel } from './components/WorkersPanel';

export function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [jobsData, reportersData, editorsData, summaryData] =
      await Promise.all([
        api.listJobs(),
        api.listReporters(),
        api.listEditors(),
        api.getPaymentsSummary(),
      ]);
    setJobs(jobsData);
    setReporters(reportersData);
    setEditors(editorsData);
    setSummary(summaryData);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [loadAll]);

  // Runs a mutating action, then refreshes all dashboard data. Any failure
  // (backend guard, validation) surfaces as a dismissible banner.
  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setPending(true);
      setError(null);
      try {
        await action();
        await loadAll();
      } catch (err: unknown) {
        setError(errorMessage(err));
      } finally {
        setPending(false);
      }
    },
    [loadAll],
  );

  const createJob = (input: CreateJobInput) =>
    runAction(() => api.createJob(input));
  const addReporter = (input: CreateReporterInput) =>
    runAction(() => api.createReporter(input));
  const addEditor = (input: CreateEditorInput) =>
    runAction(() => api.createEditor(input));

  return (
    <main className="app">
      <h1>Court Reporting Workflow Manager</h1>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading dashboard…</p>
      ) : (
        <div className="layout">
          <section className="main-column">
            <h2>Jobs</h2>
            <JobsTable
              jobs={jobs}
              pending={pending}
              onAssignReporter={(id) => runAction(() => api.assignReporter(id))}
              onMarkTranscribed={(id) =>
                runAction(() => api.setStatus(id, 'TRANSCRIBED'))
              }
              onAssignEditor={(id) => runAction(() => api.assignEditor(id))}
              onMarkReviewed={(id) =>
                runAction(() => api.setStatus(id, 'REVIEWED'))
              }
              onComplete={(id) => runAction(() => api.completeJob(id))}
            />
          </section>

          <aside className="side-column">
            <CreateJobForm pending={pending} onCreate={createJob} />
            <PaymentsSummaryCard summary={summary} />
            <WorkersPanel
              reporters={reporters}
              editors={editors}
              pending={pending}
              onAddReporter={addReporter}
              onAddEditor={addEditor}
            />
          </aside>
        </div>
      )}
    </main>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong';
}
