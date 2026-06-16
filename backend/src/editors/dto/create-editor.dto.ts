import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEditorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
