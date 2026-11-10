import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  classifyChanges,
  countIssues,
  fmtDate,
  proposeVersionCode,
  validateVersion,
  VersionContentSchema,
  type ApproveBodyT,
  type SaveDraftBodyT,
  type VersionContent,
  type VersionDetailResponse,
  type VersionListItem,
  type VersionListResponse,
  type VersionState,
} from '@lotrinh/shared';
import { and, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mssql-core';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, notFound, staleData } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { levelRuns, staff, users, versions } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { findVersionForDate, PUBLISHED } from '../runs/run-factory';
import { affected, lockRows } from '../../db/mssql';

type VersionRow = typeof versions.$inferSelect;
const OPEN = ['draft', 'pending'] as const;

/**
 * Vòng đời phiên bản (mục 8.2): Nháp → Chờ duyệt → Đã ban hành (đang / sắp / hết hiệu lực theo ngày hiệu lực).
 * Bản đã ban hành bất biến (R03), có thêm trigger versions_guard ở cơ sở dữ liệu.
 */
@Injectable()
export class VersionLifecycleService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assert(user: SessionUser, action: 'read' | 'update' | 'approve', message: string) {
    await this.access.assertCan(user, action, 'Version', message);
  }

  private async rows(): Promise<VersionListItem[]> {
    const creator = alias(users, 'creator');
    const submitter = alias(users, 'submitter');
    const approver = alias(users, 'approver');
    const parent = alias(versions, 'parent');
    const rows = await this.db
      .select({
        v: versions,
        parentCode: parent.code,
        createdByName: creator.fullName,
        submittedByName: submitter.fullName,
        approvedByName: approver.fullName,
      })
      .from(versions)
      .leftJoin(parent, eq(parent.id, versions.parentId))
      .leftJoin(creator, eq(creator.id, versions.createdBy))
      .leftJoin(submitter, eq(submitter.id, versions.submittedBy))
      .leftJoin(approver, eq(approver.id, versions.approvedBy));
    const runs = await this.db
      .select({ line: versions.criteriaLine, n: sql<number>`count(*)` })
      .from(levelRuns)
      .innerJoin(versions, eq(versions.id, levelRuns.versionId))
      .where(eq(levelRuns.status, 'active'))
      .groupBy(versions.criteriaLine);
    const today = await this.clock.today();
    const currentId = (await findVersionForDate(this.db, today).catch(() => null))?.id ?? null;

    const items = rows.map(({ v, ...names }) => ({
      id: v.id,
      code: v.code,
      criteriaLine: v.criteriaLine,
      state: this.state(v, today, currentId),
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      parentId: v.parentId,
      parentCode: names.parentCode,
      changeNote: v.changeNote,
      changeKind: v.changeKind,
      reviewNote: v.reviewNote,
      itemCount: v.content.levels.reduce((a, l) => a + l.stages.reduce((b, s) => b + s.items.length, 0), 0),
      activeRuns: v.criteriaLine ? (runs.find((r) => r.line === v.criteriaLine)?.n ?? 0) : 0,
      createdAt: v.createdAt.toISOString(),
      createdByName: names.createdByName,
      submittedAt: v.submittedAt?.toISOString() ?? null,
      submittedByName: names.submittedByName,
      approvedAt: v.approvedAt?.toISOString() ?? null,
      approvedByName: names.approvedByName,
    }));
    const rank: Record<VersionState, number> = { draft: 0, pending: 1, scheduled: 2, current: 3, expired: 4 };
    return items.sort((a, b) => rank[a.state] - rank[b.state] || (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? '') || b.id - a.id);
  }

  private state(v: VersionRow, today: string, currentId: number | null): VersionState {
    if (v.status === 'draft' || v.status === 'pending') return v.status;
    if (v.id === currentId) return 'current';
    return v.effectiveFrom && v.effectiveFrom > today ? 'scheduled' : 'expired';
  }

  private async get(id: number): Promise<VersionRow> {
    const [row] = await this.db.select().from(versions).where(eq(versions.id, id));
    if (!row) throw notFound('VERSION_NOT_FOUND', 'Không tìm thấy phiên bản');
    return row;
  }

  private async parentOf(row: VersionRow): Promise<VersionRow | null> {
    return row.parentId ? this.get(row.parentId) : null;
  }

  async list(user: SessionUser): Promise<VersionListResponse> {
    await this.assert(user, 'read', 'Chỉ BP Đào tạo xem được danh sách phiên bản');
    return {
      today: await this.clock.today(),
      items: await this.rows(),
      canEdit: await this.access.can(user, 'update', 'Version'),
      canApprove: await this.access.can(user, 'approve', 'Version'),
    };
  }

  async detail(user: SessionUser, id: number): Promise<VersionDetailResponse> {
    await this.assert(user, 'read', 'Chỉ BP Đào tạo xem được phiên bản');
    const row = await this.get(id);
    const parent = await this.parentOf(row);
    const all = await this.rows();
    const item = all.find((i) => i.id === id)!;
    const [canEdit, canApprove] = await Promise.all([this.access.can(user, 'update', 'Version'), this.access.can(user, 'approve', 'Version')]);
    const hasOpen = all.some((i) => i.state === 'draft' || i.state === 'pending');
    const published = row.status === 'active' || row.status === 'expired';
    const today = await this.clock.today();
    const effectiveRange = await this.effectiveRange(row, today);
    return {
      today,
      effectiveRange,
      version: { ...item, rowVersion: row.rowVersion },
      content: VersionContentSchema.parse(row.content),
      parentContent: parent ? VersionContentSchema.parse(parent.content) : null,
      parentLine: parent?.criteriaLine ?? null,
      existingCodes: all.map((i) => i.code).filter((c): c is string => !!c),
      permissions: {
        edit: canEdit && row.status === 'draft',
        submit: canEdit && row.status === 'draft',
        withdraw: canEdit && row.status === 'pending',
        approve: canApprove && row.status === 'pending',
        remove: canEdit && row.status === 'draft',
        createDraft: canEdit && published && !hasOpen,
        reschedule: canApprove && effectiveRange !== null,
      },
    };
  }

  /** Tạo bản nháp từ một bản đã ban hành. Mỗi lúc chỉ có một bản nháp hoặc chờ duyệt để số phiên bản không chồng nhau */
  async createDraft(user: SessionUser, fromId: number): Promise<{ id: number }> {
    await this.assert(user, 'update', 'Chỉ BP Đào tạo được tạo bản nháp');
    const source = await this.get(fromId);
    if (source.status !== 'active' && source.status !== 'expired') throw badRequest('NOT_PUBLISHED', 'Chỉ tạo bản nháp từ phiên bản đã ban hành');
    const [open] = await this.db.select({ id: versions.id, status: versions.status }).from(versions).where(inArray(versions.status, [...OPEN]));
    if (open) {
      throw conflict(
        'OPEN_DRAFT_EXISTS',
        open.status === 'draft' ? 'Đang có một bản nháp. Mở bản đó để sửa tiếp, hoặc xóa trước khi tạo bản mới' : 'Đang có một bản chờ duyệt. Rút về hoặc chờ duyệt xong rồi tạo bản mới',
      );
    }
    const [row] = await this.db
      .insert(versions)
      .output({ id: versions.id })
      .values({ status: 'draft', parentId: source.id, content: source.content, changeNote: '', createdBy: user.id, updatedBy: user.id });
    return row;
  }

  async saveDraft(user: SessionUser, id: number, body: SaveDraftBodyT): Promise<VersionDetailResponse> {
    await this.assert(user, 'update', 'Chỉ BP Đào tạo được sửa bản nháp');
    const row = await this.get(id);
    if (row.status !== 'draft') throw conflict('NOT_DRAFT', 'Chỉ sửa được bản nháp. Bản đã gửi duyệt hoặc ban hành không sửa được (R03)');
    const updated = await this.db
      .update(versions)
      .set({ content: body.content, changeNote: body.changeNote, rowVersion: sql`${versions.rowVersion} + 1`, updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(versions.id, id), eq(versions.rowVersion, body.rowVersion)));
    // Bảng versions có trigger nên không dùng OUTPUT; kiểm số dòng bị sửa
    if (!affected(updated)) throw staleData();
    return this.detail(user, id);
  }

  /** Kiểm tra trước khi gửi duyệt / ban hành: hết lỗi CK, có ghi chú, có thay đổi so với bản gốc */
  private readyCheck(row: VersionRow, parent: VersionRow | null, changeNote: string) {
    const content = VersionContentSchema.parse(row.content);
    const { errors } = countIssues(validateVersion(content));
    if (errors) throw badRequest('VALIDATION_FAILED', `Còn ${errors} lỗi trong khung "Kiểm tra trước khi gửi duyệt". Sửa hết lỗi rồi gửi lại`);
    if (!changeNote.trim()) throw badRequest('CHANGE_NOTE_REQUIRED', 'Nhập ghi chú thay đổi trước khi gửi duyệt');
    if (!parent) throw badRequest('NO_PARENT', 'Bản nháp không có bản gốc để so sánh');
    const summary = classifyChanges(VersionContentSchema.parse(parent.content), content);
    if (!summary.kind) throw badRequest('NO_CHANGES', `Bản nháp chưa có thay đổi nào so với v${parent.code}`);
    return { kind: summary.kind, content };
  }

  async submit(user: SessionUser, id: number, changeNote?: string): Promise<VersionDetailResponse> {
    await this.assert(user, 'update', 'Chỉ BP Đào tạo được gửi duyệt');
    const row = await this.get(id);
    if (row.status !== 'draft') throw conflict('NOT_DRAFT', 'Chỉ gửi duyệt được bản nháp');
    const note = changeNote ?? row.changeNote ?? '';
    const { kind } = this.readyCheck(row, await this.parentOf(row), note);
    await this.db
      .update(versions)
      .set({ status: 'pending', changeKind: kind, changeNote: note, submittedBy: user.id, submittedAt: new Date(), reviewNote: null, updatedAt: new Date() })
      .where(and(eq(versions.id, id), eq(versions.status, 'draft')));
    return this.detail(user, id);
  }

  async withdraw(user: SessionUser, id: number): Promise<VersionDetailResponse> {
    await this.assert(user, 'update', 'Chỉ BP Đào tạo được rút bản chờ duyệt về nháp');
    const row = await this.get(id);
    if (row.status !== 'pending') throw conflict('NOT_PENDING', 'Chỉ rút về được bản đang chờ duyệt');
    await this.db.update(versions).set({ status: 'draft', updatedAt: new Date() }).where(eq(versions.id, id));
    return this.detail(user, id);
  }

  /**
   * Duyệt và ban hành (mục 8.2, 8.3): cấp số phiên bản theo loại thay đổi, đặt ngày hiệu lực (được phép ở tương lai);
   * bản bị thay thế có ngày kết thúc = ngày hiệu lực mới − 1.
   */
  async approve(user: SessionUser, id: number, body: ApproveBodyT): Promise<VersionDetailResponse> {
    await this.assert(user, 'approve', 'Chỉ BP Đào tạo được duyệt và ban hành');
    const row = await this.get(id);
    if (row.status !== 'pending') throw conflict('NOT_PENDING', 'Chỉ duyệt được bản đang chờ duyệt');
    const today = await this.clock.today();
    if (body.effectiveFrom < today) throw badRequest('EFFECTIVE_IN_PAST', 'Ngày hiệu lực không được trước hôm nay');
    const parent = await this.parentOf(row);
    const { kind } = this.readyCheck(row, parent, row.changeNote ?? '');
    const parentLine = parent!.criteriaLine!;

    const later = await this.db
      .select({ code: versions.code, effectiveFrom: versions.effectiveFrom })
      .from(versions)
      .where(and(PUBLISHED, sql`${versions.effectiveFrom} >= ${body.effectiveFrom}`, kind === 'text' ? eq(versions.criteriaLine, parentLine) : undefined));
    if (later.length) {
      throw badRequest('EFFECTIVE_CONFLICT', `Đã có v${later[0].code} hiệu lực từ ${later[0].effectiveFrom}. Chọn ngày hiệu lực sau ngày đó`);
    }

    const codes = (await this.db.select({ code: versions.code }).from(versions)).map((r) => r.code).filter((c): c is string => !!c);
    const code = proposeVersionCode(parentLine, kind, codes);
    const line = kind === 'text' ? parentLine : code;
    const dayBefore = addDays(body.effectiveFrom, -1);

    await this.db.transaction(async (tx) => {
      await tx
        .update(versions)
        .set({ status: 'active', code, criteriaLine: line, changeKind: kind, effectiveFrom: body.effectiveFrom, approvedBy: user.id, approvedAt: new Date(), reviewNote: null })
        .where(eq(versions.id, id));
      // Thay đổi tiêu chí: đóng các dòng cũ với lượt Level mới. Sửa diễn đạt: đóng bản cũ trong cùng dòng
      await tx
        .update(versions)
        .set({ effectiveTo: dayBefore })
        .where(
          and(
            PUBLISHED,
            ne(versions.id, id),
            isNull(versions.effectiveTo),
            lt(versions.effectiveFrom, body.effectiveFrom),
            kind === 'text' ? eq(versions.criteriaLine, line) : ne(versions.criteriaLine, line),
          ),
        );
    });
    return this.detail(user, id);
  }

  /**
   * Khoảng ngày hiệu lực được phép chọn lại cho bản đã duyệt nhưng chưa tới ngày ("Sắp hiệu lực"):
   * sau mọi bản đứng trước nó (bản cùng dòng nếu là sửa diễn đạt) và trước mọi bản ban hành sau nó, không sớm hơn hôm nay.
   */
  private async effectiveRange(row: VersionRow, today: string): Promise<{ min: string; max: string | null } | null> {
    if (row.status !== 'active' || !row.effectiveFrom || row.effectiveFrom <= today) return null;
    const others = (await this.db.select().from(versions).where(and(PUBLISHED, ne(versions.id, row.id)))).filter((v) => v.effectiveFrom);
    const isHead = row.code === row.criteriaLine;
    const before = others.filter((v) => v.effectiveFrom! < row.effectiveFrom! && (isHead || v.criteriaLine === row.criteriaLine)).map((v) => v.effectiveFrom!);
    const after = others.filter((v) => v.effectiveFrom! > row.effectiveFrom!).map((v) => v.effectiveFrom!);
    const lower = before.length ? addDays(before.sort().at(-1)!, 1) : today;
    return { min: lower > today ? lower : today, max: after.length ? addDays(after.sort()[0], -1) : null };
  }

  /**
   * Đổi ngày hiệu lực của bản đã duyệt nhưng chưa tới ngày. Bản bị thay thế đổi ngày kết thúc theo.
   * Thay đổi tiêu chí: chặn nếu có lượt Level bắt đầu trong khoảng giữa ngày cũ và ngày mới, vì phiên bản gắn với lượt (R01) sẽ không còn đúng.
   */
  async reschedule(user: SessionUser, id: number, effectiveFrom: string): Promise<VersionDetailResponse> {
    await this.assert(user, 'approve', 'Chỉ BP Đào tạo được đổi ngày hiệu lực');
    const today = await this.clock.today();
    const row = await this.get(id);
    const old = row.effectiveFrom;
    const range = await this.effectiveRange(row, today);
    if (!range || !old) {
      throw conflict(
        'NOT_SCHEDULED',
        row.status === 'active' || row.status === 'expired'
          ? `v${row.code} đã có hiệu lực từ ${fmtDate(old)}, không đổi ngày được. Muốn thay đổi thì ban hành bản mới`
          : 'Chỉ đổi ngày hiệu lực được cho bản đã duyệt mà chưa tới ngày hiệu lực',
      );
    }
    if (effectiveFrom === old) return this.detail(user, id);
    if (effectiveFrom < range.min) {
      throw badRequest('EFFECTIVE_TOO_EARLY', range.min === today ? 'Ngày hiệu lực không được trước hôm nay' : `Ngày hiệu lực phải từ ${fmtDate(range.min)} (sau bản trước đó)`);
    }
    if (range.max && effectiveFrom > range.max) {
      throw badRequest('EFFECTIVE_TOO_LATE', `Ngày hiệu lực phải trước ${fmtDate(addDays(range.max, 1))}, ngày bản ban hành sau có hiệu lực`);
    }

    const isHead = row.code === row.criteriaLine;
    const [from, to] = effectiveFrom < old ? [effectiveFrom, old] : [old, effectiveFrom];
    if (isHead) {
      const affected = await this.db
        .select({ name: staff.fullName, startDate: levelRuns.startDate })
        .from(levelRuns)
        .innerJoin(staff, eq(staff.id, levelRuns.staffId))
        .where(and(gte(levelRuns.startDate, from), lt(levelRuns.startDate, to)));
      if (affected.length) {
        const names = affected.map((a) => `${a.name} (${fmtDate(a.startDate)})`);
        throw conflict(
          'RUNS_AFFECTED',
          `Có ${affected.length} lượt Level bắt đầu từ ${fmtDate(from)} đến trước ${fmtDate(to)} đã gắn phiên bản theo ngày cũ: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}. Chọn ngày khác`,
        );
      }
    }

    await this.db.transaction(async (tx) => {
      await lockRows(tx, versions, 'rowVersion', eq(versions.id, id));
      const [locked] = await tx.select().from(versions).where(eq(versions.id, id));
      if (locked.effectiveFrom !== old) throw staleData();
      await tx.update(versions).set({ effectiveFrom, updatedAt: new Date() }).where(eq(versions.id, id));
      // Bản bị bản này thay thế (đã được đặt kết thúc = ngày cũ − 1 khi duyệt) kết thúc theo ngày mới
      await tx
        .update(versions)
        .set({ effectiveTo: addDays(effectiveFrom, -1) })
        .where(
          and(
            PUBLISHED,
            ne(versions.id, id),
            eq(versions.effectiveTo, addDays(old, -1)),
            isHead ? ne(versions.criteriaLine, row.criteriaLine!) : eq(versions.criteriaLine, row.criteriaLine!),
          ),
        );
    });

    const recipients = await this.notifications.activeIds({ role: 'bp' });
    await this.notifications.notify(
      recipients,
      { type: 'version_rescheduled', title: `Bộ lộ trình v${row.code} đổi ngày hiệu lực: ${fmtDate(old)} → ${fmtDate(effectiveFrom)}`, link: `/thiet-ke/${id}` },
      user.id,
    );
    return this.detail(user, id);
  }

  async remove(user: SessionUser, id: number): Promise<{ ok: true }> {
    await this.assert(user, 'update', 'Chỉ BP Đào tạo được xóa bản nháp');
    const row = await this.get(id);
    if (row.status !== 'draft') throw conflict('NOT_DRAFT', 'Chỉ xóa được bản nháp; bản đã gửi duyệt hoặc ban hành được giữ lại (R03)');
    await this.db.delete(versions).where(eq(versions.id, id));
    return { ok: true };
  }

  async exportJson(user: SessionUser, id: number): Promise<{ filename: string; content: VersionContent }> {
    await this.assert(user, 'read', 'Chỉ BP Đào tạo xuất được phiên bản');
    const row = await this.get(id);
    return { filename: `lo-trinh-${row.code ? `v${row.code}` : `nhap-${row.id}`}.json`, content: VersionContentSchema.parse(row.content) };
  }
}
