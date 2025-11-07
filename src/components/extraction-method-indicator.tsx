'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Zap, Monitor } from 'lucide-react';
import { getBrowserSupport } from '@/lib/browserSupport';
// import { detectVideoCodec, type CodecInfo } from '@/lib/codecDetection';

interface ExtractionMethodIndicatorProps {
  currentMethod?: 'MediaBunny' | 'Canvas' | null;
  fallbackReason?: string | null;
  performanceMetrics?: {
    duration: number;
    framesPerSecond: number;
  } | null;
  processing?: boolean;
  videoFile?: File | null;
}

export function ExtractionMethodIndicator({ 
  currentMethod,
  fallbackReason,
  performanceMetrics,
  processing
  // videoFile - reserved for future codec detection
}: ExtractionMethodIndicatorProps) {
  const browserSupport = getBrowserSupport();

  if (processing && !currentMethod) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Detecting optimal extraction method...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentMethod) {
    const isMediaBunny = currentMethod === 'MediaBunny';
    const cardClass = isMediaBunny 
      ? "border-green-200 bg-green-50" 
      : "border-orange-200 bg-orange-50";
    
    return (
      <Card className={cardClass}>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMediaBunny ? (
                <Zap className="h-4 w-4 text-green-600" />
              ) : (
                <Monitor className="h-4 w-4 text-orange-600" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Using {currentMethod} extraction
                </span>
                {performanceMetrics && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {performanceMetrics.framesPerSecond.toFixed(1)} fps • 
                    {(performanceMetrics.duration / 1000).toFixed(1)}s total
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {!isMediaBunny && browserSupport.mediaBunny && fallbackReason && (
            <div className="mt-2 mb-1 text-xs text-muted-foreground">
              {fallbackReason} by WebCodecs
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={browserSupport.mediaBunny ? "border-blue-200 bg-blue-50" : "border-gray-200"}>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          {browserSupport.mediaBunny ? (
            <>
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                MediaBunny Available
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Canvas Mode
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}