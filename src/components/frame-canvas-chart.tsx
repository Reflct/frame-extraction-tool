import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { FrameData } from '@/types/frame';

interface CanvasFrameChartProps {
  frames: FrameData[];
  selectedFrames: Set<string>;
  hoveredFrameId: string | null;
  scrollOffset: number;
  containerWidth: number;
  height?: number;
  onHover: (frame: FrameData, position: { x: number; y: number }) => void;
  onLeave: () => void;
  onClick: (frame: FrameData) => void;
  onScroll: (scrollDelta: number) => void;
}

const CanvasFrameChart: React.FC<CanvasFrameChartProps> = ({
  frames,
  selectedFrames,
  hoveredFrameId,
  scrollOffset,
  containerWidth,
  height = 300,
  onHover,
  onLeave,
  onClick,
  onScroll
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameMapRef = useRef<Map<string, FrameData>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  // Constants
  const BAR_WIDTH = 10; // 8px bar + 2px gap
  const MARGIN_LEFT = 40;
  const MARGIN_BOTTOM = 30;
  const MARGIN_TOP = 10;
  const GRID_COLOR = '#E5E7EB';
  const AXIS_COLOR = '#9CA3AF';
  const UNSELECTED_COLOR = '#E5E7EB';
  const SELECTED_COLOR = '#0066FF';
  const HOVER_COLOR = '#0066FF';

  // Build frameMap for O(1) lookups
  useEffect(() => {
    frameMapRef.current.clear();
    frames.forEach(frame => frameMapRef.current.set(frame.id, frame));
  }, [frames]);

  // Calculate visible range based on scroll offset and container width
  // Only render bars that are visible in the current viewport
  const visibleRange = useMemo(() => {
    // Guard against containerWidth being 0 (occurs during initial mount)
    if (containerWidth === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    const startIndex = Math.max(0, Math.floor(scrollOffset / BAR_WIDTH));
    const endIndex = Math.min(frames.length, startIndex + Math.ceil(containerWidth / BAR_WIDTH) + 1);

    return { startIndex, endIndex };
  }, [scrollOffset, containerWidth, frames.length]);

  // Calculate max sharpness score for Y-axis scaling
  // NOTE: Only depends on frames.length to avoid expensive recalculations when frame data changes
  // The loop reads current frame values, but we only recalculate when count changes
  const maxSharpnessScore = useMemo(() => {
    let max = 100;
    for (const frame of frames) {
      if (frame.sharpnessScore && frame.sharpnessScore > max) {
        max = frame.sharpnessScore;
      }
    }
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.length]);

  // Pointer-to-frame conversion
  const getFrameAtPointer = useCallback((clientX: number): { frame: FrameData; barIndex: number } | null => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    // Convert viewport-relative click position to chart coordinates
    // Account for scroll offset: add back the scrolled amount to get absolute position
    const canvasX = clientX - rect.left - MARGIN_LEFT + scrollOffset;

    if (canvasX < 0) return null;

    // Calculate which bar was clicked based on absolute position in chart
    const barIndex = Math.floor(canvasX / BAR_WIDTH);

    if (barIndex >= frames.length || barIndex < 0) return null;

    const frame = frameMapRef.current.get(frames[barIndex].id);
    return frame ? { frame, barIndex } : null;
  }, [scrollOffset, frames]);

  // Calculate tooltip position
  const getTooltipPosition = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    // Tooltip positions are already in viewport coordinates
    // Return them directly (no conversion needed)
    return {
      x: clientX,
      y: clientY
    };
  }, []);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = getFrameAtPointer(e.clientX);
    if (!result) {
      onLeave();
      return;
    }

    const tooltipPos = getTooltipPosition(e.clientX, e.clientY);
    if (tooltipPos) {
      onHover(result.frame, tooltipPos);
    }
  }, [getFrameAtPointer, getTooltipPosition, onHover, onLeave]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    onLeave();
  }, [onLeave]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = getFrameAtPointer(e.clientX);
    if (result) {
      onClick(result.frame);
    }
  }, [getFrameAtPointer, onClick]);

  // Handle mouse wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Scroll amount: 30px per wheel tick
    const scrollDelta = e.deltaY > 0 ? 30 : -30;
    onScroll(scrollDelta);
  }, [onScroll]);

  // Handle arrow key scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasRef.current || canvasRef.current !== document.activeElement) return;

      const scrollAmount = 20;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onScroll(scrollAmount);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onScroll(-scrollAmount);
      }
    };

    // Add wheel listener with passive: false to allow preventDefault
    const handleWheelCapture = (e: WheelEvent) => {
      if (canvasRef.current && canvasRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheelCapture, { passive: false, capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheelCapture, { capture: true } as const);
    };
  }, [onScroll]);

  // Render function
  const renderChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up high-DPI canvas
    // Canvas is viewport-sized (containerWidth), not full chart width
    // Virtualization ensures we only render visible bars
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = containerWidth * dpr;
    const targetHeight = height * dpr;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.scale(dpr, dpr);

    const canvasWidth = containerWidth;
    const canvasHeight = height;
    const chartHeight = canvasHeight - MARGIN_BOTTOM - MARGIN_TOP;

    console.log('[Canvas Render] Canvas sizing:', {
      containerWidth,
      canvasWidth,
      height,
      canvasHeight,
      scrollOffset,
      visibleRange: visibleRange.endIndex - visibleRange.startIndex,
      totalFrames: frames.length
    });

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = MARGIN_TOP + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = AXIS_COLOR;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const value = (maxSharpnessScore / gridLines) * (gridLines - i);
      const y = MARGIN_TOP + (chartHeight / gridLines) * i;
      ctx.fillText(value.toFixed(1), MARGIN_LEFT - 5, y + 4);
    }

    // Draw Y-axis
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, MARGIN_TOP);
    ctx.lineTo(MARGIN_LEFT, MARGIN_TOP + chartHeight);
    ctx.stroke();

    // Draw only visible bars (virtualization)
    // Bars are positioned relative to viewport, not absolute chart position
    const { startIndex, endIndex } = visibleRange;
    let barsDrawn = 0;
    const startTime = performance.now();

    for (let i = startIndex; i < endIndex; i++) {
      const frame = frames[i];
      if (!frame) continue;

      const sharpness = frame.sharpnessScore || 0;
      const barHeight = (sharpness / maxSharpnessScore) * chartHeight;

      // Position bars relative to viewport
      // visibleIndex is 0 for the first visible bar, increments from there
      const visibleIndex = i - startIndex;
      const barX = MARGIN_LEFT + (visibleIndex * BAR_WIDTH);
      const barY = MARGIN_TOP + chartHeight - barHeight;

      // All bars in this loop should be visible, but check just in case
      if (barX + 8 < 0 || barX > canvasWidth) {
        continue;
      }

      barsDrawn++;

      // Determine color
      let color = UNSELECTED_COLOR;
      if (selectedFrames.has(frame.id)) {
        color = SELECTED_COLOR;
      } else if (frame.id === hoveredFrameId) {
        color = HOVER_COLOR;
      }

      // Draw bar
      ctx.fillStyle = color;
      ctx.globalAlpha = frame.id === hoveredFrameId ? 1 : 0.8;
      ctx.fillRect(barX, barY, 8, barHeight);
      ctx.globalAlpha = 1;
    }

    // Draw X-axis
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, MARGIN_TOP + chartHeight);
    ctx.lineTo(canvasWidth, MARGIN_TOP + chartHeight);
    ctx.stroke();

    const renderTime = performance.now() - startTime;
    console.log('[CanvasFrameChart] renderChart completed:', {
      barsDrawn,
      visibleRangeStart: visibleRange.startIndex,
      visibleRangeEnd: visibleRange.endIndex,
      totalFrames: frames.length,
      scrollOffset,
      containerWidth,
      renderTimeMs: renderTime.toFixed(2)
    });

    // Schedule next render if needed
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [frames, selectedFrames, hoveredFrameId, scrollOffset, containerWidth, maxSharpnessScore, height, visibleRange]);

  // Trigger render on prop changes
  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // Set canvas height
  const chartHeight = height || 300;

  // Guard against rendering with containerWidth of 0
  if (containerWidth === 0) {
    return <canvas ref={canvasRef} style={{ width: '100%', height: `${chartHeight}px`, display: 'block' }} />;
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onWheel={handleWheel}
      tabIndex={0}
      style={{
        width: `${containerWidth}px`,
        height: `${chartHeight}px`,
        cursor: 'pointer',
        display: 'block',
        outline: 'none'
      }}
    />
  );
};

export default CanvasFrameChart;
