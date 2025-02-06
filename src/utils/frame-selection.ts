import { type ExtractPageState, type ChartData } from '@/types/frame-extraction';
import { type FrameData } from '@/types/frame';

export function getSelectedFramesCount(state: ExtractPageState): number {
  return getSelectedFrames(state).length;
}

interface ScoredFrame extends FrameData {
  compositeScore: number;
  segmentIndex: number;
}

function calculateDistributionScore(frameIndex: number, totalFrames: number, selectedFrames: Set<number>, minGap: number): number {
  // Calculate distance to nearest selected frame
  let nearestSelectedDistance = minGap;
  for (const selectedIndex of selectedFrames) {
    const distance = Math.abs(frameIndex - selectedIndex);
    if (distance < nearestSelectedDistance) {
      nearestSelectedDistance = distance;
    }
  }

  // Normalize distance score (0 to 1)
  const distanceScore = Math.min(nearestSelectedDistance / minGap, 1);

  // Calculate position score based on ideal distribution
  const segmentSize = totalFrames / selectedFrames.size;
  const nearestIdealPosition = Math.round(frameIndex / segmentSize) * segmentSize;
  const positionScore = 1 - (Math.abs(frameIndex - nearestIdealPosition) / segmentSize);

  // Combine scores with weights
  return (distanceScore * 0.7) + (positionScore * 0.3);
}

function selectBestNFrames(frames: FrameData[], n: number, minGap: number): FrameData[] {
  if (frames.length === 0) return [];
  
  const selectedIndices = new Set<number>();
  const segmentSize = Math.ceil(frames.length / n);
  const segments: ScoredFrame[][] = [];

  // Create segments and calculate initial scores
  for (let i = 0; i < frames.length; i += segmentSize) {
    const segment = frames.slice(i, i + segmentSize).map(frame => ({
      ...frame,
      compositeScore: frame.sharpnessScore || 0,
      segmentIndex: Math.floor(i / segmentSize)
    }));
    segments.push(segment);
  }

  const selectedFrames: FrameData[] = [];

  // First pass: Select best frame from each segment
  for (let i = 0; i < segments.length && selectedFrames.length < n; i++) {
    const segment = segments[i];
    const validFrames = segment.filter(frame => {
      const frameIndex = frames.findIndex(f => f.id === frame.id);
      return Array.from(selectedIndices).every(selectedIndex => 
        Math.abs(frameIndex - selectedIndex) >= minGap
      );
    });

    if (validFrames.length > 0) {
      // Sort by sharpness score and select the best one
      const bestFrame = validFrames.reduce((best, current) => 
        (current.sharpnessScore || 0) > (best.sharpnessScore || 0) ? current : best
      );
      
      selectedFrames.push(bestFrame);
      selectedIndices.add(frames.findIndex(f => f.id === bestFrame.id));
    }
  }

  // Second pass: Fill remaining slots with best available frames
  while (selectedFrames.length < n) {
    let bestScore = -1;
    let bestFrame: FrameData | null = null;

    for (let i = 0; i < frames.length; i++) {
      if (selectedIndices.has(i)) continue;

      const frame = frames[i];
      const distributionScore = calculateDistributionScore(i, frames.length, selectedIndices, minGap);
      const sharpnessScore = frame.sharpnessScore || 0;
      const compositeScore = (sharpnessScore * 0.7) + (distributionScore * 0.3);

      if (compositeScore > bestScore && 
          Array.from(selectedIndices).every(selectedIndex => Math.abs(i - selectedIndex) >= minGap)) {
        bestScore = compositeScore;
        bestFrame = frame;
      }
    }

    if (bestFrame) {
      selectedFrames.push(bestFrame);
      selectedIndices.add(frames.findIndex(f => f.id === bestFrame.id));
    } else {
      break; // No more valid frames to select
    }
  }

  return selectedFrames;
}

function selectTopPercentFrames(frames: FrameData[], percentageThreshold: number): FrameData[] {
  if (frames.length === 0) return [];

  // Sort frames by sharpness score in descending order
  const sortedFrames = [...frames].sort((a, b) => 
    (b.sharpnessScore ?? 0) - (a.sharpnessScore ?? 0)
  );

  // Calculate how many frames to select based on the percentage
  const numFramesToSelect = Math.ceil(frames.length * (percentageThreshold / 100));

  // Return the top N% frames
  return sortedFrames.slice(0, numFramesToSelect);
}

export function getSelectedFrames(state: ExtractPageState): FrameData[] {
  if (state.frames.length === 0) return [];

  // Filter out frames without sharpness scores
  const framesWithScores = state.frames.filter(
    (frame): frame is FrameData & { sharpnessScore: number } => 
      typeof frame.sharpnessScore === 'number'
  );

  if (framesWithScores.length === 0) return [];

  // In manual mode, return only manually selected frames
  if (state.selectionMode === 'manual') {
    return state.frames.filter(frame => frame.selected);
  }

  // Get automatically selected frames based on mode
  let autoSelectedFrames: FrameData[] = [];
  
  if (state.selectionMode === 'batched') {
    // Process frames in batches, selecting the best frame from each batch
    for (let i = 0; i < framesWithScores.length; i += state.batchSize + state.batchBuffer) {
      // Get current batch
      const batch = framesWithScores.slice(i, i + state.batchSize);
      if (batch.length === 0) break;

      // Find the sharpest frame in the batch
      const selectedFrame = batch.reduce((best, current) => 
        current.sharpnessScore > best.sharpnessScore ? current : best
      , batch[0]);

      autoSelectedFrames.push(selectedFrame);
    }
  } else if (state.selectionMode === 'best-n') {
    autoSelectedFrames = selectBestNFrames(framesWithScores, state.bestNCount, state.bestNMinGap);
  } else if (state.selectionMode === 'top-percent') {
    autoSelectedFrames = selectTopPercentFrames(framesWithScores, state.percentageThreshold);
  }

  // Get manually selected frames
  const manuallySelectedFrames = state.frames.filter(frame => frame.selected);

  // Combine auto and manual selections, removing duplicates
  const selectedFrameIds = new Set([
    ...autoSelectedFrames.map(f => f.id),
    ...manuallySelectedFrames.map(f => f.id)
  ]);

  return state.frames.filter(frame => selectedFrameIds.has(frame.id));
}

export function getChartData(state: ExtractPageState): ChartData[] {
  const selectedFrames = new Set(getSelectedFrames(state));
  return state.frames.map((frame) => ({
    name: frame.name,
    sharpnessScore: frame.sharpnessScore ?? 0,
    selected: selectedFrames.has(frame),
  }));
}
