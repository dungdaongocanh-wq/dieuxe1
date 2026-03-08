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
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
