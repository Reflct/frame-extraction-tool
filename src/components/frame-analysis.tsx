'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { type FrameData, type FrameMetadata } from '@/types/frame';
import { FramePreviewDialog } from './frame-preview-dialog';
import { frameStorage } from '@/lib/frameStorage';
import { ChartTooltip } from './chart-tooltip';
import { ThumbnailCache } from '@/lib/thumbnailCache';
import CanvasFrameChart from './frame-canvas-chart';

interface FrameAnalysisProps {
  frames: FrameData[];
  selectedFrames: Set<string>;
  onFrameSelectAction: (frameId: string) => void;
  showImageGrid?: boolean;
}

export function FrameAnalysis({
  frames,
  selectedFrames,
  onFrameSelectAction,
  showImageGrid = true,
}: FrameAnalysisProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameData | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<FrameData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [frameData, setFrameData] = useState<Record<string, Uint8Array>>({});
  const [scrollPosition, setScrollPosition] = useState(0);
  const convertingRef = useRef<Record<string, boolean>>({});

  // NEW: Replace Map with ThumbnailCache for memory-efficient thumbnail management
  const thumbnailCache = useRef<ThumbnailCache>(new ThumbnailCache(200));
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const failedFrameIds = useRef<Set<string>>(new Set()); // Track frames that failed generation (don't retry these)
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Throttle thumbnail URL updates to prevent cascading re-renders during rapid mouse movement
  const thumbnailUpdateThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // Track retry attempts for hovered frames - map of frameId to retry attempt count
  // This ensures we retry hovered frames even when queue is full
  const hoveredRetryCountRef = useRef<Map<string, number>>(new Map());

  // Component lifecycle - cleanup cache on unmount and setup eviction callback
  useEffect(() => {
    const cache = thumbnailCache.current;
    const failed = failedFrameIds.current;
    const throttleRef = thumbnailUpdateThrottleRef.current;
    const retryMap = hoveredRetryCountRef.current;

    // Register callback to clean up state when cache evicts entries
    cache.setEvictionCallback((evictedFrameIds) => {
      setThumbnailUrls(prev => {
        const updated = new Map(prev);
        evictedFrameIds.forEach(id => updated.delete(id));
        return updated;
      });
    });

    return () => {
      cache.clear();
      failed.clear();
      setThumbnailUrls(new Map());
      retryMap.clear();

      // Clean up thumbnail throttle timer
      if (throttleRef) {
        clearTimeout(throttleRef);
      }
    };
  }, []);

  // Load hovered frame + nearby frames on-demand (only when user hovers)
  // This prevents loading thousands of thumbnails upfront
  useEffect(() => {
    if (!hoveredFrame) return;

    // Clear any pending preload
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }

    const loadHoveredAndPreload = async () => {
      // 1. Load hovered frame immediately (high priority)
      const hoveredId = hoveredFrame.id;

      // Skip if frame generation permanently failed
      if (failedFrameIds.current.has(hoveredId)) {
        return;
      }

      // Attempt to load with exponential backoff retry for queue-full scenarios
      // This ensures hovered frames are retried even if the loading queue is saturated
      const hoveredUrl = await thumbnailCache.current.get(hoveredId);

      if (!hoveredUrl) {
        // Retry logic for hovered frames when queue is full
        // Track retry attempts to avoid infinite loops
        const currentRetries = hoveredRetryCountRef.current.get(hoveredId) || 0;
        const MAX_RETRIES = 3;

        if (currentRetries < MAX_RETRIES) {
          // Implement exponential backoff: 100ms, 200ms, 400ms
          const delay = Math.pow(2, currentRetries) * 100;
          hoveredRetryCountRef.current.set(hoveredId, currentRetries + 1);

          // Schedule retry - this will pick up the thumbnail when queue has space
          setTimeout(() => {
            loadHoveredAndPreload();
          }, delay);
        }
      } else {
        // Success: clear retry count and update state
        hoveredRetryCountRef.current.delete(hoveredId);
        // Always update state immediately for hovered frames (don't throttle)
        setThumbnailUrls(prev => new Map(prev.set(hoveredId, hoveredUrl)));
      }

      // 2. Preload nearby frames (debounced to avoid excessive loading)
      preloadTimerRef.current = setTimeout(async () => {
        const currentIndex = frames.findIndex(f => f.id === hoveredId);
        if (currentIndex === -1) return;

        // Preload ±15 frames around hovered frame
        const preloadRange = 15;
        const start = Math.max(0, currentIndex - preloadRange);
        const end = Math.min(frames.length, currentIndex + preloadRange + 1);

        const nearbyFrameIds = frames
          .slice(start, end)
          .map(f => f.id)
          .filter(id => !failedFrameIds.current.has(id)); // Skip frames that permanently failed

        if (nearbyFrameIds.length > 0) {
          // Non-blocking preload in background (no attempt tracking, let cache handle retries)
          thumbnailCache.current.preload(nearbyFrameIds).catch(() => {
            // Silently ignore preload errors
          });
        }
      }, 150); // 150ms debounce
    };

    loadHoveredAndPreload();

    return () => {
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredFrame?.id, frames.length]);

  // Get thumbnail URL for a frame from state
  const getThumbnailUrl = useCallback((frameId: string) => {
    return thumbnailUrls.get(frameId);
  }, [thumbnailUrls]);



  // Monitor thumbnail URL map growth and cache health
  useEffect(() => {
    // Cache health monitoring (non-invasive)
  }, [thumbnailUrls.size]);

  // Render frame thumbnail component
  const FrameThumbnail = useCallback(({ frame }: { frame: FrameData }) => {
    const url = getThumbnailUrl(frame.id);

    if (!url) {
      return null;
    }

    return (
      <div className="relative w-full h-full">
        <Image
          src={url}
          alt={`Frame ${frame.id}`}
          className="w-full h-full object-cover"
          fill
          loading="lazy"
        />
      </div>
    );
  }, [getThumbnailUrl]);

  // Convert Blob to Uint8Array
  const convertBlobToUint8Array = useCallback(async (frame: FrameMetadata): Promise<void> => {
    if (frameData[frame.name] || convertingRef.current[frame.name]) return;
    
    convertingRef.current[frame.name] = true;
    try {
      const blob = await frameStorage.getFrameBlob(frame.id);
      if (!blob) return;
      
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      setFrameData(prev => ({ ...prev, [frame.name]: uint8Array }));
    } finally {
      convertingRef.current[frame.name] = false;
    }
  }, [frameData]);

  // Navigation handlers
  const handleNext = useCallback((frame: FrameMetadata) => {
    const currentIndex = frames.findIndex(f => f.id === frame.id);
    if (currentIndex < frames.length - 1) {
      const nextFrame = frames[currentIndex + 1];
      setSelectedFrame(nextFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.length]);

  const handlePrevious = useCallback((frame: FrameMetadata) => {
    const currentIndex = frames.findIndex(f => f.id === frame.id);
    if (currentIndex > 0) {
      const prevFrame = frames[currentIndex - 1];
      setSelectedFrame(prevFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.length]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!hoveredFrame || !onFrameSelectAction) return;

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onFrameSelectAction(hoveredFrame.id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredFrame?.id, onFrameSelectAction]);

  // Canvas chart hover handler
  const handleCanvasHover = useCallback((frame: FrameData, position: { x: number; y: number }) => {
    setHoveredFrame(frame);
    setTooltipPosition(position);
  }, []);

  // Canvas chart leave handler
  const handleCanvasLeave = useCallback(() => {
    setHoveredFrame(null);
    setTooltipPosition(null);
  }, []);

  // Canvas chart click handler
  const handleCanvasClick = useCallback((frame: FrameData) => {
    setSelectedFrame(frame);
    setIsPreviewOpen(true);
    convertBlobToUint8Array(frame);
  }, [convertBlobToUint8Array]);

  // Get container width for canvas virtualization
  const [containerWidth, setContainerWidth] = useState(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  // Canvas scroll handler - update scroll position from internal canvas events
  const handleCanvasScroll = useCallback((scrollDelta: number) => {
    setScrollPosition((prev) => {
      // Calculate max scroll based on chart width vs container width
      const chartWidth = frames.length * 10; // BAR_WIDTH = 10
      const maxScroll = Math.max(0, chartWidth - containerWidth);
      const newScroll = Math.max(0, Math.min(prev + scrollDelta, maxScroll));
      return newScroll;
    });
  }, [frames.length, containerWidth]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        const width = canvasContainerRef.current.offsetWidth;
        setContainerWidth(width);
      }
    };

    // Use ResizeObserver for accurate sizing after DOM layout
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvasContainerRef.current) {
      resizeObserver.observe(canvasContainerRef.current);
      // Also call immediately in case ResizeObserver doesn't fire on first layout
      handleResize();
    }

    // Fallback: also listen to window resize
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Lock page scroll when hovering over minimap (same as main chart)
  useEffect(() => {
    const handleWheelCapture = (e: WheelEvent) => {
      if (minimapRef.current && minimapRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const wheelOptions = { passive: false, capture: true } as const;
    window.addEventListener('wheel', handleWheelCapture, wheelOptions);
    return () => {
      window.removeEventListener('wheel', handleWheelCapture, wheelOptions);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Frame Analysis</h3>
          <p className="text-sm text-[#111214]/35">
            {frames.length} frames analyzed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Batch selection - trigger single update for all frames
              frames.forEach(frame => {
                if (!selectedFrames.has(frame.id)) {
                  onFrameSelectAction(frame.id);
                }
              });
            }}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Batch deselection - trigger single update for all selected frames
              Array.from(selectedFrames).forEach(frameId => {
                onFrameSelectAction(frameId);
              });
            }}
          >
            Deselect All
          </Button>
        </div>
      </div>

      {/* Histogram - Canvas-based chart with internal scroll handling */}
      <div className="space-y-2">
        <div ref={canvasContainerRef} className="relative h-[300px] w-full">
          {frames.length > 0 ? (
            <CanvasFrameChart
              frames={frames}
              selectedFrames={selectedFrames}
              hoveredFrameId={hoveredFrame?.id || null}
              scrollOffset={scrollPosition}
              containerWidth={containerWidth}
              height={300}
              onHover={handleCanvasHover}
              onLeave={handleCanvasLeave}
              onClick={handleCanvasClick}
              onScroll={handleCanvasScroll}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No frames to display
            </div>
          )}
        </div>

        {/* Minimap Scrollbar - Click to jump to position, shows chart preview */}
        {frames.length > 0 && (
          <div className="w-full py-2" style={{ paddingLeft: '40px', paddingRight: '0px' }}>
            <div
              ref={minimapRef}
              className="relative w-full h-16 bg-gray-100 rounded cursor-pointer overflow-hidden"
              style={{ backgroundColor: '#f3f4f6' }}
              onClick={(e) => {
                const trackElement = e.currentTarget;
                const trackRect = trackElement.getBoundingClientRect();
                const clickX = e.clientX - trackRect.left;

                // Calculate what percentage along the timeline was clicked
                const clickPercentage = Math.max(0, Math.min(clickX / trackRect.width, 1));

                // Convert to scroll position
                const scrollRange = (frames.length * 10) - containerWidth;
                const targetScrollPosition = clickPercentage * scrollRange;

                // Calculate delta from current position
                const scrollDelta = targetScrollPosition - scrollPosition;
                handleCanvasScroll(scrollDelta);
              }}
              onWheel={(e) => {
                e.preventDefault();
                // Scroll amount: 30px per wheel tick
                const scrollDelta = e.deltaY > 0 ? 30 : -30;
                handleCanvasScroll(scrollDelta);
              }}
            >
              {/* Mini chart background - SVG graph with aggregated data */}
              <svg
                viewBox="0 0 100 100"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0.6,
                  display: 'block'
                }}
                preserveAspectRatio="none"
              >
                {(() => {
                  // Aggregate frames into buckets for readable visualization
                  // Use 500 data points max for smoother line
                  const MAX_DATA_POINTS = 500;
                  const bucketSize = Math.ceil(frames.length / MAX_DATA_POINTS);
                  const aggregatedData: number[] = [];

                  // Calculate max sharpness from actual frame data
                  // This adapts to different video content ranges dynamically
                  const sharpnessValues = frames.map(f => f.sharpnessScore || 0);
                  const maxSharpness = Math.max(...sharpnessValues, 1); // Ensure at least 1 to prevent division by zero

                  // Aggregate frames into buckets - use average of sharpness in each bucket
                  for (let i = 0; i < frames.length; i += bucketSize) {
                    const bucketEnd = Math.min(i + bucketSize, frames.length);
                    const bucketFrames = frames.slice(i, bucketEnd);
                    const avgSharpness = bucketFrames.reduce((sum, f) => sum + (f.sharpnessScore || 0), 0) / bucketFrames.length;
                    aggregatedData.push(avgSharpness);
                  }

                  // Generate SVG points for polyline
                  // Add 10% padding above and below data to prevent touching edges
                  const PADDING = 10;
                  const yRange = 100 - (PADDING * 2);
                  const points = aggregatedData
                    .map((sharpness, idx) => {
                      const x = (idx / (aggregatedData.length - 1 || 1)) * 100;
                      const normalizedY = (sharpness / maxSharpness) * yRange;
                      const y = PADDING + (yRange - normalizedY);
                      return `${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })()}
              </svg>

              {/* Viewport indicator - shows which part of chart is currently visible */}
              {(() => {
                // Calculate visible frame indices (same logic as canvas chart)
                const BAR_WIDTH = 10;

                // Calculate which frames are visible
                const startFrameIndex = containerWidth > 0 ? Math.max(0, Math.floor(scrollPosition / BAR_WIDTH)) : 0;
                const endFrameIndex = containerWidth > 0 ? Math.min(frames.length, startFrameIndex + Math.ceil(containerWidth / BAR_WIDTH) + 1) : 0;

                // Map frame indices to aggregated datapoint indices
                const MAX_DATA_POINTS = 500;
                const bucketSize = Math.ceil(frames.length / MAX_DATA_POINTS);

                // Calculate which aggregated datapoints correspond to visible frames
                const startAggregatedIndex = Math.floor(startFrameIndex / bucketSize);
                const endAggregatedIndex = Math.ceil(endFrameIndex / bucketSize);
                const totalAggregatedPoints = Math.ceil(frames.length / bucketSize);

                // Convert aggregated datapoint indices to percentages
                const leftPercent = (startAggregatedIndex / Math.max(totalAggregatedPoints, 1)) * 100;
                const widthPercent = ((endAggregatedIndex - startAggregatedIndex) / Math.max(totalAggregatedPoints, 1)) * 100;

                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(59, 130, 246, 0.3)',
                      borderLeft: '2px solid #3b82f6',
                      borderRight: '2px solid #3b82f6',
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      minWidth: '40px',
                      pointerEvents: 'none',
                      transition: 'none'
                    }}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <ChartTooltip
        frame={hoveredFrame}
        position={tooltipPosition}
        getThumbnailUrl={getThumbnailUrl}
      />

      {/* Section Title */}
      {showImageGrid && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Selected frames</h3>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {showImageGrid && (
        <div className="grid grid-cols-6 gap-4">
          {frames.filter(frame => selectedFrames.has(frame.id)).map((frame) => (
            <div 
              key={frame.id} 
              className="relative aspect-video rounded-md overflow-hidden border border-gray-200"
            >
              <FrameThumbnail frame={frame} />
            </div>
          ))}
        </div>
      )}

      <FramePreviewDialog
        open={isPreviewOpen}
        onOpenChangeAction={setIsPreviewOpen}
        frame={selectedFrame}
        frames={frames}
        isSelected={selectedFrame ? selectedFrames.has(selectedFrame.id) : undefined}
        onToggleSelection={selectedFrame ? () => onFrameSelectAction(selectedFrame.id) : undefined}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
