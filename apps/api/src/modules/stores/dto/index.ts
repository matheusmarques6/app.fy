import {
  IsString,
  IsIn,
  IsOptional,
  IsUrl,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_PLATFORMS } from '@appfy/shared';

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsIn(SUPPORTED_PLATFORMS)
  platform: 'shopify' | 'woocommerce';

  @IsString()
  primary_domain: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  default_locale?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  primary_domain?: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}
