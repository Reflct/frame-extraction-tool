declare global {
  interface Window {
    cv: OpenCV;
    Module: EmscriptenModule;
  }
}

interface OpenCV {
  Mat: {
    new(): Mat;
    new(rows: number, cols: number, type: number, data?: number[]): Mat;
  };
  imread: (element: HTMLImageElement | HTMLCanvasElement) => Mat;
  Laplacian: (src: Mat, dst: Mat, ddepth: number, ksize?: number) => void;
  mean: (src: Mat) => number[];
  matFromImageData: (imageData: ImageData) => Mat;
  cvtColor: (src: Mat, dst: Mat, code: number) => void;
  COLOR_RGBA2GRAY: number;
  CV_64F: number;
  absdiff: (src1: Mat, src2: Mat, dst: Mat) => void;
}

interface Mat {
  data: Uint8Array;
  data8U: Uint8Array;
  data32F: Float32Array;
  data64F: Float64Array;
  cols: number;
  rows: number;
  mul: (other: Mat, scale: number) => Mat;
  delete(): void;
}

interface EmscriptenModule {
  onRuntimeInitialized: () => void;
  onAbort: (error: Error) => void;
}

let opencvLoaded = false;
let opencvLoadPromise: Promise<void> | null = null;

export async function loadOpenCV(): Promise<void> {
  if (opencvLoaded) return;
  if (opencvLoadPromise) return opencvLoadPromise;
  
  opencvLoadPromise = new Promise((resolve, reject) => {
    // Create script element
    const script = document.createElement('script');
    script.src = '/opencv.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    // Set up OpenCV.js initialization callback
    window.Module = {
      onRuntimeInitialized: () => {
        if (window.cv && window.cv.Mat) {
          opencvLoaded = true;
          resolve();
        } else {
          reject(new Error('OpenCV load failed - cv.Mat not available'));
        }
      },
      onAbort: (error: Error) => {
        reject(new Error(`OpenCV initialization aborted: ${error.message}`));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV script'));
      opencvLoadPromise = null;
    };
    
    // Append script to document
    document.body.appendChild(script);
  });
  
  return opencvLoadPromise;
}

export async function calculateSharpnessScore(imageBlob: Blob): Promise<number> {
  if (!opencvLoaded) {
    await loadOpenCV();
  }

  const cv = window.cv;
  let mat: Mat | null = null;
  let gray: Mat | null = null;
  let laplacian: Mat | null = null;
  let url: string | null = null;

  try {
    // Convert Blob to ImageData with downscaling for performance
    const img = await createImageElement(imageBlob);
    url = img.src; // Store URL for cleanup

    // Downscale to max 600px width for faster processing (36% fewer pixels vs 800px)
    const maxWidth = 600;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const scaledWidth = Math.floor(img.width * scale);
    const scaledHeight = Math.floor(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d')!;

    // Use medium image smoothing quality for better performance
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

    const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);

    // Convert to OpenCV matrix
    mat = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    // Calculate Laplacian
    laplacian = new cv.Mat();
    cv.Laplacian(gray, laplacian, cv.CV_64F);

    // Calculate mean absolute deviation using scalar-based math instead of full matrix
    // This avoids creating a massive matrix just to compute differences
    const mean = cv.mean(laplacian)[0];
    const laplacianData = laplacian.data64F;

    // Compute mean absolute deviation directly
    let sumAbsDev = 0;
    for (let i = 0; i < laplacianData.length; i++) {
      sumAbsDev += Math.abs(laplacianData[i] - mean);
    }
    const mad = sumAbsDev / laplacianData.length;

    // Scale to 0-100 range and ensure it's a reasonable value
    const scaledScore = Math.min(100, Math.max(0, mad * 5));

    return scaledScore;
  } catch (error) {
    throw new Error(`Failed to calculate sharpness score: ${error}`);
  } finally {
    // Clean up OpenCV matrices
    if (mat) mat.delete();
    if (gray) gray.delete();
    if (laplacian) laplacian.delete();

    // Revoke object URL to prevent memory leak
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

function createImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    // Add timeout to prevent hanging if image never loads
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load timeout'));
    }, 5000); // 5 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      // Store URL on image for cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (img as any).__blobUrl = url;
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    try {
      img.src = url;
    } catch (error) {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(error);
    }
  });
}
