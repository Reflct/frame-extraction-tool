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
  onNext?: (frame: FrameMetadata) => void;
  onPrevious?: (frame: FrameMetadata) => void;
  onToggleSelection?: () => void;
}

export function FramePreviewDialog({
  open,
  onOpenChangeAction: onOpenChange,
  frame,
  isSelected = false,
  onNext,
  onPrevious,
  onToggleSelection
}: FramePreviewDialogProps) {
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const [localSelected, setLocalSelected] = useState(isSelected);

  // Update local selection state when prop changes
  useEffect(() => {
    setLocalSelected(isSelected);
  }, [isSelected]);

  // Handle keyboard navigation and zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsZooming(true);
      } else if (onToggleSelection && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd')) {
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

  // Handle mouse movement for zoom with debounce
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
    }
  }, [open]);

  const handleToggleSelection = useCallback(() => {
    if (onToggleSelection) {
      onToggleSelection();
      setLocalSelected(!localSelected);
    }
  }, [onToggleSelection, localSelected]);

  if (!frame) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="flex items-center justify-between pr-12">
          <div className="flex items-center gap-4">
            <span>Frame Preview</span>
            <div className="flex items-center gap-4">
              {frame && (
                <Button
                  variant={localSelected ? "default" : "destructive"}
                  size="sm"
                  onClick={handleToggleSelection}
                  className={cn(
                    "text-sm",
                    localSelected ? "bg-blue-500 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600",
                    "text-white",
                    !onToggleSelection && "opacity-60 cursor-not-allowed hover:bg-blue-500"
                  )}
                  disabled={!onToggleSelection}
                >
                  {localSelected ? "Selected" : "Not Selected"}
                  {onToggleSelection && (
                    <span className="ml-2 text-xs text-white/80">
                      (Press A/D)
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

        <div 
          className="relative mt-4 overflow-hidden rounded-lg border"
          style={{ 
            aspectRatio: '16/9',
          }}
        >
          <div 
            className={cn(
              "relative w-full h-full will-change-transform",
              isZooming && "scale-[2.5]"
            )}
            style={{
              transform: `scale(${isZooming ? 2.5 : 1})`,
              transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
              transition: 'transform 0.15s ease-out',
              willChange: 'transform',
            }}
          >
            <img
              ref={imageRef}
              src={frame.data ? URL.createObjectURL(new Blob([frame.data], { type: `image/${frame.format}` })) : ''}
              alt={frame.name}
              onMouseMove={handleMouseMove}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            />
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            Hold Z to zoom
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
