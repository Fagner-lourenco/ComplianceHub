import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-dom') || id.includes('\\react-dom\\')) return 'react-dom';
          if (id.includes('react') || id.includes('\\react\\')) return 'react-core';

          if (id.includes('firebase/auth') || id.includes('\\firebase\\auth\\')) return 'firebase-auth';
          if (id.includes('firebase/firestore') || id.includes('\\firebase\\firestore\\')) return 'firebase-firestore';
          if (id.includes('firebase/functions') || id.includes('\\firebase\\functions\\')) return 'firebase-functions';
          if (id.includes('firebase/app') || id.includes('\\firebase\\app\\')) return 'firebase-core';
          if (id.includes('firebase')) return 'firebase-shared';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
  },
})
