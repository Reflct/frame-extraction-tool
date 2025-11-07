interface BrowserInfo {
  chrome: boolean;
  firefox: boolean;
  safari: boolean;
  edge: boolean;
  version: number;
}

function getBrowserInfo(): BrowserInfo {
  const userAgent = navigator.userAgent;
  
  // Chrome detection (must come before Safari since Chrome includes Safari in UA)
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return {
      chrome: true,
      firefox: false,
      safari: false,
      edge: false,
      version: match ? parseInt(match[1]) : 0
    };
  }
  
  // Edge detection
  if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return {
      chrome: false,
      firefox: false,
      safari: false,
      edge: true,
      version: match ? parseInt(match[1]) : 0
    };
  }
  
  // Firefox detection
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return {
      chrome: false,
      firefox: true,
      safari: false,
      edge: false,
      version: match ? parseInt(match[1]) : 0
    };
  }
  
  // Safari detection
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return {
      chrome: false,
      firefox: false,
      safari: true,
      edge: false,
      version: match ? parseInt(match[1]) : 0
    };
  }
  
  return {
    chrome: false,
    firefox: false,
    safari: false,
    edge: false,
    version: 0
  };
}

export interface BrowserSupport {
  mediaBunny: boolean;
  canvas: boolean;
  webCodecs: boolean;
  reason?: string;
}

export function getBrowserSupport(): BrowserSupport {
  if (typeof window === 'undefined') {
    return {
      mediaBunny: false,
      canvas: false,
      webCodecs: false,
      reason: 'Server-side environment'
    };
  }

  const isWebCodecsSupported = 'VideoDecoder' in window && 'VideoEncoder' in window;
  const browser = getBrowserInfo();
  
  let mediaBunnySupported = false;
  let reason: string | undefined;

  if (!isWebCodecsSupported) {
    reason = 'WebCodecs API not supported';
  } else if (browser.chrome && browser.version >= 94) {
    mediaBunnySupported = true;
  } else if (browser.firefox && browser.version >= 133) {
    mediaBunnySupported = true;
  } else if (browser.edge && browser.version >= 94) {
    mediaBunnySupported = true;
  } else if (browser.safari && browser.version >= 16.6) {
    mediaBunnySupported = true;
    reason = 'Safari has partial WebCodecs support';
  } else {
    reason = `Browser version not supported (${getBrowserName(browser)} ${browser.version})`;
  }
  
  return {
    mediaBunny: mediaBunnySupported,
    canvas: true,
    webCodecs: isWebCodecsSupported,
    reason
  };
}

function getBrowserName(browser: BrowserInfo): string {
  if (browser.chrome) return 'Chrome';
  if (browser.firefox) return 'Firefox';
  if (browser.safari) return 'Safari';
  if (browser.edge) return 'Edge';
  return 'Unknown';
}

export async function canUseMediaBunny(videoFile: File): Promise<boolean> {
  const support = getBrowserSupport();

  if (!support.mediaBunny) {
    return false;
  }

  try {
    // Use the entire file for codec detection - chunks can miss metadata
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(videoFile)
    });

    const videoTrack = await input.getPrimaryVideoTrack();

    if (!videoTrack) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getExtractionMethodInfo(useMediaBunny: boolean) {
  return {
    method: useMediaBunny ? 'MediaBunny' : 'Canvas',
    description: useMediaBunny ? 'High-performance extraction' : 'Compatible extraction',
    expectedSpeedup: useMediaBunny ? '10-60x faster' : 'Standard speed'
  };
}