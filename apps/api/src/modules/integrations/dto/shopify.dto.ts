import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';

// OAuth
export class ShopifyInstallDto {
  @IsString()
  @IsNotEmpty()
  shop: string; // mystore.myshopify.com
}

export class ShopifyOAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  shop: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsOptional()
  hmac?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

// Webhook payloads
export class ShopifyWebhookHeaders {
  'x-shopify-topic': string;
  'x-shopify-shop-domain': string;
  'x-shopify-api-version': string;
  'x-shopify-webhook-id': string;
  'x-shopify-hmac-sha256': string;
}

export class ShopifyProductDto {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle: string;
  status: string;
  tags?: string;
  variants: ShopifyVariantDto[];
  images: ShopifyImageDto[];
  created_at: string;
  updated_at: string;
}

export class ShopifyVariantDto {
  id: number;
  product_id: number;
  title: string;
  price: string;
  compare_at_price?: string;
  sku?: string;
  inventory_quantity?: number;
  weight?: number;
  weight_unit?: string;
}

export class ShopifyImageDto {
  id: number;
  product_id: number;
  src: string;
  alt?: string;
  position: number;
}

export class ShopifyOrderDto {
  id: number;
  order_number: number;
  email?: string;
  phone?: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string; // pending, paid, refunded, etc.
  fulfillment_status?: string;
  customer?: ShopifyCustomerDto;
  line_items: ShopifyLineItemDto[];
  shipping_address?: ShopifyAddressDto;
  billing_address?: ShopifyAddressDto;
  created_at: string;
  updated_at: string;
  confirmed: boolean;
  cancelled_at?: string;
  cancel_reason?: string;
  note?: string;
  tags?: string;
  discount_codes?: { code: string; amount: string; type: string }[];
}

export class ShopifyCustomerDto {
  id: number;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  orders_count: number;
  total_spent: string;
  tags?: string;
  created_at: string;
  updated_at: string;
}

export class ShopifyLineItemDto {
  id: number;
  product_id?: number;
  variant_id?: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  vendor?: string;
}

export class ShopifyAddressDto {
  first_name?: string;
  last_name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

// Responses
export class IntegrationResponseDto {
  id: string;
  platform: string;
  status: string;
  shop_domain?: string;
  scopes: string[];
  last_sync_at?: Date;
  created_at: Date;
}

export class ShopifyInstallResponseDto {
  install_url: string;
  state: string;
}
