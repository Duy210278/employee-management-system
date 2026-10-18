<script setup lang="ts">
import type { VersionState } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { versionApi, useVersion, useVersions } from '@/api/queries';
import VersionEditor from '@/components/design/VersionEditor.vue';
import { useToast } from '@/composables/toast';
import { fmtDate } from '@/format';

/** Thiết kế lộ trình (mục 4.3, 7.3): cột trái danh sách phiên bản dạng dòng thời gian, bên phải trình soạn */
const route = useRoute();
const router = useRouter();
const qc = useQueryClient();
const toast = useToast();
const { data: list, error: listError, isLoading } = useVersions();
const selectedId = computed<number | null>(() => (route.params.id ? Number(route.params.id) : null));
const { data: detail, error: detailError, isFetching } = useVersion(selectedId);
const creating = ref(false);

// Mở /thiet-ke thì chọn sẵn bản nháp / chờ duyệt, nếu không có thì bản đang hiệu lực
watch(
  [list, selectedId],
  ([l, id]) => {
    if (!l || id !== null) return;
    const pick = l.items.find((i) => i.state === 'draft' || i.state === 'pending') ?? l.items.find((i) => i.state === 'current');
    if (pick) void router.replace(`/thiet-ke/${pick.id}`);
  },
  { immediate: true },
);

const STATE: Record<VersionState, [string, string]> = {
  draft: ['Nháp', 'warn'],
  pending: ['Chờ duyệt', 'info'],
  current: ['Đang hiệu lực', 'ok'],
  scheduled: ['Sắp hiệu lực', 'info'],
  expired: ['Hết hiệu lực', ''],
};
const refYear = computed(() => (list.value ? Number(list.value.today.slice(0, 4)) : new Date().getFullYear()));
const current = computed(() => list.value?.items.find((i) => i.state === 'current'));
const hasOpen = computed(() => !!list.value?.items.some((i) => i.state === 'draft' || i.state === 'pending'));

async function newDraft() {
  if (!current.value) return;
  creating.value = true;
  try {
    const res = await versionApi.createDraft(current.value.id);
    await qc.invalidateQueries({ queryKey: ['versions'] });
    toast.show(`Đã tạo bản nháp từ v${current.value.code}`);
    await router.push(`/thiet-ke/${res.id}`);
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="listError" class="card pad"><div class="alert bad"><div>{{ listError.message }}</div></div></div>
  <div v-else-if="list" class="designer">
    <aside class="card dz-list" aria-label="Danh sách phiên bản">
      <div class="stg"><b>Phiên bản</b></div>
      <RouterLink
        v-for="i in list.items"
        :key="i.id"
        :to="`/thiet-ke/${i.id}`"
        class="vitem"
        :aria-current="i.id === selectedId ? 'page' : undefined"
      >
        <span class="rowf sp" style="gap: 6px">
          <b>{{ i.code ? `v${i.code}` : 'Bản nháp' }}</b>
          <span class="pill" :class="STATE[i.state][1]">{{ STATE[i.state][0] }}</span>
        </span>
        <span class="sm mut">
          <template v-if="i.effectiveFrom">Từ {{ fmtDate(i.effectiveFrom, refYear) }}<template v-if="i.effectiveTo"> → {{ fmtDate(i.effectiveTo, refYear) }}</template></template>
          <template v-else-if="i.parentCode">Từ v{{ i.parentCode }}</template>
          <template v-if="i.activeRuns"> · {{ i.activeRuns }} lượt</template>
        </span>
        <span v-if="i.changeNote" class="sm vnote">{{ i.changeNote }}</span>
      </RouterLink>
      <div v-if="list.canEdit && current && !hasOpen" style="padding: 10px 12px">
        <button class="btn sm pri" type="button" :disabled="creating" @click="newDraft">+ Tạo bản nháp từ v{{ current.code }}</button>
      </div>
    </aside>

    <div class="dz-main">
      <div v-if="detailError" class="card pad"><div class="alert bad"><div>{{ detailError.message }}</div></div></div>
      <VersionEditor v-else-if="detail && detail.version.id === selectedId" :key="detail.version.id" :detail="detail" />
      <div v-else-if="isFetching || selectedId" class="card empty">Đang tải phiên bản…</div>
      <div v-else class="card empty">
        <h3>Chưa có phiên bản nào</h3>
      </div>
    </div>
  </div>
</template>
