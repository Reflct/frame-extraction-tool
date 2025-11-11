'use client';

import { useEffect } from 'react';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker for StreamSaver support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[ServiceWorker] Registered successfully:', registration);
        })
        .catch((error) => {
          console.warn('[ServiceWorker] Registration failed:', error);
          // Non-critical: Service worker registration failure doesn't break functionality
          // Streaming will fall back to standard download method
        });
    }
  }, []);

  return <>{children}</>;
}
