import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JobStatus, LocationType, WorkerStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import {
  buildHarness,
  createJob,
  createReporter,
  resetDb,
} from './helpers/e2e';

// Integration layer (the fat middle of the Testing Trophy): the assignment
// concurrency guarantees only a real Postgres can prove. One highest-return test
// per concern — FOR UPDATE serialisation, and SKIP LOCKED fan-out.
describe('assign-reporter concurrency (integration, real Postgres)', () => {
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

  const assign = (jobId: string) =>
    app.inject({
      method: 'POST',
      url: `/api/jobs/${jobId}/assign-reporter`,
    });

  it('FOR UPDATE: 20 parallel assigns on 1 job + 1 reporter -> exactly 1 winner', async () => {
    const reporterId = await createReporter(prisma);
    const jobId = await createJob(prisma);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => assign(jobId)),
    );
    const codes = results.map((r) => r.statusCode);

    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);

    const job = await prisma.job.findUniqueOrThrow({
      where: { job_id: jobId },
    });
    expect(job.status).toBe(JobStatus.ASSIGNED);
    expect(job.reporter_id).toBe(reporterId);

    const reporter = await prisma.reporter.findUniqueOrThrow({
      where: { reporter_id: reporterId },
    });
    expect(reporter.status).toBe(WorkerStatus.BUSY);
  });

  it('SKIP LOCKED: 5 jobs + 3 reporters in parallel -> 3 win, no reporter double-booked', async () => {
    const reporters = await Promise.all([
      createReporter(prisma),
      createReporter(prisma),
      createReporter(prisma),
    ]);
    const jobIds = await Promise.all([
      createJob(prisma),
      createJob(prisma),
      createJob(prisma),
      createJob(prisma),
      createJob(prisma),
    ]);

    const results = await Promise.all(jobIds.map((id) => assign(id)));
    const codes = results.map((r) => r.statusCode);

    expect(codes.filter((c) => c === 200)).toHaveLength(3);
    expect(codes.filter((c) => c === 409)).toHaveLength(2);

    const assigned = await prisma.job.findMany({
      where: { status: JobStatus.ASSIGNED },
    });
    expect(assigned).toHaveLength(3);

    // The two losers never advanced: still NEW, no reporter attached.
    const stillNew = await prisma.job.findMany({
      where: { status: JobStatus.NEW },
    });
    expect(stillNew).toHaveLength(2);
    expect(stillNew.every((j) => j.reporter_id === null)).toBe(true);

    // No reporter assigned to more than one job.
    const usedReporterIds = assigned.map((j) => j.reporter_id);
    expect(new Set(usedReporterIds).size).toBe(3);
    for (const id of usedReporterIds) {
      expect(reporters).toContain(id);
    }

    // Exactly the three claimed reporters flipped to BUSY.
    const busy = await prisma.reporter.findMany({
      where: { status: WorkerStatus.BUSY },
    });
    expect(busy).toHaveLength(3);
  });

  it('same-city preference under concurrency: PHYSICAL jobs claim same-city reporters first, not the out-of-city ones', async () => {
    // 2 Jakarta + 2 Bandung reporters; 2 PHYSICAL Jakarta jobs assigned in
    // parallel. The same-city ORDER BY + SKIP LOCKED must hand both jobs a
    // Jakarta reporter and leave the Bandung reporters untouched — proving the
    // preference branch holds under contention (existing tests only cover the
    // REMOTE/no-city path).
    const jakartaIds = await Promise.all([
      createReporter(prisma, { city: 'Jakarta' }),
      createReporter(prisma, { city: 'Jakarta' }),
    ]);
    const bandungIds = await Promise.all([
      createReporter(prisma, { city: 'Bandung' }),
      createReporter(prisma, { city: 'Bandung' }),
    ]);
    const jobIds = await Promise.all([
      createJob(prisma, { location: LocationType.PHYSICAL, city: 'Jakarta' }),
      createJob(prisma, { location: LocationType.PHYSICAL, city: 'Jakarta' }),
    ]);

    const results = await Promise.all(jobIds.map((id) => assign(id)));
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);

    const assigned = await prisma.job.findMany({
      where: { status: JobStatus.ASSIGNED },
    });
    const claimed = assigned.map((j) => j.reporter_id);

    // Both jobs took distinct Jakarta reporters — same-city preferred over the
    // available Bandung fallbacks, and no reporter double-booked.
    expect(new Set(claimed).size).toBe(2);
    expect(claimed.every((id) => jakartaIds.includes(id as string))).toBe(true);

    // The out-of-city reporters were never touched.
    const bandung = await prisma.reporter.findMany({
      where: { reporter_id: { in: bandungIds } },
    });
    expect(bandung.every((r) => r.status === WorkerStatus.AVAILABLE)).toBe(true);
  });
});
