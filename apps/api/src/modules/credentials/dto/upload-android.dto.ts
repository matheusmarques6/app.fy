import { IsString, IsNotEmpty } from 'class-validator';

export class UploadAndroidCredentialDto {
  /**
   * Base64-encoded keystore file
   */
  @IsString()
  @IsNotEmpty()
  keystore: string;

  /**
   * Keystore password
   */
  @IsString()
  @IsNotEmpty()
  keystore_password: string;

  /**
   * Key alias within the keystore
   */
  @IsString()
  @IsNotEmpty()
  key_alias: string;

  /**
   * Key password (often same as keystore password)
   */
  @IsString()
  @IsNotEmpty()
  key_password: string;
}

export interface AndroidCredentialResponse {
  id: string;
  platform: 'android';
  metadata: {
    key_alias: string;
    valid_until: string;
    fingerprint_sha256?: string;
  };
  created_at: string;
}
