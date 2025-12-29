import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // 允许容器外访问
    port: 5173,
    strictPort: true,  // 端口被占用就报错，不自动跳到 5174
    proxy: {
      '/graphql': 'http://localhost:4000',
      '/auth': 'http://localhost:4000',
      '/api': 'http://localhost:4000'
    }
  }
})
