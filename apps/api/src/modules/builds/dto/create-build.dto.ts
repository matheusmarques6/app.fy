import { IsString, IsIn, IsOptional, Matches } from 'class-validator';

export class CreateBuildDto {
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must be in semver format (e.g., 1.2.3)',
  })
  version_name: string;

  @IsOptional()
  @IsString()
  release_notes?: string;
}

export interface BuildResponse {
  id: string;
  app_version_id: string;
  platform: 'ios' | 'android';
  version: {
    name: string;
    code: number;
  };
  status: string;
  created_at: string;
}

export interface BuildJobData {
  buildJobId: string;
  appId: string;
  appVersionId: string;
  platform: 'ios' | 'android';
  versionName: string;
  versionCode: number;
}
