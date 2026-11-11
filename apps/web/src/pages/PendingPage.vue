<script setup lang="ts">
import { useRoute } from 'vue-router';

const BASE_URL = import.meta.env.BASE_URL;

/** Màn "Đang chờ duyệt" (mục 5.1): người dùng không thấy dữ liệu nào cho tới khi BP Đào tạo duyệt */
const route = useRoute();
const email = typeof route.query.email === 'string' ? route.query.email : '';
const name = typeof route.query.name === 'string' ? route.query.name : '';
</script>

<template>
  <div class="auth-page">
    <div class="auth-card mid">
      <div class="auth-head">
        <img class="auth-logo" :src="`${BASE_URL}upharma.png`" alt="UPharma" width="96" height="96" />
        <h1 class="auth-title">Đang chờ duyệt</h1>
        <p class="auth-sub">
          <template v-if="name">Cảm ơn <b>{{ name }}</b>, đăng ký</template><template v-else>Tài khoản</template>
          <template v-if="email"> <span class="mono">{{ email }}</span></template> đã được gửi tới BP Đào tạo.
        </p>
      </div>
      <div class="alert info">
        <div>BP Đào tạo sẽ kiểm tra thông tin, chốt vai trò và nhà thuốc/khu vực của bạn. Khi được duyệt, đăng nhập bằng email và mật khẩu vừa tạo.</div>
      </div>
      <RouterLink class="btn cta lg round wide" to="/dang-nhap">Về trang đăng nhập</RouterLink>
      <div class="auth-foot">Nếu chờ quá lâu, liên hệ BP Đào tạo hoặc Cửa hàng trưởng của bạn.</div>
    </div>
  </div>
</template>
