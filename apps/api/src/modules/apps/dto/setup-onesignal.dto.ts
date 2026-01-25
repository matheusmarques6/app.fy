import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class SetupOneSignalDto {
  @IsOptional()
  @IsBoolean()
  auto_create?: boolean;

  // For manual setup
  @IsOptional()
  @IsString()
  @IsUUID('4')
  app_id?: string;

  @IsOptional()
  @IsString()
  api_key?: string;
}

export class OneSignalConfigResponse {
  configured: boolean;
  app_id?: string;
  created_at?: string;
}
