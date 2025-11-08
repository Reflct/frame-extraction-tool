import { type FrameData } from '@/types/frame';
import { useEffect, useRef, useState } from 'react';

interface ChartTooltipProps {
  frame: FrameData | null;
  position: { x: number; y: number } | null;
  getThumbnailUrl: (id: string) => string | undefined;
}

export function ChartTooltip({ frame, position, getThumbnailUrl }: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      if (!tooltipRef.current || !position) return;

      // Direct style manipulation for smoother updates
      const tooltip = tooltipRef.current;
      const x = position.x;
      const y = position.y - 16;

      console.log('[TOOLTIP_POSITION] Setting position:', { x, y, frameId: frame?.id });

      // Use transform3d for GPU acceleration
      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    } catch (error) {
      console.error('[TOOLTIP_POSITION] Error setting position:', error);
    }
  }, [position, frame?.id]);

  // Track loading state for thumbnail
  useEffect(() => {
    try {
      console.log('[TOOLTIP_THUMB] Effect fired - Frame:', frame?.id, 'getThumbnailUrl function changed');

      if (frame && !getThumbnailUrl(frame.id)) {
        console.log('[TOOLTIP_THUMB] Thumbnail not cached, setting loading state for:', frame.id);
        setIsLoading(true);
        // Set a timeout to show loading state if thumbnail takes too long
        const timer = setTimeout(() => {
          console.log('[TOOLTIP_THUMB] Timeout loading thumbnail for:', frame.id);
          setIsLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        console.log('[TOOLTIP_THUMB] Thumbnail found or no frame');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[TOOLTIP_THUMB] Error in thumbnail loading effect:', error);
      setIsLoading(false);
    }
  }, [frame, getThumbnailUrl]);

  if (!frame || !position) {
    console.log('[TOOLTIP_RENDER] Not rendering - frame or position missing');
    return null;
  }

  try {
    const thumbnailUrl = getThumbnailUrl(frame.id);
    console.log('[TOOLTIP_RENDER] Rendering tooltip for frame:', frame.id, 'has URL:', !!thumbnailUrl);

    return (
      <div
        ref={tooltipRef}
        className="fixed top-0 left-0 bg-white p-3 border rounded-lg shadow-lg pointer-events-none z-[9999]"
        style={{
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden'
        }}
      >
        <div className="relative w-48 aspect-video mb-2 rounded-md overflow-hidden bg-gray-100">
          {isLoading && !thumbnailUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={frame.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{frame.name}</p>
          <p className="text-sm text-muted-foreground">
            Sharpness: {frame.sharpnessScore?.toFixed(1)}
          </p>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[TOOLTIP_RENDER] Error rendering tooltip:', error);
    return null;
  }
}
