import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
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

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino as the application logger
  app.useLogger(app.get(PinoLogger));

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

  // Allow Vercel preview deployments
  const vercelPatterns = [
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*-.*\.vercel\.app$/,
  ];

  const isAllowedOrigin = (origin: string): boolean => {
    if (allowedOrigins.includes(origin)) return true;
    return vercelPatterns.some(pattern => pattern.test(origin));
  };

  app.enableCors({
    origin: nodeEnv === 'production'
      ? (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin || isAllowedOrigin(origin)) {
            callback(null, true);
          } else {
            logger.warn(`CORS blocked for origin: ${origin}`);
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
