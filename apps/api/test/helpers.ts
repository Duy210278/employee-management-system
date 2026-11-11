import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, todayIn, type AccountRole, type ClockView, type IsoDate, type RunTasksResponse, type TodayResponse } from '@lotrinh/shared';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ClockService } from '../src/adapters/clock/clock.service';
import { createDb } from '../src/db/client';
import { resetDatabase } from '../src/db/seed';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { SEED_USERS } from '../src/db/seed/seed-data';

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
  /** Danh tính SSO của tài khoản mẫu, ví dụ as('lan') */
  as(key: string, changes?: { role?: AccountRole; stores?: string[]; areas?: string[]; active?: boolean }): Promise<Agent>;
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
    async as(key, changes = {}) {
      const agent = request.agent(app.getHttpServer());
      const person = SEED_USERS.find((u) => u.key === key && u.status === 'active');
      if (!person) throw new Error(`Không có tài khoản mẫu đang hoạt động ${key}`);
      const title = { bp: 'DAO_TAO', qlkv: 'QLKV', cht: 'CHT', nv: 'NVBH' }[changes.role ?? person.role];
      const token = await new SignJWT({
        employeeCode: person.employeeCode,
        name: person.fullName,
        email: person.email,
        titles: [title],
        stores: changes.stores ?? person.stores ?? [],
        areas: changes.areas ?? person.areas ?? [],
        active: changes.active ?? true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(`test-${person.employeeCode}`)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(process.env.HOST_JWT_SECRET));
      agent.set('Cookie', `hostsid=${token}`);
      agent.set('Origin', 'http://127.0.0.1');
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
