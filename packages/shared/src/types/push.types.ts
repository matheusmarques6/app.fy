export interface PushPayload {
  store_id: string;
  device_id: string;
  provider_sub_id: string;
  title: string;
  body: string;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, string>;
  delivery_id: string;
  campaign_id?: string;
  automation_id?: string;
}

export interface PushDeliveryResult {
  success: boolean;
  provider_message_id?: string;
  error?: string;
  error_code?: string;
}

export interface PushStats {
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
}

export interface PushHealthMetrics {
  store_id: string;
  period: '24h' | '7d' | '28d';
  opt_in_rate: number;
  unsubscribe_rate: number;
  spam_report_rate: number;
  delivery_failure_rate: number;
  open_rate: number;
  click_rate: number;
  devices_seen: number;
  devices_opted_in: number;
}

export type PushHealthLevel = 'healthy' | 'degraded_light' | 'degraded_heavy' | 'paused';

export interface PushBackoffState {
  store_id: string;
  level: PushHealthLevel;
  triggered_at: string;
  triggers: string[];
  cap_reduction_percent: number;
  marketing_paused: boolean;
  all_paused: boolean;
}
