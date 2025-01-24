import { type VideoMetadata } from '@/lib/videoUtils';
import { type FrameData } from '@/types/frame';

export interface ProgressInfo {
  current: number;
  total: number;
  startTime?: number;
  estimatedTimeMs?: number;
}

export interface ExtractPageState {
  videoFile: File | null;
  videoMetadata: VideoMetadata | null;
  fps: number;
  format: 'jpeg' | 'png';
  prefix: string;
  useOriginalFrameRate: boolean;
  frames: FrameData[];
  processing: boolean;
  loadingMetadata: boolean;
  videoThumbnailUrl: string | null;
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  selectionMode: 'percentage' | 'batched' | 'manual';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  error: string | null;
  showFrames: boolean;
  showClearCacheDialog: boolean;
  timeRange: [number, number];
  imageFiles: FileList | null;
  isImageMode: boolean;
}

export interface ChartData {
  name: string;
  sharpnessScore: number;
  selected: boolean;
}

export const defaultState: ExtractPageState = {
  videoFile: null,
  videoMetadata: null,
  fps: 10,
  format: 'jpeg',
  prefix: '',
  useOriginalFrameRate: false,
  frames: [],
  processing: false,
  loadingMetadata: false,
  videoThumbnailUrl: null,
  extractionProgress: { current: 0, total: 0 },
  sharpnessProgress: { current: 0, total: 0 },
  selectionMode: 'percentage',
  percentageThreshold: 50,
  batchSize: 10,
  batchBuffer: 3,
  error: null,
  showFrames: true,
  showClearCacheDialog: false,
  timeRange: [0, 0],
  imageFiles: null,
  isImageMode: false,
};
