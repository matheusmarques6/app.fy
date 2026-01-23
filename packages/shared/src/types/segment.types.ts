export interface Segment {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  definition: SegmentDefinition;
  member_count: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface SegmentDefinition {
  version: 1;
  match: 'all' | 'any';
  rules: SegmentRule[];
}

export interface SegmentRule {
  field?: string;
  event?: string;
  op: SegmentOperator;
  value: SegmentValue;
}

export type SegmentOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'within_last'
  | 'contains'
  | 'starts_with'
  | 'count_within';

export type SegmentValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | { count: number; window: string }
  | null;

export interface SegmentMembership {
  id: string;
  segment_id: string;
  device_id: string;
  store_id: string;
  entered_at: string;
  exited_at?: string;
}

export interface UserMetrics {
  device_id: string;
  store_id: string;
  last_seen_at: string;
  first_seen_at: string;
  session_count_7d: number;
  session_count_30d: number;
  view_product_7d: number;
  view_product_30d: number;
  add_to_cart_7d: number;
  add_to_cart_30d: number;
  purchases_7d: number;
  purchases_30d: number;
  purchases_90d: number;
  spent_7d_amount_minor: number;
  spent_30d_amount_minor: number;
  spent_90d_amount_minor: number;
  currency: string;
  updated_at: string;
}

export interface CreateSegmentRequest {
  name: string;
  description?: string;
  definition: SegmentDefinition;
}

export interface UpdateSegmentRequest {
  name?: string;
  description?: string;
  definition?: SegmentDefinition;
}
