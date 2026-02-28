import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const path = req.url;
    const storeId = req.headers['x-store-id'] ?? '-';
    const requestId = req.headers['x-request-id'] ?? req.id ?? '-';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          this.logger.log({
            request_id: requestId,
            store_id: storeId,
            method,
            path,
            status_code: res.statusCode,
            duration_ms: duration,
          });
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.error({
            request_id: requestId,
            store_id: storeId,
            method,
            path,
            status_code: err.status || 500,
            duration_ms: duration,
            error: process.env.NODE_ENV === 'production' ? err.message : err.stack,
          });
        },
      }),
    );
  }
}
