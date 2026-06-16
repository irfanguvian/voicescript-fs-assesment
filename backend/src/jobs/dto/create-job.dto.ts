import { LocationType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { CITIES } from '../../config/cities';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  case_name!: string;

  @IsInt()
  @Min(1)
  duration_minutes!: number;

  @IsEnum(LocationType)
  location_type!: LocationType;

  // City is required for PHYSICAL jobs (used for same-city reporter preference)
  // and ignored/optional for REMOTE jobs. Must be one of the fixed operating cities.
  @ValidateIf((o: CreateJobDto) => o.location_type === LocationType.PHYSICAL)
  @IsString()
  @IsIn(CITIES)
  city?: string;
}
