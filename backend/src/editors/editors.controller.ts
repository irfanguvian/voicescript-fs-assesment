import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateEditorDto } from './dto/create-editor.dto';
import { EditorsService } from './editors.service';

@Controller('editors')
export class EditorsController {
  constructor(private readonly editors: EditorsService) {}

  @Post()
  create(@Body() dto: CreateEditorDto) {
    return this.editors.create(dto);
  }

  @Get()
  list() {
    return this.editors.list();
  }
}
