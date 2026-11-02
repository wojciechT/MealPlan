import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin in development, so the app needs no CORS and no base URL.
    // The host turns its HTTPS redirect off in Development for this to work.
    proxy: {
      '/api': 'http://localhost:5106',
    },
  },
  build: {
    // The host serves the built SPA from wwwroot outside Development.
    outDir: '../backend/MealPlan.Host/wwwroot',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
