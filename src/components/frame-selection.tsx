'use client';

import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface FrameSelectionProps {
  batchSize: number;
  batchBuffer: number;
  bestNCount: number;
  bestNMinGap: number;
  onSelectionModeChangeAction: (mode: 'batched' | 'manual' | 'best-n') => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
  onBestNCountChangeAction: (count: number) => void;
  onBestNMinGapChangeAction: (gap: number) => void;
}

export function FrameSelection({
  batchSize,
  batchBuffer,
  bestNCount,
  bestNMinGap,
  onSelectionModeChangeAction,
  onBatchSizeChangeAction,
  onBatchBufferChangeAction,
  onBestNCountChangeAction,
  onBestNMinGapChangeAction,
}: FrameSelectionProps) {
  const selectionModes = [
    {
      value: 'batched',
      label: 'Batch Selection',
      description: 'Select the sharpest frame from each batch of frames',
    },
    {
      value: 'best-n',
      label: 'Best N Selection',
      description: 'Select N frames with highest sharpness scores, evenly distributed',
    },
    {
      value: 'manual',
      label: 'Manual Selection',
      description: 'Manually select frames using the A key',
    },
  ] as const;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Frame Selection</CardTitle>
        <CardDescription>Choose how frames are selected for extraction</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="batched" onValueChange={(value: string) => {
          if (value === 'batched' || value === 'manual' || value === 'best-n') {
            onSelectionModeChangeAction(value);
          }
        }}>
          <TabsList className="grid w-full grid-cols-3">
            {selectionModes.map(mode => (
              <TabsTrigger key={mode.value} value={mode.value}>
                {mode.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {selectionModes.map(mode => (
            <TabsContent key={mode.value} value={mode.value}>
              <p className="text-sm text-muted-foreground mb-4">
                {mode.description}
              </p>
              {mode.value === 'batched' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label>Batch Size</Label>
                    <Input
                      type="number"
                      value={batchSize}
                      onChange={e => onBatchSizeChangeAction(parseInt(e.target.value))}
                      min={1}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of frames to consider in each batch
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Batch Buffer</Label>
                    <Input
                      type="number"
                      value={batchBuffer}
                      onChange={e => onBatchBufferChangeAction(parseInt(e.target.value))}
                      min={0}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of frames to skip between batches
                    </p>
                  </div>
                </div>
              )}
              {mode.value === 'best-n' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label>Number of Frames</Label>
                    <Input
                      type="number"
                      value={bestNCount}
                      onChange={e => onBestNCountChangeAction(parseInt(e.target.value))}
                      min={1}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of frames to select
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Minimum Gap</Label>
                    <Input
                      type="number"
                      value={bestNMinGap}
                      onChange={e => onBestNMinGapChangeAction(parseInt(e.target.value))}
                      min={0}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Minimum number of frames between selected frames
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
