// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // اگر در کد از "@/..." استفاده کرده‌ای، این alias لازم است
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // پورت پیش‌فرض Vite، می‌تونی حذفش کنی تا همان 5173 باشد
    port: 5173,
    open: true,
  },
})
