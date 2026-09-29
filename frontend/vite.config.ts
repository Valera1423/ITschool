// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    svgr({
      include: '**/*.svg',
      svgrOptions: {
        replaceAttrValues: {
          '#000': 'currentColor',
          '#000000': 'currentColor',
        },
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/ready': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: {
    port: 4173,
  },

  optimizeDeps: {
    include: ['lucide-react', 'date-fns'],
    exclude: [],
  },

  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          query: ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          oidc: ['oidc-client-ts', 'react-oidc-context'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          xlsx: ['xlsx'],
          pdf: ['jspdf', 'jspdf-autotable'],
          flow: ['reactflow'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          leaflet: ['leaflet', 'react-leaflet'],
          datefns: ['date-fns'],
        },
      },
    },
  },
});