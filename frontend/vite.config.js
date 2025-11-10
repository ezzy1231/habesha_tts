import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy API requests to the backend during development to keep same-origin for cookies
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // If your backend is mounted at /api already, leave rewrite as identity
        // If not, you can rewrite here
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})