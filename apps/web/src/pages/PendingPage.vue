<script setup lang="ts">
import { useRoute } from 'vue-router';

/** Màn "Đang chờ duyệt" (mục 5.1): người dùng không thấy dữ liệu nào cho tới khi BP Đào tạo duyệt */
const route = useRoute();
const email = typeof route.query.email === 'string' ? route.query.email : '';
const name = typeof route.query.name === 'string' ? route.query.name : '';
</script>

<template>
  <div class="auth stack" style="max-width: 560px">
    <div class="brand"><i>U</i>Lộ trình Upharma</div>
    <div class="card pad stack">
      <div class="h1">Đang chờ duyệt</div>
      <div>
        <template v-if="name">Cảm ơn <b>{{ name }}</b>, đăng ký</template><template v-else>Tài khoản</template>
        <template v-if="email"> <span class="mono">{{ email }}</span></template> đã được gửi tới BP Đào tạo.
      </div>
      <div class="alert info">
        <div>BP Đào tạo sẽ kiểm tra thông tin, chốt vai trò và nhà thuốc/khu vực của bạn. Khi được duyệt, đăng nhập bằng email và mật khẩu vừa tạo.</div>
      </div>
      <div class="sm mut">Nếu chờ quá lâu, liên hệ BP Đào tạo hoặc Cửa hàng trưởng của bạn.</div>
      <div><RouterLink class="btn" to="/dang-nhap">Về trang đăng nhập</RouterLink></div>
    </div>
  </div>
</template>
