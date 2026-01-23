export interface EventIngestRequest {
  device_id: string;
  identity_hint?: {
    external_customer_id?: string | null;
    email_hash?: string | null;
  };
  events: EventPayload[];
}

export interface EventPayload {
  event_id: string;
  name: EventName;
  ts: string;
  props?: EventProps;
}

export type EventName =
  | 'app_open'
  | 'app_close'
  | 'view_product'
  | 'view_collection'
  | 'view_cart'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase_detected'
  | 'purchase_confirmed'
  | 'search'
  | 'add_to_wishlist'
  | 'remove_from_wishlist'
  | 'push_received'
  | 'push_opened'
  | 'push_clicked'
  | 'custom';

export interface EventProps {
  url?: string;
  referrer?: string;
  product?: ProductProps;
  products?: ProductProps[];
  collection?: CollectionProps;
  order?: OrderProps;
  search_query?: string;
  utm?: UtmProps;
  custom?: Record<string, unknown>;
}

export interface ProductProps {
  id: string;
  sku?: string;
  name: string;
  price_amount_minor: number;
  currency: string;
  category?: string;
  quantity?: number;
}

export interface CollectionProps {
  id: string;
  name: string;
}

export interface OrderProps {
  order_id: string;
  order_total_amount_minor: number;
  currency: string;
  items_count?: number;
}

export interface UtmProps {
  source?: string;
  medium?: string;
  campaign?: string;
  campaign_id?: string;
  delivery_id?: string;
}

export interface EventIngestResponse {
  accepted: string[];
  rejected: Array<{
    event_id: string;
    reason: string;
  }>;
}

export interface StoredEvent {
  id: string;
  store_id: string;
  device_id: string;
  event_id: string;
  name: EventName;
  ts: string;
  props: EventProps;
  product_id?: string;
  order_id?: string;
  campaign_id?: string;
  delivery_id?: string;
  value_amount_minor?: number;
  currency?: string;
  created_at: string;
}
