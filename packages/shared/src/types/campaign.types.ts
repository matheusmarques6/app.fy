export interface Campaign {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  segment_id?: string;
  template_id: string;
  scheduled_for?: string;
  timezone: string;
  stats: CampaignStats;
  created_at: string;
  updated_at: string;
  sent_at?: string;
}

export type CampaignType = 'one_time' | 'recurring' | 'triggered';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'cancelled';

export interface CampaignStats {
  total_targeted: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened: number;
  total_clicked: number;
  total_converted: number;
  conversion_value_amount_minor: number;
  currency: string;
}

export interface PushTemplate {
  id: string;
  store_id: string;
  name: string;
  title: Record<string, string>; // locale -> text
  body: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  store_id: string;
  campaign_id?: string;
  automation_id?: string;
  automation_run_id?: string;
  device_id: string;
  template_id: string;
  status: DeliveryStatus;
  scheduled_for: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  failed_at?: string;
  failure_reason?: string;
  provider_message_id?: string;
  created_at: string;
}

export type DeliveryStatus =
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'failed'
  | 'cancelled';

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  type: CampaignType;
  segment_id?: string;
  template_id: string;
  scheduled_for?: string;
  timezone?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  segment_id?: string;
  template_id?: string;
  scheduled_for?: string;
  status?: CampaignStatus;
}

export interface CreateTemplateRequest {
  name: string;
  title: Record<string, string>;
  body: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, string>;
}
