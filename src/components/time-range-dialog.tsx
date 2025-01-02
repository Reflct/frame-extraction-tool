"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VideoRangeSelector } from "@/components/video-range-selector"

interface TimeRangeDialogProps {
  duration: number
  timeRange: [number, number]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTimeRangeChangeAction: (range: [number, number]) => void
}

export function TimeRangeDialog({
  duration,
  timeRange,
  videoRef,
  onTimeRangeChangeAction,
}: TimeRangeDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [localRange, setLocalRange] = React.useState(timeRange)
  const startPreviewRef = React.useRef<HTMLVideoElement>(null)
  const endPreviewRef = React.useRef<HTMLVideoElement>(null)

  // Reset local range when dialog opens
  React.useEffect(() => {
    if (open) {
      setLocalRange(timeRange)
    }
  }, [open, timeRange])

  // Update preview videos when range changes
  React.useEffect(() => {
    if (startPreviewRef.current) {
      startPreviewRef.current.currentTime = localRange[0]
    }
    if (endPreviewRef.current) {
      endPreviewRef.current.currentTime = localRange[1]
    }
  }, [localRange])

  const handleRangeChange = (range: [number, number]) => {
    setLocalRange(range)
  }

  const handleSave = () => {
    onTimeRangeChangeAction(localRange)
    setOpen(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Time Range: {formatTime(timeRange[0])} - {formatTime(timeRange[1])}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Time Range</DialogTitle>
          <DialogDescription>
            Choose the start and end times for frame extraction
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <VideoRangeSelector
            duration={duration}
            onRangeChangeAction={handleRangeChange}
            videoRef={videoRef}
          />
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Start Frame</div>
              {videoRef.current && (
                <video
                  ref={startPreviewRef}
                  src={videoRef.current.src}
                  className="w-full h-auto rounded-lg object-contain"
                  controls={false}
                />
              )}
              <div className="text-sm text-muted-foreground text-center">
                {formatTime(localRange[0])}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">End Frame</div>
              {videoRef.current && (
                <video
                  ref={endPreviewRef}
                  src={videoRef.current.src}
                  className="w-full h-auto rounded-lg object-contain"
                  controls={false}
                />
              )}
              <div className="text-sm text-muted-foreground text-center">
                {formatTime(localRange[1])}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Range</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
