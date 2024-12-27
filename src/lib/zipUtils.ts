import JSZip from 'jszip';

export interface FrameData {
  blob: Blob;
  fileName: string;
  blurScore?: number;
  format: 'jpeg' | 'png';
}

export async function downloadAsZip(frames: FrameData[], fileName = 'frames.zip') {
  const zip = new JSZip();
  
  // Add each frame to the zip
  frames.forEach((frame) => {
    zip.file(frame.fileName, frame.blob);
  });
  
  // Generate the zip file
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Create download link and trigger download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
