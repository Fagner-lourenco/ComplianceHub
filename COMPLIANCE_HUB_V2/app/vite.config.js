import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (/[\\/]react-dom[\\/]/.test(id)) return 'react-dom';
          if (/[\\/]react[\\/]/.test(id)) return 'react-core';

          if (/[\\/]firebase[\\/]auth[\\/]/.test(id)) return 'firebase-auth';
          if (/[\\/]firebase[\\/]firestore[\\/]/.test(id)) return 'firebase-firestore';
          if (/[\\/]firebase[\\/]functions[\\/]/.test(id)) return 'firebase-functions';
          if (/[\\/]firebase[\\/]app[\\/]/.test(id)) return 'firebase-core';
          if (id.includes('firebase')) return 'firebase-shared';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.emulator.test.js',
    ],
  },
})
