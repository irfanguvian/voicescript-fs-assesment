import type { JobStatus } from '@prisma/client';
import { IsIn } from 'class-validator';
import { MANUAL_STATUS_TARGETS } from '../jobs.transitions';

export class UpdateStatusDto {
  @IsIn(MANUAL_STATUS_TARGETS)
  status!: JobStatus;
}
