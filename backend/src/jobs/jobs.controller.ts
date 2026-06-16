import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobs.create(dto);
  }

  @Get()
  list() {
    return this.jobs.list();
  }

  @Get(':job_id')
  detail(@Param('job_id') jobId: string) {
    return this.jobs.detail(jobId);
  }

  @Post(':job_id/assign-reporter')
  @HttpCode(HttpStatus.OK)
  assignReporter(@Param('job_id') jobId: string) {
    return this.jobs.assignReporter(jobId);
  }

  @Post(':job_id/assign-editor')
  @HttpCode(HttpStatus.OK)
  assignEditor(@Param('job_id') jobId: string) {
    return this.jobs.assignEditor(jobId);
  }

  @Post(':job_id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('job_id') jobId: string, @Body() dto: UpdateStatusDto) {
    return this.jobs.updateStatus(jobId, dto.status);
  }

  @Post(':job_id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('job_id') jobId: string) {
    return this.jobs.complete(jobId);
  }
}
