'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

interface FrameSelectionProps {
  selectionMode: 'percentage' | 'batched';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  onSelectionModeChangeAction: (mode: 'percentage' | 'batched') => void;
  onPercentageThresholdChangeAction: (value: number) => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
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
            if (value === 'percentage' || value === 'batched') {
              onSelectionModeChangeAction(value);
            }
          }}
        >
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
                  value={batchSize}
                  onChange={onBatchSizeChangeAction}
                  min={1}
                  className="w-48"
                  disabled={processing}
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-bold">Buffer Size</label>
                  <p className="text-sm text-dark mt-1">Number of frames to skip between batches. Can be zero.</p>
                </div>
                <NumberInput
                  value={batchBuffer}
                  onChange={onBatchBufferChangeAction}
                  min={0}
                  className="w-48"
                  disabled={processing}
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
                    value={[percentageThreshold]}
                    onValueChange={([value]) => onPercentageThresholdChangeAction(value)}
                    max={100}
                    step={1}
                    className="flex-1"
                    disabled={processing}
                  />
                  <span className="text-sm w-12 text-right">{percentageThreshold}%</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
