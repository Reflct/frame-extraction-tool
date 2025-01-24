import { type ExtractPageState, type ChartData } from '@/types/frame-extraction';
import { type FrameData } from '@/types/frame';

export function getSelectedFramesCount(state: ExtractPageState): number {
  return getSelectedFrames(state).length;
}

export function getSelectedFrames(state: ExtractPageState): FrameData[] {
  if (state.frames.length === 0) return [];

  // Filter out frames without sharpness scores
  const framesWithScores = state.frames.filter(
    (frame): frame is FrameData & { sharpnessScore: number } => 
      typeof frame.sharpnessScore === 'number'
  );

  if (framesWithScores.length === 0) return [];

  // In manual mode, return frames that are explicitly selected
  if (state.selectionMode === 'manual') {
    return state.frames.filter(frame => frame.selected);
  }

  if (state.selectionMode === 'percentage') {
    // Sort frames by sharpness score in descending order (sharpest first)
    const sortedFrames = [...framesWithScores].sort((a, b) => b.sharpnessScore - a.sharpnessScore);
    const numFramesToSelect = Math.ceil(sortedFrames.length * (state.percentageThreshold / 100));
    return sortedFrames.slice(0, numFramesToSelect);
  } else {
    // Batch mode
    const selectedFrames: FrameData[] = [];
    
    // Process frames in batches
    for (let i = 0; i < framesWithScores.length; i += state.batchSize + state.batchBuffer) {
      // Get current batch
      const batch = framesWithScores.slice(i, i + state.batchSize);
      if (batch.length === 0) break;

      // Find the sharpest frame in the batch
      const selectedFrame = batch.reduce((best, current) => 
        current.sharpnessScore > best.sharpnessScore ? current : best
      , batch[0]);

      selectedFrames.push(selectedFrame);
    }

    return selectedFrames;
  }
}

export function getChartData(state: ExtractPageState): ChartData[] {
  const selectedFrames = new Set(getSelectedFrames(state));
  return state.frames.map((frame) => ({
    name: frame.name,
    sharpnessScore: frame.sharpnessScore ?? 0,
    selected: selectedFrames.has(frame),
  }));
}
