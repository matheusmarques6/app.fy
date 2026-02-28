import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
            : undefined,
        autoLogging: true,
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              store_id: req.headers?.['x-store-id'],
              request_id: req.headers?.['x-request-id'] || req.id,
            };
          },
          res(res) {
            return { status_code: res.statusCode };
          },
        },
        customProps(req: any) {
          return {
            store_id: req.headers?.['x-store-id'],
            request_id: req.headers?.['x-request-id'] || req.id,
          };
        },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: '[REDACTED]',
        },
      },
    }),
  ],
})
export class LoggerModule {}
