'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type DownloadMode = 'chunked' | 'all';

interface DownloadOptionsDialogProps {
  open: boolean;
  frameCount: number;
  onClose: () => void;
  onConfirm: (mode: DownloadMode) => void;
  isLoading?: boolean;
}

export function DownloadOptionsDialog({
  open,
  frameCount,
  onClose,
  onConfirm,
  isLoading = false,
}: DownloadOptionsDialogProps) {
  const [selectedMode, setSelectedMode] = useState<DownloadMode>('all');

  const handleConfirm = () => {
    onConfirm(selectedMode);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
          <DialogDescription>
            You have selected {frameCount.toLocaleString()} frames. How would you like to download?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {/* Download All Option */}
          <div
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedMode === 'all'
                ? 'border-[#3190ff] bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedMode('all')}
          >
            <div className="flex items-start space-x-3">
              <div
                className={`w-4 h-4 rounded-full border-2 mt-1 flex items-center justify-center flex-shrink-0 ${
                  selectedMode === 'all'
                    ? 'border-[#3190ff] bg-[#3190ff]'
                    : 'border-gray-300'
                }`}
              >
                {selectedMode === 'all' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Download All at Once
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Faster download, but can crash if you have a lot of large frames. Requires more memory.
                </p>
              </div>
            </div>
          </div>

          {/* Chunked Option */}
          <div
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedMode === 'chunked'
                ? 'border-[#3190ff] bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedMode('chunked')}
          >
            <div className="flex items-start space-x-3">
              <div
                className={`w-4 h-4 rounded-full border-2 mt-1 flex items-center justify-center flex-shrink-0 ${
                  selectedMode === 'chunked'
                    ? 'border-[#3190ff] bg-[#3190ff]'
                    : 'border-gray-300'
                }`}
              >
                {selectedMode === 'chunked' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Chunked Download (Safer)
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Downloads in chunks of around 1,000 frames. If you see download errors, try this.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Files: chunk-001.zip, chunk-002.zip, etc.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-[#3190ff] hover:bg-[#2170df]"
          >
            {isLoading ? 'Downloading...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
