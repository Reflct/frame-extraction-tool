'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, YAxis, XAxis, Tooltip, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { type FrameData, type FrameMetadata } from '@/types/frame';
import { FramePreviewDialog } from './frame-preview-dialog';
import { frameStorage } from '@/lib/frameStorage';
import { ChartTooltip } from './chart-tooltip';
import { ThumbnailCache } from '@/lib/thumbnailCache';

interface FrameAnalysisProps {
  frames: FrameData[];
  selectedFrames: Set<string>;
  onFrameSelectAction: (frameId: string) => void;
  showImageGrid?: boolean;
}

interface ChartMouseMoveState {
  activePayload?: Array<{
    payload: {
      frameId: string;
    }
  }>;
  chartX?: number;
  chartY?: number;
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
  const attemptedFrameIds = useRef<Set<string>>(new Set()); // Track frames we've already tried to load (prevents re-attempts)
  const chartRef = useRef<HTMLDivElement>(null);
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Component lifecycle - cleanup cache on unmount
  useEffect(() => {
    console.log('[FRAME_ANALYSIS] Component mounted');
    const cache = thumbnailCache.current;
    const attempted = attemptedFrameIds.current;
    const scrollTimer = scrollTimerRef.current;

    return () => {
      const stats = cache.getStats();
      console.log('[FRAME_ANALYSIS] Component unmounting, cache stats:', stats);
      cache.clear();
      attempted.clear();
      setThumbnailUrls(new Map());

      // Clean up scroll timer
      if (scrollTimer) {
        clearTimeout(scrollTimer);
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

      // Skip if already attempted
      if (attemptedFrameIds.current.has(hoveredId)) {
        console.log('[FRAME_ANALYSIS] Hovered frame already attempted:', hoveredId);
        return;
      }

      attemptedFrameIds.current.add(hoveredId);
      const hoveredUrl = await thumbnailCache.current.get(hoveredId);
      if (hoveredUrl) {
        setThumbnailUrls(prev => new Map(prev.set(hoveredId, hoveredUrl)));
        console.log('[FRAME_ANALYSIS] Loaded hovered frame:', hoveredId);
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
          .filter(id => !attemptedFrameIds.current.has(id)); // Only preload frames we haven't tried yet

        if (nearbyFrameIds.length > 0) {
          console.log('[FRAME_ANALYSIS] Preloading', nearbyFrameIds.length, 'nearby frames');
          // Mark all as attempted before loading
          nearbyFrameIds.forEach(id => attemptedFrameIds.current.add(id));

          // Non-blocking preload in background
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

  // Memoize frames lookup Map for O(1) access in event handlers
  const frameMap = useMemo(() => {
    const map = new Map<string, FrameData>();
    frames.forEach(frame => map.set(frame.id, frame));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.length]); // Only recreate when frame count changes, not on every reference change

  // Memoize chart data array to prevent recreation on every render
  const chartData = useMemo(() => {
    return frames.map((frame, index) => ({
      x: index,
      y: frame.sharpnessScore || 0,
      frameId: frame.id,
      frameIndex: index // Used by XAxis for proper coordinate mapping when virtualized
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.length]); // Only recreate when frame count changes, not on every reference change

  // Calculate visible frames based on scroll position (viewport virtualization)
  const visibleChartData = useMemo(() => {
    const BAR_WIDTH = 10; // pixels per bar (8px bar + 2px gap)
    const VISIBLE_RANGE = 250; // number of bars to render around viewport center

    // Calculate which frames are in the visible viewport
    const centerFrameIndex = Math.floor(scrollPosition / BAR_WIDTH);

    // Render frames in range: center ± VISIBLE_RANGE
    const startIndex = Math.max(0, centerFrameIndex - VISIBLE_RANGE);
    const endIndex = Math.min(frames.length, centerFrameIndex + VISIBLE_RANGE);

    console.log('[CHART_DATA] Calculating visible range - scrollPosition:', scrollPosition, 'centerFrameIndex:', centerFrameIndex, 'startIndex:', startIndex, 'endIndex:', endIndex);

    try {
      // Return visible frames with their actual frame index for XAxis positioning
      // This ensures Recharts knows the semantic position of each bar, not just array index
      const sliced = chartData.slice(startIndex, endIndex);
      const result = sliced.map((item, visibleIndex) => ({
        ...item,
        frameIndex: startIndex + visibleIndex // Actual frame position in dataset
      }));

      console.log('[CHART_DATA] Calculated visibleChartData:', {
        scrollPosition,
        centerFrameIndex,
        startIndex,
        endIndex,
        slicedLength: sliced.length,
        resultLength: result.length,
        firstFrameIndex: result[0]?.frameIndex,
        lastFrameIndex: result[result.length - 1]?.frameIndex,
        totalFrames: frames.length
      });

      return result;
    } catch (error) {
      console.error('[CHART_DATA] ERROR calculating visibleChartData:', error);
      console.error('[CHART_DATA] Error details:', {
        scrollPosition,
        centerFrameIndex,
        startIndex,
        endIndex,
        chartDataLength: chartData.length,
        framesLength: frames.length
      });
      throw error;
    }
  }, [chartData, scrollPosition, frames.length]);

  // Calculate dynamic chart width based on visible bar count
  // This ensures bars are always 8px (not stretched/squished by Recharts)
  const dynamicChartWidth = useMemo(() => {
    const BAR_WIDTH = 10; // 8px bar + 2px gap
    // Width should accommodate visible data count, not all frames
    const width = Math.max(visibleChartData.length * BAR_WIDTH, 100);
    console.log('[CHART_WIDTH] Calculated dynamic chart width:', width, 'for', visibleChartData.length, 'visible bars');
    return width;
  }, [visibleChartData.length]);

  // Monitor thumbnail URL map growth and cache health
  useEffect(() => {
    if (thumbnailUrls.size > 0 || attemptedFrameIds.current.size > 0) {
      const cacheStats = thumbnailCache.current.getStats();
      console.log('[FRAME_ANALYSIS] Thumbnail stats:', {
        mapSize: thumbnailUrls.size,
        attemptedCount: attemptedFrameIds.current.size,
        cacheSize: cacheStats.size,
        cacheLoading: cacheStats.loading,
        cacheUtilization: cacheStats.utilizationPercent + '%'
      });
    }
  }, [thumbnailUrls.size]);

  // Render frame thumbnail component
  const FrameThumbnail = useCallback(({ frame }: { frame: FrameData }) => {
    const url = getThumbnailUrl(frame.id);
    
    if (!url) {
      return null;
    }

    return (
      <div className="relative w-full h-full">
        <img
          src={url}
          alt={`Frame ${frame.id}`}
          className="w-full h-full object-cover"
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

  // Optimized mouse move handler
  const handleChartMouseMove = useCallback((state: ChartMouseMoveState) => {
    try {
      if (state?.activePayload?.[0]?.payload && chartRef.current) {
        const { frameId } = state.activePayload[0].payload;
        console.log('[CHART_HOVER] Hovering over frame:', frameId);

        if (!frameId) {
          console.warn('[CHART_HOVER] Invalid frameId:', frameId);
          return;
        }

        // Look up the full frame object using O(1) Map instead of O(N) find()
        const frame = frameMap.get(frameId);
        if (!frame) {
          console.warn('[CHART_HOVER] Could not find frame with ID:', frameId);
          return;
        }

        setHoveredFrame(frame);

        // Get the scrollable container's position
        const containerRect = chartRef.current.getBoundingClientRect();
        const scrollLeft = chartRef.current.scrollLeft;

        // Adjust the chart coordinates relative to the viewport
        if (typeof state.chartX === 'number' && typeof state.chartY === 'number') {
          setTooltipPosition({
            x: containerRect.left + state.chartX - scrollLeft,
            y: containerRect.top + state.chartY
          });
        }
      }
    } catch (error) {
      console.error('[CHART_HOVER] Error in handleChartMouseMove:', error);
      console.error('[CHART_HOVER] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        state
      });
    }
  }, [frameMap]);

  // Handle mouse leave
  const handleChartMouseLeave = useCallback(() => {
    setHoveredFrame(null);
    setTooltipPosition(null);
  }, []);

  // Handle horizontal scroll for viewport virtualization
  // Debounce scroll events to avoid excessive state updates and re-renders
  const handleChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = (e.target as HTMLDivElement).scrollLeft;

    // Clear pending scroll update
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }

    // Debounce: only update state after scrolling stops
    scrollTimerRef.current = setTimeout(() => {
      setScrollPosition(scrollLeft);
      console.log('[CHART_VIEWPORT] Scroll position updated:', scrollLeft);
    }, 50); // 50ms debounce - responsive but not excessive
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

      {/* Histogram */}
      <div className="relative h-[300px] w-full overflow-hidden">
        <div
          ref={chartRef}
          className="h-full overflow-x-auto"
          style={{ width: '100%' }}
          onScroll={handleChartScroll}
        >
          <div style={{
            width: `${Math.max(frames.length * 10, 100)}px`,
            height: '100%'
          }}>
            {visibleChartData.length > 0 ? (
              <BarChart
                data={visibleChartData}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
                margin={{ left: 40, right: 0 }}
                width={dynamicChartWidth}
                height={300}
                barCategoryGap="0%"
              >
                  <YAxis
                    tickFormatter={(value) => value.toFixed(1)}
                    width={40}
                    stroke="#9CA3AF"
                  />
                  <XAxis
                    hide={true}
                    axisLine={{ stroke: '#E5E7EB' }}
                    dataKey="x"
                    type="number"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 102, 255, 0.1)' }}
                    content={() => null}
                  />
                  <Bar
                    dataKey="y"
                    barSize={8}
                    onClick={(data) => {
                      try {
                        const frameId = (data as unknown as { frameId: string }).frameId;
                        console.log('[BAR_CLICK] Clicked bar with frameId:', frameId);
                        const frame = frameMap.get(frameId);
                        if (frame) {
                          setSelectedFrame(frame);
                          setIsPreviewOpen(true);
                          convertBlobToUint8Array(frame);
                        } else {
                          console.warn('[BAR_CLICK] Frame not found in map:', frameId);
                        }
                      } catch (error) {
                        console.error('[BAR_CLICK] Error handling bar click:', error);
                      }
                    }}
                    cursor="pointer"
                  >
                    {visibleChartData.map((item) => {
                      try {
                        const frame = frameMap.get(item.frameId);
                        return (
                          <Cell
                            key={item.frameId}
                            fill={frame && selectedFrames.has(frame.id) ? '#0066FF' : '#E5E7EB'}
                            className="cursor-pointer hover:opacity-80"
                          />
                        );
                      } catch (error) {
                        console.error('[CELL_RENDER] Error rendering cell for frameId:', item.frameId, error);
                        return (
                          <Cell
                            key={item.frameId}
                            fill="#E5E7EB"
                            className="cursor-pointer hover:opacity-80"
                          />
                        );
                      }
                    })}
                  </Bar>
              </BarChart>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No frames to display
              </div>
            )}
          </div>
        </div>
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
