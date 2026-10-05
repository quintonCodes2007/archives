import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = (target) => ({
  target,
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/[^/]+-api/, '')
});

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/customer-api': proxy('http://localhost:8081'),
      '/restaurant-api': proxy('http://localhost:8082'),
      '/order-api': proxy('http://localhost:8083'),
      '/delivery-api': proxy('http://localhost:8085'),
      '/admin-api': proxy('http://localhost:8087')
    }
  }
});
