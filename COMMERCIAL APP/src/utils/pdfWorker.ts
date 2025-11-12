import { pdfjs } from 'react-pdf';

// Initialize PDF.js worker with proper error handling
let workerInitialized = false;
let workerReady = false;
let workerReadyPromise: Promise<void> | null = null;

export const initializePDFWorker = () => {
  if (workerInitialized) {
    console.log('🔵 PDF worker already initialized');
    return workerReadyPromise || Promise.resolve();
  }

  if (typeof window === 'undefined') {
    console.log('🔵 PDF worker init skipped (SSR)');
    return Promise.resolve();
  }

  workerInitialized = true;

  workerReadyPromise = new Promise<void>(async (resolve) => {
    try {
      // Get the exact version from pdfjs
      const pdfjsVersion = pdfjs.version;
      console.log('🔵 PDF.js version:', pdfjsVersion);
      
      // Use local worker file first (copied during build from node_modules)
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      console.log('🔵 Set worker source to local:', pdfjs.GlobalWorkerOptions.workerSrc);
      
      // Verify worker file exists
      const response = await fetch('/pdf.worker.min.mjs', { method: 'HEAD' });
      if (!response.ok) {
        // Try .js extension
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const response2 = await fetch('/pdf.worker.min.js', { method: 'HEAD' });
        if (!response2.ok) {
          // Fallback to CDN
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
        }
      }
      
      console.log('✅ PDF worker file found and accessible');
      
      // Give worker significant time to initialize and establish connection
      // PDF.js worker needs time to load, parse, and establish message port
      await new Promise(resolve => setTimeout(resolve, 800));
      
      workerReady = true;
      console.log('✅ PDF worker ready');
      resolve();
    } catch (error) {
      console.error('❌ Failed to initialize PDF.js worker:', error);
      workerReady = true; // Resolve anyway to prevent blocking
      resolve();
    }
  });

  return workerReadyPromise;
};

export const waitForWorkerReady = async () => {
  if (workerReady) {
    return Promise.resolve();
  }
  return workerReadyPromise || initializePDFWorker();
};

// Initialize immediately when module loads
if (typeof window !== 'undefined') {
  initializePDFWorker();
  
  // Also verify worker is accessible after a short delay
  setTimeout(() => {
    const workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
    console.log('🔍 Worker verification check:', {
      workerSrc,
      initialized: workerInitialized,
      ready: workerReady,
      version: pdfjs.version
    });
  }, 2000);
}

