import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';
import { IngestEventsDto } from './dto';
import { CurrentDevice } from '../../common/decorators/current-device.decorator';

interface DeviceContext {
  deviceId: string;
  storeId: string;
  appId: string;
}

@Controller('events')
@UseGuards(AuthGuard('device-jwt'))
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Ingest events from device
   * POST /v1/events/ingest
   */
  @Post('ingest')
  @Throttle({ long: { limit: 500, ttl: 1000 } }) // 500 requests per second per IP
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Body() dto: IngestEventsDto,
    @CurrentDevice() device: DeviceContext,
  ) {
    return this.eventsService.ingestEvents(
      device.storeId,
      device.deviceId,
      dto as any,
    );
  }
}
