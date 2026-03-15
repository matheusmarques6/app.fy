-- Add external_id column to notification_deliveries for OneSignal webhook correlation
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "external_id" text;
