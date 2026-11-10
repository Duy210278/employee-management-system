import { Inject, OnApplicationShutdown, Provider } from '@nestjs/common';
import { env } from '../config';
import { createDb, type Db } from './client';

export const DB = Symbol('DB');
const DB_CONN = Symbol('DB_CONN');

type Conn = ReturnType<typeof createDb>;

export const dbProviders: Provider[] = [
  { provide: DB_CONN, useFactory: (): Conn => createDb(env().DATABASE_URL) },
  { provide: DB, inject: [DB_CONN], useFactory: (conn: Conn): Db => conn.db },
];

export class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(DB_CONN) private readonly conn: Conn) {}

  async onApplicationShutdown(): Promise<void> {
    await this.conn.close();
  }
}
