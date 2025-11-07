'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Zap, Clock, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PerformanceMetrics {
  method: string;
  totalFrames: number;
  extractionTime: number;
  framesPerSecond: number;
  averageFrameTime: number;
  memoryUsed?: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  error?: string;
}

export default function PerformanceTestPage() {
  const [mounted, setMounted] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fps, setFps] = useState(10);
  const [frameCount, setFrameCount] = useState(30);
  const [canvasMetrics, setCanvasMetrics] = useState<PerformanceMetrics>({
    method: 'Canvas (Current)',
    totalFrames: 0,
    extractionTime: 0,
    framesPerSecond: 0,
    averageFrameTime: 0,
    status: 'idle'
  });
  const [mediaBunnyMetrics, setMediaBunnyMetrics] = useState<PerformanceMetrics>({
    method: 'MediaBunny',
    totalFrames: 0,
    extractionTime: 0,
    framesPerSecond: 0,
    averageFrameTime: 0,
    status: 'idle'
  });
  const [extractedFrames, setExtractedFrames] = useState<{
    canvas: string[];
    mediaBunny: string[];
  }>({ canvas: [], mediaBunny: [] });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setExtractedFrames({ canvas: [], mediaBunny: [] });
      setCanvasMetrics(prev => ({ ...prev, status: 'idle', error: undefined }));
      setMediaBunnyMetrics(prev => ({ ...prev, status: 'idle', error: undefined }));
    }
  }, []);

  const extractWithCanvas = useCallback(async () => {
    if (!videoFile) return;

    setCanvasMetrics(prev => ({ ...prev, status: 'running', error: undefined }));
    const startTime = performance.now();
    const frames: string[] = [];

    try {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const videoUrl = URL.createObjectURL(videoFile);
      const frameInterval = 1 / fps;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
        video.src = videoUrl;
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const duration = video.duration;
      const maxFrames = Math.min(frameCount, Math.floor(duration * fps));

      for (let i = 0; i < maxFrames; i++) {
        const time = i * frameInterval;
        video.currentTime = time;
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        ctx.drawImage(video, 0, 0);
        
        // Convert to data URL for preview (only first 5 frames)
        if (i < 5) {
          frames.push(canvas.toDataURL('image/jpeg', 0.5));
        }
      }

      URL.revokeObjectURL(videoUrl);

      const endTime = performance.now();
      const extractionTime = endTime - startTime;

      setCanvasMetrics({
        method: 'Canvas (Current)',
        totalFrames: maxFrames,
        extractionTime,
        framesPerSecond: (maxFrames / extractionTime) * 1000,
        averageFrameTime: extractionTime / maxFrames,
        status: 'completed'
      });

      setExtractedFrames(prev => ({ ...prev, canvas: frames }));
    } catch (error) {
      setCanvasMetrics(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [videoFile, frameCount, fps]);

  const extractWithMediaBunny = useCallback(async () => {
    if (!videoFile) return;

    setMediaBunnyMetrics(prev => ({ ...prev, status: 'running', error: undefined }));
    const startTime = performance.now();
    const frames: string[] = [];

    try {
      // Check WebCodecs support first
      if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
        throw new Error('WebCodecs API not supported in this browser');
      }

      // Dynamic import to handle potential browser incompatibility
      const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('mediabunny');

      const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(videoFile)
      });

      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) {
        throw new Error('No video track found');
      }

      // Use CanvasSink for easier frame extraction - no size constraints for full resolution
      const sink = new CanvasSink(videoTrack);

      const startTimestamp = await videoTrack.getFirstTimestamp();
      const duration = await videoTrack.computeDuration();

      // Calculate timestamp points for frame extraction
      const timeStep = duration / frameCount;
      const timestamps = [];
      for (let i = 0; i < frameCount; i++) {
        timestamps.push(startTimestamp + (i * timeStep));
      }

      let frameIndex = 0;
      try {
        for await (const result of sink.canvasesAtTimestamps(timestamps)) {
          if (result && result.canvas) {
            // Convert canvas to data URL for preview (only first 5 frames)
            if (frameIndex < 5 && result.canvas instanceof HTMLCanvasElement) {
              frames.push(result.canvas.toDataURL('image/jpeg', 0.5));
            }
            
            frameIndex++;
          }
        }
      } catch {
        // Stream extraction error - error handling done in outer catch
      }

      const endTime = performance.now();
      const extractionTime = endTime - startTime;

      setMediaBunnyMetrics({
        method: 'MediaBunny',
        totalFrames: frameIndex,
        extractionTime,
        framesPerSecond: (frameIndex / extractionTime) * 1000,
        averageFrameTime: extractionTime / frameIndex,
        status: 'completed'
      });

      setExtractedFrames(prev => ({ ...prev, mediaBunny: frames }));
    } catch (error) {
      setMediaBunnyMetrics(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      // Cleanup any remaining resources
      try {
        // Force garbage collection if available
        if ('gc' in window && typeof window.gc === 'function') {
          window.gc();
        }
      } catch {
        // Ignore GC errors
      }
    }
  }, [videoFile, frameCount]);

  const runBothTests = useCallback(async () => {
    await Promise.all([
      extractWithCanvas(),
      extractWithMediaBunny()
    ]);
  }, [extractWithCanvas, extractWithMediaBunny]);

  const downloadFirstFrames = useCallback(() => {
    const downloadFrame = (dataUrl: string, filename: string) => {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (extractedFrames.canvas.length > 0) {
      downloadFrame(extractedFrames.canvas[0], 'canvas-first-frame.jpg');
    }

    if (extractedFrames.mediaBunny.length > 0) {
      downloadFrame(extractedFrames.mediaBunny[0], 'mediabunny-first-frame.jpg');
    }

    if (extractedFrames.canvas.length === 0 && extractedFrames.mediaBunny.length === 0) {
      alert('No frames extracted yet. Run tests first.');
    }
  }, [extractedFrames]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getSpeedupFactor = () => {
    if (canvasMetrics.status === 'completed' && mediaBunnyMetrics.status === 'completed') {
      return (canvasMetrics.extractionTime / mediaBunnyMetrics.extractionTime).toFixed(1);
    }
    return null;
  };

  const isWebCodecsSupported = typeof window !== 'undefined' && 'VideoDecoder' in window;

  if (!mounted) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Frame Extraction Performance Test</h1>
        <p className="text-muted-foreground">
          Compare performance between Canvas-based extraction and MediaBunny
        </p>
        {!isWebCodecsSupported && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WebCodecs API is not supported in this browser. MediaBunny tests will fail. 
              Try Chrome 94+, Firefox 133+, or Edge 94+ for full compatibility.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="video-upload">Video File</Label>
            <Input
              id="video-upload"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fps">Frames Per Second</Label>
              <Input
                id="fps"
                type="number"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                min={1}
                max={60}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frame-count">Max Frames to Extract</Label>
              <Input
                id="frame-count"
                type="number"
                value={frameCount}
                onChange={(e) => setFrameCount(Number(e.target.value))}
                min={1}
                max={100}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={extractWithCanvas} 
              disabled={!videoFile || canvasMetrics.status === 'running'}
            >
              <Clock className="mr-2 h-4 w-4" />
              Test Canvas Method
            </Button>
            <Button 
              onClick={extractWithMediaBunny} 
              disabled={!videoFile || mediaBunnyMetrics.status === 'running' || !isWebCodecsSupported}
            >
              <Zap className="mr-2 h-4 w-4" />
              Test MediaBunny
            </Button>
            <Button 
              onClick={runBothTests} 
              disabled={!videoFile || canvasMetrics.status === 'running' || mediaBunnyMetrics.status === 'running' || !isWebCodecsSupported}
              variant="default"
            >
              Run Both Tests
            </Button>
            <Button 
              onClick={downloadFirstFrames} 
              disabled={extractedFrames.canvas.length === 0 && extractedFrames.mediaBunny.length === 0}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download First Frames
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <MetricsCard metrics={canvasMetrics} formatTime={formatTime} />
        <MetricsCard metrics={mediaBunnyMetrics} formatTime={formatTime} />
      </div>

      {getSpeedupFactor() && (
        <Alert className="mb-6">
          <Zap className="h-4 w-4" />
          <AlertDescription>
            MediaBunny is <strong>{getSpeedupFactor()}x faster</strong> than the Canvas method
          </AlertDescription>
        </Alert>
      )}

      {(extractedFrames.canvas.length > 0 || extractedFrames.mediaBunny.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Frames (First 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {extractedFrames.canvas.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Canvas Method</h3>
                <div className="flex gap-2 overflow-x-auto">
                  {extractedFrames.canvas.map((frame, i) => (
                    <Image
                      key={i}
                      src={frame}
                      alt={`Canvas frame ${i}`}
                      className="h-24 object-contain border rounded"
                      width={96}
                      height={96}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {extractedFrames.mediaBunny.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">MediaBunny</h3>
                <div className="flex gap-2 overflow-x-auto">
                  {extractedFrames.mediaBunny.map((frame, i) => (
                    <Image
                      key={i}
                      src={frame}
                      alt={`MediaBunny frame ${i}`}
                      className="h-24 object-contain border rounded"
                      width={96}
                      height={96}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricsCard({ metrics, formatTime }: { 
  metrics: PerformanceMetrics; 
  formatTime: (ms: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {metrics.method}
          {metrics.status === 'running' && (
            <span className="text-sm text-muted-foreground">Running...</span>
          )}
          {metrics.status === 'completed' && (
            <span className="text-sm text-green-600">✓ Complete</span>
          )}
          {metrics.status === 'error' && (
            <span className="text-sm text-red-600">✗ Error</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.status === 'running' && (
          <Progress value={50} className="animate-pulse" />
        )}
        
        {metrics.status === 'completed' && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Time:</span>
                <p className="font-semibold">{formatTime(metrics.extractionTime)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Frames:</span>
                <p className="font-semibold">{metrics.totalFrames}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Speed:</span>
                <p className="font-semibold">{metrics.framesPerSecond.toFixed(1)} fps</p>
              </div>
              <div>
                <span className="text-muted-foreground">Per Frame:</span>
                <p className="font-semibold">{formatTime(metrics.averageFrameTime)}</p>
              </div>
            </div>
          </>
        )}
        
        {metrics.status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{metrics.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}