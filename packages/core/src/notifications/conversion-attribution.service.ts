import type { DeliveryStatus } from '@appfy/shared'

/** Delivery record needed for attribution */
export interface AttributableDelivery {
  readonly id: string
  readonly notificationId: string
  readonly appUserId: string | null
  readonly status: DeliveryStatus
  readonly sentAt: Date | null
  readonly convertedAt: Date | null
}

/** Repository for querying recent deliveries for attribution */
export interface AttributionRepository {
  /** Find deliveries sent to a user within a time window, ordered by sentAt DESC */
  findRecentDeliveries(
    tenantId: string,
    appUserId: string,
    withinMs: number,
  ): Promise<AttributableDelivery[]>
  /** Mark a delivery as converted */
  markConverted(tenantId: string, deliveryId: string, convertedAt: Date): Promise<void>
}

export interface ConversionAttributionResult {
  readonly attributed: boolean
  readonly deliveryId?: string
  readonly notificationId?: string
  readonly windowType?: 'multi_campaign' | 'normal'
}

/** Multi-campaign attribution window: 1 hour */
const MULTI_CAMPAIGN_WINDOW_MS = 60 * 60 * 1000

/** Normal flow attribution window: 24 hours */
const NORMAL_FLOW_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Conversion attribution service.
 *
 * Rules:
 * - Multi-campaign window: 1h (attributes to most recent push). Boundary: exactly 1h = inclusive
 * - Normal flow window: 24h. Boundary: exactly 24h = inclusive
 * - After window expires → no attribution
 * - Updates delivery status to `converted` with `converted_at` timestamp
 */
export class ConversionAttributionService {
  constructor(private readonly repo: AttributionRepository) {}

  /**
   * Attributes a conversion (purchase) to the most recent push notification.
   *
   * @param tenantId - Tenant ID
   * @param appUserId - The app user who made the purchase
   * @param purchaseTime - When the purchase occurred
   * @param isMultiCampaign - Whether to use the 1h multi-campaign window (default: false → 24h)
   */
  async attributeConversion(
    tenantId: string,
    appUserId: string,
    purchaseTime: Date,
    isMultiCampaign = false,
  ): Promise<ConversionAttributionResult> {
    const windowMs = isMultiCampaign ? MULTI_CAMPAIGN_WINDOW_MS : NORMAL_FLOW_WINDOW_MS
    const windowType = isMultiCampaign ? 'multi_campaign' : 'normal'

    // Find deliveries sent within the window (most recent first)
    const deliveries = await this.repo.findRecentDeliveries(tenantId, appUserId, windowMs)

    // Filter to those within the window (inclusive boundary)
    const eligibleDeliveries = deliveries.filter((d) => {
      if (!d.sentAt) return false
      const elapsed = purchaseTime.getTime() - d.sentAt.getTime()
      return elapsed >= 0 && elapsed <= windowMs // inclusive boundary
    })

    if (eligibleDeliveries.length === 0) {
      return { attributed: false }
    }

    // Attribute to most recent (first in DESC order)
    const target = eligibleDeliveries[0]!

    // Mark as converted
    await this.repo.markConverted(tenantId, target.id, purchaseTime)

    return {
      attributed: true,
      deliveryId: target.id,
      notificationId: target.notificationId,
      windowType,
    }
  }
}
