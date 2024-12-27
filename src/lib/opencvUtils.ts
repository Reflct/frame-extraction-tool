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

export async function calculateBlurScore(imageBlob: Blob): Promise<number> {
  if (!opencvLoaded) {
    await loadOpenCV();
  }
  
  const cv = window.cv;
  let mat: Mat | null = null;
  let gray: Mat | null = null;
  let laplacian: Mat | null = null;
  
  try {
    // Convert Blob to ImageData
    const img = await createImageElement(imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Convert to OpenCV matrix
    mat = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    
    // Calculate Laplacian
    laplacian = new cv.Mat();
    cv.Laplacian(gray, laplacian, cv.CV_64F);
    
    // Calculate variance using mean absolute deviation as it's more stable
    const mean = cv.mean(laplacian)[0];
    const absDev = new cv.Mat();
    const meanMat = new cv.Mat(laplacian.rows, laplacian.cols, cv.CV_64F, [mean, mean, mean, mean]);
    cv.absdiff(laplacian, meanMat, absDev);
    const mad = cv.mean(absDev)[0];
    
    // Clean up extra matrices
    meanMat.delete();
    absDev.delete();
    
    // Scale to 0-100 range and ensure it's a reasonable value
    const scaledScore = Math.min(100, Math.max(0, mad * 5));
    
    return scaledScore;
  } catch (error) {
    console.error('Error in blur detection:', error);
    throw new Error(`Failed to calculate blur score: ${error}`);
  } finally {
    // Clean up OpenCV matrices
    if (mat) mat.delete();
    if (gray) gray.delete();
    if (laplacian) laplacian.delete();
  }
}

function createImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
