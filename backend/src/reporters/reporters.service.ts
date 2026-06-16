import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReporterDto } from './dto/create-reporter.dto';

@Injectable()
export class ReportersService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the reporter and its zeroed balance row in one nested create.
  async create(dto: CreateReporterDto) {
    return this.prisma.reporter.create({
      data: {
        reporter_id: ulid(),
        name: dto.name,
        city: dto.city,
        balance: { create: { current_balance: 0 } },
      },
      include: { balance: true },
    });
  }

  async list() {
    return this.prisma.reporter.findMany({
      where: { deleted_at: null },
      include: { balance: true },
      orderBy: { created_at: 'asc' },
    });
  }
}
