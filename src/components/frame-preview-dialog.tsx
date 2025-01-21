'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type FrameMetadata } from '@/types/frame';
import { cn } from '@/lib/utils';

interface FramePreviewDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  frame: FrameMetadata | null;
  isSelected?: boolean;
  frames: FrameMetadata[];
  onFrameChangeAction: (frame: FrameMetadata) => void;
}

export function FramePreviewDialog({
  open,
  onOpenChangeAction,
  frame,
  isSelected = false,
  frames,
  onFrameChangeAction
}: FramePreviewDialogProps) {
  const [frameUrls, setFrameUrls] = useState<Record<string, string>>({});
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const urlsRef = useRef<Record<string, string>>(frameUrls);

  // Find current frame index and adjacent frames
  const currentIndex = frame ? frames.findIndex(f => f.id === frame.id) : -1;
  const prevFrame = currentIndex > 0 ? frames[currentIndex - 1] : null;
  const nextFrame = currentIndex < frames.length - 1 ? frames[currentIndex + 1] : null;

  // Create object URL from frame data
  useEffect(() => {
    if (!frame?.data) return;

    const framesToLoad = [frame, prevFrame, nextFrame].filter((f): f is FrameMetadata => f !== null && !!f.data);
    const newUrls: Record<string, string> = {};
    let hasNewUrls = false;

    framesToLoad.forEach(f => {
      if (!urlsRef.current[f.id]) {
        const blob = new Blob([f.data!], { type: `image/${f.format}` });
        newUrls[f.id] = URL.createObjectURL(blob);
        hasNewUrls = true;
      }
    });

    if (hasNewUrls) {
      const updatedUrls = { ...urlsRef.current, ...newUrls };
      urlsRef.current = updatedUrls;
      setFrameUrls(updatedUrls);
    }

    return () => {
      const currentFrameIds = new Set(framesToLoad.map(f => f.id));
      Object.entries(urlsRef.current).forEach(([id, url]) => {
        if (!currentFrameIds.has(id)) {
          URL.revokeObjectURL(url);
          delete urlsRef.current[id];
        }
      });
      setFrameUrls(urlsRef.current);
    };
  }, [frame?.id, frame?.data, prevFrame?.id, prevFrame?.data, nextFrame?.id, nextFrame?.data, frame, prevFrame, nextFrame]);

  // Handle zoom key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z') {
        setIsZooming(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z') {
        setIsZooming(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle mouse movement for zoom
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current || !isZooming) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  }, [isZooming]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onFrameChangeAction(frames[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < frames.length - 1) {
        onFrameChangeAction(frames[currentIndex + 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, frames, currentIndex, onFrameChangeAction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-7xl w-[95vw]">
        <DialogTitle className="flex items-center justify-between">
          <span className="text-lg">Frame {frame?.name}</span>
          <div className="flex items-center gap-4">
            {frame?.sharpnessScore !== undefined && (
              <span className="text-base font-medium">
                Sharpness: {frame.sharpnessScore.toFixed(2)}
              </span>
            )}
            <span 
              className={cn(
                "px-3 py-1.5 rounded-md text-base font-medium",
                isSelected 
                  ? "bg-blue-500/20 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" 
                  : "bg-red-500/20 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              )}
            >
              {isSelected ? "Selected" : "Not Selected"}
            </span>
          </div>
        </DialogTitle>

        <div className="relative flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => currentIndex > 0 && onFrameChangeAction(frames[currentIndex - 1])}
            disabled={currentIndex <= 0}
            className="absolute left-2 z-10 bg-background/80 hover:bg-background/90"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            className="relative overflow-hidden rounded-lg w-full"
            style={{ maxHeight: '80vh' }}
          >
            {frame && frameUrls[frame.id] && (
              <img
                ref={imageRef}
                src={frameUrls[frame.id]}
                alt={frame.name}
                className={`max-h-full w-full object-contain ${
                  isZooming ? 'cursor-zoom-in' : ''
                }`}
                style={{
                  transform: isZooming ? `scale(2.5)` : 'none',
                  transformOrigin: isZooming ? `${mousePos.x}% ${mousePos.y}%` : 'center',
                  transition: isZooming ? 'none' : 'transform 0.2s ease-out'
                }}
                onMouseMove={handleMouseMove}
              />
            )}
            <div className="absolute bottom-4 right-4 bg-background/80 text-foreground px-3 py-1.5 rounded-md text-sm">
              Hold Z to zoom
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => currentIndex < frames.length - 1 && onFrameChangeAction(frames[currentIndex + 1])}
            disabled={currentIndex >= frames.length - 1}
            className="absolute right-2 z-10 bg-background/80 hover:bg-background/90"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
