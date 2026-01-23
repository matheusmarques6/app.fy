import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  ValidateNested,
  IsObject,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EVENT_BATCH_MAX_SIZE } from '@appfy/shared';

class IdentityHintDto {
  @IsString()
  @IsOptional()
  external_customer_id?: string;

  @IsString()
  @IsOptional()
  email_hash?: string;
}

class EventPayloadDto {
  @IsUUID()
  event_id: string;

  @IsString()
  name: string;

  @IsDateString()
  ts: string;

  @IsObject()
  @IsOptional()
  props?: Record<string, unknown>;
}

export class IngestEventsDto {
  @IsUUID()
  device_id: string;

  @ValidateNested()
  @Type(() => IdentityHintDto)
  @IsOptional()
  identity_hint?: IdentityHintDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPayloadDto)
  @ArrayMaxSize(EVENT_BATCH_MAX_SIZE)
  events: EventPayloadDto[];
}
