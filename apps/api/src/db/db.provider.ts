import { Inject, OnApplicationShutdown, Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config';
import * as schema from './schema';
import './client';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export const dbProviders: Provider[] = [
  { provide: PG_POOL, useFactory: () => new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 }) },
  { provide: DB, inject: [PG_POOL], useFactory: (pool: pg.Pool) => drizzle(pool, { schema }) },
];

export class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
