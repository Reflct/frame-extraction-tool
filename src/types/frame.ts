export interface FrameMetadata {
  id: string;
  name: string;
  timestamp: number;
  format: string;
  sharpnessScore?: number;
  selected?: boolean;
}

// Light-weight frame data stored in memory
export interface FrameData extends FrameMetadata {
  // Optional blob reference, only loaded when needed
  blob?: Blob;
  // Optional data buffer, only loaded when needed
  data?: Uint8Array;
}

// Complete frame data stored in IndexedDB
export interface StoredFrameData extends FrameMetadata {
  blob: Blob;
  data: Uint8Array;
  storedAt: number;
}
