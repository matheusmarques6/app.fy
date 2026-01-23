export interface Device {
  id: string;
  store_id: string;
  app_id: string;
  device_fingerprint: string;
  platform: 'ios' | 'android';
  locale: string;
  timezone: string;
  country_guess: string;
  app_instance_id?: string;
  push_subscription_id?: string;
  customer_id?: string;
  identity_confirmed: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceSession {
  id: string;
  device_id: string;
  store_id: string;
  family_id: string;
  current_refresh_token_hash: string;
  revoked_at?: string;
  revoke_reason?: DeviceSessionRevokeReason;
  created_at: string;
  updated_at: string;
}

export type DeviceSessionRevokeReason =
  | 'refresh_reuse'
  | 'fingerprint_change'
  | 'manual'
  | 'abuse_detected'
  | 'attestation_invalid';

export interface PushSubscription {
  id: string;
  device_id: string;
  store_id: string;
  provider: 'onesignal';
  provider_sub_id: string;
  opt_in: boolean;
  opt_in_at?: string;
  opt_out_at?: string;
  created_at: string;
  updated_at: string;
}
