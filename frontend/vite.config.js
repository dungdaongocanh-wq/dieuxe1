import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite với proxy API để tránh CORS khi phát triển
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Chuyển tiếp tất cả requests /api đến backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
