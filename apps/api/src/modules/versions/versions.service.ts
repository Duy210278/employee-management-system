import { Inject, Injectable } from '@nestjs/common';
import { VersionContentSchema, type IsoDate, type VersionContent } from '@lotrinh/shared';
import { and, desc, eq, lte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { versions } from '../../db/schema';
import { PUBLISHED } from '../runs/run-factory';

export interface LoadedVersion {
  id: number;
  code: string | null;
  content: VersionContent;
}

/** Nội dung phiên bản dùng khi vận hành lượt Level */
@Injectable()
export class VersionsService {
  /** Bản đã ban hành là bất biến (R03) nên có thể giữ trong bộ nhớ theo id */
  private readonly cache = new Map<number, VersionContent>();

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Sau khi khôi phục dữ liệu mẫu, id phiên bản được cấp lại từ đầu */
  clearCache(): void {
    this.cache.clear();
  }

  private parse(id: number, raw: unknown): VersionContent {
    let content = this.cache.get(id);
    if (!content) {
      content = VersionContentSchema.parse(raw);
      this.cache.set(id, content);
    }
    return content;
  }

  /**
   * R02: lượt Level gắn với dòng tiêu chí; câu chữ hiển thị lấy từ bản mới nhất đã có hiệu lực trong dòng.
   * Lượt bắt đầu trước ngày hiệu lực của chính phiên bản mình (lượt tương lai) thì dùng phiên bản đã gắn.
   */
  async contentForRun(run: { versionId: number }, today: IsoDate): Promise<LoadedVersion> {
    const pick = { id: versions.id, code: versions.code, content: versions.content };
    const [own] = await this.db.select({ ...pick, line: versions.criteriaLine }).from(versions).where(eq(versions.id, run.versionId));
    if (!own) throw new Error(`Không tìm thấy phiên bản ${run.versionId} của lượt`);
    // Dòng tiêu chí của lượt là dòng của phiên bản đã gắn (lượt chỉ gắn với bản đã ban hành nên luôn có dòng)
    const [latest] = own.line
      ? await this.db
          .select(pick)
          .from(versions)
          .where(and(PUBLISHED, eq(versions.criteriaLine, own.line), lte(versions.effectiveFrom, today)))
          .orderBy(desc(versions.effectiveFrom), desc(versions.id))
          .limit(1)
      : [];
    const row = latest ?? own;
    return { id: row.id, code: row.code, content: this.parse(row.id, row.content) };
  }
}
