import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, todayIn, type ClockView, type DemoAccount, type IsoDate, type RunTasksResponse, type TodayResponse } from '@lotrinh/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ClockService } from '../src/adapters/clock/clock.service';
import { createDb } from '../src/db/client';
import { resetDatabase } from '../src/db/seed';
import { JobsService } from '../src/modules/jobs/jobs.service';

export const API = '/api/v1';
export type Agent = ReturnType<typeof request.agent>;

const TZ = 'Asia/Ho_Chi_Minh';

/** Đồng hồ giả chỉ dùng trong test: lệch so với ngày thật một số ngày. Ứng dụng thật luôn dùng ngày thật. */
class TestClock {
  offset = 0;
  async today(): Promise<IsoDate> {
    return addDays(todayIn(TZ), this.offset);
  }
  async now(): Promise<Date> {
    return new Date(Date.now() + this.offset * 86_400_000);
  }
  async view(): Promise<ClockView> {
    return { today: await this.today() };
  }
}

export interface TestApp {
  app: INestApplication;
  today: string;
  /** Tua đồng hồ test thêm số ngày (cộng dồn), rồi chạy các job của ngày mới như khi sang ngày thật */
  shiftDays(days: number): Promise<IsoDate>;
  /** Đưa đồng hồ test về ngày thật */
  resetClock(): Promise<void>;
  /** Phiên đăng nhập của tài khoản mẫu, ví dụ as('lan') */
  as(key: string): Promise<Agent>;
  anonymous(): ReturnType<typeof request>;
  close(): Promise<void>;
}

/** Nạp lại dữ liệu mẫu vào cơ sở dữ liệu test rồi dựng ứng dụng Nest đầy đủ */
export async function setupApp(): Promise<TestApp> {
  const today = todayIn(TZ);
  const { db, close } = createDb(process.env.DATABASE_URL!);
  await resetDatabase(db, today);
  const clock = new TestClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ClockService).useValue(clock).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const accounts: DemoAccount[] = (await request(app.getHttpServer()).get(`${API}/demo/accounts`).expect(200)).body;

  const jobs = app.get(JobsService);

  return {
    app,
    today,
    async shiftDays(days) {
      clock.offset += days;
      const date = await clock.today();
      await jobs.runAll(date);
      return date;
    },
    async resetClock() {
      clock.offset = 0;
      await jobs.runAll(await clock.today());
    },
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
      await close();
    },
  };
}

export const todayOf = async (agent: Agent) => (await agent.get(`${API}/me/today`).expect(200)).body as TodayResponse;
export const runTasks = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/tasks`).expect(200)).body as RunTasksResponse;
