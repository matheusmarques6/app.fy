/**
 * Workers Entry Point
 * Runs separately from the API: node dist/workers.js
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkersModule } from './workers/workers.module';

async function bootstrap() {
  const logger = new Logger('Workers');

  const app = await NestFactory.createApplicationContext(WorkersModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.log('Workers started successfully');
  logger.log('Listening for jobs on all queues...');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down workers...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down workers...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
