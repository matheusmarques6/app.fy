import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

// Connection
export class WooCommerceConnectDto {
  @IsUrl()
  @IsNotEmpty()
  store_url: string; // https://mystore.com

  @IsString()
  @IsNotEmpty()
  consumer_key: string;

  @IsString()
  @IsNotEmpty()
  consumer_secret: string;
}

// Webhook payloads
export class WooCommerceWebhookHeaders {
  'x-wc-webhook-topic': string;
  'x-wc-webhook-resource': string;
  'x-wc-webhook-event': string;
  'x-wc-webhook-signature': string;
  'x-wc-webhook-id': string;
  'x-wc-webhook-delivery-id': string;
}

export class WooCommerceProductDto {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type: string;
  status: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  on_sale: boolean;
  stock_quantity?: number;
  stock_status: string;
  categories: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; alt: string }[];
  variations?: number[];
  date_created: string;
  date_modified: string;
}

export class WooCommerceOrderDto {
  id: number;
  number: string;
  order_key: string;
  status: string; // pending, processing, on-hold, completed, cancelled, refunded, failed
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  shipping_total: string;
  discount_total: string;
  customer_id: number;
  billing: WooCommerceAddressDto;
  shipping: WooCommerceAddressDto;
  payment_method: string;
  payment_method_title: string;
  transaction_id?: string;
  customer_note?: string;
  line_items: WooCommerceLineItemDto[];
  coupon_lines: { id: number; code: string; discount: string }[];
  date_created: string;
  date_modified: string;
  date_paid?: string;
  date_completed?: string;
}

export class WooCommerceAddressDto {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export class WooCommerceLineItemDto {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  subtotal: string;
  total: string;
  sku?: string;
  price: number;
}

export class WooCommerceCustomerDto {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  billing: WooCommerceAddressDto;
  shipping: WooCommerceAddressDto;
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  date_created: string;
  date_modified: string;
}
