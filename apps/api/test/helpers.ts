import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { todayIn, type DemoAccount, type RunTasksResponse, type TodayResponse } from '@lotrinh/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { createDb } from '../src/db/client';
import { resetDatabase } from '../src/db/seed';

export const API = '/api/v1';
export type Agent = ReturnType<typeof request.agent>;

export interface TestApp {
  app: INestApplication;
  today: string;
  /** Phiên đăng nhập của tài khoản mẫu, ví dụ as('lan') */
  as(key: string): Promise<Agent>;
  anonymous(): ReturnType<typeof request>;
  close(): Promise<void>;
}

/** Nạp lại dữ liệu mẫu vào cơ sở dữ liệu test rồi dựng ứng dụng Nest đầy đủ */
export async function setupApp(): Promise<TestApp> {
  const today = todayIn('Asia/Ho_Chi_Minh');
  const { pool, db } = createDb(process.env.DATABASE_URL!);
  await resetDatabase(db, today);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const accounts: DemoAccount[] = (await request(app.getHttpServer()).get(`${API}/demo/accounts`).expect(200)).body;

  return {
    app,
    today,
    async as(key) {
      const agent = request.agent(app.getHttpServer());
      const account = accounts.find((a) => a.email === `${key}@upharma.local`);
      if (!account) throw new Error(`Không có tài khoản mẫu ${key}`);
      await agent.post(`${API}/demo/login-as`).send({ userId: account.id }).expect(200);
      return agent;
    },
    anonymous: () => request(app.getHttpServer()),
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export const todayOf = async (agent: Agent) => (await agent.get(`${API}/me/today`).expect(200)).body as TodayResponse;
export const runTasks = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/tasks`).expect(200)).body as RunTasksResponse;
