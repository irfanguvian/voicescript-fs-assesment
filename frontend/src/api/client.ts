import type {
  CreateEditorInput,
  CreateJobInput,
  CreateReporterInput,
  Editor,
  Job,
  JobStatus,
  PaymentsSummary,
  Reporter,
} from './types';

// Shape of the backend error envelope (AllExceptionsFilter).
interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

// Error thrown for any non-2xx response, carrying the backend message so the UI
// can show a meaningful reason instead of a generic failure.
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function envelopeMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as ErrorEnvelope).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare a JSON body when one is actually sent. A bodyless POST (e.g.
  // assign-reporter) with Content-Type: application/json makes Fastify reject
  // the request with "Body cannot be empty when content-type is set to
  // 'application/json'".
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      envelopeMessage(body, `Request failed (${response.status})`),
    );
  }
  return body as T;
}

function post<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

export const api = {
  listJobs: () => request<Job[]>('/jobs'),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  createJob: (input: CreateJobInput) => post<Job>('/jobs', input),
  assignReporter: (jobId: string) =>
    post<Job>(`/jobs/${jobId}/assign-reporter`),
  assignEditor: (jobId: string) => post<Job>(`/jobs/${jobId}/assign-editor`),
  setStatus: (jobId: string, status: JobStatus) =>
    post<Job>(`/jobs/${jobId}/status`, { status }),
  completeJob: (jobId: string) => post<Job>(`/jobs/${jobId}/complete`),

  listReporters: () => request<Reporter[]>('/reporters'),
  createReporter: (input: CreateReporterInput) =>
    post<Reporter>('/reporters', input),

  listEditors: () => request<Editor[]>('/editors'),
  createEditor: (input: CreateEditorInput) => post<Editor>('/editors', input),

  getPaymentsSummary: () => request<PaymentsSummary>('/payments/summary'),
};
