import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { JobStatus, LocationType, WorkerStatus } from '@prisma/client';
import { ulid } from 'ulid';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

// Boots the real Nest app on the Fastify adapter wired exactly like main.ts
// (global /api prefix, ValidationPipe, exception filter) so integration/e2e
// specs exercise the production request path and drive it via app.inject().
export interface TestHarness {
  app: NestFastifyApplication;
  prisma: PrismaService;
}

export async function buildHarness(): Promise<TestHarness> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

// Wipe every workflow table so each spec owns a deterministic DB state. CASCADE
// + RESTART IDENTITY clears jobs, workers, balances and the ledger in one shot.
// NOTE: this empties the dev seed data; re-run `pnpm prisma:seed` afterward.
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE balance_ledger, "job", reporter_balance, editor_balance, reporter, editor RESTART IDENTITY CASCADE',
  );
}

export async function createReporter(
  prisma: PrismaService,
  opts: { city?: string; balance?: number } = {},
): Promise<string> {
  const reporter_id = ulid();
  await prisma.reporter.create({
    data: {
      reporter_id,
      name: `Reporter ${reporter_id.slice(-6)}`,
      city: opts.city ?? 'Jakarta',
      status: WorkerStatus.AVAILABLE,
      balance: { create: { current_balance: opts.balance ?? 0 } },
    },
  });
  return reporter_id;
}

export async function createEditor(
  prisma: PrismaService,
  opts: { balance?: number } = {},
): Promise<string> {
  const editor_id = ulid();
  await prisma.editor.create({
    data: {
      editor_id,
      name: `Editor ${editor_id.slice(-6)}`,
      status: WorkerStatus.AVAILABLE,
      balance: { create: { current_balance: opts.balance ?? 0 } },
    },
  });
  return editor_id;
}

export async function createJob(
  prisma: PrismaService,
  opts: {
    status?: JobStatus;
    duration?: number;
    city?: string;
    location?: LocationType;
    reporter_id?: string;
    editor_id?: string;
  } = {},
): Promise<string> {
  const job_id = ulid();
  const location = opts.location ?? LocationType.REMOTE;
  await prisma.job.create({
    data: {
      job_id,
      case_name: `Case ${job_id.slice(-6)}`,
      duration_minutes: opts.duration ?? 90,
      location_type: location,
      city:
        location === LocationType.PHYSICAL ? (opts.city ?? 'Jakarta') : null,
      status: opts.status ?? JobStatus.NEW,
      reporter_id: opts.reporter_id ?? null,
      editor_id: opts.editor_id ?? null,
    },
  });
  return job_id;
}
