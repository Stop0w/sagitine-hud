import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@features': '/src/features'
    }
  },
  build: {
    rollupOptions: {
      output: {
        // rolldown (Vite 8) requires manualChunks as a function, not an object.
        // Split vendor libraries so they are cached independently of app code.
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-framer';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-lucide';
          }
        },
      },
    },
  },
})