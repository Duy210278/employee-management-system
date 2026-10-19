import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AreaBody, StoreBody, type AreaBodyT, type OrgResponse, type StoreBodyT } from '@lotrinh/shared';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { conflict, notFound } from '../../common/errors';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { areas, staff, stores, userAreaScopes, users, userStoreScopes } from '../../db/schema';
import { AccessService } from '../access/access.service';

/**
 * Danh mục cửa hàng, khu vực (mục 5.5): chỉ BP Đào tạo quản lý.
 * CHT, QLKV phụ trách suy ra từ phạm vi của tài khoản; hồ sơ NV và tài khoản chọn từ danh mục, không nhập chữ tự do.
 */
@Controller('org')
export class OrgController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
  ) {}

  private assert(user: SessionUser) {
    return this.access.assertCan(user, 'manage', 'Org', 'Chỉ BP Đào tạo quản lý danh mục cửa hàng, khu vực');
  }

  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<OrgResponse> {
    await this.assert(user);
    const [areaRows, storeRows, qlkv, cht, staffCounts] = await Promise.all([
      this.db.select().from(areas).orderBy(asc(areas.name)),
      this.db.select({ s: stores, areaName: areas.name }).from(stores).innerJoin(areas, eq(areas.id, stores.areaId)).orderBy(asc(stores.name)),
      this.db
        .select({ areaId: userAreaScopes.areaId, name: users.fullName })
        .from(userAreaScopes)
        .innerJoin(users, eq(users.id, userAreaScopes.userId))
        .where(and(eq(users.role, 'qlkv'), eq(users.status, 'active'))),
      this.db
        .select({ storeId: userStoreScopes.storeId, name: users.fullName })
        .from(userStoreScopes)
        .innerJoin(users, eq(users.id, userStoreScopes.userId))
        .where(and(eq(users.role, 'cht'), eq(users.status, 'active'))),
      this.db.select({ storeId: staff.storeId, n: sql<number>`count(*)::int` }).from(staff).where(eq(staff.active, true)).groupBy(staff.storeId),
    ]);
    return {
      areas: areaRows.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        active: a.active,
        storeCount: storeRows.filter((s) => s.s.areaId === a.id).length,
        qlkvNames: qlkv.filter((q) => q.areaId === a.id).map((q) => q.name),
      })),
      stores: storeRows.map(({ s, areaName }) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        address: s.address,
        areaId: s.areaId,
        areaName,
        active: s.active,
        chtNames: cht.filter((c) => c.storeId === s.id).map((c) => c.name),
        staffCount: staffCounts.find((c) => c.storeId === s.id)?.n ?? 0,
      })),
    };
  }

  private async uniqueCode(table: typeof areas | typeof stores, code: string, exceptId?: number) {
    const where = exceptId ? and(eq(table.code, code), ne(table.id, exceptId)) : eq(table.code, code);
    const [dup] = await this.db.select({ id: table.id }).from(table).where(where);
    if (dup) throw conflict('CODE_TAKEN', `Mã ${code} đã được dùng`);
  }

  @Post('areas')
  async createArea(@Body(new ZodPipe(AreaBody)) body: AreaBodyT, @CurrentUser() user: SessionUser): Promise<OrgResponse> {
    await this.assert(user);
    await this.uniqueCode(areas, body.code);
    await this.db.insert(areas).values(body);
    return this.list(user);
  }

  @Put('areas/:id')
  async updateArea(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(AreaBody)) body: AreaBodyT, @CurrentUser() user: SessionUser): Promise<OrgResponse> {
    await this.assert(user);
    await this.uniqueCode(areas, body.code, id);
    if (!body.active) {
      const [open] = await this.db.select({ id: stores.id }).from(stores).where(and(eq(stores.areaId, id), eq(stores.active, true))).limit(1);
      if (open) throw conflict('AREA_IN_USE', 'Khu vực còn cửa hàng đang hoạt động. Ngừng hoặc chuyển các cửa hàng trước');
    }
    const updated = await this.db.update(areas).set(body).where(eq(areas.id, id)).returning({ id: areas.id });
    if (!updated.length) throw notFound('AREA_NOT_FOUND', 'Không tìm thấy khu vực');
    return this.list(user);
  }

  @Post('stores')
  async createStore(@Body(new ZodPipe(StoreBody)) body: StoreBodyT, @CurrentUser() user: SessionUser): Promise<OrgResponse> {
    await this.assert(user);
    await this.uniqueCode(stores, body.code);
    await this.db.insert(stores).values({ ...body, address: body.address || null });
    return this.list(user);
  }

  @Put('stores/:id')
  async updateStore(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(StoreBody)) body: StoreBodyT, @CurrentUser() user: SessionUser): Promise<OrgResponse> {
    await this.assert(user);
    await this.uniqueCode(stores, body.code, id);
    if (!body.active) {
      const [{ n }] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(staff)
        .where(and(eq(staff.storeId, id), eq(staff.active, true)));
      if (n) throw conflict('STORE_IN_USE', `Còn ${n} nhân viên đang theo dõi ở cửa hàng này. Chuyển cửa hàng cho họ trước`);
    }
    const updated = await this.db
      .update(stores)
      .set({ ...body, address: body.address || null })
      .where(eq(stores.id, id))
      .returning({ id: stores.id });
    if (!updated.length) throw notFound('STORE_NOT_FOUND', 'Không tìm thấy cửa hàng');
    return this.list(user);
  }
}
