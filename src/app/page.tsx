'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { extractFramesInBrowser } from '@/lib/browserFrameExtraction';
import { calculateBlurScore } from '@/lib/opencvUtils';
import { frameStorage } from '@/lib/frameStorage';
import { downloadAsZip, type FrameData } from '@/lib/zipUtils';
import { getVideoMetadata, type VideoMetadata } from '@/lib/videoUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, YAxis, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClearCacheDialog } from '@/components/ui/clear-cache-dialog';
import Image from 'next/image';
import { clsx } from 'clsx';

interface ProgressInfo {
  current: number;
  total: number;
  startTime?: number;
  estimatedTimeMs?: number;
}

interface ExtractPageState {
  videoFile: File | null;
  videoMetadata: VideoMetadata | null;
  fps: number;
  format: 'jpeg' | 'png';
  frames: FrameData[];
  processing: boolean;
  loadingMetadata: boolean;
  videoThumbnailUrl: string | null;
  extractionProgress: ProgressInfo;
  blurProgress: ProgressInfo;
  selectionMode: 'percentage' | 'batched';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  error: string | null;
  showFrames: boolean;
  showClearCacheDialog: boolean;
  pendingFile: File | null;
}

interface ChartData {
  name: string;
  blurScore: number;
  selected: boolean;
}

const getSelectedFramesCount = (state: ExtractPageState) => {
  const frames = getSelectedFrames(state);
  return frames.length;
};

const getSelectedFrames = (state: ExtractPageState) => {
  switch (state.selectionMode) {
    case 'percentage':
      // Sort frames by blur score in descending order and take top percentage
      const sortedFrames = [...state.frames].sort((a, b) => 
        (b.blurScore ?? 0) - (a.blurScore ?? 0)
      );
      const topPercentage = Math.floor(sortedFrames.length * (state.percentageThreshold / 100));
      return sortedFrames.slice(0, topPercentage);
    case 'batched':
      // Process frames in batches, selecting the best frame from each batch
      const selectedFrames: FrameData[] = [];
      for (let i = 0; i < state.frames.length; i += state.batchSize + state.batchBuffer) {
        // Get current batch of frames
        const batch = state.frames.slice(i, i + state.batchSize);
        if (batch.length === 0) break;
        
        // Find frame with highest blur score in batch
        const bestFrame = batch.reduce((best, current) => 
          (current.blurScore ?? 0) > (best.blurScore ?? 0) ? current : best
        , batch[0]);
        
        selectedFrames.push(bestFrame);
      }
      return selectedFrames;
    default:
      return [];
  }
};

const getChartData = (state: ExtractPageState) => {
  return state.frames.map(frame => ({
    name: frame.fileName.replace(/^frame_(\d+)\..*$/, '$1'),
    blurScore: frame.blurScore ?? 0,
    selected: getSelectedFrames(state).includes(frame)
  } as ChartData));
};

const NumberInput = ({ 
  value, 
  onChange, 
  min,
  label,
  className = ""
}: { 
  value: number, 
  onChange: (value: number) => void, 
  min: number,
  label?: string,
  className?: string
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8"
        >
          -
        </Button>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || min)}
          min={min}
          className="w-20 text-center"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8"
        >
          +
        </Button>
      </div>
    </div>
  );
};

