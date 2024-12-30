import { type VideoMetadata } from '@/lib/videoUtils';
import { type FrameData } from '@/lib/zipUtils';

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
  frames: FrameData[];
  processing: boolean;
  loadingMetadata: boolean;
  videoThumbnailUrl: string | null;
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  selectionMode: 'percentage' | 'batched';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  error: string | null;
  showFrames: boolean;
  showClearCacheDialog: boolean;
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
  frames: [],
  processing: false,
  loadingMetadata: false,
  videoThumbnailUrl: null,
  extractionProgress: { current: 0, total: 0 },
  sharpnessProgress: { current: 0, total: 0 },
  selectionMode: 'batched',
  percentageThreshold: 25,
  batchSize: 3,
  batchBuffer: 1,
  error: null,
  showFrames: false,
  showClearCacheDialog: false,
};
