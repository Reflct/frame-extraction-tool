import JSZip from 'jszip';

export interface FrameData {
  id: string;
  blob: Blob;
  name: string;
  format: string;
  sharpnessScore?: number;
}

/**
 * Sanitizes filenames to be Windows 11 compatible
 * Removes or replaces reserved characters: < > : " / \ | ? *
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^\s+|\s+$/g, '') // Remove leading/trailing whitespace
    .substring(0, 255); // Windows filename length limit
}

export async function downloadAsZip(frames: FrameData[]): Promise<void> {
  const zip = new JSZip();

  // Add each frame to the zip with sanitized filenames for Windows 11 compatibility
  frames.forEach((frame) => {
    const sanitizedName = sanitizeFilename(frame.name);
    zip.file(sanitizedName, frame.blob);
  });
  
  // Generate the zip file
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Create download link and trigger download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'frames.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
