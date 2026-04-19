import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // Allow access from outside the container
    port: 5173,
    strictPort: true,  // Fail if port is occupied, don't auto-switch to 5174
    proxy: {
      '/graphql': 'http://localhost:4000',
      '/auth': 'http://localhost:4000',
      '/api': 'http://localhost:4000'
    }
  }
})
