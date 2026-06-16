import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JobStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { buildHarness, resetDb } from './helpers/e2e';

// Thin e2e top of the trophy: one happy path through the public API only, no
// direct DB seeding — create everything via endpoints, then assert the payments
// summary the dashboard reads.
describe('happy path (e2e via HTTP)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildHarness());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  const post = (url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload });
  const get = (url: string) => app.inject({ method: 'GET', url });

  it('create -> assign-reporter -> TRANSCRIBED -> assign-editor -> REVIEWED -> complete -> summary', async () => {
    const reporterRes = await post('/api/reporters', {
      name: 'Andi',
      city: 'Jakarta',
    });
    expect(reporterRes.statusCode).toBe(201);
    const reporterId = reporterRes.json().reporter_id;

    const editorRes = await post('/api/editors', { name: 'Budi' });
    expect(editorRes.statusCode).toBe(201);
    const editorId = editorRes.json().editor_id;

    const createRes = await post('/api/jobs', {
      case_name: 'State v. Example',
      duration_minutes: 90,
      location_type: 'PHYSICAL',
      city: 'Jakarta',
    });
    expect(createRes.statusCode).toBe(201);
    const job = createRes.json();
    const jobId = job.job_id;
    expect(job.status).toBe(JobStatus.NEW);

    const assignReporter = await post(`/api/jobs/${jobId}/assign-reporter`);
    expect(assignReporter.statusCode).toBe(200);
    expect(assignReporter.json().status).toBe(JobStatus.ASSIGNED);
    expect(assignReporter.json().reporter.reporter_id).toBe(reporterId);

    const transcribed = await post(`/api/jobs/${jobId}/status`, {
      status: 'TRANSCRIBED',
    });
    expect(transcribed.statusCode).toBe(200);
    expect(transcribed.json().status).toBe(JobStatus.TRANSCRIBED);

    const assignEditor = await post(`/api/jobs/${jobId}/assign-editor`);
    expect(assignEditor.statusCode).toBe(200);
    expect(assignEditor.json().editor.editor_id).toBe(editorId);

    const reviewed = await post(`/api/jobs/${jobId}/status`, {
      status: 'REVIEWED',
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json().status).toBe(JobStatus.REVIEWED);

    const completed = await post(`/api/jobs/${jobId}/complete`);
    expect(completed.statusCode).toBe(200);
    const done = completed.json();
    expect(done.status).toBe(JobStatus.COMPLETED);
    expect(done.finished_at).not.toBeNull();
    expect(done.earnings.total).toBe(180000 + 50000);

    const summaryRes = await get('/api/payments/summary');
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary.total_payout).toBe(230000);

    const reporterSummary = summary.reporters.find(
      (r: { reporter_id: string }) => r.reporter_id === reporterId,
    );
    const editorSummary = summary.editors.find(
      (e: { editor_id: string }) => e.editor_id === editorId,
    );
    expect(reporterSummary.current_balance).toBe(180000);
    expect(editorSummary.current_balance).toBe(50000);
    expect(reporterSummary.jobs).toHaveLength(1);
    expect(editorSummary.jobs).toHaveLength(1);
  });
});