export default function ExtractPage() {
  const [state, setState] = useState<ExtractPageState>({
    videoFile: null,
    videoMetadata: null,
    fps: 1,
    format: 'jpeg',
    frames: [],
    processing: false,
    loadingMetadata: false,
    videoThumbnailUrl: null,
    extractionProgress: { current: 0, total: 0 },
    blurProgress: { current: 0, total: 0 },
    selectionMode: 'batched',
    percentageThreshold: 25,
    batchSize: 3,
    batchBuffer: 1,
    error: null,
    showFrames: false,
    showClearCacheDialog: false,
    pendingFile: null
  });

  const processNewFile = useCallback(async (file: File) => {
    const thumbnailUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      videoFile: file,
      videoThumbnailUrl: thumbnailUrl,
      loadingMetadata: true,
      error: null
    }));

    try {
      const metadata = await getVideoMetadata(file);
      setState(prev => ({
        ...prev,
        videoMetadata: metadata,
        loadingMetadata: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to load video metadata: ${error}`,
        loadingMetadata: false
      }));
    }
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (state.frames.length > 0) {
        setState(prev => ({
          ...prev,
          showClearCacheDialog: true,
          pendingFile: file
        }));
      } else {
        await processNewFile(file);
      }
    }
  }, [state.frames.length, processNewFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files[0];
    if (file) {
      if (state.frames.length > 0) {
        setState(prev => ({
          ...prev,
          showClearCacheDialog: true,
          pendingFile: file
        }));
      } else {
        await processNewFile(file);
      }
    }
  }, [state.frames.length, processNewFile]);

  const handleClearCache = useCallback(async () => {
    try {
      await frameStorage.clear();
      setState(prev => ({
        ...prev,
        frames: [],
        showClearCacheDialog: false,
        pendingFile: null,
        error: null,
        videoFile: null,
        videoMetadata: null,
        videoThumbnailUrl: null,
        processing: false,
        loadingMetadata: false,
        extractionProgress: { current: 0, total: 0 },
        blurProgress: { current: 0, total: 0 }
      }));

      // Only open file explorer if we have a pending file (replacing video)
      if (state.pendingFile) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            await processNewFile(file);
          }
        };
        input.click();
      }
    } catch {
      setState(prev => ({
        ...prev,
        showClearCacheDialog: false,
        error: 'Failed to clear cache. Please try refreshing the page.' 
      }));
    }
  }, [processNewFile, state.pendingFile]);

  const handleExtractFrames = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        processing: true,
        error: null,
        extractionProgress: { current: 0, total: 0, startTime: Date.now() },
        blurProgress: { current: 0, total: 0 }
      }));

      await extractFramesInBrowser(
        state.videoFile!,
        state.fps,
        state.format,
        0.9,
        (current, total) => {
          setState(prev => {
            const progress = prev.extractionProgress;
            const elapsedMs = Date.now() - (progress.startTime || Date.now());
            const msPerFrame = current > 0 ? elapsedMs / current : 0;
            const remainingFrames = total - current;
            const estimatedTimeMs = msPerFrame * remainingFrames;

            return {
              ...prev,
              extractionProgress: { 
                current, 
                total,
                startTime: progress.startTime,
                estimatedTimeMs
              }
            };
          });
        }
      );

      // Load frames from storage
      const storedFrames = await frameStorage.getAllFrames();
      
      // Update blur calculation progress state
      setState(prev => ({
        ...prev,
        blurProgress: { 
          current: 0, 
          total: storedFrames.length,
          startTime: Date.now()
        }
      }));

      console.log('Starting blur calculation...');
      
      // Process frames in batches for blur detection
      const framesWithBlur: FrameData[] = [];
      for (let i = 0; i < storedFrames.length; i++) {
        const frame = storedFrames[i];
        const blurScore = await calculateBlurScore(frame.blob);
        framesWithBlur.push({
          ...frame,
          blurScore
        });

        // Update progress
        setState(prev => {
          const progress = prev.blurProgress;
          const elapsedMs = Date.now() - (progress.startTime || Date.now());
          const msPerFrame = (i + 1) > 0 ? elapsedMs / (i + 1) : 0;
          const remainingFrames = storedFrames.length - (i + 1);
          const estimatedTimeMs = msPerFrame * remainingFrames;

          return {
            ...prev,
            blurProgress: {
              current: i + 1,
              total: storedFrames.length,
              startTime: progress.startTime,
              estimatedTimeMs
            }
          };
        });
      }

      console.log('Processing complete!');

      setState(prev => ({
        ...prev,
        frames: framesWithBlur,
        processing: false,
        extractionProgress: { current: 0, total: 0 },
        blurProgress: { current: 0, total: 0 }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        processing: false,
        error: `Failed to extract frames: ${error}`,
        extractionProgress: { current: 0, total: 0 },
        blurProgress: { current: 0, total: 0 }
      }));
    }
  }, [state.videoFile, state.fps, state.format]);

  const handleDownload = useCallback(async () => {
    const selectedFrames = getSelectedFrames(state);
    if (selectedFrames.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'No frames selected for download'
      }));
      return;
    }

    try {
      await downloadAsZip(selectedFrames);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to download frames: ${error}`
      }));
    }
  }, [state]);

  useEffect(() => {
    // Clean up video thumbnail URL when it changes
    return () => {
      if (state.videoThumbnailUrl) {
        URL.revokeObjectURL(state.videoThumbnailUrl);
      }
    };
  }, [state.videoThumbnailUrl]);

  return (
    <div className="min-h-screen bg-[#E0E0E0]">
      <div className="container mx-auto space-y-4 relative pb-20">
        {/* Fixed Header Bar */}
        <div className="fixed top-3 px-7 left-0 right-0 z-50">
          <div className="container mx-auto">
            <Card className="rounded-[1.125rem] bg-white">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <a href="https://reflct.app" target="_blank" rel="noopener noreferrer">
                    <Image src="/Full Logo Vector.svg" alt="Logo" width={120} height={32} className="h-8 w-auto" />
                  </a>
                </div>
                <div className="flex items-center gap-6">
                  <a 
                    href="https://discord.gg/rfYNxSw3yx" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-dm-mono text-[#111214] text-sm font-medium uppercase leading-[100%] text-edge-cap"
                  >
                    Discord
                  </a>
                  <a 
                    href="https://reflct.app" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-dm-mono text-[#111214] text-sm font-medium uppercase leading-[100%] text-edge-cap"
                  >
                    Reflct.app
                  </a>
                  <Button
                    onClick={handleDownload}
                    disabled={state.frames.length === 0}
                    className={`flex h-10 p-3 justify-center items-center gap-1 bg-[#3190ff] hover:bg-[#2170df] ${state.frames.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Download className="w-4 h-4" />
                    <span 
                      className="font-dm-mono text-white text-sm font-medium uppercase leading-[100%] text-edge-cap"
                    >
                      Download Frames {state.frames.length > 0 && `(${getSelectedFramesCount(state)})`}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content - Adjust padding top to account for new header height */}
        <div className="pt-28 space-y-8">
          {/* Description Section */}
          <div className="max-w-3xl pl-7">
            <h1 className="text-[64px] font-medium mb-4">Frame extraction tool</h1>
            <p className="text-lg text-gray-700">
              Extract full size frames from your video, with blur detection and smart frame selection 
              designed for 3DGS and NeRF dataset preparation. Frame selection 
              inspired by <a href="https://github.com/SharkWipf/nerf_dataset_preprocessing_helper" target="_blank" rel="noopener noreferrer" className="text-[#3190ff]">SharkWipf.</a>
            </p>
            <p className="text-lg text-gray-700 mt-4">All processing happens in your browser, <span className="font-bold">we will never see or store your data.</span></p>
            <p className="text-lg text-gray-700 mt-4">This tool is a work in progress.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-7">
            {/* Upload Card */}
            <Card className="rounded-[14px] border border-[#E0E0E0] bg-white">
              <div className="m-4">
                <div
                  className={clsx(
                    "flex flex-col items-center justify-center rounded-lg",
                    !state.videoFile ? "border-2 border-dashed border-gray-200 p-8" : ""
                  )}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {state.videoFile ? (
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold text-left">{state.videoFile.name}</h2>
                      {/* Video and Metadata */}
                      <div className="flex gap-12">
                        {/* Video Thumbnail and Replace Button */}
                        <div className="w-1/2 space-y-4">
                          {state.videoThumbnailUrl && (
                            <video 
                              className="w-full h-auto rounded-lg"
                              src={state.videoThumbnailUrl}
                              controls={false}
                            />
                          )}
                          <Button 
                            variant="secondary"
                            onClick={() => {
                              setState(prev => ({ ...prev, showClearCacheDialog: true }));
                            }}
                          >
                            Replace Video
                          </Button>
                        </div>
                        {/* Metadata */}
                        {state.videoMetadata && (
                          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-left">
                            <div>
                              <dt className="text-gray-500 mb-1 font-semibold">Duration:</dt>
                              <dd>{state.videoMetadata.duration.toFixed(2)}s</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 mb-1 font-semibold">Resolution:</dt>
                              <dd>{state.videoMetadata.width}x{state.videoMetadata.height}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 mb-1 font-semibold">FPS:</dt>
                              <dd>{state.videoMetadata.fps} fps</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 mb-1 font-semibold">Frames:</dt>
                              <dd>{state.videoMetadata.totalFrames}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 mb-1 font-semibold">Codec:</dt>
                              <dd>{state.videoMetadata.codec}</dd>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p>Drag and drop your video here, or click to select</p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="video-upload"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => document.getElementById('video-upload')?.click()}
                        className="mt-4"
                      >
                        Select Video
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Extraction Settings Card - Only shown when video is loaded */}
            {state.videoMetadata && (
              <Card className="rounded-[14px] border border-[#E0E0E0] bg-white">
                <div className="m-4">
                  <h2 className="text-xl font-semibold mb-4">Extraction Settings</h2>
                  {!state.processing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Frame Rate (fps)</label>
                        <Input
                          type="number"
                          value={state.fps}
                          onChange={(e) => setState(prev => ({ ...prev, fps: parseFloat(e.target.value) }))}
                          min={0.1}
                          step={0.1}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Format</label>
                        <select
                          value={state.format}
                          onChange={(e) => setState(prev => ({ ...prev, format: e.target.value as 'jpeg' | 'png' }))}
                          className="w-full p-2 border rounded"
                        >
                          <option value="jpeg">JPEG</option>
                          <option value="png">PNG</option>
                        </select>
                      </div>
                      <Button onClick={handleExtractFrames} className="w-full">
                        Extract Frames
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Progress Indicators */}
                      {state.processing && (
                        <div className="space-y-4">
                          {state.extractionProgress.total > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Extracting Frames...</span>
                                <span>
                                  {Math.round((state.extractionProgress.current / state.extractionProgress.total) * 100)}%
                                  {state.extractionProgress.estimatedTimeMs && (
                                    <span className="ml-2 text-muted-foreground">
                                      ({Math.ceil(state.extractionProgress.estimatedTimeMs / 1000)}s remaining)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <Progress value={(state.extractionProgress.current / state.extractionProgress.total) * 100} />
                            </div>
                          )}
                          {state.blurProgress.total > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Calculating Blur Scores...</span>
                                <span>
                                  {Math.round((state.blurProgress.current / state.blurProgress.total) * 100)}%
                                  {state.blurProgress.estimatedTimeMs && (
                                    <span className="ml-2 text-muted-foreground">
                                      ({Math.ceil(state.blurProgress.estimatedTimeMs / 1000)}s remaining)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <Progress value={(state.blurProgress.current / state.blurProgress.total) * 100} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Error Alert */}
          {state.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Frame Selection Card */}
          {state.frames.length > 0 && (
            <div className="px-7">
              <Card className="text-card-foreground shadow rounded-[14px] border border-[#E0E0E0] bg-white">
                <div className="m-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Frame Selection</h2>
                    <Button
                      variant="outline"
                      onClick={() => setState(prev => ({ ...prev, showFrames: !prev.showFrames }))}
                    >
                      {state.showFrames ? 'Hide Frames' : 'Show Frames'}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {/* Selection Controls */}
                    <div className="space-y-4">
                      <div className="max-w-2xl">
                        <Tabs defaultValue="batched" value={state.selectionMode} onValueChange={(value) => setState(prev => ({ ...prev, selectionMode: value as 'percentage' | 'batched' }))}>
                          <TabsList className="grid w-full grid-cols-2 gap-2 p-0 bg-transparent">
                            <TabsTrigger 
                              value="batched"
                              className="border data-[state=active]:border-dark data-[state=inactive]:border-gray data-[state=active]:bg-transparent data-[state=inactive]:text-gray"
                            >
                              Batch Selection
                            </TabsTrigger>
                            <TabsTrigger 
                              value="percentage" 
                              className="border data-[state=active]:border-dark data-[state=inactive]:border-gray data-[state=active]:bg-transparent data-[state=inactive]:text-gray"
                            >
                              Top Percentage
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="batched">
                            <div className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <div>
                                  <label className="text-sm font-bold">Batch Size</label>
                                  <p className="text-sm text-dark mt-1">The best frame is selected from each batch.</p>
                                </div>
                                <NumberInput
                                  value={state.batchSize}
                                  onChange={(value) => setState(prev => ({ ...prev, batchSize: value }))}
                                  min={1}
                                  className="w-48"
                                />
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <label className="text-sm font-bold">Buffer Size</label>
                                  <p className="text-sm text-dark mt-1">Number of frames to skip between batches. Can be zero.</p>
                                </div>
                                <NumberInput
                                  value={state.batchBuffer}
                                  onChange={(value) => setState(prev => ({ ...prev, batchBuffer: value }))}
                                  min={0}
                                  className="w-48"
                                />
                              </div>
                            </div>
                          </TabsContent>
                          <TabsContent value="percentage">
                            <div className="space-y-2 pt-4">
                              <div>
                                <label className="text-sm font-bold">Top Percentage</label>
                                <div className="flex items-center gap-4 mt-2">
                                  <Slider
                                    value={[state.percentageThreshold]}
                                    onValueChange={([value]) => setState(prev => ({ ...prev, percentageThreshold: value }))}
                                    max={100}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <span className="text-sm w-12 text-right">{state.percentageThreshold}%</span>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>

                    {/* Histogram */}
                    <div style={{ width: '100%', height: '200px' }}>
                      <ResponsiveContainer>
                        <BarChart data={getChartData(state)}>
                          <YAxis />
                          <XAxis label={{ value: 'Frames', position: 'insideBottomRight', offset: -10 }} hide />
                          <Tooltip />
                          <Bar dataKey="blurScore">
                            {getChartData(state).map((entry) => (
                              <Cell 
                                key={entry.name}
                                fill={entry.selected ? '#3190ff' : '#94a3b8'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Frame Grid */}
                    {state.showFrames && (
                      <div className="mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {state.frames.map(frame => {
                            const frameNumber = frame.fileName.match(/frame_(\d+)/)?.[1] || '0';
                            const paddedNumber = frameNumber.padStart(4, '0');
                            return (
                              <div key={frame.fileName} className="relative">
                                <Image
                                  src={URL.createObjectURL(frame.blob)}
                                  alt={`Frame ${paddedNumber}`}
                                  width={320}
                                  height={180}
                                  className="w-full h-auto rounded-lg shadow-md"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
                                  <p className="text-sm text-center">
                                    frame_{paddedNumber} Blur: {Math.round(frame.blurScore || 0)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Clear Cache Dialog */}
          <ClearCacheDialog 
            open={state.showClearCacheDialog}
            onCloseAction={() => setState(prev => ({ ...prev, showClearCacheDialog: false }))}
            onConfirmAction={handleClearCache}
          />
        </div>
      </div>
    </div>
  );
}
