import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate required environment variables
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Security
  app.use(helmet());

  // CORS
  const allowedOrigins = configService.get<string>('CORS_ORIGINS', '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  // Always include CONSOLE_BASE_URL if set
  const consoleUrl = configService.get<string>('CONSOLE_BASE_URL', '');
  if (consoleUrl && !allowedOrigins.includes(consoleUrl)) {
    allowedOrigins.push(consoleUrl);
  }

  app.enableCors({
    origin: nodeEnv === 'production'
      ? (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS not allowed for origin: ${origin}`));
          }
        }
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Store-Id', 'X-Request-Id'],
  });

  // Global prefix
  app.setGlobalPrefix('v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`Application running on port ${port} (${nodeEnv})`);
  logger.log(`API available at http://localhost:${port}/v1`);
}

bootstrap();
