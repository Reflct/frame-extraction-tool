import JSZip from 'jszip';

export interface FrameData {
  id: string;
  blob: Blob;
  name: string;
  format: string;
  sharpnessScore?: number;
}

export async function downloadAsZip(frames: FrameData[]): Promise<void> {
  const zip = new JSZip();
  
  // Add each frame to the zip
  frames.forEach((frame) => {
    zip.file(frame.name, frame.blob);
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
