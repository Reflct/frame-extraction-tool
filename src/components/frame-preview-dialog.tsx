'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { frameStorage } from '@/lib/frameStorage';
import { type FrameData } from '@/types/frame';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface FramePreviewDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  frame: FrameData | null;
  frames: FrameData[];
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onNext?: (frame: FrameData) => void;
  onPrevious?: (frame: FrameData) => void;
}

export function FramePreviewDialog({
  open,
  onOpenChangeAction,
  frame,
  frames,
  isSelected = false,
  onToggleSelection,
  onNext,
  onPrevious,
}: FramePreviewDialogProps) {
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const preloadedUrls = useRef<Map<string, string>>(new Map());
  const loadingFrames = useRef<Set<string>>(new Set());

  // Load frame image and create object URL
  const loadFullImage = useCallback(async (frameToLoad: FrameData) => {
    if (!frameToLoad || loadingFrames.current.has(frameToLoad.id)) return;

    try {
      loadingFrames.current.add(frameToLoad.id);
      const blob = await frameStorage.getFrameBlob(frameToLoad.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        preloadedUrls.current.set(frameToLoad.id, url);
        return url;
      }
    } catch (error) {
      console.error('Error loading frame:', error);
    } finally {
      loadingFrames.current.delete(frameToLoad.id);
    }
    return null;
  }, []);

  // Get neighboring frames using index lookup
  const getNeighborFrames = useCallback((currentFrame: FrameData): FrameData[] => {
    const currentIndex = frames.findIndex(f => f.id === currentFrame.id);
    if (currentIndex === -1) return [];

    const neighbors: FrameData[] = [];
    
    if (onPrevious && currentIndex > 0) {
      neighbors.push(frames[currentIndex - 1]);
    }
    
    if (onNext && currentIndex < frames.length - 1) {
      neighbors.push(frames[currentIndex + 1]);
    }
    
    return neighbors;
  }, [frames, onNext, onPrevious]);

  // Preload neighboring frames
  const preloadNeighboringFrames = useCallback(async (currentFrame: FrameData) => {
    if (!currentFrame) return;

    const neighbors = getNeighborFrames(currentFrame);
    for (const neighbor of neighbors) {
      if (!preloadedUrls.current.has(neighbor.id)) {
        loadFullImage(neighbor).catch(console.error);
      }
    }
  }, [getNeighborFrames, loadFullImage]);

  // Cleanup URLs that are no longer needed
  const cleanupUnusedUrls = useCallback((currentFrame: FrameData | null) => {
    if (!currentFrame) {
      // If no current frame, cleanup all URLs
      for (const [id, url] of preloadedUrls.current) {
        URL.revokeObjectURL(url);
        preloadedUrls.current.delete(id);
      }
      return;
    }

    // Get the IDs we want to keep
    const neighbors = getNeighborFrames(currentFrame);
    const keepIds = new Set([currentFrame.id, ...neighbors.map(f => f.id)]);

    // Cleanup URLs that aren't in the keep set
    for (const [id, url] of preloadedUrls.current) {
      if (!keepIds.has(id)) {
        URL.revokeObjectURL(url);
        preloadedUrls.current.delete(id);
      }
    }
  }, [getNeighborFrames]);

  useEffect(() => {
    if (!frame || !open) return;

    const loadCurrentFrame = async () => {
      setIsLoading(true);
      try {
        // Check if we already have the URL preloaded
        const existingUrl = preloadedUrls.current.get(frame.id);
        if (existingUrl) {
          setFrameUrl(existingUrl);
          return;
        }

        // Load current frame
        const url = await loadFullImage(frame);
        if (url) setFrameUrl(url);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentFrame();
    
    // Preload neighbors after current frame is loaded
    if (frame) {
      preloadNeighboringFrames(frame).catch(console.error);
    }

    return () => {
      cleanupUnusedUrls(frame);
    };
  }, [frame, open, loadFullImage, preloadNeighboringFrames, cleanupUnusedUrls]);

  // Handle keyboard navigation and zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsZooming(true);
      } else if (onToggleSelection && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onToggleSelection();
      } else if (e.key === 'ArrowLeft' && onPrevious && frame) {
        e.preventDefault();
        onPrevious(frame);
      } else if (e.key === 'ArrowRight' && onNext && frame) {
        e.preventDefault();
        onNext(frame);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsZooming(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open, onToggleSelection, onNext, onPrevious, frame]);

  // Handle mouse movement for zoom
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
    });
  }, []);

  // Reset zoom state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsZooming(false);
      setMousePos({ x: 0, y: 0 });
      // Cleanup all URLs
      for (const url of preloadedUrls.current.values()) {
        URL.revokeObjectURL(url);
      }
      preloadedUrls.current.clear();
      setFrameUrl(null);
    }
  }, [open]);

  if (!frame) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="flex items-center justify-between pr-12">
          <div className="flex items-center gap-4">
            <span>Frame Preview</span>
            <div className="flex items-center gap-4">
              {frame && (
                <Button
                  variant={isSelected ? "default" : "destructive"}
                  size="sm"
                  onClick={onToggleSelection}
                  className={cn(
                    "text-sm",
                    isSelected ? "bg-blue-500 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600",
                    "text-white",
                    !onToggleSelection && "opacity-60 cursor-not-allowed hover:bg-blue-500"
                  )}
                  disabled={!onToggleSelection}
                >
                  {isSelected ? "Selected" : "Not Selected"}
                  {onToggleSelection && (
                    <span className="ml-2 text-xs text-white/80">
                      (Press A)
                    </span>
                  )}
                </Button>
              )}
              {frame?.sharpnessScore !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Sharpness: {frame.sharpnessScore.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPrevious?.(frame)}
              disabled={!onPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNext?.(frame)}
              disabled={!onNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogTitle>

        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${isZooming ? 2.5 : 1})`,
              transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
              transition: 'transform 0.15s ease-out',
              willChange: 'transform',
            }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : frameUrl && (
              <Image
                ref={imageRef}
                src={frameUrl}
                alt={frame?.name || ''}
                onMouseMove={handleMouseMove}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 90vw, 75vw"
                priority
                style={{
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                }}
              />
            )}
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            Hold Z to zoom • Press A to select
          </div>
        </div>

        <div className="mt-2 text-sm text-muted-foreground">
          <div>Name: {frame.name}</div>
          {frame.sharpnessScore !== undefined && (
            <div>Sharpness Score: {frame.sharpnessScore.toFixed(2)}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
