'use client';

import { useRef } from 'react';
import { MainLayout } from '@/components/main-layout';
import { UploadCard } from '@/components/upload-card';
import { ExtractionSettingsCard } from '@/components/extraction-settings-card';
import { ErrorAlert } from '@/components/error-alert';
import { FrameAnalysisCard } from '@/components/frame-analysis-card';
import { ClearCacheDialog } from '@/components/clear-cache-dialog';
import { useFrameExtraction } from '@/hooks/use-frame-extraction';
import { getSelectedFrames, getSelectedFramesCount } from '@/utils/frame-selection';

export default function ExtractPage() {
  const { state, handlers } = useFrameExtraction();
  const videoRef = useRef<HTMLVideoElement | null>(null) as React.RefObject<HTMLVideoElement>;

  return (
    <MainLayout
      frameCount={state.frames.length}
      selectedFrameCount={getSelectedFramesCount(state)}
      onDownloadAction={handlers.handleDownload}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-7">
        {/* Upload Card */}
        <UploadCard
          video={state.videoFile}
          videoThumbnail={state.videoThumbnailUrl}
          metadata={state.videoMetadata}
          loadingMetadata={state.loadingMetadata}
          onVideoChangeAction={handlers.handleVideoChange}
          onVideoReplaceAction={handlers.handleVideoReplace}
          videoRef={videoRef}
        />

        {/* Extraction Settings Card */}
        {state.videoMetadata && (
          <ExtractionSettingsCard
            videoMetadata={state.videoMetadata}
            fps={state.fps}
            format={state.format}
            processing={state.processing}
            extractionProgress={state.extractionProgress}
            sharpnessProgress={state.sharpnessProgress}
            timeRange={state.timeRange}
            videoRef={videoRef}
            onFpsChangeAction={(fps) => handlers.setState(prev => ({ ...prev, fps }))}
            onFormatChangeAction={(format) => handlers.setState(prev => ({ ...prev, format }))}
            onTimeRangeChangeAction={(range) => handlers.setState(prev => ({ ...prev, timeRange: range }))}
            onExtractAction={handlers.handleExtractFrames}
            onCancelAction={handlers.handleCancel}
          />
        )}
      </div>

      {/* Error Alert */}
      <ErrorAlert error={state.error} className="mt-4" />

      {/* Frame Analysis Card */}
      <FrameAnalysisCard
        frames={state.frames}
        selectedFrames={getSelectedFrames(state)}
        showFrames={state.showFrames}
        processing={state.processing}
        selectionMode={state.selectionMode}
        percentageThreshold={state.percentageThreshold}
        batchSize={state.batchSize}
        batchBuffer={state.batchBuffer}
        onSelectionModeChangeAction={(mode) => handlers.setState(prev => ({ ...prev, selectionMode: mode }))}
        onPercentageThresholdChangeAction={(value) => handlers.setState(prev => ({ ...prev, percentageThreshold: value }))}
        onBatchSizeChangeAction={(size) => handlers.setState(prev => ({ ...prev, batchSize: size }))}
        onBatchBufferChangeAction={(buffer) => handlers.setState(prev => ({ ...prev, batchBuffer: buffer }))}
        onToggleFramesAction={() => handlers.setState(prev => ({ ...prev, showFrames: !prev.showFrames }))}
        onDownloadAction={handlers.handleDownload}
      />

      {/* Clear Cache Dialog */}
      <ClearCacheDialog
        open={state.showClearCacheDialog}
        onOpenChangeAction={(open: boolean) => handlers.setState(prev => ({ ...prev, showClearCacheDialog: open }))}
        onConfirmAction={handlers.handleClearCache}
        frameCount={state.frames.length}
      />
    </MainLayout>
  );
}
