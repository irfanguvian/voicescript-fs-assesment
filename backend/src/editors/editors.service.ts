import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEditorDto } from './dto/create-editor.dto';

@Injectable()
export class EditorsService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the editor and its zeroed balance row in one nested create.
  async create(dto: CreateEditorDto) {
    return this.prisma.editor.create({
      data: {
        editor_id: ulid(),
        name: dto.name,
        balance: { create: { current_balance: 0 } },
      },
      include: { balance: true },
    });
  }

  async list() {
    return this.prisma.editor.findMany({
      where: { deleted_at: null },
      include: { balance: true },
      orderBy: { created_at: 'asc' },
    });
  }
}
