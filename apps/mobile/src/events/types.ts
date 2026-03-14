/**
 * App event types — re-exported from @appfy/shared (single source of truth).
 */
export { type AppEventType } from '@appfy/shared';

export interface AppEvent {
  readonly eventType: import('@appfy/shared').AppEventType;
  readonly deviceId: string;
  readonly userId: string | null;
  readonly timestamp: string;
  readonly metadata: Record<string, unknown>;
}

export interface ProductViewedMetadata {
  readonly productId: string;
  readonly productName: string;
  readonly productPrice: number;
  readonly currency: string;
}

export interface PurchaseCompletedMetadata {
  readonly orderId: string;
  readonly totalValue: number;
  readonly currency: string;
  readonly itemCount: number;
}

export interface PushInteractionMetadata {
  readonly notificationId: string;
  readonly ref: string;
}
