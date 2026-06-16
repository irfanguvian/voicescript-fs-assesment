import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JobStatus, LocationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

// A detail() response shape — create()/updateStatus() both end by calling
// detail(), which reads the job back via findFirst with reporter/editor joins.
const detailRow = {
  job_id: 'J1',
  reporter: null,
  editor: null,
  reporter_amount: null,
  editor_amount: null,
};

describe('JobsService.create', () => {
  it('persists city for PHYSICAL jobs', async () => {
    const create = vi.fn(async ({ data }: { data: { job_id: string } }) => ({
      job_id: data.job_id,
    }));
    const prisma = {
      job: { create, findFirst: vi.fn(async () => detailRow) },
    };
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    const service = new JobsService(prisma as any);

    await service.create({
      case_name: 'Case A',
      duration_minutes: 60,
      location_type: LocationType.PHYSICAL,
      city: 'Jakarta',
    } as CreateJobDto);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          city: 'Jakarta',
          status: JobStatus.NEW,
        }),
      }),
    );
  });

  it('nulls city for REMOTE jobs', async () => {
    const create = vi.fn(async ({ data }: { data: { job_id: string } }) => ({
      job_id: data.job_id,
    }));
    const prisma = {
      job: { create, findFirst: vi.fn(async () => detailRow) },
    };
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    const service = new JobsService(prisma as any);

    await service.create({
      case_name: 'Case B',
      duration_minutes: 30,
      location_type: LocationType.REMOTE,
      city: 'ignored',
    } as CreateJobDto);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: null }) }),
    );
  });
});

describe('JobsService.updateStatus', () => {
  it('throws NotFound when the job is missing', async () => {
    const prisma = { job: { findFirst: vi.fn(async () => null) } };
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    const service = new JobsService(prisma as any);

    await expect(service.updateStatus('missing', JobStatus.TRANSCRIBED)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an illegal transition (NEW -> REVIEWED)', async () => {
    const prisma = {
      job: {
        findFirst: vi.fn(async () => ({ status: JobStatus.NEW, editor_id: null })),
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    const service = new JobsService(prisma as any);

    await expect(service.updateStatus('J1', JobStatus.REVIEWED)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('performs the update on a legal transition (ASSIGNED -> TRANSCRIBED)', async () => {
    const update = vi.fn(async () => ({}));
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ status: JobStatus.ASSIGNED, editor_id: null })
      .mockResolvedValueOnce(detailRow);
    const prisma = { job: { findFirst, update } };
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock
    const service = new JobsService(prisma as any);

    await service.updateStatus('J1', JobStatus.TRANSCRIBED);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: JobStatus.TRANSCRIBED },
      }),
    );
  });
});
