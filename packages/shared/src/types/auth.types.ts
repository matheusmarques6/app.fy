export interface DeviceRegisterRequest {
  app_id: string;
  store_id: string;
  device_fingerprint: string;
  platform: 'ios' | 'android';
  locale: string;
  timezone: string;
  country_guess: string;
  onesignal?: {
    provider_sub_id: string | null;
  };
  attestation?: {
    type: 'none' | 'play_integrity' | 'app_attest';
    token?: string;
  };
}

export interface DeviceRegisterResponse {
  device_id: string;
  access_token: string;
  refresh_token: string;
  server_time: string;
}

export interface TokenRefreshRequest {
  refresh_token: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  server_time: string;
}

export interface DeviceTokenClaims {
  iss: string;
  aud: string;
  typ: 'device_access';
  sub: string; // device_id
  jti: string;
  iat: number;
  exp: number;
  store_id: string;
  app_id: string;
  device_id: string;
  session_id?: string;
  scope?: string[];
}

export interface UserTokenClaims {
  iss: string;
  aud: string;
  typ: 'user_access';
  sub: string; // user_id
  jti: string;
  iat: number;
  exp: number;
  account_id: string;
  email: string;
  role: UserRole;
}

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';
