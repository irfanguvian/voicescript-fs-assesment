import { Module } from '@nestjs/common';
import { EditorsController } from './editors.controller';
import { EditorsService } from './editors.service';

@Module({
  controllers: [EditorsController],
  providers: [EditorsService],
  exports: [EditorsService],
})
export class EditorsModule {}
