import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // BASE_PATH đọc từ .env ở gốc monorepo (cùng file với API); bản build cho máy chủ phải build với đúng BASE_PATH
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  const basePath = (process.env.BASE_PATH ?? rootEnv.BASE_PATH ?? '/').replace(/\/+$/, '');
  const base = `${basePath}/`;
  const port = process.env.PORT ?? rootEnv.PORT ?? '3000';
  return {
    base,
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Dùng thẳng mã nguồn shared để sửa là thấy ngay, không cần build lại
        '@lotrinh/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: { [`${base}api`]: `http://localhost:${port}` },
    },
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
