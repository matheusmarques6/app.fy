import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class UploadIosCredentialDto {
  /**
   * Base64-encoded P12 certificate file
   */
  @IsString()
  @IsNotEmpty()
  certificate_p12: string;

  /**
   * Password for the P12 file
   */
  @IsString()
  @IsNotEmpty()
  password: string;

  /**
   * Base64-encoded provisioning profile
   */
  @IsString()
  @IsNotEmpty()
  provisioning_profile: string;
}

export interface IosCredentialResponse {
  id: string;
  platform: 'ios';
  metadata: {
    team_id: string;
    bundle_id: string;
    common_name: string;
    expires_at: string;
    is_distribution: boolean;
    is_app_store: boolean;
  };
  created_at: string;
}
