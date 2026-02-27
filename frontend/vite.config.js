import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/dns/',
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/dns/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/dns/, ''),
      },
    },
  },
})
