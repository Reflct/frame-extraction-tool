export interface CodecInfo {
  format: string;
  codec: string;
  isSupported: boolean;
  webCodecsSupported: boolean;
  reason?: string;
}

export async function detectVideoCodec(videoFile: File): Promise<CodecInfo> {
  const defaultInfo: CodecInfo = {
    format: 'unknown',
    codec: 'unknown',
    isSupported: false,
    webCodecsSupported: false,
    reason: 'Unable to detect codec'
  };

  try {
    // Create a video element to load the file
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoFile);
    
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        
        // Try to detect codec from MIME type or file extension
        const extension = videoFile.name.split('.').pop()?.toLowerCase() || '';
        const mimeType = videoFile.type;
        
        let codec = 'unknown';
        const format = extension;
        let webCodecsSupported = false;
        let reason = '';

        // Basic codec detection based on file properties
        if (mimeType.includes('av01') || mimeType.includes('AV1')) {
          codec = 'AV1';
          webCodecsSupported = checkAV1Support();
          if (!webCodecsSupported) {
            reason = 'AV1 codec has limited WebCodecs support in current browser';
          }
        } else if (mimeType.includes('avc1') || mimeType.includes('h264')) {
          codec = 'H.264';
          webCodecsSupported = true;
        } else if (mimeType.includes('hev1') || mimeType.includes('h265')) {
          codec = 'H.265/HEVC';
          webCodecsSupported = checkHEVCSupport();
          if (!webCodecsSupported) {
            reason = 'H.265/HEVC support varies by browser and platform';
          }
        } else if (mimeType.includes('vp8')) {
          codec = 'VP8';
          webCodecsSupported = true;
        } else if (mimeType.includes('vp9')) {
          codec = 'VP9';
          webCodecsSupported = true;
        } else {
          // Try to infer from container format
          switch (extension) {
            case 'mp4':
            case 'm4v':
              codec = 'H.264 (assumed)';
              webCodecsSupported = true;
              break;
            case 'webm':
              codec = 'VP8/VP9 (assumed)';
              webCodecsSupported = true;
              break;
            case 'avi':
              codec = 'Various (container)';
              webCodecsSupported = false;
              reason = 'AVI container may contain unsupported codecs';
              break;
            case 'mov':
              codec = 'H.264 (assumed)';
              webCodecsSupported = true;
              break;
            default:
              reason = `Unknown format: ${extension}`;
          }
        }

        resolve({
          format,
          codec,
          isSupported: webCodecsSupported,
          webCodecsSupported,
          reason
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          ...defaultInfo,
          reason: 'Failed to load video file'
        });
      };

      video.src = url;
    });
  } catch (error) {
    return {
      ...defaultInfo,
      reason: `Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function checkAV1Support(): boolean {
  if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
    return false;
  }
  
  // AV1 support is limited and varies by browser
  const userAgent = navigator.userAgent;
  
  // Chrome/Edge have better AV1 support
  if (userAgent.includes('Chrome') || userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+)|Edg\/(\d+)/);
    const version = parseInt(match?.[1] || match?.[2] || '0');
    return version >= 110; // AV1 support improved significantly in these versions
  }
  
  // Firefox has limited AV1 support
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    const version = parseInt(match?.[1] || '0');
    return version >= 133;
  }
  
  // Safari has very limited AV1 support
  return false;
}

function checkHEVCSupport(): boolean {
  if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
    return false;
  }
  
  // HEVC support is mainly on Safari/iOS and some Chrome versions
  const userAgent = navigator.userAgent;
  
  // Safari/iOS generally support HEVC
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return true;
  }
  
  // Chrome has limited HEVC support
  return false;
}