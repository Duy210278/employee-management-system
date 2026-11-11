<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const BASE_URL = import.meta.env.BASE_URL;

/** Người dùng đến từ hệ thống chính (Web A) nhưng chưa vào được Lộ trình: chức danh chưa được cấp quyền, đã nghỉ… */
const route = useRoute();
const TITLES: Record<string, string> = {
  NO_MODULE_ACCESS: 'Chưa được cấp quyền Lộ trình',
  NOT_PROVISIONED: 'Chưa có tài khoản Lộ trình',
  ACCOUNT_INACTIVE: 'Tài khoản đã ngừng hoạt động',
  IDENTITY_CONFLICT: 'Tài khoản cần được kiểm tra',
};
const code = computed(() => (typeof route.query.code === 'string' ? route.query.code : ''));
const title = computed(() => TITLES[code.value] ?? 'Không mở được Lộ trình');
const message = computed(() => (typeof route.query.msg === 'string' && route.query.msg) || 'Liên hệ BP Đào tạo để được hỗ trợ.');
/** Module chạy dưới đường dẫn con của hệ thống chính: gốc tên miền là trang chủ hệ thống chính */
const homeUrl = `${window.location.origin}/`;
</script>

<template>
  <div class="auth-page">
    <div class="auth-card mid">
      <div class="auth-head">
        <img class="auth-logo" :src="`${BASE_URL}upharma.png`" alt="UPharma" width="96" height="96" />
        <h1 class="auth-title">{{ title }}</h1>
        <p class="auth-sub">{{ message }}</p>
      </div>
      <a class="btn cta lg round wide" :href="homeUrl">Về hệ thống chính</a>
      <div class="auth-foot">Vai trò và nơi làm việc của bạn được quản lý ở hệ thống chính. BP Đào tạo cấp quyền dùng Lộ trình theo chức danh.</div>
    </div>
  </div>
</template>
