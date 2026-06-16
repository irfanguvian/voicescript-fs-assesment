import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  JobStatus,
  LocationType,
  PayeeType,
  Prisma,
  WorkerStatus,
} from '@prisma/client';
import { ulid } from 'ulid';
import { getRates } from '../config/rates';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateJobDto } from './dto/create-job.dto';
import { isLegalTransition } from './jobs.transitions';

const JOB_INCLUDE = {
  reporter: { select: { reporter_id: true, name: true, city: true } },
  editor: { select: { editor_id: true, name: true } },
} satisfies Prisma.JobInclude;

type JobWithParties = Prisma.JobGetPayload<{ include: typeof JOB_INCLUDE }>;

// Shape returned by the row-lock query — only the columns the workflow needs.
interface JobLockRow {
  job_id: string;
  status: JobStatus;
  location_type: LocationType;
  city: string | null;
  reporter_id: string | null;
  editor_id: string | null;
}

// Workflow transactions (assign + complete) hold a job row lock while a peer may
// sit on a worker/balance row; pin READ COMMITTED and give a generous timeout so
// genuine contention surfaces as a clean conflict rather than Prisma's 5s default
// timeout (P2028).
const WORKFLOW_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 10_000,
} as const;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJobDto) {
    const job = await this.prisma.job.create({
      data: {
        job_id: ulid(),
        case_name: dto.case_name,
        duration_minutes: dto.duration_minutes,
        location_type: dto.location_type,
        city: dto.location_type === LocationType.PHYSICAL ? dto.city : null,
        status: JobStatus.NEW,
      },
    });
    return this.detail(job.job_id);
  }

  async list() {
    const jobs = await this.prisma.job.findMany({
      where: { deleted_at: null },
      include: JOB_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return jobs.map((job) => this.toResponse(job));
  }

  async detail(jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { job_id: jobId, deleted_at: null },
      include: JOB_INCLUDE,
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return this.toResponse(job);
  }

  // Locks the job row FOR UPDATE inside the caller's transaction so status
  // guards and the follow-up assignment are serialised against concurrent peers.
  private async lockJob(
    tx: Prisma.TransactionClient,
    jobId: string,
  ): Promise<JobLockRow> {
    const [job] = await tx.$queryRaw<JobLockRow[]>`
      SELECT job_id, status, location_type, city, reporter_id, editor_id
      FROM job
      WHERE job_id = ${jobId} AND deleted_at IS NULL
      FOR UPDATE`;
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  // Lock the job (must be NEW), then claim one AVAILABLE reporter preferring the
  // same city for PHYSICAL jobs. SKIP LOCKED lets concurrent callers fan out to
  // different reporters instead of serialising on the same row.
  async assignReporter(jobId: string) {
    await this.prisma.$transaction(async (tx) => {
      const job = await this.lockJob(tx, jobId);
      if (job.status !== JobStatus.NEW) {
        throw new ConflictException(`Job is ${job.status}, expected NEW`);
      }
      if (job.reporter_id) {
        throw new ConflictException('Job already has a reporter');
      }

      const preferCity = job.location_type === LocationType.PHYSICAL;
      const [reporter] = await tx.$queryRaw<{ reporter_id: string }[]>`
        SELECT reporter_id
        FROM reporter
        WHERE status = 'AVAILABLE' AND deleted_at IS NULL
        ORDER BY
          CASE WHEN ${preferCity} AND city = ${job.city} THEN 0 ELSE 1 END,
          created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (!reporter) {
        throw new ConflictException('No available reporter');
      }

      await tx.job.update({
        where: { job_id: jobId },
        data: { reporter_id: reporter.reporter_id, status: JobStatus.ASSIGNED },
      });
      await tx.reporter.update({
        where: { reporter_id: reporter.reporter_id },
        data: { status: WorkerStatus.BUSY },
      });
    }, WORKFLOW_TX_OPTIONS);
    return this.detail(jobId);
  }

  // Same lock pattern: job must be TRANSCRIBED with no editor yet.
  async assignEditor(jobId: string) {
    await this.prisma.$transaction(async (tx) => {
      const job = await this.lockJob(tx, jobId);
      if (job.status !== JobStatus.TRANSCRIBED) {
        throw new ConflictException(
          `Job is ${job.status}, expected TRANSCRIBED`,
        );
      }
      if (job.editor_id) {
        throw new ConflictException('Job already has an editor');
      }

      const [editor] = await tx.$queryRaw<{ editor_id: string }[]>`
        SELECT editor_id
        FROM editor
        WHERE status = 'AVAILABLE' AND deleted_at IS NULL
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (!editor) {
        throw new ConflictException('No available editor');
      }

      await tx.job.update({
        where: { job_id: jobId },
        data: { editor_id: editor.editor_id },
      });
      await tx.editor.update({
        where: { editor_id: editor.editor_id },
        data: { status: WorkerStatus.BUSY },
      });
    }, WORKFLOW_TX_OPTIONS);
    return this.detail(jobId);
  }

  // Single transaction: guard REVIEWED, compute payouts, append two ledger rows
  // (with before_balance), bump both balances, flip job to COMPLETED, release
  // both workers. The job FOR UPDATE lock makes this safe against double-pay:
  // a concurrent complete on the same job blocks, re-reads COMPLETED, and 409s.
  async complete(jobId: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockJob(tx, jobId);
      if (locked.status !== JobStatus.REVIEWED) {
        throw new ConflictException(
          `Job is ${locked.status}, expected REVIEWED`,
        );
      }
      if (!locked.reporter_id || !locked.editor_id) {
        throw new ConflictException('Job missing reporter or editor');
      }

      // Snapshot rates inside the locked region so a test (or config reload)
      // mutating process.env can't split the amount across the read and write.
      const { reporterRatePerMinute, editorFlatFee } = getRates();

      const job = await tx.job.findUniqueOrThrow({
        where: { job_id: jobId },
        select: { duration_minutes: true },
      });
      const reporterAmount = job.duration_minutes * reporterRatePerMinute;
      const editorAmount = editorFlatFee;

      // Lock the balance rows FOR UPDATE before the read-modify-write so
      // before_balance is the committed prior value and the increment can't
      // race a concurrent writer under READ COMMITTED.
      const [reporterRow] = await tx.$queryRaw<{ current_balance: number }[]>`
        SELECT current_balance FROM reporter_balance
        WHERE reporter_id = ${locked.reporter_id} FOR UPDATE`;
      const [editorRow] = await tx.$queryRaw<{ current_balance: number }[]>`
        SELECT current_balance FROM editor_balance
        WHERE editor_id = ${locked.editor_id} FOR UPDATE`;
      const beforeReporter = reporterRow.current_balance;
      const beforeEditor = editorRow.current_balance;

      await tx.balanceLedger.createMany({
        data: [
          {
            ledger_id: ulid(),
            job_id: jobId,
            payee_type: PayeeType.REPORTER,
            payee_id: locked.reporter_id,
            amount: reporterAmount,
            before_balance: beforeReporter,
            description: `Reporter payout for job ${jobId}`,
          },
          {
            ledger_id: ulid(),
            job_id: jobId,
            payee_type: PayeeType.EDITOR,
            payee_id: locked.editor_id,
            amount: editorAmount,
            before_balance: beforeEditor,
            description: `Editor payout for job ${jobId}`,
          },
        ],
      });

      await tx.reporterBalance.update({
        where: { reporter_id: locked.reporter_id },
        data: { current_balance: beforeReporter + reporterAmount },
      });
      await tx.editorBalance.update({
        where: { editor_id: locked.editor_id },
        data: { current_balance: beforeEditor + editorAmount },
      });

      await tx.job.update({
        where: { job_id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          finished_at: new Date(),
          reporter_amount: reporterAmount,
          editor_amount: editorAmount,
        },
      });
      await tx.reporter.update({
        where: { reporter_id: locked.reporter_id },
        data: { status: WorkerStatus.AVAILABLE },
      });
      await tx.editor.update({
        where: { editor_id: locked.editor_id },
        data: { status: WorkerStatus.AVAILABLE },
      });
    }, WORKFLOW_TX_OPTIONS);
    return this.detail(jobId);
  }

  async updateStatus(jobId: string, target: JobStatus) {
    const job = await this.prisma.job.findFirst({
      where: { job_id: jobId, deleted_at: null },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    if (
      !isLegalTransition(job.status, target, {
        hasEditor: job.editor_id !== null,
      })
    ) {
      throw new UnprocessableEntityException(
        `Illegal transition ${job.status} -> ${target}`,
      );
    }
    await this.prisma.job.update({
      where: { job_id: jobId },
      data: { status: target },
    });
    return this.detail(jobId);
  }

  private toResponse(job: JobWithParties) {
    return {
      ...job,
      earnings: {
        reporter_amount: job.reporter_amount,
        editor_amount: job.editor_amount,
        total: (job.reporter_amount ?? 0) + (job.editor_amount ?? 0),
      },
    };
  }
}
