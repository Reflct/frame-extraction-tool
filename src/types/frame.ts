export interface FrameMetadata {
  id: string;
  name: string;
  timestamp: number;
  format: string;
  sharpnessScore?: number;
  data?: Uint8Array;
}

export interface ExtractedFrame {
  metadata: FrameMetadata;
  data: Uint8Array;
}
