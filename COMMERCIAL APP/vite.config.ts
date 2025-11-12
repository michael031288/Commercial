import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';

// Copy PDF.js worker file to public directory
function copyPDFWorker() {
  const workerSource = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  const workerDest = path.resolve(__dirname, 'public/pdf.worker.min.mjs');
  
  if (existsSync(workerSource)) {
    try {
      copyFileSync(workerSource, workerDest);
      console.log('✅ Copied PDF.js worker to public directory');
    } catch (error) {
      console.warn('⚠️ Could not copy PDF.js worker:', error);
    }
  } else {
    // Try .js extension
    const workerSourceJs = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js');
    if (existsSync(workerSourceJs)) {
      try {
        copyFileSync(workerSourceJs, workerDest.replace('.mjs', '.js'));
        console.log('✅ Copied PDF.js worker (.js) to public directory');
      } catch (error) {
        console.warn('⚠️ Could not copy PDF.js worker:', error);
      }
    }
  }
}

// Copy worker file - runs on both dev and build
copyPDFWorker();

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    // Plugin to ensure worker file is copied when dev server starts
    {
      name: 'copy-pdf-worker',
      configureServer() {
        copyPDFWorker();
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
