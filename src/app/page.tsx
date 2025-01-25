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
  const { state, setState, handlers } = useFrameExtraction();
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
          onImageDirectoryChangeAction={handlers.handleImageDirectoryChange}
          videoRef={videoRef}
          isImageMode={state.isImageMode}
          imageCount={state.frames.length}
        />

        {/* Extraction Settings Card */}
        {state.videoMetadata && !state.isImageMode && (
          <ExtractionSettingsCard
            videoMetadata={state.videoMetadata}
            fps={state.fps}
            format={state.format}
            prefix={state.prefix}
            useOriginalFrameRate={state.useOriginalFrameRate}
            processing={state.processing}
            extractionProgress={state.extractionProgress}
            sharpnessProgress={state.sharpnessProgress}
            timeRange={state.timeRange}
            videoRef={videoRef}
            onFpsChangeAction={(fps) => setState(prev => ({ ...prev, fps }))}
            onFormatChangeAction={(format) => setState(prev => ({ ...prev, format }))}
            onPrefixChangeAction={(prefix) => setState(prev => ({ ...prev, prefix }))}
            onUseOriginalFrameRateChangeAction={(value) => setState(prev => ({ ...prev, useOriginalFrameRate: value }))}
            onTimeRangeChangeAction={(range) => setState(prev => ({ ...prev, timeRange: range }))}
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
        batchSize={state.batchSize}
        batchBuffer={state.batchBuffer}
        bestNCount={state.bestNCount}
        bestNMinGap={state.bestNMinGap}
        onSelectionModeChangeAction={handlers.handleSelectionModeChange}
        onBatchSizeChangeAction={handlers.handleBatchSizeChange}
        onBatchBufferChangeAction={handlers.handleBatchBufferChange}
        onBestNCountChangeAction={(count) => setState(prev => ({ ...prev, bestNCount: count }))}
        onBestNMinGapChangeAction={(gap) => setState(prev => ({ ...prev, bestNMinGap: gap }))}
        onToggleFramesAction={() => setState(prev => ({ ...prev, showFrames: !prev.showFrames }))}
        onToggleFrameSelectionAction={handlers.handleToggleFrameSelection}
      />

      {/* Clear Cache Dialog */}
      <ClearCacheDialog
        open={state.showClearCacheDialog}
        onOpenChangeAction={(open: boolean) => setState(prev => ({ ...prev, showClearCacheDialog: open }))}
        onConfirmAction={handlers.handleClearCache}
        frameCount={state.frames.length}
      />
    </MainLayout>
  );
}
