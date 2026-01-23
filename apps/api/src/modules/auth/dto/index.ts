import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class OneSignalDto {
  @IsString()
  @IsOptional()
  provider_sub_id?: string;
}

class AttestationDto {
  @IsIn(['none', 'play_integrity', 'app_attest'])
  type: 'none' | 'play_integrity' | 'app_attest';

  @IsString()
  @IsOptional()
  token?: string;
}

export class RegisterDeviceDto {
  @IsUUID()
  app_id: string;

  @IsUUID()
  store_id: string;

  @IsString()
  device_fingerprint: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  locale: string;

  @IsString()
  timezone: string;

  @IsString()
  country_guess: string;

  @IsObject()
  @ValidateNested()
  @Type(() => OneSignalDto)
  @IsOptional()
  onesignal?: OneSignalDto;

  @IsObject()
  @ValidateNested()
  @Type(() => AttestationDto)
  @IsOptional()
  attestation?: AttestationDto;
}

export class RefreshTokenDto {
  @IsString()
  refresh_token: string;
}
