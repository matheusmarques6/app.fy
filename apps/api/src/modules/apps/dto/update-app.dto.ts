import { IsString, IsOptional, Matches, MaxLength, IsObject } from 'class-validator';

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, {
    message: 'Bundle ID must be in reverse domain format (e.g., com.example.app)',
  })
  bundle_id_ios?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, {
    message: 'Package name must be in reverse domain format (e.g., com.example.app)',
  })
  bundle_id_android?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
