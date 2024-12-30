'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ClearCacheDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onConfirmAction: () => void;
  frameCount: number;
}

export const ClearCacheDialog: React.FC<ClearCacheDialogProps> = ({
  open,
  onOpenChangeAction,
  onConfirmAction,
  frameCount,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <DialogTitle>Clear Existing Frames?</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {frameCount} {frameCount === 1 ? 'frame has' : 'frames have'} already been extracted. 
            Do you want to clear them and extract frames from the new video?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChangeAction(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirmAction}>
            Clear and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
