export async function createThumbnail(blob: Blob, maxWidth: number = 150): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Calculate thumbnail dimensions
      const scale = maxWidth / img.width;
      const width = maxWidth;
      const height = img.height * scale;

      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Balance speed and quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with lower quality for thumbnails
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create thumbnail blob'));
        },
        'image/jpeg',
        0.75
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for thumbnail creation'));
    };

    img.src = url;
  });
} 