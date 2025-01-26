import { type FrameData } from '@/types/frame';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

interface ChartTooltipProps {
  frame: FrameData | null;
  position: { x: number; y: number } | null;
  getThumbnailUrl: (id: string) => string | undefined;
}

export function ChartTooltip({ frame, position, getThumbnailUrl }: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipRef.current || !position) return;

    // Direct style manipulation for smoother updates
    const tooltip = tooltipRef.current;
    const x = position.x;
    const y = position.y - 16;
    
    // Use transform3d for GPU acceleration
    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [position]);

  if (!frame || !position) return null;

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
        {getThumbnailUrl(frame.id) && (
          <Image
            src={getThumbnailUrl(frame.id)!}
            alt={frame.name}
            fill
            className="object-cover"
            sizes="192px"
            priority
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
} 