import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CITIES } from '../../config/cities';

export class CreateReporterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(CITIES)
  city!: string;
}
