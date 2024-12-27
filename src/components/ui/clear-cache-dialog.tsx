'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ClearCacheDialogProps {
  open: boolean;
  onCloseAction: () => void;
  onConfirmAction: () => void;
}

export function ClearCacheDialog({ open, onCloseAction, onConfirmAction }: ClearCacheDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCloseAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear Cached Files</DialogTitle>
          <DialogDescription>
            Previous files are still in the cache. Please make sure you have downloaded any files you want to keep, as they will be deleted when you proceed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCloseAction}>Cancel</Button>
          <Button onClick={onConfirmAction}>Clear and Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
