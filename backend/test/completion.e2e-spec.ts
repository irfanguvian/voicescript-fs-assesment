import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JobStatus, PayeeType, WorkerStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import {
  buildHarness,
  createEditor,
  createJob,
  createReporter,
  resetDb,
} from './helpers/e2e';

// Integration: ledger/balance consistency and transaction atomicity — the other
// seam that only real Postgres proves. Defaults: 2000 IDR/min, 50000 flat fee.
describe('completion consistency + atomicity (integration, real Postgres)', () => {
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

  // Builds a REVIEWED job with both workers attached and the workers flipped to
  // BUSY, ready for completion.
  async function reviewedJob(reporterBalance = 0, editorBalance = 0) {
    const reporterId = await createReporter(prisma, {
      balance: reporterBalance,
    });
    const editorId = await createEditor(prisma, { balance: editorBalance });
    await prisma.reporter.update({
      where: { reporter_id: reporterId },
      data: { status: WorkerStatus.BUSY },
    });
    await prisma.editor.update({
      where: { editor_id: editorId },
      data: { status: WorkerStatus.BUSY },
    });
    const jobId = await createJob(prisma, {
      status: JobStatus.REVIEWED,
      duration: 90,
      reporter_id: reporterId,
      editor_id: editorId,
    });
    return { jobId, reporterId, editorId };
  }

  it('completes a 90-min job with consistent ledger rows and balances', async () => {
    const { jobId, reporterId, editorId } = await reviewedJob(0, 0);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${jobId}/complete`,
    });
    expect(res.statusCode).toBe(200);

    const job = await prisma.job.findUniqueOrThrow({
      where: { job_id: jobId },
    });
    expect(job.status).toBe(JobStatus.COMPLETED);
    expect(job.finished_at).not.toBeNull();
    expect(job.reporter_amount).toBe(180000);
    expect(job.editor_amount).toBe(50000);

    const ledger = await prisma.balanceLedger.findMany({
      where: { job_id: jobId },
      orderBy: { payee_type: 'asc' },
    });
    expect(ledger).toHaveLength(2);
    const reporterRow = ledger.find((l) => l.payee_type === PayeeType.REPORTER);
    const editorRow = ledger.find((l) => l.payee_type === PayeeType.EDITOR);
    expect(reporterRow?.amount).toBe(180000);
    expect(reporterRow?.before_balance).toBe(0);
    expect(editorRow?.amount).toBe(50000);
    expect(editorRow?.before_balance).toBe(0);

    const reporterBalance = await prisma.reporterBalance.findUniqueOrThrow({
      where: { reporter_id: reporterId },
    });
    const editorBalance = await prisma.editorBalance.findUniqueOrThrow({
      where: { editor_id: editorId },
    });
    expect(reporterBalance.current_balance).toBe(180000);
    expect(editorBalance.current_balance).toBe(50000);

    const reporter = await prisma.reporter.findUniqueOrThrow({
      where: { reporter_id: reporterId },
    });
    const editor = await prisma.editor.findUniqueOrThrow({
      where: { editor_id: editorId },
    });
    expect(reporter.status).toBe(WorkerStatus.AVAILABLE);
    expect(editor.status).toBe(WorkerStatus.AVAILABLE);
  });

  it('before_balance reflects a non-zero prior balance', async () => {
    const { jobId, reporterId } = await reviewedJob(100000, 25000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${jobId}/complete`,
    });
    expect(res.statusCode).toBe(200);

    const reporterRow = await prisma.balanceLedger.findFirstOrThrow({
      where: { job_id: jobId, payee_type: PayeeType.REPORTER },
    });
    expect(reporterRow.before_balance).toBe(100000);

    const reporterBalance = await prisma.reporterBalance.findUniqueOrThrow({
      where: { reporter_id: reporterId },
    });
    expect(reporterBalance.current_balance).toBe(100000 + 180000);
  });

  it('atomicity: a write that fails AFTER the ledger insert rolls everything back', async () => {
    // Stage the reporter near int4's ceiling so the ledger rows insert cleanly
    // (amount + before_balance both fit), but the follow-up
    // `reporterBalance.update` (beforeBalance + amount) overflows int4 and the
    // DB aborts the write. The failure lands AFTER the ledger createMany has
    // already run, so a non-atomic implementation would leave orphan ledger rows
    // and a half-applied balance. INT4_MAX = 2_147_483_647.
    const startBalance = 2_000_000_000;
    const { jobId, reporterId } = await reviewedJob(startBalance, 0);
    await prisma.job.update({
      where: { job_id: jobId },
      data: { duration_minutes: 90_000 }, // payout = 180_000_000; sum overflows
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${jobId}/complete`,
    });
    expect(res.statusCode).toBe(500);

    // Rollback proof: the ledger rows the tx inserted are gone, the reporter
    // balance is untouched, and the job never advanced past REVIEWED.
    const ledger = await prisma.balanceLedger.findMany({
      where: { job_id: jobId },
    });
    expect(ledger).toHaveLength(0);

    const reporterBalance = await prisma.reporterBalance.findUniqueOrThrow({
      where: { reporter_id: reporterId },
    });
    expect(reporterBalance.current_balance).toBe(startBalance);

    const job = await prisma.job.findUniqueOrThrow({
      where: { job_id: jobId },
    });
    expect(job.status).toBe(JobStatus.REVIEWED);
  });
});
