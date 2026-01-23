import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }

  /**
   * Execute operations within a transaction with RLS context set
   * CRITICAL: All multi-tenant queries MUST use this method
   */
  async withRLS<T>(
    storeId: string,
    userId: string | null,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Set RLS context
      await tx.$executeRaw`SELECT set_config('app.store_id', ${storeId}, true)`;
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      }

      return operation(tx);
    });
  }

  /**
   * Execute raw query with RLS context (for complex queries)
   */
  async queryWithRLS<T>(
    storeId: string,
    query: any,
  ): Promise<T> {
    return this.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.store_id', ${storeId}, true)`;
      return tx.$queryRaw(query) as T;
    });
  }

  /**
   * Clean up old data (retention policies)
   */
  async cleanupOldEvents(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.$executeRaw`
      DELETE FROM events
      WHERE created_at < ${cutoffDate}
    `;

    return Number(result);
  }
}
