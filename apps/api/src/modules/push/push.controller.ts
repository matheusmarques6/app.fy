import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PushService } from './push.service';
import { createHmac, timingSafeEqual } from 'crypto';

interface OneSignalWebhookPayload {
  event: string;
  app_id: string;
  data: {
    id: string; // notification ID
    player_id?: string;
    user_id?: string;
  };
}

@Controller('webhooks/push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  /**
   * Handle OneSignal webhook callbacks
   * POST /v1/webhooks/push/onesignal
   */
  @Post('onesignal')
  @HttpCode(HttpStatus.OK)
  async handleOneSignalWebhook(
    @Headers('onesignal-signature') signature: string,
    @Body() payload: OneSignalWebhookPayload,
  ) {
    // Note: OneSignal webhook signature verification would go here
    // For now, we just process the event

    this.logger.log(`Received OneSignal webhook: ${payload.event}`);

    const { event, data } = payload;

    if (!data.id || !data.player_id) {
      throw new BadRequestException('Invalid webhook payload');
    }

    // Map OneSignal events to our events
    let ourEvent: 'delivered' | 'opened' | 'clicked' | null = null;

    switch (event) {
      case 'notification.delivered':
        ourEvent = 'delivered';
        break;
      case 'notification.clicked':
        ourEvent = 'clicked';
        break;
      case 'notification.willDisplay':
        ourEvent = 'opened';
        break;
      default:
        this.logger.log(`Ignoring event: ${event}`);
        return { received: true };
    }

    if (ourEvent) {
      await this.pushService.handleWebhook(ourEvent, data.id, data.player_id);
    }

    return { received: true };
  }

  /**
   * Health check for webhook endpoint
   */
  @Post('onesignal/test')
  @HttpCode(HttpStatus.OK)
  async testWebhook() {
    return { status: 'ok', message: 'Webhook endpoint is reachable' };
  }
}
