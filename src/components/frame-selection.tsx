'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

interface FrameSelectionProps {
  selectionMode: 'percentage' | 'batched' | 'manual';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  onSelectionModeChangeAction: (mode: 'percentage' | 'batched' | 'manual') => void;
  onPercentageThresholdChangeAction: (value: number) => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
  onSelectAllAction?: () => void;
  onDeselectAllAction?: () => void;
  processing: boolean;
}

interface NumberInputProps { 
  value: number;
  onChange: (value: number) => void;
  min: number;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const NumberInput = ({ 
  value, 
  onChange, 
  min,
  label,
  className = "",
  disabled = false
}: NumberInputProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8"
          disabled={disabled}
        >
          -
        </Button>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || min)}
          min={min}
          className="w-20 text-center"
          disabled={disabled}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8"
          disabled={disabled}
        >
          +
        </Button>
      </div>
    </div>
  );
};

export function FrameSelection({
  selectionMode,
  percentageThreshold,
  batchSize,
  batchBuffer,
  onSelectionModeChangeAction,
  onPercentageThresholdChangeAction,
  onBatchSizeChangeAction,
  onBatchBufferChangeAction,
  processing
}: FrameSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <Tabs 
          defaultValue="batched" 
          value={selectionMode} 
          onValueChange={(value: string) => {
            if (value === 'percentage' || value === 'batched' || value === 'manual') {
              onSelectionModeChangeAction(value);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-3 gap-2 p-0 bg-transparent">
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
            <TabsTrigger 
              value="manual"
              className="border data-[state=active]:border-dark data-[state=inactive]:border-gray data-[state=active]:bg-transparent data-[state=inactive]:text-gray"
            >
              Manual Selection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="batched" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select frames in batches to reduce redundancy. You can also manually select additional frames using A/D keys.
                <br />- Batch Size: Number of frames to select from each segment
                <br />- Buffer Size: Number of frames to skip between segments
              </p>
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  value={batchSize}
                  onChange={onBatchSizeChangeAction}
                  min={1}
                  label="Batch Size"
                  disabled={processing}
                />
                <NumberInput
                  value={batchBuffer}
                  onChange={onBatchBufferChangeAction}
                  min={0}
                  label="Buffer Size"
                  disabled={processing}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="percentage" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select frames based on sharpness score. Higher percentage includes more frames.
                <br />You can also manually select additional frames using A/D keys.
              </p>
              <Slider
                value={[percentageThreshold]}
                onValueChange={([value]) => onPercentageThresholdChangeAction(value)}
                min={1}
                max={100}
                step={1}
                disabled={processing}
              />
              <div className="text-sm">Top {percentageThreshold}% of frames</div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manually select frames using A/D keys while hovering over them in the histogram or frame grid.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
