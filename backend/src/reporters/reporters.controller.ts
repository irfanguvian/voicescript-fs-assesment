import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateReporterDto } from './dto/create-reporter.dto';
import { ReportersService } from './reporters.service';

@Controller('reporters')
export class ReportersController {
  constructor(private readonly reporters: ReportersService) {}

  @Post()
  create(@Body() dto: CreateReporterDto) {
    return this.reporters.create(dto);
  }

  @Get()
  list() {
    return this.reporters.list();
  }
}
